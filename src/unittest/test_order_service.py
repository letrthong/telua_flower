import os
import sys
import unittest
import json
import time
from datetime import datetime, timedelta

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from app import app
from services.order_service import (
    get_available_delivery_slots,
    calculate_haversine_distance,
    assign_nearest_branch,
    create_order,
    generate_order_code
)
from services.auth_service import generate_jwt_token
from services.data_service import get_order_by_id, get_customer_by_phone, get_customers


class TestOrderService(unittest.TestCase):
    """Bộ kiểm thử nghiệp vụ Đặt Hàng, Hẹn Giờ 30 Ngày, Thiệp, Banner & Phân Phối Chi Nhánh (TASK 03)"""

    def setUp(self):
        self.client = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()

    def tearDown(self):
        self.app_context.pop()

    def test_01_delivery_slots_generation(self):
        """Kiểm tra sinh danh sách khung giờ giao hàng cho các ngày trong 30 ngày tới"""
        future_date = (datetime.now().date() + timedelta(days=5)).strftime("%Y-%m-%d")
        slots = get_available_delivery_slots(future_date)

        self.assertGreaterEqual(len(slots), 6, "Phải có ít nhất 6 khung giờ chuẩn trong ngày")
        for s in slots:
            self.assertIn("id", s)
            self.assertIn("name", s)
            self.assertIn("start", s)
            self.assertIn("end", s)
            self.assertTrue(s["available"], "Các ngày trong tương lai slot phải khả dụng")

    def test_02_haversine_and_branch_assignment(self):
        """Kiểm tra thuật toán định vị Haversine và phân bổ Showroom gần nhất"""
        # Tọa độ khu vực Thảo Điền (gần Showroom Thảo Điền)
        thao_dien_lat, thao_dien_lng = 10.8030, 106.7320
        branch_td = assign_nearest_branch("Quận 2, TP.HCM", thao_dien_lat, thao_dien_lng)
        self.assertEqual(branch_td, "branch_thao_dien")

        # Tọa độ khu vực Chợ Bến Thành Quận 1 (gần Showroom Q1)
        q1_lat, q1_lng = 10.7720, 106.6980
        branch_q1 = assign_nearest_branch("Lê Thánh Tôn, Quận 1, TP.HCM", q1_lat, q1_lng)
        self.assertEqual(branch_q1, "branch_q1")

        # Phân bổ qua từ khóa địa chỉ khi không có GPS
        self.assertEqual(assign_nearest_branch("123 Thảo Điền, TP. Thủ Đức"), "branch_thao_dien")
        self.assertEqual(assign_nearest_branch("45 Hai Bà Trưng, Quận 1"), "branch_q1")
        self.assertEqual(assign_nearest_branch("183 Đường 3/2, Quận 10"), "branch_q10")

    def test_03_create_order_full_success(self):
        """Kiểm tra tạo đơn hàng hoàn chỉnh với Hẹn giờ, Thiệp, Banner và Tích điểm CRM"""
        del_date = (datetime.now().date() + timedelta(days=2)).strftime("%Y-%m-%d")
        order_req = {
            "sender": {
                "name": "Nguyễn Văn A",
                "phone": "0987654321",
                "email": "nva@gmail.com",
                "isAnonymous": False
            },
            "recipient": {
                "name": "Trần Thị Thu Hà",
                "phone": "0912345678",
                "address": "183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP.HCM",
                "deliveryNotes": "Tòa nhà đối diện công viên, gửi bảo vệ nếu không nghe máy"
            },
            "delivery": {
                "deliveryDate": del_date,
                "timeSlot": "09:00 - 11:00",
                "isExpress2H": False
            },
            "customization": {
                "cardMessage": "Chúc em sinh nhật vui vẻ, luôn rạng ngời và hạnh phúc!",
                "ribbonBanner": "Happy Birthday My Love"
            },
            "items": [
                {
                    "productId": "bo_hoa_01",
                    "quantity": 2,
                    "price": 420000
                }
            ],
            "paymentMethod": "vietqr"
        }

        success, new_order, err = create_order(order_req)
        self.assertTrue(success, f"Lỗi tạo đơn hàng: {err}")
        self.assertIsNotNone(new_order)
        self.assertEqual(new_order["status"], "pending")
        self.assertTrue(new_order["orderCode"].startswith("NHTB-"))
        self.assertEqual(new_order["customization"]["cardMessage"], "Chúc em sinh nhật vui vẻ, luôn rạng ngời và hạnh phúc!")
        self.assertEqual(new_order["recipient"]["deliveryNotes"], "Tòa nhà đối diện công viên, gửi bảo vệ nếu không nghe máy")
        self.assertEqual(new_order["financials"]["subtotal"], 840000)

        # Đơn >= 500k được freeship
        self.assertEqual(new_order["financials"]["shippingFee"], 0)
        self.assertEqual(new_order["totalAmount"], 840000)

        # Kiểm tra đồng bộ điểm CRM
        cust = get_customer_by_phone("0987654321")
        self.assertIsNotNone(cust)
        self.assertGreaterEqual(cust["loyaltyPoints"], 50 + 84)

    def test_04_create_order_anonymous_sender(self):
        """Kiểm tra tính năng gửi hoa bí mật (Ẩn danh người gửi)"""
        order_req = {
            "sender": {
                "name": "Người Yêu Cũ",
                "phone": "0909999888",
                "isAnonymous": True
            },
            "recipient": {
                "name": "Lê Thị C",
                "phone": "0911223344",
                "address": "456 Nguyễn Đình Chiểu, Q.3, TP.HCM"
            },
            "delivery": {
                "deliveryDate": datetime.now().date().strftime("%Y-%m-%d"),
                "timeSlot": "14:00 - 16:00"
            },
            "items": [
                {"productId": "bo_hoa_01", "quantity": 1, "price": 420000}
            ]
        }

        success, new_order, _ = create_order(order_req)
        self.assertTrue(success)
        self.assertTrue(new_order["sender"]["isAnonymous"])
        # Tên người gửi công khai được ẩn đi
        self.assertEqual(new_order["sender"]["name"], "Người gửi bí mật (Ẩn danh)")
        # Hệ thống nội bộ vẫn giữ realName
        self.assertEqual(new_order["sender"]["realName"], "Người Yêu Cũ")

    def test_05_create_order_with_percentage_voucher(self):
        """Kiểm tra áp dụng voucher giảm 15% PHUNU15"""
        order_req = {
            "sender": {"name": "Test Voucher", "phone": "0911000222"},
            "recipient": {"name": "Người Nhận", "phone": "0911000333", "address": "Quận 1, TP.HCM"},
            "items": [{"productId": "bo_hoa_01", "quantity": 2, "price": 420000}],  # 840.000
            "voucherCode": "PHUNU15"
        }

        success, new_order, _ = create_order(order_req)
        self.assertTrue(success)
        # Giảm 15% của 840k = 126.000
        self.assertEqual(new_order["financials"]["discountAmount"], 126000)
        self.assertEqual(new_order["totalAmount"], 840000 - 126000)

    def test_06_create_order_validation_errors(self):
        """Kiểm tra chặn các trường hợp thiếu dữ liệu hoặc ngày giao vượt quá 30 ngày"""
        # 1. Thiếu thông tin người nhận
        bad_req_1 = {
            "sender": {"phone": "0987654321"},
            "recipient": {},
            "items": [{"productId": "bo_hoa_01", "quantity": 1}]
        }
        success_1, _, err_1 = create_order(bad_req_1)
        self.assertFalse(success_1)
        self.assertIn("người nhận", err_1)

        # 2. Ngày giao quá 30 ngày trong tương lai (35 ngày)
        far_date = (datetime.now().date() + timedelta(days=35)).strftime("%Y-%m-%d")
        bad_req_2 = {
            "sender": {"phone": "0987654321"},
            "recipient": {"name": "A", "phone": "091", "address": "B"},
            "delivery": {"deliveryDate": far_date},
            "items": [{"productId": "bo_hoa_01", "quantity": 1}]
        }
        success_2, _, err_2 = create_order(bad_req_2)
        self.assertFalse(success_2)
        self.assertIn("30 ngày", err_2)

    def test_07_flask_api_delivery_and_orders_endpoints(self):
        """Kiểm tra các HTTP REST Endpoints: GET /api/delivery/slots, POST /api/orders, GET /api/orders/<id>"""
        # 1. GET /api/delivery/slots
        res_slots = self.client.get("/api/delivery/slots?date=2026-08-25")
        self.assertEqual(res_slots.status_code, 200)
        json_slots = res_slots.get_json()
        self.assertTrue(json_slots["success"])
        self.assertGreaterEqual(len(json_slots["data"]["slots"]), 6)

        # 2. POST /api/orders
        order_payload = {
            "sender": {"name": "Khách Test API", "phone": "0988776655"},
            "recipient": {"name": "Người Nhận API", "phone": "0933221100", "address": "Quận 10, TP.HCM"},
            "delivery": {"deliveryDate": "2026-08-25", "timeSlot": "09:00 - 11:00"},
            "items": [{"productId": "bo_hoa_01", "quantity": 1, "price": 420000}]
        }
        res_order = self.client.post("/api/orders", json=order_payload)
        self.assertEqual(res_order.status_code, 201)
        order_created = res_order.get_json()["data"]
        order_id = order_created["id"]

        # 3. GET /api/orders/<id>
        res_get = self.client.get(f"/api/orders/{order_id}")
        self.assertEqual(res_get.status_code, 200)
        self.assertEqual(res_get.get_json()["data"]["id"], order_id)


if __name__ == "__main__":
    unittest.main()
