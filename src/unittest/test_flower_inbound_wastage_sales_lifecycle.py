# -*- coding: utf-8 -*-
"""
Unit tests for Complete Flower Lifecycle:
1. Nhập hàng (Inbound / Requisition Fulfillment & Stock Increment).
2. Báo hỏng (Wastage Reporting, Spoiled Stems, & Safety Caps).
3. Bán hàng (Sales Orders & Stock Deduction: Direct Stems + Arranged Recipes).
4. Thống kê số hoa còn lại (Inventory Balance: Closing = Opening + Inbound - Sold - Wastage).
5. Phân lập tồn kho đa chi nhánh (Multi-branch Isolation).
6. Khóa vĩnh viễn báo hỏng khi Admin đóng đơn sau 2-3 ngày (Closed Status Immutable).
"""

import os
import sys
import unittest
import shutil
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from data_service import (
    get_materials,
    save_materials,
    get_material_by_id,
    update_material_stock,
    get_products,
    save_products,
    get_wastage_reports,
    save_wastage_reports,
    get_config_path,
    read_json,
    write_json,
    get_all_orders_across_all_months,
)
from inventory_service import (
    create_purchase_request,
    update_purchase_request_status,
    fulfill_purchase_request,
    create_inbound_receipt,
    get_inbound_receipts,
    create_wastage_report,
    deduct_order_materials,
    calculate_order_cogs_and_profit,
    get_monthly_inventory_report,
    get_inventory_matrix,
    get_product_stock_for_branch,
)


class TestFlowerInboundWastageSalesLifecycle(unittest.TestCase):
    """Bộ kiểm thử khép kín vòng đời hoa: Nhập kho -> Báo hỏng -> Bán hàng -> Thống kê số hoa còn lại."""

    def setUp(self):
        # 1. Backup trạng thái dữ liệu trước khi test
        self.original_materials = [dict(m) for m in get_materials()]
        self.original_products = [dict(p) for p in get_products()]
        self.original_wastage = [dict(w) for w in get_wastage_reports()]

        self.req_path = get_config_path("purchase_requests.json")
        self.original_requests = read_json(self.req_path, default=[])

        self.test_branch = "branch_q10"
        self.test_branch_other = "branch_q1"

        # Định danh hoa test
        self.flower_rose = "test_mat_rose_red_ecua"
        self.flower_tana = "test_mat_daisy_tana_test"

        # Khởi tạo nguyên liệu hoa cành với số tồn ban đầu xác định
        # Rose: Q10 = 20 cành, Q1 = 15 cành
        # Tana: Q10 = 10 cành, Q1 = 5 cành
        prods = get_products()
        prods = [p for p in prods if p.get("id") not in [self.flower_rose, self.flower_tana]]
        prods.append({
            "id": self.flower_rose,
            "name": "Hoa Hồng Đỏ Explorer Ecuador",
            "category": "flower_main",
            "productType": "direct",
            "unit": "cành",
            "costPrice": 20000,
            "priceNumber": 35000,
            "stockByBranch": {self.test_branch: 20, self.test_branch_other: 15},
            "dailyQuota": 35,
            "isActive": True
        })
        prods.append({
            "id": self.flower_tana,
            "name": "Cúc Tana Nhỏ Đà Lạt",
            "category": "flower_filler",
            "productType": "direct",
            "unit": "cành",
            "costPrice": 5000,
            "priceNumber": 10000,
            "stockByBranch": {self.test_branch: 10, self.test_branch_other: 5},
            "dailyQuota": 15,
            "isActive": True
        })
        save_products(prods)

        # Chuẩn bị user giả lập
        self.user_manager = {
            "id": "staff_001",
            "fullName": "Trần Thị Mai",
            "role": "branch_manager",
            "branchId": self.test_branch
        }
        self.user_florist = {
            "id": "staff_002",
            "fullName": "Lê Thị Cẩm Tú",
            "role": "florist",
            "branchId": self.test_branch
        }
        self.user_admin = {
            "id": "staff_admin",
            "fullName": "Tổng Quản Trị Hệ Thống",
            "role": "super_admin"
        }

    def tearDown(self):
        # Khôi phục dữ liệu nguyên trạng sau khi test xong
        save_products(self.original_products)
        save_materials(self.original_materials)
        save_wastage_reports(self.original_wastage)
        if os.path.exists(self.req_path):
            write_json(self.req_path, self.original_requests)

    def test_01_inbound_flower_intake_and_stock_increment(self):
        """
        [1. NHẬP HÀNG]
        - Lập đề xuất nhập hàng (50 cành hồng, 30 cành cúc tana)
        - Duyệt đề xuất -> Xử lý nhập kho thực tế (50 cành hồng, 30 cành cúc)
        - Xác minh: Tồn kho tăng chính xác (+50 hồng, +30 cúc)
        - Xác minh: Phiếu nhập kho (inb_...) được tạo thành công
        """
        initial_rose = get_material_by_id(self.flower_rose)["stockByBranch"][self.test_branch]
        initial_tana = get_material_by_id(self.flower_tana)["stockByBranch"][self.test_branch]
        self.assertEqual(initial_rose, 20)
        self.assertEqual(initial_tana, 10)

        # 1. Tạo đơn yêu cầu nhập hàng
        req_payload = {
            "branchId": self.test_branch,
            "requestDate": "2026-09-17",
            "expectedDate": "2026-09-17",
            "supplier": "Nhà Vườn Dalat Hasfarm",
            "notes": "Đơn nhập hoa tươi phục vụ sự kiện",
            "items": [
                {
                    "materialId": self.flower_rose,
                    "name": "Hoa Hồng Đỏ Explorer Ecuador",
                    "requestedQty": 50,
                    "unit": "cành",
                    "costPrice": 20000
                },
                {
                    "materialId": self.flower_tana,
                    "name": "Cúc Tana Nhỏ Đà Lạt",
                    "requestedQty": 30,
                    "unit": "cành",
                    "costPrice": 5000
                }
            ]
        }
        ok, req_res = create_purchase_request(req_payload, user_dict=self.user_manager)
        self.assertTrue(ok, f"Tạo yêu cầu nhập hàng lỗi: {req_res}")
        req_id = req_res["id"]

        # 2. Quản lý duyệt đơn (approved)
        ok, approve_res = update_purchase_request_status(req_id, "approved", user_dict=self.user_admin)
        self.assertTrue(ok)
        self.assertEqual(approve_res["status"], "approved")

        # 3. Xe hoa về: Thủ kho xác nhận nhận hàng (fulfill_purchase_request)
        fulfill_payload = {
            "branchId": self.test_branch,
            "supplier": "Nhà Vườn Dalat Hasfarm",
            "actualImportDate": "2026-09-17",
            "receiverNotes": "Hoa tươi đẹp, đủ số lượng",
            "items": [
                {
                    "materialId": self.flower_rose,
                    "quantity": 50,
                    "costPrice": 20000,
                    "unit": "cành"
                },
                {
                    "materialId": self.flower_tana,
                    "quantity": 30,
                    "costPrice": 5000,
                    "unit": "cành"
                }
            ]
        }
        ok, fulfill_res = fulfill_purchase_request(req_id, fulfill_payload, user_dict=self.user_manager)
        self.assertTrue(ok, f"Xử lý nhập kho thất bại: {fulfill_res}")

        # Kiểm tra trạng thái đơn chuyển thành fulfilled
        fulfilled_req = fulfill_res.get("request", {})
        self.assertEqual(fulfilled_req.get("status"), "fulfilled")
        inb_id = fulfilled_req.get("fulfilledInboundId")
        self.assertIsNotNone(inb_id)
        self.assertTrue(str(inb_id).startswith("inb_"))

        # Xác minh tồn kho hoa cành tăng chính xác
        rose_after_inbound = get_material_by_id(self.flower_rose)["stockByBranch"][self.test_branch]
        tana_after_inbound = get_material_by_id(self.flower_tana)["stockByBranch"][self.test_branch]
        self.assertEqual(rose_after_inbound, 20 + 50) # 70 cành
        self.assertEqual(tana_after_inbound, 10 + 30) # 40 cành

    def test_02_wastage_reporting_and_loss_calculation(self):
        """
        [2. BÁO HỎNG]
        - Sau khi nhận hoa, qua 1-2 ngày lưu kho lạnh phát hiện:
          + 5 cành hoa hồng bị dập cánh, thối gốc
          + 3 cành cúc tana bị gãy cuống
        - Lập phiếu báo hỏng gắn với mã đợt nhập
        - Xác minh: Tồn kho tự động bị trừ (-5 hồng, -3 cúc)
        - Xác minh: Tổng thiệt hại giá vốn = (5 * 20.000) + (3 * 5.000) = 115.000₫
        """
        # Giả lập nhập hàng trực tiếp
        inbound_payload = {
            "branchId": self.test_branch,
            "supplier": "Nhà Vườn Hasfarm",
            "importDate": "2026-09-17",
            "items": [
                {"materialId": self.flower_rose, "quantity": 40, "unit": "cành", "costPrice": 20000},
                {"materialId": self.flower_tana, "quantity": 25, "unit": "cành", "costPrice": 5000}
            ]
        }
        ok, inb_res = create_inbound_receipt(inbound_payload, user_dict=self.user_manager)
        self.assertTrue(ok)
        inb_id = inb_res["id"]
        inb_code = inb_res["inboundCode"]

        rose_before = get_material_by_id(self.flower_rose)["stockByBranch"][self.test_branch]
        tana_before = get_material_by_id(self.flower_tana)["stockByBranch"][self.test_branch]

        # Lập phiếu báo hoa hỏng gắn với đợt nhập
        wastage_payload = {
            "inboundId": inb_id,
            "inboundCode": inb_code,
            "branchId": self.test_branch,
            "date": "2026-09-17",
            "notes": "Hoa lưu kho lạnh 1 ngày phát hiện thối cuống",
            "items": [
                {
                    "materialId": self.flower_rose,
                    "flowerType": "Hoa Hồng Đỏ Explorer Ecuador",
                    "damagedStems": 5,
                    "unitCost": 20000,
                    "reason": "Thối gốc sau 1 ngày lưu kho lạnh"
                },
                {
                    "materialId": self.flower_tana,
                    "flowerType": "Cúc Tana Nhỏ Đà Lạt",
                    "damagedStems": 3,
                    "unitCost": 5000,
                    "reason": "Gãy cành khi dưỡng hoa"
                }
            ]
        }
        ok, waste_res = create_wastage_report(wastage_payload, user_dict=self.user_florist)
        self.assertTrue(ok, f"Lập phiếu báo hỏng thất bại: {waste_res}")

        # Kiểm tra tính toán thiệt hại
        expected_loss = (5 * 20000) + (3 * 5000) # 115.000₫
        self.assertEqual(waste_res["totalDamagedStems"], 8)
        self.assertEqual(waste_res["totalLossAmount"], expected_loss)

        # Kiểm tra tồn kho cành hoa bị trừ đúng số lượng cành hỏng
        rose_after = get_material_by_id(self.flower_rose)["stockByBranch"][self.test_branch]
        tana_after = get_material_by_id(self.flower_tana)["stockByBranch"][self.test_branch]
        self.assertEqual(rose_after, rose_before - 5)
        self.assertEqual(tana_after, tana_before - 3)

    def test_03_prevent_excessive_wastage_beyond_inbound(self):
        """
        [BẢO VỆ DỮ LIỆU - CHỐNG BÁO HỎNG KHỐNG]
        - Một đợt nhập nhận 15 cành hoa.
        - Cố tình báo hỏng 50 cành (> 15 cành) -> Hệ thống phải chặn và báo lỗi rõ ràng.
        - Số lượng tồn kho không được suy chuyển.
        """
        inbound_payload = {
            "branchId": self.test_branch,
            "supplier": "Nhà Vườn Hasfarm",
            "importDate": "2026-09-17",
            "items": [
                {"materialId": self.flower_rose, "quantity": 15, "unit": "cành", "costPrice": 20000}
            ]
        }
        ok, inb_res = create_inbound_receipt(inbound_payload, user_dict=self.user_manager)
        self.assertTrue(ok)

        rose_stock_before = get_material_by_id(self.flower_rose)["stockByBranch"][self.test_branch]

        # Báo hỏng 50 cành (vượt quá 15 cành)
        excessive_payload = {
            "inboundId": inb_res["id"],
            "inboundCode": inb_res["inboundCode"],
            "branchId": self.test_branch,
            "items": [
                {
                    "materialId": self.flower_rose,
                    "flowerType": "Hoa Hồng Đỏ Explorer Ecuador",
                    "damagedStems": 50,
                    "unitCost": 20000,
                    "reason": "Khai báo vượt mức"
                }
            ]
        }
        ok, err = create_wastage_report(excessive_payload, user_dict=self.user_florist)
        self.assertFalse(ok, "Hệ thống phải từ chối khi số cành hỏng vượt quá số cành thực nhận!")
        self.assertIn("vượt quá số lượng thực nhận", str(err))

        # Tồn kho không thay đổi
        rose_stock_after = get_material_by_id(self.flower_rose)["stockByBranch"][self.test_branch]
        self.assertEqual(rose_stock_after, rose_stock_before)

    def test_04_sales_deduction_direct_and_arranged_recipes(self):
        """
        [3. BÁN HÀNG & TRỪ KHO HOA CÀNH]
        - Bán 1: Bán cành hoa trực tiếp (direct).
        - Bán 2: Bán sản phẩm cắm phối (arranged bouquet có công thức recipe).
          + 1 Giỏ Hoa Tình Yêu cần: 12 cành Hồng Đỏ + 8 cành Cúc Tana.
          + Khách đặt 2 Giỏ -> Tiêu hao: 24 cành Hồng Đỏ + 16 cành Cúc Tana.
        - Xác minh: Hệ thống khấu trừ chính xác từng cành hoa trong kho chi nhánh.
        - Xác minh: Tính toán đúng giá vốn hoa cành (COGS) của đơn hàng.
        """
        # Đảm bảo đủ tồn kho ban đầu trước khi trừ cắm hoa
        update_material_stock(self.flower_rose, self.test_branch, delta=30) # 20 + 30 = 50 cành
        update_material_stock(self.flower_tana, self.test_branch, delta=20) # 10 + 20 = 30 cành

        rose_before = get_material_by_id(self.flower_rose)["stockByBranch"][self.test_branch]
        tana_before = get_material_by_id(self.flower_tana)["stockByBranch"][self.test_branch]

        # Đơn hàng cắm 2 giỏ hoa
        mock_order = {
            "id": "ord_flower_sales_001",
            "assignedBranchId": self.test_branch,
            "financials": {
                "subtotal": 1200000,
                "totalAmount": 1200000
            },
            "items": [
                {
                    "productId": "gio_hoa_tinh_yeu",
                    "productName": "Giỏ Hoa Tình Yêu Thủy Chung",
                    "productType": "arranged",
                    "quantity": 2,
                    "price": 600000,
                    "recipe": [
                        {"materialId": self.flower_rose, "quantity": 12, "costPrice": 20000},
                        {"materialId": self.flower_tana, "quantity": 8, "costPrice": 5000}
                    ]
                }
            ]
        }

        # 1. Khấu trừ nguyên vật liệu hoa cành theo đơn hàng
        ok, msg = deduct_order_materials(mock_order, branch_id=self.test_branch)
        self.assertTrue(ok, f"Khấu trừ hoa cành thất bại: {msg}")

        # Kiểm tra tồn kho bị trừ đúng: 2 * 12 = 24 cành hồng; 2 * 8 = 16 cành tana
        rose_after = get_material_by_id(self.flower_rose)["stockByBranch"][self.test_branch]
        tana_after = get_material_by_id(self.flower_tana)["stockByBranch"][self.test_branch]
        self.assertEqual(rose_after, rose_before - 24)
        self.assertEqual(tana_after, tana_before - 16)

        # 2. Kiểm tra tính toán Giá vốn (COGS) & Lãi gộp
        profit_data = calculate_order_cogs_and_profit(mock_order)
        # Giá vốn 1 giỏ = (12 * 20.000) + (8 * 5.000) = 240.000 + 40.000 = 280.000₫
        # 2 giỏ = 560.000₫
        expected_cogs = 560000
        expected_gross_profit = 1200000 - 560000 # 640.000₫
        self.assertEqual(profit_data["cogs"], expected_cogs)
        self.assertEqual(profit_data["grossProfit"], expected_gross_profit)

    def test_05_inventory_balance_and_remaining_flower_formula(self):
        """
        [4. THỐNG KÊ SỐ HOA CÒN LẠI (INVENTORY BALANCE)]
        - Kiểm tra tính toán khép kín vòng đời:
          Số Hoa Còn Lại = Tồn Ban Đầu + Nhập Kho - Báo Hỏng - Xuất Bán
        - Đối soát số liệu thực tế qua get_monthly_inventory_report và get_material_by_id.
        """
        # 1. Tồn ban đầu của chi nhánh Q10
        opening_rose = 30
        opening_tana = 25
        update_material_stock(self.flower_rose, self.test_branch, delta=(opening_rose - get_material_by_id(self.flower_rose)["stockByBranch"][self.test_branch]))
        update_material_stock(self.flower_tana, self.test_branch, delta=(opening_tana - get_material_by_id(self.flower_tana)["stockByBranch"][self.test_branch]))

        self.assertEqual(get_material_by_id(self.flower_rose)["stockByBranch"][self.test_branch], opening_rose)
        self.assertEqual(get_material_by_id(self.flower_tana)["stockByBranch"][self.test_branch], opening_tana)

        # 2. Nhập thêm: +50 hồng, +40 tana
        inbound_qty_rose = 50
        inbound_qty_tana = 40
        create_inbound_receipt({
            "branchId": self.test_branch,
            "supplier": "Hasfarm",
            "importDate": "2026-09-17",
            "items": [
                {"materialId": self.flower_rose, "quantity": inbound_qty_rose, "costPrice": 20000},
                {"materialId": self.flower_tana, "quantity": inbound_qty_tana, "costPrice": 5000}
            ]
        }, user_dict=self.user_manager)

        # 3. Báo hỏng: -4 hồng, -2 tana
        wastage_qty_rose = 4
        wastage_qty_tana = 2
        create_wastage_report({
            "branchId": self.test_branch,
            "date": "2026-09-17",
            "items": [
                {"materialId": self.flower_rose, "flowerType": "Hoa Hồng Đỏ Explorer", "damagedStems": wastage_qty_rose, "unitCost": 20000},
                {"materialId": self.flower_tana, "flowerType": "Cúc Tana Nhỏ", "damagedStems": wastage_qty_tana, "unitCost": 5000}
            ]
        }, user_dict=self.user_florist)

        # 4. Xuất bán cắm hoa: 1 giỏ (cần 16 hồng, 10 tana)
        sold_qty_rose = 16
        sold_qty_tana = 10
        deduct_order_materials({
            "id": "ord_stat_balance_01",
            "assignedBranchId": self.test_branch,
            "items": [
                {
                    "productId": "gio_balance",
                    "quantity": 1,
                    "recipe": [
                        {"materialId": self.flower_rose, "quantity": sold_qty_rose},
                        {"materialId": self.flower_tana, "quantity": sold_qty_tana}
                    ]
                }
            ]
        }, branch_id=self.test_branch)

        # 5. Tính toán số hoa còn lại kỳ vọng theo công thức:
        # Closing = Opening + Inbound - Wastage - Sold
        expected_remaining_rose = opening_rose + inbound_qty_rose - wastage_qty_rose - sold_qty_rose
        expected_remaining_tana = opening_tana + inbound_qty_tana - wastage_qty_tana - sold_qty_tana

        # 30 + 50 - 4 - 16 = 60 cành hồng
        self.assertEqual(expected_remaining_rose, 60)
        # 25 + 40 - 2 - 10 = 53 cành tana
        self.assertEqual(expected_remaining_tana, 53)

        # 6. Kiểm tra số hoa thực tế còn lại trong hệ thống
        actual_remaining_rose = get_material_by_id(self.flower_rose)["stockByBranch"][self.test_branch]
        actual_remaining_tana = get_material_by_id(self.flower_tana)["stockByBranch"][self.test_branch]

        self.assertEqual(actual_remaining_rose, expected_remaining_rose, "Số hoa hồng còn lại không khớp công thức tồn kho!")
        self.assertEqual(actual_remaining_tana, expected_remaining_tana, "Số cúc tana còn lại không khớp công thức tồn kho!")

        # 7. Kiểm tra Báo Cáo Cân Đối Nhập - Xuất - Tồn (get_monthly_inventory_report)
        report = get_monthly_inventory_report(
            month_str="2026-09",
            branch_id=self.test_branch,
            item_type="materials"
        )
        self.assertIn("summary", report)
        self.assertIn("items", report)

        # Tìm 2 loại hoa trong danh mục báo cáo
        rose_rep = next((it for it in report["items"] if it.get("id") == self.flower_rose), None)
        tana_rep = next((it for it in report["items"] if it.get("id") == self.flower_tana), None)

        self.assertIsNotNone(rose_rep)
        self.assertIsNotNone(tana_rep)

        # Xác minh công thức toán học bất biến trên báo cáo: Closing = Opening + Inbound - Sold - Wastage
        for item in [rose_rep, tana_rep]:
            item_open = int(item.get("opening", 0))
            item_inb = int(item.get("inbound", 0))
            item_sold = int(item.get("sold", 0))
            item_waste = int(item.get("wastage", 0))
            item_close = int(item.get("closing", 0))

            calc_close = max(0, item_open + item_inb - item_sold - item_waste)
            self.assertEqual(item_close, calc_close, f"Báo cáo thống kê của '{item.get('name')}' bị lệch số liệu!")

    def test_06_multi_branch_isolation(self):
        """
        [5. PHÂN LẬP ĐA CHI NHÁNH]
        - Showroom Q10 nhập, báo hỏng, bán hàng -> Số hoa còn lại của Showroom Q1 không bị thay đổi.
        """
        q1_rose_before = get_material_by_id(self.flower_rose)["stockByBranch"].get(self.test_branch_other, 0)
        q1_tana_before = get_material_by_id(self.flower_tana)["stockByBranch"].get(self.test_branch_other, 0)

        # Nhập 100 cành cho Q10
        create_inbound_receipt({
            "branchId": self.test_branch,
            "supplier": "Hasfarm",
            "items": [{"materialId": self.flower_rose, "quantity": 100, "costPrice": 20000}]
        }, user_dict=self.user_manager)

        # Báo hỏng 10 cành tại Q10
        create_wastage_report({
            "branchId": self.test_branch,
            "items": [{"materialId": self.flower_rose, "damagedStems": 10, "unitCost": 20000}]
        }, user_dict=self.user_florist)

        # Bán 30 cành tại Q10
        deduct_order_materials({
            "id": "ord_q10_sales",
            "assignedBranchId": self.test_branch,
            "items": [{"productId": "p1", "recipe": [{"materialId": self.flower_rose, "quantity": 30}]}]
        }, branch_id=self.test_branch)

        # Kiểm tra tồn kho tại chi nhánh Q1 hoàn toàn nguyên vẹn
        q1_rose_after = get_material_by_id(self.flower_rose)["stockByBranch"].get(self.test_branch_other, 0)
        q1_tana_after = get_material_by_id(self.flower_tana)["stockByBranch"].get(self.test_branch_other, 0)

        self.assertEqual(q1_rose_after, q1_rose_before, "Tồn kho hoa tại Chi Nhánh Q1 bị ảnh hưởng trái phép bởi Chi Nhánh Q10!")
        self.assertEqual(q1_tana_after, q1_tana_before)

    def test_07_closed_requisition_locks_wastage_reporting(self):
        """
        [6. KHÓA BÁO HỎNG SAU KHI ADMIN ĐÓNG ĐƠN (CLOSED)]
        - Khi đơn đã được Super Admin chốt sổ công nợ sau 2-3 ngày:
        - Mọi thao tác báo hỏng liên kết với đợt nhập đó đều bị hệ thống chặn.
        - Bảo toàn số hoa còn lại và số liệu kế toán.
        """
        # 1. Tạo và duyệt đơn yêu cầu
        ok, req = create_purchase_request({
            "branchId": self.test_branch,
            "supplier": "Hasfarm",
            "items": [{"materialId": self.flower_rose, "requestedQty": 20, "costPrice": 20000}]
        }, user_dict=self.user_manager)
        self.assertTrue(ok)
        req_id = req["id"]
        update_purchase_request_status(req_id, "approved", user_dict=self.user_admin)

        # 2. Xử lý nhập kho (fulfilled)
        ok, inb_req = fulfill_purchase_request(req_id, {
            "branchId": self.test_branch,
            "supplier": "Hasfarm",
            "items": [{"materialId": self.flower_rose, "quantity": 20, "costPrice": 20000}]
        }, user_dict=self.user_manager)
        self.assertTrue(ok, f"Fulfill thất bại: {inb_req}")
        inb_id = inb_req["inboundReceipt"]["id"]

        # 3. Super Admin chốt sổ kế toán sau 2-3 ngày -> Chuyển trạng thái sang closed
        ok, close_res = update_purchase_request_status(req_id, "closed", user_dict=self.user_admin)
        self.assertTrue(ok)
        self.assertEqual(close_res["status"], "closed")

        # 4. Nhân viên cố tình báo hỏng thêm cho đợt nhập đã closed
        attempt_payload = {
            "inboundId": inb_id,
            "branchId": self.test_branch,
            "items": [
                {
                    "materialId": self.flower_rose,
                    "flowerType": "Hoa Hồng Đỏ Explorer Ecuador",
                    "damagedStems": 2,
                    "unitCost": 20000,
                    "reason": "Héo úa muộn"
                }
            ]
        }
        ok, err = create_wastage_report(attempt_payload, user_dict=self.user_florist)
        self.assertFalse(ok, "Hệ thống phải chặn báo hỏng khi đơn yêu cầu đã được Admin chốt đóng (closed)!")
        self.assertIn("closed", str(err).lower())


if __name__ == "__main__":
    unittest.main()
