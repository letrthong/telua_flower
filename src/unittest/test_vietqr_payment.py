import os
import sys
import unittest
import json
from datetime import datetime, timedelta

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from app import app
from vietqr_service import (
    generate_vietqr_payload,
    get_vietqr_quicklink,
    generate_vietqr_base64,
    build_order_payment_info,
    get_default_bank_config,
    _crc16_ccitt
)
from order_service import create_order


class TestVietQRPayment(unittest.TestCase):
    """Kiểm thử chuyên sâu module VietQR Chuẩn Napas EMVCo & Tích hợp Thanh toán Đặt hoa"""

    def setUp(self):
        self.client = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()

    def tearDown(self):
        self.app_context.pop()

    def test_01_crc16_checksum_validity(self):
        """Kiểm tra thuật toán tính mã kiểm tra CRC16/CCITT-FALSE"""
        # Chuỗi test chuẩn
        test_data = "00020101021238540010A00000072701240006970422011009764913230208QRIBFTTA5303704540735000005802VN62170813NHTB ORD123456304"
        crc = _crc16_ccitt(test_data)
        self.assertEqual(len(crc), 4, "Mã CRC phải gồm đúng 4 ký tự Hex")
        self.assertTrue(all(c in "0123456789ABCDEF" for c in crc), "CRC phải là ký tự Hex in hoa")

    def test_02_emvco_payload_structure(self):
        """Kiểm tra cấu trúc chuỗi EMVCo Napas (Tag 00, 01, 38, 53, 54, 58, 62, 63)"""
        amount = 3500000
        order_code = "NHTB-20260902-888"
        payload = generate_vietqr_payload(amount=amount, order_code=order_code)

        # 1. Bắt đầu bằng 000201 (Tag 00: Version 01)
        self.assertTrue(payload.startswith("000201"))
        # 2. Tag 010212 (Dynamic QR có số tiền)
        self.assertIn("010212", payload)
        # 3. Tag 38 chứa GUID Napas A000000727 và Service Code QRIBFTTA
        self.assertIn("A000000727", payload)
        self.assertIn("QRIBFTTA", payload)
        # 4. Tag 5303704 (Tiền tệ VND)
        self.assertIn("5303704", payload)
        # 5. Tag 54 chứa số tiền 3500000
        self.assertIn(f"54{len(str(amount)):02d}{amount}", payload)
        # 6. Tag 5802VN (Quốc gia VN)
        self.assertIn("5802VN", payload)
        # 7. Tag 6304 kết thúc bằng 4 ký tự CRC
        self.assertIn("6304", payload)
        self.assertEqual(len(payload.split("6304")[-1]), 4)

    def test_03_static_qr_payload_without_amount(self):
        """Kiểm tra sinh QR tĩnh (không có số tiền cụ thể)"""
        payload = generate_vietqr_payload(amount=None, order_code="TELUA")
        # Tag 010211 (QR tĩnh)
        self.assertIn("010211", payload)
        self.assertNotIn("530370454", payload)

    def test_04_quicklink_url_format(self):
        """Kiểm tra định dạng QuickLink URL của VietQR Gateway"""
        amount = 840000
        order_code = "NHTB-ORD999"
        url = get_vietqr_quicklink(amount=amount, order_code=order_code)

        cfg = get_default_bank_config()
        self.assertTrue(url.startswith("https://img.vietqr.io/image/"))
        self.assertIn(cfg["bank_code"], url)
        self.assertIn(cfg["account_number"], url)
        self.assertIn("amount=840000", url)
        self.assertIn("addInfo=", url)
        self.assertIn("accountName=", url)

    def test_05_build_order_payment_info(self):
        """Kiểm tra hàm đóng gói dữ liệu thanh toán cho đơn hàng"""
        payment = build_order_payment_info(order_code="NHTB-001", total_amount=1200000, method="vietqr")
        self.assertEqual(payment["method"], "vietqr")
        self.assertEqual(payment["status"], "unpaid")
        self.assertIn("bankInfo", payment)
        self.assertEqual(payment["bankInfo"]["bankCode"], "MB")
        self.assertEqual(payment["bankInfo"]["accountNumber"], "0976491323")
        self.assertEqual(payment["transferContent"], "NHTB NHTB-001")
        self.assertIn("vietqr", payment)
        self.assertTrue(payment["vietqr"]["payload"].startswith("000201"))
        self.assertTrue(payment["vietqr"]["quickLink"].startswith("https://img.vietqr.io/"))

    def test_06_order_creation_with_vietqr(self):
        """Kiểm tra tạo đơn hàng thực tế và xác nhận VietQR được sinh tự động"""
        future_date = (datetime.now().date() + timedelta(days=3)).strftime("%Y-%m-%d")
        order_req = {
            "sender": {
                "name": "Khách Thử Nghiệm VietQR",
                "phone": "0988112233",
                "email": "test_vietqr@gmail.com",
                "isAnonymous": False
            },
            "recipient": {
                "name": "Người Nhận Hoa Mẫu",
                "phone": "0977665544",
                "address": "99 Nguyễn Huệ, Quận 1, TP.HCM",
                "deliveryNotes": "Giao giờ hành chính"
            },
            "delivery": {
                "deliveryDate": future_date,
                "timeSlot": "10:00 - 12:00"
            },
            "customization": {
                "cardMessage": "Chúc mừng khai trương đại hồng phát!",
                "ribbonBanner": "Khai Trương Hồng Phát"
            },
            "items": [
                {
                    "productId": "lan_01",
                    "quantity": 1,
                    "price": 3500000
                }
            ],
            "paymentMethod": "vietqr"
        }

        success, new_order, err = create_order(order_req)
        self.assertTrue(success, f"Lỗi tạo đơn: {err}")
        self.assertIsNotNone(new_order)
        self.assertEqual(new_order["totalAmount"], 3500000)

        # Kiểm tra thông tin thanh toán VietQR
        payment = new_order.get("payment", {})
        self.assertEqual(payment.get("method"), "vietqr")
        self.assertEqual(payment.get("status"), "unpaid")
        self.assertIn("bankInfo", payment)
        self.assertIn("vietqr", payment)
        self.assertTrue(payment["vietqr"]["payload"].startswith("000201"))
        self.assertTrue(payment["vietqr"]["quickLink"].startswith("https://img.vietqr.io/"))
        self.assertTrue(payment["transferContent"].startswith("NHTB"))

        # Kiểm tra gọi API tra cứu QR đơn hàng: GET /api/flower/v1/orders/<order_id>/payment-qr
        resp = self.client.get(f"/api/flower/v1/orders/{new_order['id']}/payment-qr")
        self.assertEqual(resp.status_code, 200)
        json_resp = resp.get_json()
        self.assertTrue(json_resp["success"])
        self.assertEqual(json_resp["data"]["orderId"], new_order["id"])
        self.assertEqual(json_resp["data"]["totalAmount"], 3500000)
        self.assertIn("vietqr", json_resp["data"])
        self.assertTrue(json_resp["data"]["vietqr"]["payload"].startswith("000201"))

    def test_07_get_payment_qr_not_found(self):
        """Kiểm tra tra cứu QR đơn hàng không tồn tại trả về 404"""
        resp = self.client.get("/api/flower/v1/orders/non_existent_order_99999/payment-qr")
        self.assertEqual(resp.status_code, 404)
        self.assertFalse(resp.get_json()["success"])


if __name__ == "__main__":
    unittest.main()
