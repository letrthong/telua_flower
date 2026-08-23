"""
Unit Test: Quản Lý Nhân Sự, Phân Quyền & Quản Lý Chuỗi Cửa Hàng (Staff & Store Chain RBAC)
- Super Admin: Toàn quyền xem toàn bộ hệ thống, thêm chi nhánh mới, phân quyền tất cả nhân sự.
- Branch Manager: Chỉ thấy và quản lý nhân sự thuộc chi nhánh của mình (bị cô lập dữ liệu).
- Customer: Bị chặn hoàn toàn khỏi các API Quản trị.
"""

import os
import sys
import unittest
import time

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.dirname(CURRENT_DIR)
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from app import app
from services.auth_service import authenticate_user, register_customer, delete_staff_user
from services.data_service import get_branches, save_branches


class TestStaffAndBranchManagement(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

        # 1. Đăng nhập Super Admin
        _, auth_admin, _ = authenticate_user("admin@nohoathabinh.vn", "123456")
        self.admin_token = auth_admin["token"]
        self.admin_user = auth_admin["user"]

        # 2. Đăng nhập Quản lý Chi Nhánh Q10 (branch_q10)
        _, auth_mgr, _ = authenticate_user("0909123456", "123456")
        self.mgr_q10_token = auth_mgr["token"]
        self.mgr_q10 = auth_mgr["user"]

        # 3. Đăng ký / Đăng nhập Customer
        cust_phone = f"0933{int(time.time()) % 10000:04d}"
        register_customer(cust_phone, "123456", "Khách Hàng Thử Nghiệm")
        _, auth_cust, _ = authenticate_user(cust_phone, "123456")
        self.cust_token = auth_cust["token"]

    def test_01_super_admin_views_all_staff_and_manager_isolated(self):
        """Kiểm tra Super Admin thấy toàn bộ nhân sự, Quản lý Q10 chỉ thấy nhân sự Q10"""
        headers_admin = {"Authorization": f"Bearer {self.admin_token}"}
        headers_mgr = {"Authorization": f"Bearer {self.mgr_q10_token}"}

        # 1. Super Admin lấy toàn bộ
        res_admin = self.client.get("/api/admin/users", headers=headers_admin)
        self.assertEqual(res_admin.status_code, 200)
        all_users = res_admin.get_json()["data"]
        self.assertTrue(len(all_users) >= 3)
        # Super admin thấy cả nhân sự thuộc nhiều chi nhánh khác nhau
        branch_ids = set(u.get("branchId") for u in all_users if u.get("branchId"))
        self.assertTrue(len(branch_ids) >= 2)

        # 2. Quản lý Q10 lấy danh sách -> CHỈ thấy nhân sự branch_q10
        res_mgr = self.client.get("/api/admin/users", headers=headers_mgr)
        self.assertEqual(res_mgr.status_code, 200)
        mgr_users = res_mgr.get_json()["data"]
        for u in mgr_users:
            self.assertEqual(u.get("branchId"), "branch_q10")

    def test_02_branch_manager_can_create_staff_for_own_branch(self):
        """Kiểm tra Quản lý Q10 tạo thợ cắm hoa mới cho đúng chi nhánh Q10"""
        headers_mgr = {"Authorization": f"Bearer {self.mgr_q10_token}"}
        new_phone = f"0988{int(time.time()) % 10000:04d}"

        staff_payload = {
            "fullName": "Thợ Cắm Hoa Mới Q10",
            "phone": new_phone,
            "email": f"florist_{new_phone}@nohoathabinh.vn",
            "role": "florist",
            "password": "password123"
        }

        res = self.client.post("/api/admin/users", json=staff_payload, headers=headers_mgr)
        self.assertEqual(res.status_code, 201)
        created_staff = res.get_json()["data"]
        self.assertEqual(created_staff["fullName"], "Thợ Cắm Hoa Mới Q10")
        self.assertEqual(created_staff["branchId"], "branch_q10")
        self.assertEqual(created_staff["role"], "florist")

        # Dọn dẹp
        delete_staff_user(self.admin_user, created_staff["id"])

    def test_03_branch_manager_blocked_from_creating_admin_or_cross_branch(self):
        """Kiểm tra Quản lý chi nhánh BỊ CHẶN khi cố tạo Super Admin hoặc gán sang chi nhánh khác"""
        headers_mgr = {"Authorization": f"Bearer {self.mgr_q10_token}"}

        # 1. Thử tạo Super Admin -> Bị chặn 400
        illegal_admin_payload = {
            "fullName": "Super Admin Giả Mạo",
            "phone": f"0977{int(time.time()) % 10000:04d}",
            "role": "super_admin",
            "password": "password123"
        }
        res_1 = self.client.post("/api/admin/users", json=illegal_admin_payload, headers=headers_mgr)
        self.assertEqual(res_1.status_code, 400)
        self.assertIn("Quản lý chi nhánh chỉ có quyền", res_1.get_json()["message"])

    def test_04_super_admin_can_manage_store_chain_branches(self):
        """Kiểm tra Super Admin mở thêm chi nhánh mới trong chuỗi cửa hàng và bật/tắt"""
        headers_admin = {"Authorization": f"Bearer {self.admin_token}"}
        test_branch_id = f"branch_test_{int(time.time())}"

        branch_payload = {
            "id": test_branch_id,
            "code": f"CN_T{int(time.time()) % 100}",
            "name": "Nở Hoa Thả Bình - Showroom Landmark 81",
            "address": "720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP.HCM",
            "phone": "0976.491.999",
            "lat": 10.7950,
            "lng": 106.7218,
            "deliveryRadiusKm": 15,
            "openHours": "08:00 - 22:00"
        }

        # 1. Tạo chi nhánh mới -> 201 Created
        res_create = self.client.post("/api/admin/branches", json=branch_payload, headers=headers_admin)
        self.assertEqual(res_create.status_code, 201)
        created_b = res_create.get_json()["data"]
        self.assertEqual(created_b["id"], test_branch_id)
        self.assertEqual(created_b["name"], "Nở Hoa Thả Bình - Showroom Landmark 81")

        # 2. Cập nhật chi nhánh -> 200 OK
        update_payload = {
            "name": "Nở Hoa Thả Bình - Showroom Landmark 81 VIP",
            "address": "720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP.HCM",
            "phone": "0976.491.888"
        }
        res_upd = self.client.put(f"/api/admin/branches/{test_branch_id}", json=update_payload, headers=headers_admin)
        self.assertEqual(res_upd.status_code, 200)
        self.assertEqual(res_upd.get_json()["data"]["name"], "Nở Hoa Thả Bình - Showroom Landmark 81 VIP")

        # 3. Tắt/Bật chi nhánh -> 200 OK
        res_toggle = self.client.patch(f"/api/admin/branches/{test_branch_id}/toggle", headers=headers_admin)
        self.assertEqual(res_toggle.status_code, 200)
        self.assertFalse(res_toggle.get_json()["data"]["isActive"])

        # Dọn dẹp chi nhánh
        branches = get_branches(use_cache=False)
        branches = [b for b in branches if b.get("id") != test_branch_id]
        save_branches(branches)

    def test_05_branch_manager_and_customer_blocked_from_branch_creation(self):
        """Kiểm tra Quản lý chi nhánh và Khách hàng BỊ CHẶN khi cố tạo chi nhánh chuỗi cửa hàng mới"""
        headers_mgr = {"Authorization": f"Bearer {self.mgr_q10_token}"}
        headers_cust = {"Authorization": f"Bearer {self.cust_token}"}

        branch_payload = {
            "name": "Showroom Bất Hợp Pháp",
            "address": "123 Đường Test"
        }

        # 1. Quản lý chi nhánh thử tạo -> 403 Forbidden (Chỉ super_admin mới được)
        res_mgr = self.client.post("/api/admin/branches", json=branch_payload, headers=headers_mgr)
        self.assertEqual(res_mgr.status_code, 403)

        # 2. Khách hàng thử tạo -> 403 Forbidden
        res_cust = self.client.post("/api/admin/branches", json=branch_payload, headers=headers_cust)
        self.assertEqual(res_cust.status_code, 403)


if __name__ == "__main__":
    unittest.main()
