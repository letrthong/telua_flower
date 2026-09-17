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
    fulfill_purchase_request,
    create_wastage_report
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

    def test_06_update_status_approve_reject_scenarios(self):
        """Kiểm thử chi tiết các kịch bản Approve / Reject / Rollback / Quyền chi nhánh."""
        user = {"id": "staff_001", "fullName": "Nguyễn Văn A", "branchId": "branch_q10"}
        ok, req = create_purchase_request({
            "branchId": "branch_q10",
            "items": [{"materialId": self.test_mat_rose, "requestedQty": 10}]
        }, user_dict=user)
        self.assertTrue(ok)
        req_id = req["id"]

        # 1. Từ chối yêu cầu (Reject) kèm lý do
        manager_user = {"id": "mgr_001", "fullName": "Quản Lý Q10", "role": "branch_manager", "branchId": "branch_q10"}
        ok, rejected = update_purchase_request_status(req_id, "REJECTED", user_dict=manager_user, notes="Hoa tồn kho còn đủ, chưa cần nhập thêm")
        self.assertTrue(ok)
        self.assertEqual(rejected["status"], "rejected")
        self.assertEqual(rejected["rejectedBy"], "Quản Lý Q10")
        self.assertEqual(rejected["processNotes"], "Hoa tồn kho còn đủ, chưa cần nhập thêm")
        self.assertIsNotNone(rejected.get("rejectedAt"))

        # 2. Xem xét lại và Duyệt yêu cầu (Approve)
        ok, approved = update_purchase_request_status(req_id, "approved", user_dict=manager_user, notes="Đã duyệt sau khi kiểm tra lại")
        self.assertTrue(ok)
        self.assertEqual(approved["status"], "approved")
        self.assertEqual(approved["approvedBy"], "Quản Lý Q10")
        self.assertEqual(approved["processNotes"], "Đã duyệt sau khi kiểm tra lại")

        # 3. Trạng thái không hợp lệ bị từ chối
        ok, err = update_purchase_request_status(req_id, "invalid_status", user_dict=manager_user)
        self.assertFalse(ok)
        self.assertIn("không hợp lệ", str(err))

        # 4. Quản lý chi nhánh khác không có quyền can thiệp vào phiếu của Q10
        other_branch_mgr = {"id": "mgr_q1", "fullName": "Quản Lý Q1", "role": "branch_manager", "branchId": "branch_q1"}
        ok, err = update_purchase_request_status(req_id, "rejected", user_dict=other_branch_mgr)
        self.assertFalse(ok)
        self.assertIn("chi nhánh mình", str(err))

        # 5. Super Admin duyệt được mọi chi nhánh
        super_admin = {"id": "admin", "fullName": "Super Admin", "role": "super_admin"}
        ok, admin_updated = update_purchase_request_status(req_id, "approved", user_dict=super_admin)
        self.assertTrue(ok)
        self.assertEqual(admin_updated["status"], "approved")
        self.assertEqual(admin_updated["approvedBy"], "Super Admin")


    def test_07_inbound_actual_qty_and_inbound_linked_wastage(self):
        """Kiểm thử nhập kho đối soát số thực tế (actual qty) và báo hỏng bắt buộc liên kết đợt nhập (inbound-linked wastage)."""
        from src.inventory_service import (
            get_inbound_receipt_by_id, 
            create_wastage_report, 
            get_wastage_reports
        )
        staff_user = {"id": "staff_001", "fullName": "Thủ Kho Q10", "branchId": "branch_q10"}

        # 1. Tạo yêu cầu nhập hàng đề xuất 50 cành hồng
        ok, req = create_purchase_request({
            "branchId": "branch_q10",
            "notes": "Đề xuất nhập 50 cành hồng đỏ cho cuối tuần",
            "items": [
                {
                    "materialId": self.test_mat_rose,
                    "requestedQty": 50,
                    "unitCost": 15000
                }
            ]
        }, user_dict=staff_user)
        self.assertTrue(ok)
        req_id = req["id"]
        req_code = req.get("requestCode", req_id)

        # 2. Xử lý nhập kho thực nhận: Xe hoa về chỉ giao thực tế 40 cành (thực nhận < đề xuất)
        inbound_payload = {
            "branchId": "branch_q10",
            "supplier": "Vườn Lan - Hasfarm Đà Lạt",
            "importDate": "2026-09-16",
            "notes": f"Đối soát thực nhận theo Đề Xuất {req_code}",
            "purchaseRequestId": req_id,
            "requestCode": req_code,
            "items": [
                {
                    "materialId": self.test_mat_rose,
                    "quantity": 40,        # Thực nhận
                    "requestedQty": 50,    # Đề xuất ban đầu
                    "unitCost": 15000
                }
            ]
        }
        ok, fulfill_res = fulfill_purchase_request(req_id, inbound_payload, user_dict=staff_user)
        self.assertTrue(ok, f"Fulfill thất bại: {fulfill_res}")
        receipt = fulfill_res.get("inboundReceipt", {})
        receipt_id = receipt.get("id")
        self.assertIsNotNone(receipt_id)
        self.assertEqual(receipt.get("purchaseRequestId"), req_id)
        self.assertEqual(receipt.get("requestCode"), req_code)

        # 3. Kiểm tra hàm get_inbound_receipt_by_id
        found_receipt = get_inbound_receipt_by_id(receipt_id)
        self.assertIsNotNone(found_receipt, f"Không tìm thấy phiếu nhập {receipt_id}")
        self.assertEqual(found_receipt.get("id"), receipt_id)
        self.assertEqual(len(found_receipt.get("items", [])), 1)
        self.assertEqual(found_receipt["items"][0]["quantity"], 40)
        self.assertEqual(found_receipt["items"][0]["requestedQty"], 50)

        # 4. Kịch bản báo hoa hỏng trái quy định: Báo 45 cành hỏng (vượt quá 40 cành thực nhận của đợt nhập)
        overflow_wastage_payload = {
            "branchId": "branch_q10",
            "inboundId": receipt_id,
            "inboundCode": receipt_id,
            "supplier": receipt.get("supplier"),
            "requestCode": req_code,
            "reportedBy": "Thủ Kho Q10",
            "items": [
                {
                    "materialId": self.test_mat_rose,
                    "flowerType": "Hoa Hồng Test Đỏ",
                    "damagedStems": 45,  # VƯỢT QUÁ 40
                    "unitCost": 15000,
                    "reason": "Dập cánh khi vận chuyển"
                }
            ]
        }
        ok, err = create_wastage_report(overflow_wastage_payload)
        self.assertFalse(ok, "Phải chặn báo hỏng khi số lượng vượt quá số thực nhận")
        self.assertIn("vượt quá số lượng thực nhận", str(err))

        # 5. Kịch bản báo hoa hỏng hợp lệ: Báo 5 cành hỏng (<= 40 cành thực nhận)
        valid_wastage_payload = {
            "branchId": "branch_q10",
            "inboundId": receipt_id,
            "inboundCode": receipt_id,
            "supplier": receipt.get("supplier"),
            "requestCode": req_code,
            "reportedBy": "Thủ Kho Q10",
            "items": [
                {
                    "materialId": self.test_mat_rose,
                    "flowerType": "Hoa Hồng Test Đỏ",
                    "damagedStems": 5,   # HỢP LỆ <= 40
                    "unitCost": 15000,
                    "reason": "Dập cánh khi vận chuyển"
                }
            ]
        }
        ok, wastage_report = create_wastage_report(valid_wastage_payload)
        self.assertTrue(ok, f"Báo hỏng hợp lệ phải thành công: {wastage_report}")
        self.assertEqual(wastage_report.get("inboundId"), receipt_id)
        self.assertEqual(wastage_report.get("inboundCode"), receipt.get("inboundCode") or receipt_id)
        self.assertEqual(wastage_report.get("requestCode"), req_code)
        self.assertEqual(wastage_report.get("totalDamagedStems"), 5)

        # 6. Kiểm tra tự động lấy đúng đơn giá lúc nhập (inbound costPrice) cho 1 cành khi unitCost không truyền hoặc = 0
        auto_cost_payload = {
            "branchId": "branch_q10",
            "inboundId": receipt_id,
            "inboundCode": receipt_id,
            "reportedBy": "Thủ Kho Q10",
            "items": [
                {
                    "materialId": self.test_mat_rose,
                    "flowerType": "Hoa Hồng Test Đỏ",
                    "damagedStems": 2,  # 2 cành hỏng, không truyền unitCost (hoặc = 0)
                    "unitCost": 0,
                    "reason": "Cánh hoa bị dập nát"
                }
            ]
        }
        ok, auto_report = create_wastage_report(auto_cost_payload)
        self.assertTrue(ok, f"Tự động lấy đơn giá nhập phải thành công: {auto_report}")
        self.assertEqual(auto_report["items"][0]["unitCost"], 15000, "Đơn giá 1 cành phải được lấy từ đợt nhập (15.000₫)")
        self.assertEqual(auto_report["items"][0]["totalLoss"], 30000, "Thiệt hại = 2 cành * 15.000₫ = 30.000₫")
        self.assertEqual(auto_report["totalLossAmount"], 30000)

    def test_08_immutable_fulfilled_and_closed_lifecycle(self):
        """
        Kiểm thử Tính Bất Biến khi đã Nhận Hàng (fulfilled) và vòng đời Đóng Đơn (closed):
        1. Đơn hàng fulfilled KHÔNG THỂ quay lại pending, approved, rejected.
        2. Nhân viên/Thủ kho không thể tự ý đóng đơn.
        3. Super Admin có quyền đóng đơn hàng (closed) sau 2-3 ngày theo dõi.
        4. Đơn hàng closed là bất biến (không thể đổi sang trạng thái khác).
        5. Đợt nhập thuộc đơn hàng closed KHÔNG THỂ báo hoa hỏng thêm.
        """
        user_mgr = {"id": "staff_001", "fullName": "Trần Thị Mai", "role": "branch_manager", "branchId": "branch_q10"}
        user_admin = {"id": "staff_admin", "fullName": "Tổng Quản Trị", "role": "super_admin"}

        # 1. Tạo đơn và duyệt
        ok, req = create_purchase_request({
            "branchId": "branch_q10",
            "items": [{"materialId": self.test_mat_rose, "requestedQty": 30, "costPrice": 18000}]
        }, user_dict=user_mgr)
        self.assertTrue(ok)
        req_id = req["id"]

        ok, _ = update_purchase_request_status(req_id, "approved", user_dict=user_admin)
        self.assertTrue(ok)

        # 2. Xử lý nhập kho thực tế -> fulfilled
        inbound_payload = {
            "branchId": "branch_q10",
            "supplier": "Vườn Hasfarm",
            "importDate": "2026-09-17",
            "items": [{"materialId": self.test_mat_rose, "quantity": 30, "costPrice": 18000}]
        }
        ok, res = fulfill_purchase_request(req_id, inbound_payload, user_dict=user_mgr)
        self.assertTrue(ok)
        receipt_id = res["inboundReceipt"]["id"]

        # 3. Khóa Bất Biến: Thử đổi ngược fulfilled -> pending, approved, rejected => PHẢI THẤT BẠI
        for invalid_status in ["pending", "approved", "rejected"]:
            ok, err = update_purchase_request_status(req_id, invalid_status, user_dict=user_admin)
            self.assertFalse(ok, f"Không được phép đổi trạng thái fulfilled sang {invalid_status}")
            self.assertIn("không thể quay lại trạng thái khác", str(err))

        # 4. Phân quyền đóng đơn: Branch manager thử đóng đơn => PHẢI THẤT BẠI
        ok, err = update_purchase_request_status(req_id, "closed", user_dict=user_mgr)
        self.assertFalse(ok, "Branch manager không được phép đóng đơn hàng")
        self.assertIn("Chỉ Super Admin", str(err))

        # 5. Báo hoa hỏng hợp lệ khi đơn còn đang fulfilled (trong 1-2 ngày theo dõi)
        ok, w_rep = create_wastage_report({
            "branchId": "branch_q10",
            "inboundId": receipt_id,
            "items": [{"materialId": self.test_mat_rose, "damagedStems": 2, "unitCost": 18000}]
        })
        self.assertTrue(ok, "Báo hỏng trong thời gian theo dõi phải thành công")

        # 6. Super Admin đóng đơn hàng (closed) sau 2-3 ngày
        ok, closed_req = update_purchase_request_status(req_id, "closed", user_dict=user_admin, notes="Đã chốt công nợ với nhà vườn Hasfarm")
        self.assertTrue(ok, "Super Admin đóng đơn hàng phải thành công")
        self.assertEqual(closed_req.get("status"), "closed")
        self.assertEqual(closed_req.get("closedBy"), "Tổng Quản Trị")

        # 7. Khóa Bất Biến khi đã closed: Thử đổi sang bất kỳ trạng thái nào => PHẢI THẤT BẠI
        for any_status in ["pending", "approved", "rejected", "fulfilled"]:
            ok, err = update_purchase_request_status(req_id, any_status, user_dict=user_admin)
            self.assertFalse(ok, f"Không được phép đổi trạng thái closed sang {any_status}")
            self.assertIn("Đơn hàng đã đóng hoàn tất", str(err))

        # 8. Khóa Báo Hỏng: Thử báo hoa hỏng khi đơn đã closed => PHẢI THẤT BẠI
        ok, err = create_wastage_report({
            "branchId": "branch_q10",
            "inboundId": receipt_id,
            "items": [{"materialId": self.test_mat_rose, "damagedStems": 1, "unitCost": 18000}]
        })
        self.assertFalse(ok, "Không được phép báo hỏng khi đơn hàng đã đóng")
        self.assertIn("đã được Admin đóng chốt sổ", str(err))


if __name__ == "__main__":
    unittest.main()

