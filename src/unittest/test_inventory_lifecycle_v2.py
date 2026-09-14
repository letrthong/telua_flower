import os
import sys
import unittest
from datetime import datetime
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
)
from inventory_service import (
    create_inbound_receipt,
    get_inbound_receipts,
    deduct_order_materials,
    create_wastage_report,
    calculate_order_cogs_and_profit,
    get_monthly_inventory_report,
)
from anne_auth_service import generate_jwt_token


class TestInventoryLifecycleV2(unittest.TestCase):
    """
    Bộ kiểm thử TDD V2:
    1. Nhập kho hoa cành (Inbound Receipt & Auto increment).
    2. Bán hàng trừ kho: Hàng direct (1:1) vs Hàng arranged (trừ cành hoa theo recipe).
    3. Báo hủy hao hụt cành hoa (Wastage).
    4. Tính Giá vốn hoa cành (COGS) & Lợi nhuận gộp (Gross Profit) từng đơn.
    5. Báo Cáo Nhập - Xuất - Tồn Theo Tháng (Closing = Opening + Inbound - Sold - Wastage).
    """

    def setUp(self):
        # Backup dữ liệu trước khi test
        self.original_materials = [dict(m) for m in get_materials()]
        self.original_products = [dict(p) for p in get_products()]
        self.original_wastage = [dict(w) for w in get_wastage_reports()]

        # Đảm bảo có nguyên liệu test chuẩn
        self.test_branch = "branch_q10"
        self.test_mat_rose = "mat_rose_ohara_white"
        self.test_mat_tana = "mat_daisy_tana"

        prods = get_products()
        prod_ids = [p.get("id") for p in prods]
        needs_save = False
        if self.test_mat_rose not in prod_ids:
            prods.append({
                "id": self.test_mat_rose,
                "name": "Hồng Trắng Ohara Nhập Khẩu",
                "category": "flower_main",
                "productType": "direct",
                "unit": "cành",
                "costPrice": 18000,
                "priceNumber": 30000,
                "stockByBranch": {"branch_q10": 100, "branch_q1": 50, "branch_thao_dien": 30},
                "dailyQuota": 180,
                "isActive": True
            })
            needs_save = True
        if self.test_mat_tana not in prod_ids:
            prods.append({
                "id": self.test_mat_tana,
                "name": "Cúc Tana Đà Lạt",
                "category": "flower_filler",
                "productType": "direct",
                "unit": "nhánh",
                "costPrice": 6000,
                "priceNumber": 12000,
                "stockByBranch": {"branch_q10": 80, "branch_q1": 40, "branch_thao_dien": 20},
                "dailyQuota": 140,
                "isActive": True
            })
            needs_save = True
        if needs_save:
            save_products(prods)

    def tearDown(self):
        # Phục hồi dữ liệu sau khi test
        save_products(self.original_products)
        save_materials(self.original_materials)
        save_wastage_reports(self.original_wastage)

    def test_01_materials_data_service_crud_and_stock_update(self):
        """Kiểm tra đọc/ghi và cập nhật tăng/giảm cành hoa trong materials.json."""
        materials = get_materials()
        self.assertIsInstance(materials, list)
        self.assertGreater(len(materials), 0, "materials.json phải chứa dữ liệu hoa cành")

        # Tra cứu theo ID
        rose = get_material_by_id(self.test_mat_rose)
        self.assertIsNotNone(rose)
        self.assertEqual(rose.get("unit"), "cành")
        original_stock = int(rose.get("stockByBranch", {}).get(self.test_branch, 0))

        # Test tăng tồn kho (Nhập hàng +20 cành)
        ok = update_material_stock(self.test_mat_rose, self.test_branch, delta=20)
        self.assertTrue(ok)
        updated_rose = get_material_by_id(self.test_mat_rose)
        self.assertEqual(updated_rose["stockByBranch"][self.test_branch], original_stock + 20)

        # Test giảm tồn kho (Cắm hoa -5 cành)
        ok = update_material_stock(self.test_mat_rose, self.test_branch, delta=-5)
        self.assertTrue(ok)
        updated_rose = get_material_by_id(self.test_mat_rose)
        self.assertEqual(updated_rose["stockByBranch"][self.test_branch], original_stock + 15)

    def test_02_inbound_receipt_creation_and_auto_increment(self):
        """
        Kiểm tra lập Phiếu Nhập Hàng:
        - Lưu phiếu vào inventory/inbounds/{YYYY_MM}/inb_...json
        - Tự động cộng dồn số lượng cành vào materials.json của chi nhánh.
        """
        rose_before = get_material_by_id(self.test_mat_rose)
        stock_rose_before = int(rose_before.get("stockByBranch", {}).get(self.test_branch, 0))

        tana_before = get_material_by_id(self.test_mat_tana)
        stock_tana_before = int(tana_before.get("stockByBranch", {}).get(self.test_branch, 0))

        inbound_payload = {
            "branchId": self.test_branch,
            "supplier": "Nhà Vườn Dalat Hasfarm",
            "importDate": "2026-09-13",
            "items": [
                {
                    "materialId": self.test_mat_rose,
                    "quantity": 50,
                    "unit": "cành",
                    "costPrice": 18000
                },
                {
                    "materialId": self.test_mat_tana,
                    "quantity": 30,
                    "unit": "nhánh",
                    "costPrice": 6000
                }
            ],
            "notes": "Kiểm thử nhập kho hoa cành tự động"
        }

        user_dict = {
            "id": "staff_001",
            "fullName": "Trần Thị Mai",
            "role": "branch_manager",
            "branchId": self.test_branch
        }

        success, res = create_inbound_receipt(inbound_payload, user_dict=user_dict)
        self.assertTrue(success, f"Tạo phiếu nhập thất bại: {res}")
        self.assertIsInstance(res, dict)
        self.assertIn("id", res)
        self.assertIn("inboundCode", res)
        self.assertEqual(res["totalStems"], 80)
        self.assertEqual(res["totalCost"], 50 * 18000 + 30 * 6000)

        # Kiểm tra tồn kho materials.json được tự động cộng dồn
        rose_after = get_material_by_id(self.test_mat_rose)
        self.assertEqual(rose_after["stockByBranch"][self.test_branch], stock_rose_before + 50)

        tana_after = get_material_by_id(self.test_mat_tana)
        self.assertEqual(tana_after["stockByBranch"][self.test_branch], stock_tana_before + 30)

        # Kiểm tra tra cứu danh sách phiếu nhập
        receipts = get_inbound_receipts(month_str="2026_09", branch_id=self.test_branch)
        self.assertGreater(len(receipts), 0)
        found = any(r.get("id") == res["id"] for r in receipts)
        self.assertTrue(found, "Phiếu nhập vừa tạo phải nằm trong danh sách tra cứu")

    def test_03_sales_deduction_arranged_with_recipe(self):
        """
        Kiểm tra bán sản phẩm arranged (Hoa cắm phối có công thức recipe):
        - Khi đơn hàng hoàn thành cắm hoa -> Trừ chính xác số cành hoa trong materials.json.
        """
        rose_before = get_material_by_id(self.test_mat_rose)
        stock_rose_before = int(rose_before.get("stockByBranch", {}).get(self.test_branch, 0))

        tana_before = get_material_by_id(self.test_mat_tana)
        stock_tana_before = int(tana_before.get("stockByBranch", {}).get(self.test_branch, 0))

        # Đơn hàng cắm 2 Bó Hoa Mây Trắng
        # Mỗi bó cần 10 cành hồng Ohara + 5 cành Tana
        mock_order = {
            "id": "ord_test_arranged_001",
            "assignedBranchId": self.test_branch,
            "items": [
                {
                    "productId": "bo_hoa_1788048775",
                    "productName": "Bó Hoa Hồng & Hoa Ly Trắng",
                    "productType": "arranged",
                    "quantity": 2,
                    "recipe": [
                        {"materialId": self.test_mat_rose, "quantity": 10},
                        {"materialId": self.test_mat_tana, "quantity": 5}
                    ]
                }
            ]
        }

        success, msg = deduct_order_materials(mock_order, branch_id=self.test_branch)
        self.assertTrue(success, f"Trừ kho cành theo đơn thất bại: {msg}")

        # Xác minh: 2 bó * 10 cành hồng = -20 cành; 2 bó * 5 nhánh tana = -10 nhánh
        rose_after = get_material_by_id(self.test_mat_rose)
        self.assertEqual(rose_after["stockByBranch"][self.test_branch], stock_rose_before - 20)

        tana_after = get_material_by_id(self.test_mat_tana)
        self.assertEqual(tana_after["stockByBranch"][self.test_branch], stock_tana_before - 10)

    def test_04_wastage_material_deduction(self):
        """
        Kiểm tra báo hủy hoa cành nguyên liệu (Wastage Type = 'material'):
        - Lưu phiếu vào wastage_reports.json
        - Tự động trừ số cành bị hỏng trong materials.json.
        """
        rose_before = get_material_by_id(self.test_mat_rose)
        stock_rose_before = int(rose_before.get("stockByBranch", {}).get(self.test_branch, 0))

        wastage_payload = {
            "branchId": self.test_branch,
            "date": "2026-09-13",
            "wastageType": "material",
            "items": [
                {
                    "materialId": self.test_mat_rose,
                    "flowerType": "Hồng Trắng Ohara Nhập Khẩu",
                    "damagedStems": 7,
                    "unitCost": 18000,
                    "reason": "Gãy cành do vận chuyển va đập"
                }
            ],
            "notes": "Kiểm kê hao hụt ca chiều"
        }

        user_dict = {
            "id": "staff_002",
            "fullName": "Lê Thị Cẩm Tú",
            "role": "florist",
            "branchId": self.test_branch
        }

        success, res = create_wastage_report(wastage_payload, user_dict=user_dict)
        self.assertTrue(success, f"Lập phiếu báo hủy thất bại: {res}")

        # Tồn kho hoa cành phải bị trừ đúng 7 cành
        rose_after = get_material_by_id(self.test_mat_rose)
        self.assertEqual(rose_after["stockByBranch"][self.test_branch], stock_rose_before - 7)

    def test_05_calculate_order_cogs_and_profit(self):
        """
        Kiểm tra tính toán Giá vốn hoa cành (COGS) & Lợi nhuận gộp (Gross Profit) từng đơn hàng:
        Doanh thu 880.000₫ - Chi phí hoa cành định lượng = Lãi gộp.
        """
        mock_order = {
            "id": "ord_profit_test_001",
            "financials": {
                "subtotal": 880000,
                "totalAmount": 880000
            },
            "items": [
                {
                    "productId": "gio_hoa_01",
                    "productName": "Giỏ Hoa Nắng Sớm",
                    "quantity": 1,
                    "price": 880000,
                    "recipe": [
                        {"materialId": self.test_mat_rose, "quantity": 8, "costPrice": 18000}, # 144k
                        {"materialId": self.test_mat_tana, "quantity": 5, "costPrice": 6000},   # 30k
                        {"materialId": "mat_basket_rattan_oval", "quantity": 1, "costPrice": 45000} # 45k
                    ]
                }
            ]
        }

        profit_info = calculate_order_cogs_and_profit(mock_order)
        self.assertIn("revenue", profit_info)
        self.assertIn("cogs", profit_info)
        self.assertIn("grossProfit", profit_info)
        self.assertIn("profitMarginPercent", profit_info)

        expected_cogs = 144000 + 30000 + 45000 # 219.000₫
        expected_profit = 880000 - 219000      # 661.000₫

        self.assertEqual(profit_info["revenue"], 880000)
        self.assertEqual(profit_info["cogs"], expected_cogs)
        self.assertEqual(profit_info["grossProfit"], expected_profit)
        self.assertGreater(profit_info["profitMarginPercent"], 70)

    def test_06_monthly_inventory_balance_report(self):
        """
        Kiểm tra Báo Cáo Nhập - Xuất - Tồn Theo Tháng:
        Công thức chuẩn: Tồn Cuối = Tồn Đầu + Nhập - Bán - Hủy
        """
        report = get_monthly_inventory_report(
            month_str="2026-09",
            branch_id=self.test_branch,
            item_type="all"
        )
        self.assertIn("month", report)
        self.assertIn("summary", report)
        self.assertIn("items", report)

        summary = report["summary"]
        self.assertIn("totalOpeningValue", summary)
        self.assertIn("totalInboundValue", summary)
        self.assertIn("totalSoldValue", summary)
        self.assertIn("totalClosingValue", summary)

        # Kiểm tra từng mặt hàng thỏa mãn công thức cân bằng
        for item in report["items"]:
            opening = int(item.get("opening", 0))
            inbound = int(item.get("inbound", 0))
            sold = int(item.get("sold", 0))
            wastage = int(item.get("wastage", 0))
            closing = int(item.get("closing", 0))

            # Tồn Cuối = max(0, Opening + Inbound - Sold - Wastage)
            expected_closing = max(0, opening + inbound - sold - wastage)
            self.assertEqual(
                closing,
                expected_closing,
                f"Mặt hàng {item.get('name')} bị sai lệch công thức Nhập-Xuất-Tồn!"
            )

    def test_07_legacy_product_without_product_type_fallback(self):
        """Kiểm tra tính tương thích ngược cho dữ liệu cũ chưa có trường productType."""
        from data_service import get_products, save_products, get_product_by_id

        # Giả lập sản phẩm cũ không có trường productType
        mock_products = [
            {
                "id": "legacy_vase_01",
                "name": "Bình Thủy Tinh Cũ",
                "category": "binh_hoa",
                "priceNumber": 150000,
                "stockByBranch": {"branch_q10": 10},
                "dailyQuota": 10
            },
            {
                "id": "legacy_arranged_01",
                "name": "Bó Hoa Cũ Có Recipe",
                "category": "bo_hoa",
                "priceNumber": 350000,
                "recipe": [{"materialId": "mat_rose_red", "quantity": 10}],
                "stockByBranch": {"branch_q10": 5},
                "dailyQuota": 5
            }
        ]
        save_products(mock_products)

        loaded_products = get_products()
        p1 = next((p for p in loaded_products if p["id"] == "legacy_vase_01"), None)
        p2 = next((p for p in loaded_products if p["id"] == "legacy_arranged_01"), None)

        self.assertIsNotNone(p1)
        self.assertEqual(p1.get("productType"), "direct", "Sản phẩm cũ không có recipe phải mặc định là 'direct'")

        self.assertIsNotNone(p2)
        self.assertEqual(p2.get("productType"), "arranged", "Sản phẩm cũ có recipe phải tự động nhận diện là 'arranged'")


if __name__ == "__main__":
    unittest.main()
