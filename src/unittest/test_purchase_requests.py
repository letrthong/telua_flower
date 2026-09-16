# -*- coding: utf-8 -*-
"""
Unit tests for Purchase Requisition & Requisition-based Inbound Fulfillment:
- create_purchase_request
- get_purchase_requests
- update_purchase_request_status
- fulfill_purchase_request (creates Inbound Receipt, updates materials.json stock, marks request fulfilled)
"""

import unittest
import os
import sys
import shutil
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from inventory_service import (
    get_purchase_requests,
    create_purchase_request,
    update_purchase_request_status,
    fulfill_purchase_request
)
from data_service import (
    get_config_path,
    read_json,
    write_json,
    get_material_by_id
)


class TestPurchaseRequestsLifecycle(unittest.TestCase):

    def setUp(self):
        # Đảm bảo file purchase_requests.json tồn tại trong thư mục config test
        self.req_path = get_config_path("purchase_requests.json")
        self.original_content = read_json(self.req_path, default=[])

        # Đảm bảo có sẵn 1 material cành hoa trong products/materials để test
        from data_service import get_products, save_products
        self.test_mat_rose = "test_mat_rose_requisition"
        prods = get_products()
        if not any(p.get("id") == self.test_mat_rose for p in prods):
            prods.append({
                "id": self.test_mat_rose,
                "name": "Hồng Trắng Ohara Nhập Khẩu",
                "category": "flower_main",
                "productType": "direct",
                "unit": "cành",
                "costPrice": 18000,
                "stockByBranch": {"branch_q10": 100, "branch_q1": 50, "branch_thao_dien": 30},
                "dailyQuota": 180,
                "isActive": True
            })
            save_products(prods)

    def tearDown(self):
        # Khôi phục file sau khi test
        if os.path.exists(self.req_path):
            write_json(self.req_path, self.original_content)

    def test_01_create_purchase_request_success(self):
        """Tạo phiếu yêu cầu nhập hàng thành công từ chi nhánh Q10."""
        user = {"id": "staff_001", "fullName": "Trần Thị Mai", "role": "branch_manager", "branchId": "branch_q10"}
        data = {
            "branchId": "branch_q10",
            "requestDate": "2026-09-16",
            "expectedDate": "2026-09-17",
            "notes": "Chuẩn bị hoa sự kiện cuối tuần",
            "items": [
                {
                    "materialId": "mat_rose_ohara_white",
                    "name": "Hồng Trắng Ohara Nhập Khẩu",
                    "requestedQty": 60,
                    "unit": "cành",
                    "costPrice": 18000,
                    "reason": "Tồn kho sắp hết"
                }
            ]
        }
        ok, res = create_purchase_request(data, user_dict=user)
        self.assertTrue(ok, f"Tạo yêu cầu nhập hàng thất bại: {res}")
        self.assertIsInstance(res, dict)
        self.assertEqual(res.get("branchId"), "branch_q10")
        self.assertEqual(res.get("status"), "pending")
        self.assertEqual(res.get("totalStems"), 60)
        self.assertEqual(res.get("estimatedCost"), 60 * 18000)
        self.assertTrue(res.get("requestCode", "").startswith("YCNH_"))

    def test_02_create_purchase_request_validation_errors(self):
        """Kiểm tra chặn dữ liệu rỗng / thiếu chi nhánh / số lượng <= 0."""
        user = {"id": "staff_001", "fullName": "Trần Thị Mai", "role": "branch_manager"}
        
        # Thiếu branchId
        ok, err = create_purchase_request({"items": [{"materialId": "mat_rose_ohara_white", "requestedQty": 10}]}, user_dict=user)
        self.assertFalse(ok)
        self.assertIn("chi nhánh", str(err))

        # Items rỗng
        ok, err = create_purchase_request({"branchId": "branch_q10", "items": []}, user_dict=user)
        self.assertFalse(ok)
        self.assertIn("ít nhất 1", str(err))

        # Số lượng 0
        ok, err = create_purchase_request({
            "branchId": "branch_q10",
            "items": [{"materialId": "mat_rose_ohara_white", "requestedQty": 0}]
        }, user_dict=user)
        self.assertFalse(ok)
        self.assertIn("lớn hơn 0", str(err))

    def test_03_get_purchase_requests_filter(self):
        """Lọc danh sách yêu cầu nhập hàng theo chi nhánh và trạng thái."""
        user = {"id": "staff_001", "fullName": "Trần Thị Mai"}
        # Tạo 1 phiếu Q10 và 1 phiếu Q1
        create_purchase_request({
            "branchId": "branch_q10",
            "items": [{"materialId": "mat_rose_ohara_white", "requestedQty": 20}]
        }, user_dict=user)
        create_purchase_request({
            "branchId": "branch_q1",
            "items": [{"materialId": "mat_rose_ohara_white", "requestedQty": 30}]
        }, user_dict=user)

        q10_reqs = get_purchase_requests(branch_id="branch_q10")
        self.assertTrue(any(r.get("branchId") == "branch_q10" for r in q10_reqs))
        self.assertFalse(any(r.get("branchId") == "branch_q1" for r in q10_reqs))

        pending_reqs = get_purchase_requests(status="pending")
        self.assertTrue(all(r.get("status") == "pending" for r in pending_reqs))

    def test_04_update_purchase_request_status(self):
        """Duyệt hoặc từ chối phiếu yêu cầu nhập hàng."""
        user = {"id": "staff_001", "fullName": "Trần Thị Mai"}
        ok, created = create_purchase_request({
            "branchId": "branch_q10",
            "items": [{"materialId": "mat_rose_ohara_white", "requestedQty": 15}]
        }, user_dict=user)
        self.assertTrue(ok)
        req_id = created["id"]

        admin_user = {"id": "admin", "fullName": "Tổng Quản Trị"}
        ok, updated = update_purchase_request_status(req_id, "approved", user_dict=admin_user, notes="Đã gom đơn đặt vườn")
        self.assertTrue(ok)
        self.assertEqual(updated["status"], "approved")
        self.assertEqual(updated["approvedBy"], "Tổng Quản Trị")
        self.assertEqual(updated["processNotes"], "Đã gom đơn đặt vườn")

    def test_05_fulfill_purchase_request_updates_materials_stock(self):
        """
        Xử lý Yêu cầu nhập hàng (Fulfill):
        - Tạo Phiếu Nhập Kho thực tế (Inbound Receipt).
        - Cộng dồn số cành vào materials.json.
        - Chuyển trạng thái yêu cầu sang 'fulfilled' kèm fulfilledInboundId.
        """
        user = {"id": "staff_001", "fullName": "Trần Thị Mai", "branchId": "branch_q10"}
        mat_id = self.test_mat_rose
        
        # Đọc tồn kho ban đầu của cành hoa tại Q10
        mat_before = get_material_by_id(mat_id) or {}
        stock_before = int(mat_before.get("stockByBranch", {}).get("branch_q10", 0))

        # 1. Tạo yêu cầu nhập 40 cành
        qty_to_import = 40
        ok, req = create_purchase_request({
            "branchId": "branch_q10",
            "items": [{"materialId": mat_id, "name": "Hồng Trắng Ohara Nhập Khẩu", "requestedQty": qty_to_import, "costPrice": 18000}]
        }, user_dict=user)
        self.assertTrue(ok)
        req_id = req["id"]

        # 2. Xử lý nhập kho thực tế
        inbound_payload = {
            "branchId": "branch_q10",
            "supplier": "Nhà Vườn Hasfarm Đà Lạt",
            "importDate": "2026-09-16",
            "notes": f"Nhập kho theo yêu cầu {req.get('requestCode')}",
            "items": [
                {
                    "materialId": mat_id,
                    "quantity": qty_to_import,
                    "costPrice": 18000
                }
            ]
        }
        ok, res = fulfill_purchase_request(req_id, inbound_payload, user_dict=user)
        self.assertTrue(ok, f"Xử lý fulfill thất bại: {res}")
        self.assertIn("request", res)
        self.assertIn("inboundReceipt", res)

        # Kiểm tra trạng thái yêu cầu
        fulfilled_req = res["request"]
        self.assertEqual(fulfilled_req.get("status"), "fulfilled")
        self.assertIsNotNone(fulfilled_req.get("fulfilledInboundId"))

        # Kiểm tra tồn kho materials.json tại Q10 tăng chính xác bằng qty_to_import
        mat_after = get_material_by_id(mat_id) or {}
        stock_after = int(mat_after.get("stockByBranch", {}).get("branch_q10", 0))
        self.assertEqual(stock_after, stock_before + qty_to_import, "Tồn kho materials.json tại Q10 phải tăng thêm đúng số lượng nhập")


if __name__ == "__main__":
    unittest.main()
