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
from order_service import (
    get_available_delivery_slots,
    calculate_haversine_distance,
    assign_nearest_branch,
    create_order,
    generate_order_code
)
from anne_auth_service import generate_jwt_token
from data_service import get_order_by_id, get_customer_by_phone, get_customers


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
        future_date = (datetime.now().date() + timedelta(days=2)).strftime("%Y-%m-%d")
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
                "deliveryDate": future_date,
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
        future_date = (datetime.now().date() + timedelta(days=2)).strftime("%Y-%m-%d")
        order_req = {
            "sender": {"name": "Test Voucher", "phone": "0911000222"},
            "recipient": {"name": "Người Nhận", "phone": "0911000333", "address": "Quận 1, TP.HCM"},
            "delivery": {"deliveryDate": future_date, "timeSlot": "09:00 - 11:00"},
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
        future_date = (datetime.now().date() + timedelta(days=3)).strftime("%Y-%m-%d")

        # 1. GET /api/delivery/slots
        res_slots = self.client.get(f"/api/delivery/slots?date={future_date}")
        self.assertEqual(res_slots.status_code, 200)
        json_slots = res_slots.get_json()
        self.assertTrue(json_slots["success"])
        self.assertGreaterEqual(len(json_slots["data"]["slots"]), 6)

        # 2. POST /api/orders
        order_payload = {
            "sender": {"name": "Khách Test API", "phone": "0988776655"},
            "recipient": {"name": "Người Nhận API", "phone": "0933221100", "address": "Quận 10, TP.HCM"},
            "delivery": {"deliveryDate": future_date, "timeSlot": "09:00 - 11:00"},
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

    def test_08_branch_first_storage_and_admin_fallback(self):
        """Kiểm tra cấu trúc lưu trữ orders/{branch_id}/ và thư mục fallback orders/admin/"""
        from data_service import (
            read_orders_by_month,
            save_order,
            update_order_status,
            get_order_by_id,
            delete_order,
            get_orders_file_path,
            ORDERS_DIR
        )

        # 1. Đơn hàng ngoại tỉnh / không xác định chi nhánh -> lưu vào 'admin'
        unknown_order_req = {
            "sender": {"name": "Khách Ngoại Tỉnh", "phone": "0911000333"},
            "recipient": {"name": "Nhận Ngoại Tỉnh", "phone": "0922000444", "address": "TP. Hà Nội"},
            "items": [{"productId": "bo_hoa_01", "quantity": 1, "price": 420000}]
        }
        success, admin_order, _ = create_order(unknown_order_req)
        self.assertTrue(success)
        self.assertEqual(admin_order["branchId"], "admin")
        self.assertEqual(admin_order["assignedTo"], "staff_admin")

        admin_oid = admin_order["id"]
        # Kiểm tra file vật lý tồn tại trong orders/admin/{YYYY_MM}/{status}/
        from data_service import get_order_file_path
        admin_file_path = get_order_file_path(admin_oid, branch_id="admin", status=admin_order.get("status"))
        self.assertTrue(os.path.exists(admin_file_path))

        # Tìm lại đơn qua get_order_by_id
        found_in_admin = get_order_by_id(admin_oid)
        self.assertIsNotNone(found_in_admin)
        self.assertEqual(found_in_admin["branchId"], "admin")

        # 2. Điều phối chuyển nhượng đơn từ 'admin' sang 'branch_q10' (Reassign)
        updated = update_order_status(
            admin_oid,
            "confirmed",
            branchId="branch_q10",
            assignedTo="staff_manager_q10",
            history=(admin_order.get("history") or []) + [{
                "status": "confirmed",
                "note": "Điều phối từ Admin sang Chi nhánh Q10",
                "updatedBy": "staff_admin"
            }]
        )
        self.assertIsNotNone(updated)
        self.assertEqual(updated["branchId"], "branch_q10")

        # Đơn phải xuất hiện trong orders/branch_q10/ và biến mất khỏi orders/admin/
        q10_orders = read_orders_by_month(branch_id="branch_q10")
        admin_orders = read_orders_by_month(branch_id="admin")
        self.assertTrue(any(o["id"] == admin_oid for o in q10_orders))
        self.assertFalse(any(o["id"] == admin_oid for o in admin_orders))

        # Dọn dẹp đơn test
        delete_order(admin_oid)

    def test_09_query_admin_orders_sort_and_filter_by_updated_at(self):
        """Kiểm tra chức năng Sắp xếp & Lọc theo Ngày mới cập nhật (updatedAt) trên Admin Orders API"""
        from order_service import query_admin_orders, get_order_updated_at
        from data_service import delete_order, update_order_status

        # 1. Tạo 2 đơn hàng thử nghiệm với thời gian cập nhật khác nhau
        admin_user = {"userId": "staff_admin", "role": "super_admin"}
        token = generate_jwt_token(admin_user)

        success1, order1, _ = create_order({
            "sender": {"name": "Khách Test Sort 1", "phone": "0911223344"},
            "recipient": {"name": "Người Nhận Sort 1", "phone": "0911223344", "address": "Quận 10, TP.HCM"},
            "items": [{"productId": "bo_hoa_01", "quantity": 1, "price": 420000}]
        })
        self.assertTrue(success1)
        self.assertIn("updatedAt", order1)

        time.sleep(0.05)

        success2, order2, _ = create_order({
            "sender": {"name": "Khách Test Sort 2", "phone": "0955667788"},
            "recipient": {"name": "Người Nhận Sort 2", "phone": "0955667788", "address": "Quận 10, TP.HCM"},
            "items": [{"productId": "bo_hoa_01", "quantity": 2, "price": 420000}]
        })
        self.assertTrue(success2)

        # Cập nhật order1 sau cùng để order1 có updatedAt mới hơn order2
        time.sleep(0.05)
        now_future_iso = (datetime.now() + timedelta(seconds=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
        update_order_status(order1["id"], "arranging", updatedAt=now_future_iso)

        # 2. Truy vấn sắp xếp theo updatedAt desc (order1 phải đứng trước order2)
        res_updated_desc = query_admin_orders(
            current_user=admin_user,
            timeframe="all",
            sort_by="updatedAt",
            sort_order="desc"
        )
        orders_list = res_updated_desc.get("orders", [])
        o1_idx = next((i for i, o in enumerate(orders_list) if o["id"] == order1["id"]), -1)
        o2_idx = next((i for i, o in enumerate(orders_list) if o["id"] == order2["id"]), -1)
        self.assertNotEqual(o1_idx, -1)
        self.assertNotEqual(o2_idx, -1)
        self.assertLess(o1_idx, o2_idx, "Đơn hàng order1 vừa cập nhật sau phải đứng trước order2 khi sort theo updatedAt desc")

        # 3. Truy vấn sắp xếp theo createdAt desc (order2 tạo sau phải đứng trước order1)
        res_created_desc = query_admin_orders(
            current_user=admin_user,
            timeframe="all",
            sort_by="createdAt",
            sort_order="desc"
        )
        created_list = res_created_desc.get("orders", [])
        o1_c_idx = next((i for i, o in enumerate(created_list) if o["id"] == order1["id"]), -1)
        o2_c_idx = next((i for i, o in enumerate(created_list) if o["id"] == order2["id"]), -1)
        self.assertLess(o2_c_idx, o1_c_idx, "Đơn hàng order2 tạo sau phải đứng trước order1 khi sort theo createdAt desc")

        # 4. Kiểm tra qua REST API endpoint /api/flower/v1/admin/orders
        res_api = self.client.get(
            "/api/flower/v1/admin/orders?timeframe=all&sortBy=updatedAt&sortOrder=desc",
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(res_api.status_code, 200)
        api_data = res_api.get_json()["data"]
        self.assertEqual(api_data["sortBy"], "updatedAt")
        self.assertEqual(api_data["sortOrder"], "desc")

        # Dọn dẹp
        delete_order(order1["id"])
        delete_order(order2["id"])


if __name__ == "__main__":
    unittest.main()
