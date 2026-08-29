import os
import sys
import unittest
import json
import time

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from app import app
from anne_auth_service import (
    hash_password,
    verify_password,
    generate_jwt_token,
    verify_jwt_token,
    authenticate_user,
    register_customer,
    get_redirect_url_for_role
)
from auth_decorator import can_access_branch, require_role


class TestAuthService(unittest.TestCase):
    """Bộ kiểm thử phân hệ Xác thực Đăng nhập & Phân quyền JWT RBAC (TASK 02)"""

    def setUp(self):
        self.client = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()

    def tearDown(self):
        self.app_context.pop()

    def test_01_password_hashing_and_verification(self):
        """Kiểm tra băm mật khẩu và kiểm tra so khớp mật khẩu"""
        raw_pw = "secret_flower_123"
        hashed = hash_password(raw_pw)

        self.assertNotEqual(raw_pw, hashed)
        self.assertTrue(verify_password(raw_pw, hashed))
        self.assertFalse(verify_password("wrong_password", hashed))

    def test_02_jwt_token_generation_and_verification(self):
        """Kiểm tra sinh JWT Token HS256 và giải mã payload"""
        payload = {
            "userId": "staff_001",
            "fullName": "Trần Thị Mai",
            "role": "branch_manager",
            "branchId": "branch_q10"
        }
        token = generate_jwt_token(payload, expires_in_seconds=3600)
        self.assertIsInstance(token, str)
        self.assertEqual(len(token.split(".")), 3)

        is_valid, decoded, err = verify_jwt_token(token)
        self.assertTrue(is_valid)
        self.assertIsNone(err)
        self.assertEqual(decoded["userId"], "staff_001")
        self.assertEqual(decoded["role"], "branch_manager")
        self.assertEqual(decoded["branchId"], "branch_q10")

    def test_03_jwt_tampered_token_rejected(self):
        """Kiểm tra chặn token bị can thiệp chữ ký số"""
        payload = {"userId": "cust_001", "role": "customer"}
        token = generate_jwt_token(payload)

        parts = token.split(".")
        # Sửa đổi phần chữ ký
        tampered_token = f"{parts[0]}.{parts[1]}.tamperedSignature123"
        is_valid, _, err = verify_jwt_token(tampered_token)
        self.assertFalse(is_valid)
        self.assertIn("Chữ ký Token không hợp lệ", err)

    def test_04_jwt_expired_token_rejected(self):
        """Kiểm tra chặn token đã hết hạn (expired)"""
        payload = {"userId": "staff_001", "role": "florist"}
        # Token hết hạn ngay lập tức (-10s)
        expired_token = generate_jwt_token(payload, expires_in_seconds=-10)
        is_valid, _, err = verify_jwt_token(expired_token)
        self.assertFalse(is_valid)
        self.assertIn("hết hạn", err)

    def test_05_authenticate_all_5_roles_success(self):
        """Kiểm tra đăng nhập thành công cho cả 5 Roles"""
        test_accounts = [
            ("admin@nohoathabinh.vn", "123456", "super_admin", "/portal/admin"),
            ("0909123456", "123456", "branch_manager", "/portal/branch-manager"),
            ("0909654321", "123456", "florist", "/portal/staff"),
            ("0909777888", "123456", "sales_consultant", "/portal/sales"),
            ("0987654321", "123456", "customer", "/")
        ]

        for ident, pw, expected_role, expected_redirect in test_accounts:
            success, auth_data, err = authenticate_user(ident, pw)
            self.assertTrue(success, f"Đăng nhập thất bại cho {ident}: {err}")
            self.assertIsNotNone(auth_data)
            self.assertEqual(auth_data["role"], expected_role)
            self.assertEqual(auth_data["redirectUrl"], expected_redirect)
            self.assertIn("token", auth_data)

    def test_06_authenticate_invalid_credentials(self):
        """Kiểm tra chặn đăng nhập sai mật khẩu hoặc tài khoản không tồn tại"""
        # Sai mật khẩu
        success, _, err = authenticate_user("0909123456", "wrong_password_999")
        self.assertFalse(success)
        self.assertIn("không chính xác", err)

        # Tài khoản không tồn tại
        success2, _, err2 = authenticate_user("0999999999", "123456")
        self.assertFalse(success2)
        self.assertIn("không chính xác", err2)

    def test_07_role_redirect_urls(self):
        """Kiểm tra ma trận điều hướng sau đăng nhập"""
        self.assertEqual(get_redirect_url_for_role("super_admin"), "/portal/admin")
        self.assertEqual(get_redirect_url_for_role("branch_manager"), "/portal/branch-manager")
        self.assertEqual(get_redirect_url_for_role("florist"), "/portal/staff")
        self.assertEqual(get_redirect_url_for_role("sales_consultant"), "/portal/sales")
        self.assertEqual(get_redirect_url_for_role("customer"), "/")

    def test_08_register_new_customer(self):
        """Kiểm tra quy trình đăng ký khách hàng mới"""
        test_phone = f"091{int(time.time()) % 1000000:07d}"
        success, auth_data, err = register_customer(
            phone=test_phone,
            full_name="Khách Hàng Mới Test",
            password="mypassword123",
            email=f"test_{test_phone}@gmail.com"
        )
        self.assertTrue(success, f"Đăng ký thất bại: {err}")
        self.assertEqual(auth_data["role"], "customer")

        # Thử đăng ký lại số điện thoại đó -> phải bị chặn lỗi
        success_dup, _, err_dup = register_customer(
            phone=test_phone,
            full_name="Trùng SĐT",
            password="mypassword123"
        )
        self.assertFalse(success_dup)
        self.assertIn("đã được đăng ký", err_dup)

    def test_09_flask_auth_endpoints_and_rbac(self):
        """Kiểm tra các HTTP endpoints /api/auth/login, /api/auth/me và chặn 401 / 403"""
        # 1. Gọi POST /api/auth/login
        res_login = self.client.post("/api/auth/login", json={
            "identifier": "0909123456",
            "password": "123456"
        })
        self.assertEqual(res_login.status_code, 200)
        data_login = res_login.get_json()
        self.assertTrue(data_login["success"])
        token = data_login["data"]["token"]

        # 2. Gọi GET /api/auth/me với Token hợp lệ
        res_me = self.client.get("/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        self.assertEqual(res_me.status_code, 200)
        data_me = res_me.get_json()
        self.assertEqual(data_me["data"]["role"], "branch_manager")

        # 3. Gọi GET /api/auth/me không có Token -> chặn 401
        res_unauth = self.client.get("/api/auth/me")
        self.assertEqual(res_unauth.status_code, 401)

    def test_10_branch_data_isolation(self):
        """Kiểm tra phân lập dữ liệu chi nhánh"""
        admin_user = {"role": "super_admin", "branchId": None}
        manager_q10 = {"role": "branch_manager", "branchId": "branch_q10"}

        # Super Admin truy cập được tất cả chi nhánh
        self.assertTrue(can_access_branch(admin_user, "branch_q10"))
        self.assertTrue(can_access_branch(admin_user, "branch_thao_dien"))

        # Quản lý Q10 chỉ truy cập được Q10
        self.assertTrue(can_access_branch(manager_q10, "branch_q10"))
        self.assertFalse(can_access_branch(manager_q10, "branch_thao_dien"))

    def test_11_login_via_admin_email_and_phone(self):
        """Kiểm tra đăng nhập cho Super Admin qua cả Email và SĐT"""
        # Đăng nhập bằng Email
        success_email, data_email, err_email = authenticate_user("admin@nohoathabinh.vn", "123456")
        self.assertTrue(success_email, f"Lỗi đăng nhập admin bằng email: {err_email}")
        self.assertEqual(data_email["role"], "super_admin")
        self.assertEqual(data_email["redirectUrl"], "/portal/admin")

        # Đăng nhập bằng Số điện thoại
        success_phone, data_phone, err_phone = authenticate_user("0900000000", "123456")
        self.assertTrue(success_phone, f"Lỗi đăng nhập admin bằng SĐT: {err_phone}")
        self.assertEqual(data_phone["role"], "super_admin")

    def test_12_login_invalid_password_rejection(self):
        """Kiểm tra chặn đăng nhập khi mật khẩu sai"""
        success, data, err = authenticate_user("admin@nohoathabinh.vn", "sai_mat_khau_999")
        self.assertFalse(success)
        self.assertIsNone(data)
        self.assertIn("không chính xác", err)

    def test_13_login_nonexistent_user_rejection(self):
        """Kiểm tra chặn đăng nhập tài khoản không tồn tại"""
        success, data, err = authenticate_user("0999999999", "123456")
        self.assertFalse(success)
        self.assertIsNone(data)
        self.assertIn("không chính xác", err)

    def test_14_locked_account_rejection(self):
        """Kiểm tra chặn tài khoản đã bị khóa (isActive = False)"""
        # Tạo mock user bị khóa và test hàm xác thực
        from services.data_service import get_users, save_users
        users = get_users()
        # Thêm tạm 1 user bị khóa
        locked_user = {
            "id": "locked_001",
            "phone": "0999000111",
            "email": "locked@nohoathabinh.vn",
            "fullName": "Tài Khoản Bị Khóa",
            "passwordHash": hash_password("123456"),
            "role": "customer",
            "branchId": None,
            "isActive": False,
            "createdAt": "2026-08-21T00:00:00Z"
        }
        users.append(locked_user)
        save_users(users)

        success, data, err = authenticate_user("0999000111", "123456")
        self.assertFalse(success)
        self.assertIn("tạm khóa", err)

        # Dọn dẹp user test
        clean_users = [u for u in get_users() if u.get("id") != "locked_001"]
        save_users(clean_users)


if __name__ == "__main__":
    unittest.main()
