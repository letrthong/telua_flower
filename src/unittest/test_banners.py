import os
import sys
import unittest
import json

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from app import app
from anne_auth_service import generate_jwt_token
from data_service import get_banners_config, save_banners_config

class TestBannerSliderConfiguration(unittest.TestCase):
    """Kiểm thử cấu hình Banner Trình Chiếu (banners.json) & API RESTful"""

    def setUp(self):
        self.client = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()
        self.admin_token = generate_jwt_token({
            "id": "staff_admin",
            "identifier": "admin@nohoathabinh.vn",
            "role": "super_admin"
        })
        self.original_config = get_banners_config(use_cache=False)

    def tearDown(self):
        if hasattr(self, 'original_config') and self.original_config:
            save_banners_config(self.original_config)
        self.app_context.pop()

    def test_get_banners_config_structure(self):
        """Kiểm tra cấu trúc dữ liệu banners.json mặc định"""
        cfg = get_banners_config(use_cache=True)
        self.assertIsInstance(cfg, dict)
        self.assertIn("interval", cfg)
        self.assertIn("banners", cfg)
        self.assertGreaterEqual(cfg["interval"], 1000)
        self.assertIsInstance(cfg["banners"], list)
        self.assertGreater(len(cfg["banners"]), 0)

        first_banner = cfg["banners"][0]
        self.assertIn("image", first_banner)
        self.assertIn("link", first_banner)
        self.assertIn("active", first_banner)

    def test_public_banners_api_and_etag(self):
        """Kiểm tra API public GET /api/flower/v1/banners có header ETag"""
        res = self.client.get("/api/flower/v1/banners")
        self.assertEqual(res.status_code, 200)
        res_json = res.get_json()
        self.assertTrue(res_json.get("success"))
        data = res_json.get("data", {})
        self.assertIn("banners", data)
        self.assertIn("interval", data)

        etag = res.headers.get("ETag")
        self.assertIsNotNone(etag)

        res_304 = self.client.get("/api/flower/v1/banners", headers={"If-None-Match": etag})
        self.assertEqual(res_304.status_code, 304)

    def test_admin_update_banners_flow(self):
        """Kiểm tra Admin cập nhật link ảnh banner và chu kỳ đổi ảnh"""
        new_payload = {
            "interval": 7000,
            "autoplay": True,
            "banners": [
                {
                    "id": "banner_custom_01",
                    "image": "https://images.unsplash.com/photo-custom-01",
                    "title": "Hoa Mùa Thu Đặc Biệt",
                    "link": "#custom",
                    "active": True,
                    "order": 1
                },
                {
                    "id": "banner_custom_02",
                    "image": "https://images.unsplash.com/photo-custom-02",
                    "title": "Hoa Valentine",
                    "link": "#valentine",
                    "active": False,
                    "order": 2
                }
            ]
        }

        # 1. Gọi PUT với quyền super_admin
        res = self.client.put(
            "/api/flower/v1/admin/banners",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json=new_payload
        )
        self.assertEqual(res.status_code, 200)
        res_json = res.get_json()
        self.assertTrue(res_json.get("success"))
        updated_data = res_json.get("data", {})
        self.assertEqual(updated_data.get("interval"), 7000)
        self.assertEqual(len(updated_data.get("banners", [])), 2)
        self.assertEqual(updated_data["banners"][0]["image"], "https://images.unsplash.com/photo-custom-01")

        # 2. Xác thực dữ liệu được lưu xuống tệp JSON
        cfg_after = get_banners_config(use_cache=False)
        self.assertEqual(cfg_after["interval"], 7000)
        self.assertEqual(len(cfg_after["banners"]), 2)
        self.assertEqual(cfg_after["banners"][0]["image"], "https://images.unsplash.com/photo-custom-01")

    def test_get_admin_endpoints_without_token(self):
        """Kiểm tra GET /admin/company-info và /admin/banners hoạt động công khai không cần token, nhưng PUT bắt buộc token"""
        # 1. GET /admin/company-info không cần token
        res_ci = self.client.get("/api/flower/v1/admin/company-info")
        self.assertEqual(res_ci.status_code, 200)
        self.assertTrue(res_ci.get_json().get("success"))

        # 2. GET /admin/banners không cần token
        res_bn = self.client.get("/api/flower/v1/admin/banners")
        self.assertEqual(res_bn.status_code, 200)
        self.assertTrue(res_bn.get_json().get("success"))

        # 3. PUT /admin/banners không có token phải bị từ chối 401
        res_put = self.client.put("/api/flower/v1/admin/banners", json={"interval": 5000})
        self.assertEqual(res_put.status_code, 401)

        # 4. PUT /admin/company-info không có token phải bị từ chối 401
        res_put_ci = self.client.put("/api/flower/v1/admin/company-info", json={"companyName": "Test"})
        self.assertEqual(res_put_ci.status_code, 401)

if __name__ == "__main__":
    unittest.main()
