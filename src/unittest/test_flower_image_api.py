"""
Bộ Kiểm Thử Đơn Vị (Unit Test) cho RESTful API Phục Vụ & Quản Lý Hình Ảnh Hoa Tươi
Endpoints:
- GET  /api/flower/v1/images/<path:filename>
- GET  /api/flower/v1/images/products/<path:filename>
- GET  /api/flower/v1/products/images/<path:filename>
- GET  /api/flower/v1/flower/images/<path:filename>
- POST /api/flower/v1/admin/upload-image
"""

import os
import sys
import io
import unittest
import json
import time

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from app import app
from anne_auth_service import generate_jwt_token
from flower_config import FLOWER_CONFIG_DIR, PRODUCT_IMAGES_DIR


class TestFlowerImageAPI(unittest.TestCase):
    """Bộ test suite toàn diện kiểm tra các endpoint ảnh hoa tươi qua RESTful API."""

    def setUp(self):
        self.client = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()

        # Tạo token admin hợp lệ cho các test upload
        self.admin_token = generate_jwt_token({
            "id": "admin_01",
            "phone": "0909000001",
            "fullName": "Quản Trị Viên Test",
            "role": "super_admin",
            "branchId": "all"
        })
        self.headers_auth = {
            "Authorization": f"Bearer {self.admin_token}"
        }

    def test_01_get_valid_image_success(self):
        """1. GET /api/flower/v1/images/<file> trả về 200, định dạng ảnh và Cache-Control header."""
        res = self.client.get("/api/flower/v1/images/bo_hoa_01.webp")
        self.assertEqual(res.status_code, 200)
        self.assertIn("image/", res.content_type)
        self.assertIn("Cache-Control", res.headers)
        self.assertIn("max-age=604800", res.headers["Cache-Control"])
        self.assertIn("immutable", res.headers["Cache-Control"])

    def test_02_get_subpath_products_image(self):
        """2. GET /api/flower/v1/images/products/<file> hỗ trợ định tuyến subpath."""
        res = self.client.get("/api/flower/v1/images/products/bo_hoa_01.webp")
        self.assertEqual(res.status_code, 200)
        self.assertIn("image/", res.content_type)

    def test_03_get_products_images_route(self):
        """3. GET /api/flower/v1/products/images/<file> alias hoạt động chính xác."""
        res = self.client.get("/api/flower/v1/products/images/bo_hoa_01.webp")
        self.assertEqual(res.status_code, 200)
        self.assertIn("image/", res.content_type)

    def test_04_get_flower_images_route(self):
        """4. GET /api/flower/v1/flower/images/<file> alias hoạt động chính xác."""
        res = self.client.get("/api/flower/v1/flower/images/bo_hoa_01.webp")
        self.assertEqual(res.status_code, 200)
        self.assertIn("image/", res.content_type)

    def test_05_get_legacy_api_routes(self):
        """5. GET /api/images/<file> và /api/flower/images/<file> tương thích ngược."""
        res1 = self.client.get("/api/images/bo_hoa_01.webp")
        self.assertEqual(res1.status_code, 200)

        res2 = self.client.get("/api/flower/images/bo_hoa_01.webp")
        self.assertEqual(res2.status_code, 200)

    def test_06_get_image_not_found(self):
        """6. Thử truy cập ảnh không tồn tại -> Trả về mã 404 kèm thông báo JSON."""
        res = self.client.get("/api/flower/v1/images/khong_ton_tai_xyz_9999.webp")
        self.assertEqual(res.status_code, 404)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertIn("Không tìm thấy tệp ảnh", data.get("message"))

    def test_07_directory_traversal_protection(self):
        """7. Ngăn chặn tấn công Directory Traversal (../) lấy cắp file hệ thống."""
        res = self.client.get("/api/flower/v1/images/../../config/anne/staff_users.json")
        self.assertIn(res.status_code, [400, 404])

    def test_08_upload_image_multipart_success(self):
        """8. POST /api/flower/v1/admin/upload-image upload file nhị phân thành công."""
        # Tạo file ảnh giả lập dạng byte JPEG
        dummy_content = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xFF\xDB"
        data = {
            "file": (io.BytesIO(dummy_content), "test_flower_upload.jpg")
        }
        res = self.client.post(
            "/api/flower/v1/admin/upload-image",
            headers=self.headers_auth,
            data=data,
            content_type="multipart/form-data"
        )
        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertTrue(body.get("success"))
        img_url = body.get("data", {}).get("url", "")
        self.assertTrue(img_url.startswith(("/api/flower/v1/images/", "/flower/images/")))

    def test_09_upload_image_base64_success(self):
        """9. POST /api/flower/v1/admin/upload-image upload chuỗi Base64 Data URI."""
        b64_str = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
        res = self.client.post(
            "/api/flower/v1/admin/upload-image",
            headers=self.headers_auth,
            json={"image": b64_str}
        )
        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertTrue(body.get("success"))
        self.assertTrue(body.get("data", {}).get("url", "").startswith(("/api/flower/v1/images/", "/flower/images/")))

    def test_10_upload_image_unauthorized(self):
        """10. POST /api/flower/v1/admin/upload-image không kèm Token -> 401 Unauthorized."""
        res = self.client.post(
            "/api/flower/v1/admin/upload-image",
            json={"image": "data:image/jpeg;base64,abc"}
        )
        self.assertEqual(res.status_code, 401)


if __name__ == "__main__":
    unittest.main()
