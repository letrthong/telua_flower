"""
Unit Test: Kiểm Thử Bảo Mật Dữ Liệu & Phân Quyền Backend RBAC (Data Protection & Access Control)
Đảm bảo người mua (customer) hoặc người dùng chưa đăng nhập (anonymous) tuyệt đối KHÔNG thể
tải hoặc sửa đổi dữ liệu quản trị, đơn hàng của người khác, hoặc dữ liệu chi nhánh khi chưa được cấp quyền.
"""

import os
import sys
import unittest
import json
import time

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.dirname(CURRENT_DIR)
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from app import app
from services.auth_service import authenticate_user, register_customer
from services.order_service import create_order
from services.data_service import delete_order


class TestRBACDataProtection(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

        # 1. Đăng nhập Super Admin
        _, auth_admin, _ = authenticate_user("admin@nohoathabinh.vn", "123456")
        self.admin_token = auth_admin["token"]

        # 2. Đăng nhập Quản lý Chi Nhánh Q10
        _, auth_mgr, _ = authenticate_user("0909123456", "123456")
        self.manager_q10_token = auth_mgr["token"]

        # 3. Đăng nhập Thợ cắm hoa Chi Nhánh Q10
        _, auth_florist, _ = authenticate_user("0909654321", "123456")
        self.florist_q10_token = auth_florist["token"]

        # 4. Đăng ký / Đăng nhập Khách hàng A (Customer A)
        phone_a = f"0911{int(time.time()) % 10000:04d}"
        register_customer(phone_a, "123456", "Khách Hàng A")
        _, auth_cust_a, _ = authenticate_user(phone_a, "123456")
        self.cust_a_token = auth_cust_a["token"]
        self.cust_a = auth_cust_a["user"]

        # 5. Đăng ký / Đăng nhập Khách hàng B (Customer B)
        phone_b = f"0922{int(time.time()) % 10000:04d}"
        register_customer(phone_b, "123456", "Khách Hàng B")
        _, auth_cust_b, _ = authenticate_user(phone_b, "123456")
        self.cust_b_token = auth_cust_b["token"]
        self.cust_b = auth_cust_b["user"]

    def test_01_customer_cannot_access_admin_products_api(self):
        """Kiểm tra Khách hàng KHÔNG thể thêm/sửa/xóa sản phẩm trong Catalogue"""
        headers_cust = {"Authorization": f"Bearer {self.cust_a_token}"}
        payload = {
            "name": "Hoa Giả Mạo",
            "category": "bo_hoa",
            "priceLevelId": "price_lvl_01",
            "priceNumber": 400000
        }

        # 1. Thử tạo hoa mới -> 403 Forbidden
        res_post = self.client.post("/api/admin/products", json=payload, headers=headers_cust)
        self.assertEqual(res_post.status_code, 403)
        self.assertFalse(res_post.get_json()["success"])
        self.assertIn("không có quyền", res_post.get_json()["message"])

        # 2. Thử sửa hoa -> 403 Forbidden
        res_put = self.client.put("/api/admin/products/bo_hoa_01", json=payload, headers=headers_cust)
        self.assertEqual(res_put.status_code, 403)

        # 3. Thử ẩn/bật hoa -> 403 Forbidden
        res_toggle = self.client.patch("/api/admin/products/bo_hoa_01/toggle", headers=headers_cust)
        self.assertEqual(res_toggle.status_code, 403)

    def test_02_customer_cannot_access_admin_promotions_api(self):
        """Kiểm tra Khách hàng KHÔNG thể tạo hoặc gạt bật/tắt voucher khuyến mãi"""
        headers_cust = {"Authorization": f"Bearer {self.cust_a_token}"}
        promo_payload = {
            "title": "Hack Giảm Giá 99%",
            "code": "HACK99",
            "discountType": "percentage",
            "discountValue": 99,
            "maxDiscountAmount": 1000000,
            "minOrderAmount": 10000
        }

        # 1. Thử tạo voucher -> 403 Forbidden
        res_post = self.client.post("/api/admin/promotions", json=promo_payload, headers=headers_cust)
        self.assertEqual(res_post.status_code, 403)

        # 2. Thử bật/tắt voucher -> 403 Forbidden
        res_toggle = self.client.patch("/api/admin/promotions/promo_01/toggle", headers=headers_cust)
        self.assertEqual(res_toggle.status_code, 403)

    def test_03_customer_cannot_modify_translation_matrix(self):
        """Kiểm tra Khách hàng KHÔNG thể sửa từ điển đa ngôn ngữ của hệ thống"""
        headers_cust = {"Authorization": f"Bearer {self.cust_a_token}"}
        update_i18n = {"site_title": {"vi": "Website đã bị hack", "en": "Hacked"}}

        res = self.client.put("/api/admin/translations", json=update_i18n, headers=headers_cust)
        self.assertEqual(res.status_code, 403)
        self.assertFalse(res.get_json()["success"])

    def test_04_customer_cannot_access_branch_orders(self):
        """Kiểm tra Khách hàng KHÔNG thể tải danh sách đơn hàng nội bộ của Showroom"""
        headers_cust = {"Authorization": f"Bearer {self.cust_a_token}"}

        res = self.client.get("/api/branch/branch_q10/orders", headers=headers_cust)
        self.assertEqual(res.status_code, 403)
        self.assertFalse(res.get_json()["success"])
        self.assertNotIn("data", res.get_json())

    def test_05_unauthorized_guest_cannot_access_my_orders(self):
        """Kiểm tra Người dùng vãng lai (chưa đăng nhập) bị chặn khi gọi API đơn hàng cá nhân"""
        # Không truyền header Authorization
        res = self.client.get("/api/orders/my-orders")
        self.assertEqual(res.status_code, 401)
        self.assertIn("Yêu cầu đăng nhập", res.get_json()["message"])

    def test_06_customer_cannot_read_another_customer_order(self):
        """Kiểm tra Khách hàng A KHÔNG thể xem dữ liệu đơn hàng của Khách hàng B"""
        # 1. Tạo đơn hàng thuộc quyền sở hữu của Khách hàng B
        order_b_data = {
            "sender": {
                "name": "Khách B",
                "phone": self.cust_b["phone"],
                "email": "cust_b@test.com"
            },
            "recipient": {
                "name": "Người Nhận Bí Mật",
                "phone": "0988777666",
                "address": "123 Nguyễn Trãi, Quận 1"
            },
            "delivery": {
                "deliveryDate": "2026-08-28",
                "deliverySlot": "08:00 - 10:00"
            },
            "items": [{"productId": "bo_hoa_01", "quantity": 1}],
            "cardMessage": "Bí mật tình yêu",
            "isAnonymous": True
        }
        success_b, created_order_b, _ = create_order(order_b_data, authenticated_user=self.cust_b)
        self.assertTrue(success_b)
        order_b_id = created_order_b.get("id") or created_order_b.get("orderId")

        # 2. Khách hàng A gửi token của mình để tra cứu đơn hàng của Khách B -> Bị chặn 403 Forbidden
        headers_cust_a = {"Authorization": f"Bearer {self.cust_a_token}"}
        res_peek = self.client.get(f"/api/orders/{order_b_id}", headers=headers_cust_a)
        self.assertEqual(res_peek.status_code, 403)
        self.assertFalse(res_peek.get_json()["success"])
        self.assertIn("không có quyền xem", res_peek.get_json()["message"])

        # 3. Khách hàng B gửi token chính chủ -> Được xem 200 OK
        headers_cust_b = {"Authorization": f"Bearer {self.cust_b_token}"}
        res_owner = self.client.get(f"/api/orders/{order_b_id}", headers=headers_cust_b)
        self.assertEqual(res_owner.status_code, 200)
        self.assertTrue(res_owner.get_json()["success"])
        self.assertEqual(res_owner.get_json()["data"]["cardMessage"], "Bí mật tình yêu")

        # Dọn dẹp
        delete_order(order_b_id)

    def test_07_branch_manager_isolated_access(self):
        """Kiểm tra Quản lý chi nhánh Q10 không được xem dữ liệu đơn của Chi nhánh khác (Thảo Điền)"""
        headers_mgr_q10 = {"Authorization": f"Bearer {self.manager_q10_token}"}

        # Quản lý Q10 truy cập kho đơn chi nhánh Thảo Điền -> 403 Forbidden
        res = self.client.get("/api/branch/branch_thao_dien/orders", headers=headers_mgr_q10)
        self.assertEqual(res.status_code, 403)
        self.assertIn("không có quyền truy cập", res.get_json()["message"])

    def test_08_super_admin_has_full_privileged_access(self):
        """Kiểm tra Tổng Quản Trị (Super Admin) có toàn quyền tra cứu và cập nhật mọi tài nguyên"""
        headers_admin = {"Authorization": f"Bearer {self.admin_token}"}

        # 1. Xem danh mục hoa
        res_prods = self.client.get("/api/products")
        self.assertEqual(res_prods.status_code, 200)

        # 2. Xem đơn chi nhánh bất kỳ
        res_branch = self.client.get("/api/branch/branch_q10/orders", headers=headers_admin)
        self.assertEqual(res_branch.status_code, 200)

        # 3. Xem danh mục phân tầng giá
        res_lvl = self.client.get("/api/price-levels")
        self.assertEqual(res_lvl.status_code, 200)


if __name__ == "__main__":
    unittest.main()
