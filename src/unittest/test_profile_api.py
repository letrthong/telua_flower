import unittest
import json
import os
import sys

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from app import app
from anne_auth_service import generate_jwt_token, get_users, hash_password
from data_service import get_staff_users, save_staff_users


class TestUserProfileAPI(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

        # Tìm 1 staff user để test
        users = get_users()
        self.staff_user = None
        for u in users:
            if u.get("role") == "super_admin":
                self.staff_user = dict(u)
                break
        self.assertIsNotNone(self.staff_user, "Phải có ít nhất 1 super_admin để test")
        
        self.orig_fullName = self.staff_user.get("fullName")
        self.orig_email = self.staff_user.get("email")

        self.token = generate_jwt_token({
            "userId": self.staff_user.get("id"),
            "phone": self.staff_user.get("phone"),
            "role": self.staff_user.get("role"),
            "branchId": self.staff_user.get("branchId")
        })

    def tearDown(self):
        # Khôi phục nguyên vẹn thông tin user để các test suite khác không bị ảnh hưởng
        staff_users = get_staff_users()
        for i, u in enumerate(staff_users):
            if u.get("id") == self.staff_user.get("id"):
                staff_users[i]["fullName"] = self.orig_fullName
                staff_users[i]["email"] = self.orig_email
                save_staff_users(staff_users)
                break

    def test_01_update_profile_success(self):
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        payload = {
            "fullName": "Tổng Quản Trị Đã Cập Nhật",
            "email": self.orig_email
        }
        res = self.client.put("/api/auth/profile", json=payload, headers=headers)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertTrue(data.get("success"))
        self.assertEqual(data["data"]["fullName"], "Tổng Quản Trị Đã Cập Nhật")

    def test_02_update_profile_unauthorized(self):
        payload = {"fullName": "Hacker"}
        res = self.client.put("/api/auth/profile", json=payload)
        self.assertEqual(res.status_code, 401)

    def test_03_change_password_invalid_old(self):
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        payload = {
            "currentPassword": "wrong_password_999",
            "newPassword": "new_password_123456"
        }
        res = self.client.put("/api/auth/change-password", json=payload, headers=headers)
        self.assertEqual(res.status_code, 400)
        data = json.loads(res.data)
        self.assertFalse(data.get("success"))
        self.assertIn("không chính xác", data.get("message", ""))

    def test_04_change_password_too_short(self):
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        payload = {
            "currentPassword": "123456",
            "newPassword": "123"
        }
        res = self.client.put("/api/auth/change-password", json=payload, headers=headers)
        self.assertEqual(res.status_code, 400)
        data = json.loads(res.data)
        self.assertIn("tối thiểu 6 ký tự", data.get("message", ""))


if __name__ == "__main__":
    unittest.main()
