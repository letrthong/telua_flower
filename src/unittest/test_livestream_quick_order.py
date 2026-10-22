import os
import sys
import unittest
import json
import io
from io import BytesIO

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from app import app
from anne_auth_service import generate_jwt_token
from data_service import get_livestream_config, save_livestream_config, get_order_by_id

class TestLiveStreamQuickOrder(unittest.TestCase):
    """Kiểm thử tính năng Live Stream & Đặt Hàng Nhanh (livestreamConfig.json & Quick Order API)"""

    def setUp(self):
        self.client = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()

        self.admin_token = generate_jwt_token({
            "id": "staff_admin",
            "identifier": "admin@nohoathabinh.vn",
            "role": "super_admin"
        })
        self.manager_token = generate_jwt_token({
            "id": "staff_001",
            "identifier": "0909123456",
            "role": "branch_manager",
            "branchId": "branch_q10"
        })
        self.customer_token = generate_jwt_token({
            "id": "cust_001",
            "identifier": "0987654321",
            "role": "customer"
        })

        self.original_config = get_livestream_config(use_cache=False)

    def tearDown(self):
        if hasattr(self, 'original_config') and self.original_config:
            save_livestream_config(self.original_config)
        self.app_context.pop()

    def test_get_and_save_livestream_config_data_service(self):
        """Kiểm tra đọc và lưu cấu hình livestreamConfig.json qua data_service"""
        cfg = get_livestream_config(use_cache=False)
        self.assertIsInstance(cfg, dict)
        self.assertIn("enableQuickOrder", cfg)
        self.assertIn("bankInfo", cfg)
        self.assertIn("title", cfg)

        # Cập nhật bật cờ enableQuickOrder
        ok, updated, err = save_livestream_config({
            "enableQuickOrder": True,
            "title": "Live Stream Tối Nay - Sale 30%",
            "description": "Nhập thông tin nhận hoa để chốt deal livestream",
            "bankInfo": {
                "bankName": "Techcombank",
                "accountNumber": "190333888999",
                "accountName": "NO HOA THA BINH"
            }
        })
        self.assertTrue(ok)
        self.assertIsNotNone(updated)
        self.assertTrue(updated.get("enableQuickOrder"))
        self.assertEqual(updated.get("title"), "Live Stream Tối Nay - Sale 30%")
        self.assertEqual(updated.get("bankInfo", {}).get("accountNumber"), "190333888999")

    def test_public_and_admin_livestream_config_endpoints(self):
        """Kiểm tra các REST API endpoints /livestream-config và /admin/livestream-config"""
        # 1. Public GET
        res_pub = self.client.get("/api/flower/v1/livestream-config")
        self.assertEqual(res_pub.status_code, 200)
        json_pub = res_pub.get_json()
        self.assertTrue(json_pub.get("success"))
        self.assertIn("enableQuickOrder", json_pub.get("data", {}))

        # 2. Admin GET không token -> 401
        res_unauth = self.client.get("/api/flower/v1/admin/livestream-config")
        self.assertEqual(res_unauth.status_code, 401)

        # 3. Admin GET với token admin -> 200
        res_adm = self.client.get("/api/flower/v1/admin/livestream-config", headers={
            "Authorization": f"Bearer {self.admin_token}"
        })
        self.assertEqual(res_adm.status_code, 200)

        # 4. Cập nhật bật/tắt qua PUT /admin/livestream-config
        res_put = self.client.put("/api/flower/v1/admin/livestream-config", headers={
            "Authorization": f"Bearer {self.admin_token}"
        }, json={
            "enableQuickOrder": True,
            "title": "Live Stream Trưa Nay",
            "description": "Ưu đãi đặc biệt cho người xem live"
        })
        self.assertEqual(res_put.status_code, 200)
        self.assertTrue(res_put.get_json()["data"]["enableQuickOrder"])

    def test_quick_order_when_flag_disabled(self):
        """Khi cờ enableQuickOrder bị tắt, gửi đơn nhanh sẽ bị từ chối 400"""
        save_livestream_config({"enableQuickOrder": False, "enabled": False})

        payload = {
            "recipientName": "Khách Test",
            "phone": "0987111222",
            "address": "123 Đường Số 1, Quận 10",
            "transferredAmount": 450000,
            "paymentProofImage": "https://example.com/proof.jpg"
        }
        res = self.client.post("/api/flower/v1/orders/quick-order", json=payload)
        self.assertEqual(res.status_code, 400)
        json_res = res.get_json()
        self.assertFalse(json_res["success"])
        self.assertIn("tạm tắt", json_res["message"].lower())

    def test_quick_order_validations_when_flag_enabled(self):
        """Kiểm tra các ràng buộc validation khi cờ enableQuickOrder đang bật"""
        save_livestream_config({"enableQuickOrder": True, "enabled": True})

        # Thiếu tên người nhận
        res1 = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "",
            "phone": "0987111222",
            "address": "123 Đường Số 1",
            "transferredAmount": 500000,
            "paymentProofImage": "https://example.com/proof.jpg"
        })
        self.assertEqual(res1.status_code, 400)
        self.assertIn("họ và tên", res1.get_json()["message"].lower())

        # Thiếu số điện thoại
        res2 = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Nguyễn Văn A",
            "phone": "123", # Ngắn hơn 9 số
            "address": "123 Đường Số 1",
            "transferredAmount": 500000,
            "paymentProofImage": "https://example.com/proof.jpg"
        })
        self.assertEqual(res2.status_code, 400)
        self.assertIn("số điện thoại", res2.get_json()["message"].lower())

        # Thiếu địa chỉ
        res3 = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Nguyễn Văn A",
            "phone": "0912345678",
            "address": "",
            "transferredAmount": 500000,
            "paymentProofImage": "https://example.com/proof.jpg"
        })
        self.assertEqual(res3.status_code, 400)
        self.assertIn("địa chỉ", res3.get_json()["message"].lower())

        # Số tiền bằng 0 hoặc không hợp lệ
        res4 = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Nguyễn Văn A",
            "phone": "0912345678",
            "address": "123 Lê Lợi, Q1",
            "transferredAmount": 0,
            "paymentProofImage": "https://example.com/proof.jpg"
        })
        self.assertEqual(res4.status_code, 400)
        self.assertIn("số tiền", res4.get_json()["message"].lower())

        # Thiếu ảnh biên lai
        res5 = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Nguyễn Văn A",
            "phone": "0912345678",
            "address": "123 Lê Lợi, Q1",
            "transferredAmount": 500000
        })
        self.assertEqual(res5.status_code, 400)
        self.assertIn("ảnh", res5.get_json()["message"].lower())

    def test_quick_order_success_with_json_and_lookup(self):
        """Tạo đơn hàng nhanh thành công qua JSON và tra cứu lại chi tiết đơn hàng"""
        save_livestream_config({"enableQuickOrder": True, "enabled": True})

        payload = {
            "recipientName": "Khách Hàng Live Stream",
            "phone": "0976111222",
            "address": "456 CMT8, Phường 11, Quận 3, TP.HCM",
            "transferredAmount": "680000",
            "paymentProofImage": "https://example.com/fake_receipt_bill.png",
            "notes": "Hoa màu hồng phấn giao trước 15h nhé shop"
        }

        res = self.client.post("/api/flower/v1/orders/quick-order", json=payload)
        self.assertEqual(res.status_code, 201)
        res_data = res.get_json()
        self.assertTrue(res_data["success"])

        order = res_data["data"]
        self.assertIsNotNone(order.get("id"))
        self.assertIsNotNone(order.get("orderCode"))
        self.assertEqual(order.get("source"), "livestream_quick_order")
        self.assertEqual(order.get("totalAmount"), 680000)
        self.assertEqual(order.get("paymentProofImage"), "https://example.com/fake_receipt_bill.png")

        # Kiểm tra tra cứu chi tiết đơn hàng bằng admin token
        order_id = order["id"]
        res_get = self.client.get(f"/api/flower/v1/orders/{order_id}", headers={
            "Authorization": f"Bearer {self.admin_token}"
        })
        self.assertEqual(res_get.status_code, 200)
        detail = res_get.get_json()["data"]
        self.assertEqual(detail["recipient"]["name"], "Khách Hàng Live Stream")
        self.assertEqual(detail["payment"]["proofImage"], "https://example.com/fake_receipt_bill.png")

    def test_quick_order_success_with_multipart_file_upload(self):
        """Tạo đơn hàng nhanh thành công qua Multipart Form-Data với file ảnh thật"""
        save_livestream_config({"enableQuickOrder": True, "enabled": True})

        # Tạo file ảnh giả lập
        img_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
        data = {
            "recipientName": "Chị Lan Khách Live",
            "phone": "0918889999",
            "address": "789 Nguyễn Trãi, Quận 5, TP.HCM",
            "transferredAmount": "550,000",
            "notes": "Tặng mẹ sinh nhật",
            "paymentProof": (BytesIO(img_bytes), "bill_chuyen_khoan.png")
        }

        res = self.client.post("/api/flower/v1/orders/quick-order", data=data, content_type="multipart/form-data")
        self.assertEqual(res.status_code, 201)
        res_json = res.get_json()
        self.assertTrue(res_json["success"])
        order = res_json["data"]
        self.assertEqual(order["totalAmount"], 550000)
        self.assertTrue(order["paymentProofImage"].startswith("/api/flower/v1/images/") or "/static/" in order["paymentProofImage"])

    def test_quick_order_with_selected_bouquet(self):
        """Tạo đơn hàng nhanh với lựa chọn bó hoa cụ thể từ danh sách (productId)"""
        save_livestream_config({"enableQuickOrder": True, "enabled": True})

        payload = {
            "recipientName": "Anh Hoàng Khách Live",
            "phone": "0908123789",
            "address": "123 Pasteur, Bến Nghé, Quận 1, TP.HCM",
            "transferredAmount": 880000,
            "paymentProofImage": "https://example.com/receipt.jpg",
            "productId": "gio_hoa_01",
            "productName": "Giỏ Hoa Nắng Sớm",
            "notes": "Ghi thiệp: Chúc mừng khai trương hồng phát"
        }

        res = self.client.post("/api/flower/v1/orders/quick-order", json=payload)
        self.assertEqual(res.status_code, 201)
        res_json = res.get_json()
        self.assertTrue(res_json["success"])
        order = res_json["data"]
        self.assertEqual(order["items"][0]["productId"], "gio_hoa_01")
        self.assertEqual(order["items"][0]["productName"], "Giỏ Hoa Nắng Sớm")
        self.assertEqual(order["items"][0]["price"], 880000)

    def test_livestream_featured_products_config(self):
        """Kiểm tra lưu và nạp cấu hình danh sách bó hoa nổi bật (featuredProductIds)"""
        payload = {
            "enableQuickOrder": True,
            "title": "Phiên Live Bó Hoa Mới Nhất",
            "featuredProductIds": ["gio_hoa_01", "lan_test_1787964482799"]
        }
        res_put = self.client.put("/api/flower/v1/admin/livestream-config", headers={
            "Authorization": f"Bearer {self.admin_token}"
        }, json=payload)
        self.assertEqual(res_put.status_code, 200)

        # Kiểm tra API public trả về đúng featuredProductIds
        res_get = self.client.get("/api/flower/v1/livestream-config")
        self.assertEqual(res_get.status_code, 200)
        data = res_get.get_json()["data"]
        self.assertEqual(data["featuredProductIds"], ["gio_hoa_01", "lan_test_1787964482799"])

if __name__ == "__main__":
    unittest.main()
