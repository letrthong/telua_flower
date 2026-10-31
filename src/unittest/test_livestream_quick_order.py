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
from data_service import get_livestream_config, save_livestream_config, get_order_by_id, build_order_shortcut_item

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

    def test_admin_orders_filter_by_source_livestream(self):
        """Kiểm tra API GET /admin/orders?source=livestream_quick_order trả về đúng các đơn Live Stream"""
        save_livestream_config({"enableQuickOrder": True, "enabled": True})

        # Tạo 1 đơn Live Stream
        phone_live = "0981112233"
        res_create = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Khách Test Live Source",
            "phone": phone_live,
            "address": "456 Lê Duẩn, Q.1, TP.HCM",
            "transferredAmount": 790000,
            "paymentProofImage": "https://example.com/receipt_live_source.jpg"
        })
        self.assertEqual(res_create.status_code, 201)

        # Truy vấn với filter source=livestream_quick_order
        res = self.client.get("/api/flower/v1/admin/orders?timeframe=all&source=livestream_quick_order", headers={
            "Authorization": f"Bearer {self.admin_token}"
        })
        self.assertEqual(res.status_code, 200)
        res_data = res.get_json()["data"]
        orders = res_data.get("orders", [])
        self.assertGreater(len(orders), 0)

        # Tìm đơn vừa tạo trong danh sách
        found = [o for o in orders if o.get("orderCode") == phone_live or (o.get("recipient") or {}).get("phone") == phone_live]
        self.assertTrue(len(found) > 0, "Không tìm thấy đơn Live Stream khi lọc qua source=livestream_quick_order")
        live_ord = found[0]
        self.assertEqual(live_ord.get("source"), "livestream_quick_order")
        self.assertTrue(live_ord.get("proofImage") or (live_ord.get("payment") or {}).get("proofImage"))

    def test_admin_orders_search_livestream_by_phone_and_recipient(self):
        """Kiểm tra tìm kiếm đơn Live Stream theo SĐT và tên khách hàng"""
        save_livestream_config({"enableQuickOrder": True, "enabled": True})

        test_phone = "0977889900"
        test_name = "Chị Ngọc Live Stream VIP"
        res_create = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": test_name,
            "phone": test_phone,
            "address": "99 Nguyễn Huệ, Q.1, TP.HCM",
            "transferredAmount": 920000,
            "paymentProofImage": "https://example.com/receipt_ngoc.jpg"
        })
        self.assertEqual(res_create.status_code, 201)

        # 1. Tìm theo SĐT trong phân hệ Live Stream
        res_phone = self.client.get(f"/api/flower/v1/admin/orders?timeframe=all&source=livestream_quick_order&search={test_phone}", headers={
            "Authorization": f"Bearer {self.admin_token}"
        })
        self.assertEqual(res_phone.status_code, 200)
        orders_phone = res_phone.get_json()["data"].get("orders", [])
        self.assertTrue(any(o.get("orderCode") == test_phone or (o.get("recipient") or {}).get("phone") == test_phone for o in orders_phone))

        # 2. Tìm theo tên khách hàng
        res_name = self.client.get(f"/api/flower/v1/admin/orders?timeframe=all&source=livestream_quick_order&search=Ngọc", headers={
            "Authorization": f"Bearer {self.admin_token}"
        })
        self.assertEqual(res_name.status_code, 200)
        orders_name = res_name.get_json()["data"].get("orders", [])
        self.assertTrue(any(test_name.lower() in ((o.get("recipient") or {}).get("name") or "").lower() for o in orders_name))

    def test_admin_orders_livestream_status_filtering(self):
        """Kiểm tra lọc đơn Live Stream theo trạng thái (status=pending, confirmed, etc.)"""
        save_livestream_config({"enableQuickOrder": True, "enabled": True})

        test_phone = "0933445566"
        res_create = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Khách Live Status Test",
            "phone": test_phone,
            "address": "123 Hai Bà Trưng, Q.3, TP.HCM",
            "transferredAmount": 650000,
            "paymentProofImage": "https://example.com/receipt_st.jpg"
        })
        self.assertEqual(res_create.status_code, 201)

        # Lọc status=pending
        res_pending = self.client.get("/api/flower/v1/admin/orders?timeframe=all&source=livestream_quick_order&status=pending", headers={
            "Authorization": f"Bearer {self.admin_token}"
        })
        self.assertEqual(res_pending.status_code, 200)
        orders_pending = res_pending.get_json()["data"].get("orders", [])
        self.assertTrue(all(o.get("status") == "pending" for o in orders_pending))

        # Lọc status=completed (không được chứa đơn pending vừa tạo)
        res_completed = self.client.get("/api/flower/v1/admin/orders?timeframe=all&source=livestream_quick_order&status=completed", headers={
            "Authorization": f"Bearer {self.admin_token}"
        })
        self.assertEqual(res_completed.status_code, 200)
        orders_completed = res_completed.get_json()["data"].get("orders", [])
        self.assertFalse(any(o.get("orderCode") == test_phone for o in orders_completed))

    def test_order_shortcut_item_contains_source_and_proof(self):
        """Kiểm tra build_order_shortcut_item bảo lưu đầy đủ trường source, orderType và ảnh bill"""
        mock_order = {
            "id": "ord_mock_123456",
            "orderCode": "0999888777",
            "createdAt": "2026-10-22T10:00:00Z",
            "updatedAt": "2026-10-22T10:00:00Z",
            "status": "pending",
            "source": "livestream_quick_order",
            "orderType": "livestream_quick",
            "branchId": "admin",
            "recipient": {"name": "Test Shortcut", "phone": "0999888777", "address": "123 HCM"},
            "sender": {"name": "Test Shortcut", "phone": "0999888777"},
            "totalAmount": 1200000,
            "transferredAmount": 1200000,
            "payment": {
                "status": "pending_confirmation",
                "method": "vietqr",
                "proofImage": "/images/proof_mock.webp",
                "transferredAmount": 1200000
            },
            "proofImage": "/images/proof_mock.webp",
            "paymentProofImage": "/images/proof_mock.webp",
            "items": [{"productId": "bo_hoa_01", "productName": "Hoa Hồng", "quantity": 1, "price": 1200000}]
        }

        shortcut = build_order_shortcut_item(mock_order)
        self.assertEqual(shortcut.get("source"), "livestream_quick_order")
        self.assertEqual(shortcut.get("orderType"), "livestream_quick")
        self.assertEqual(shortcut.get("proofImage"), "/images/proof_mock.webp")
        self.assertEqual(shortcut.get("paymentProofImage"), "/images/proof_mock.webp")
        self.assertEqual(shortcut.get("transferredAmount"), 1200000)
        self.assertEqual((shortcut.get("payment") or {}).get("proofImage"), "/images/proof_mock.webp")

    def test_livestream_toggle_quick_order_workflow(self):
        """Kiểm tra luồng bật/tắt nhận đơn Live Stream ảnh hưởng tức thì đến API chốt đơn"""
        # 1. Tắt nhận đơn
        res_off = self.client.put("/api/flower/v1/admin/livestream-config", headers={
            "Authorization": f"Bearer {self.admin_token}"
        }, json={"enableQuickOrder": False, "enabled": False})
        self.assertEqual(res_off.status_code, 200)

        # 2. Khách thử gửi đơn -> Phải bị chặn 400
        res_fail = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Khách Gửi Đơn Lúc Tắt Live",
            "phone": "0911222333",
            "address": "123 Tắt Live, Q.1",
            "transferredAmount": 500000,
            "paymentProofImage": "https://example.com/receipt.jpg"
        })
        self.assertEqual(res_fail.status_code, 400)
        self.assertIn("tạm", res_fail.get_json()["message"].lower())

        # 3. Bật nhận đơn lại
        res_on = self.client.put("/api/flower/v1/admin/livestream-config", headers={
            "Authorization": f"Bearer {self.admin_token}"
        }, json={"enableQuickOrder": True, "enabled": True})
        self.assertEqual(res_on.status_code, 200)

        # 4. Khách gửi đơn lại -> Thành công 201
        res_ok = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Khách Gửi Đơn Lúc Bật Live",
            "phone": "0911222333",
            "address": "123 Bật Live, Q.1",
            "transferredAmount": 500000,
            "paymentProofImage": "https://example.com/receipt.jpg"
        })
        self.assertEqual(res_ok.status_code, 201)

    def test_livestream_order_fulfillment_workflow(self):
        """
        Kiểm tra trọn vẹn luồng fulfillment của shop cho đơn Live Stream:
        1. Xác nhận đơn (confirmed)
        2. Tải ảnh hoa thành phẩm thực tế (photo_sent)
        3. Gán Shipper và chuyển sang giao hàng (shipping kèm shipperName, shipperPhone)
        4. Hoàn thành đơn hàng (delivered / completed)
        """
        save_livestream_config({"enableQuickOrder": True, "enabled": True})

        # Bước 0: Tạo đơn chốt từ phiên Live
        res_create = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Chị Lan Chốt Đơn Trực Tiếp",
            "phone": "0918765432",
            "address": "88 Nguyễn Huệ, Quận 1, TP.HCM",
            "transferredAmount": 1500000,
            "paymentProofImage": "https://example.com/bill_lan.jpg",
            "notes": "Giao trước 17h chiều"
        })
        self.assertEqual(res_create.status_code, 201)
        order_id = res_create.get_json()["data"]["id"]

        # Bước 1: Shop bấm Xác nhận đơn -> status: confirmed
        res_step1 = self.client.put(f"/api/flower/v1/admin/orders/{order_id}/status", headers={
            "Authorization": f"Bearer {self.admin_token}"
        }, json={"status": "confirmed"})
        self.assertEqual(res_step1.status_code, 200)
        data_step1 = res_step1.get_json()["data"]
        self.assertEqual(data_step1["status"], "confirmed")

        # Bước 2: Shop chụp & tải ảnh hoa thành phẩm thực tế -> status: photo_sent
        res_step2 = self.client.post(f"/api/flower/v1/admin/orders/{order_id}/photo", headers={
            "Authorization": f"Bearer {self.admin_token}"
        }, json={
            "photoUrl": "https://example.com/actual_flower_lan.jpg"
        })
        self.assertEqual(res_step2.status_code, 200)
        data_step2 = res_step2.get_json()["data"]
        self.assertEqual(data_step2["status"], "photo_sent")
        self.assertEqual(data_step2["flowerPhoto"]["photoUrl"], "https://example.com/actual_flower_lan.jpg")

        # Bước 3: Shop gán Shipper (Tên, SĐT) & Bắt đầu giao hàng -> status: shipping
        res_step3 = self.client.put(f"/api/flower/v1/admin/orders/{order_id}/status", headers={
            "Authorization": f"Bearer {self.admin_token}"
        }, json={
            "status": "shipping",
            "shipperName": "Bác Ba Shipper",
            "shipperPhone": "0908889999",
            "note": "Gán shipper Bác Ba Shipper (0908889999) & bắt đầu giao"
        })
        self.assertEqual(res_step3.status_code, 200)
        data_step3 = res_step3.get_json()["data"]
        self.assertEqual(data_step3["status"], "shipping")
        self.assertEqual(data_step3["delivery"]["shipperName"], "Bác Ba Shipper")
        self.assertEqual(data_step3["delivery"]["shipperPhone"], "0908889999")

        # Bước 4: Shop bấm Hoàn thành đơn hàng -> status: delivered
        res_step4 = self.client.put(f"/api/flower/v1/admin/orders/{order_id}/status", headers={
            "Authorization": f"Bearer {self.admin_token}"
        }, json={"status": "delivered"})
        self.assertEqual(res_step4.status_code, 200)
        data_step4 = res_step4.get_json()["data"]
        self.assertEqual(data_step4["status"], "delivered")

        # Kiểm tra đọc lại đơn hàng từ API chi tiết
        res_detail = self.client.get(f"/api/flower/v1/orders/{order_id}", headers={
            "Authorization": f"Bearer {self.admin_token}"
        })
        self.assertEqual(res_detail.status_code, 200)
        final_order = res_detail.get_json()["data"]
        self.assertEqual(final_order["status"], "delivered")
        self.assertEqual(final_order["delivery"]["shipperName"], "Bác Ba Shipper")
        self.assertEqual(final_order["delivery"]["shipperPhone"], "0908889999")
        self.assertEqual(final_order["flowerPhoto"]["photoUrl"], "https://example.com/actual_flower_lan.jpg")

    def test_livestream_daily_storage_and_date_filter(self):
        """
        Kiểm tra lưu trữ đơn Live Stream theo ngày (config/anne/livestream_orders/{YYYY-MM-DD}.json)
        và bộ lọc API chọn ngày (GET /admin/orders?source=livestream_quick_order&date=YYYY-MM-DD).
        """
        from datetime import datetime
        today_str = datetime.now().strftime("%Y-%m-%d")

        save_livestream_config({"enableQuickOrder": True, "enabled": True})

        # 1. Tạo đơn Live Stream
        res_create = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Khách Test Ngày Live",
            "phone": "0934567890",
            "address": "123 Cách Mạng Tháng 8, Q.10",
            "transferredAmount": 650000,
            "paymentProofImage": "https://example.com/receipt_date_test.jpg"
        })
        self.assertEqual(res_create.status_code, 201)
        created_order = res_create.get_json()["data"]
        order_id = created_order["id"]
        self.assertEqual(created_order.get("orderDate"), today_str)

        # 2. Kiểm tra API lấy danh sách ngày có đơn Live Stream
        res_dates = self.client.get("/api/flower/v1/admin/livestream/dates", headers={
            "Authorization": f"Bearer {self.admin_token}"
        })
        self.assertEqual(res_dates.status_code, 200)
        dates_list = res_dates.get_json()["data"]
        self.assertIn(today_str, dates_list)

        # 3. Kiểm tra API lọc đơn Live Stream theo ngày hôm nay -> Phải tìm thấy đơn
        res_filter_today = self.client.get(f"/api/flower/v1/admin/orders?source=livestream_quick_order&date={today_str}", headers={
            "Authorization": f"Bearer {self.admin_token}"
        })
        self.assertEqual(res_filter_today.status_code, 200)
        today_orders = res_filter_today.get_json()["data"].get("orders", [])
        matched = [o for o in today_orders if o.get("id") == order_id or o.get("orderCode") == "0934567890"]
        self.assertTrue(len(matched) > 0, "Đơn hàng phải xuất hiện trong kết quả lọc của ngày hôm nay")

        # 4. Kiểm tra API lọc theo một ngày khác không có đơn (ví dụ: 2025-01-01) -> Không có đơn này
        res_filter_diff = self.client.get("/api/flower/v1/admin/orders?source=livestream_quick_order&date=2025-01-01", headers={
            "Authorization": f"Bearer {self.admin_token}"
        })
        self.assertEqual(res_filter_diff.status_code, 200)
        diff_orders = res_filter_diff.get_json()["data"].get("orders", [])
        matched_diff = [o for o in diff_orders if o.get("id") == order_id]
        self.assertEqual(len(matched_diff), 0, "Không được xuất hiện đơn trong ngày khác")

    def test_order_status_cannot_revert_backwards(self):
        """
        Kiểm tra trạng thái đơn hàng không thể chuyển ngược lại (Forward-only Workflow):
        - Đơn đã confirmed không được lùi về pending
        - Đơn đã shipping không được lùi về arranging hoặc confirmed
        """
        save_livestream_config({"enableQuickOrder": True, "enabled": True})

        # 1. Tạo đơn mới (pending)
        res_create = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Khách Test Backward",
            "phone": "0988776655",
            "address": "123 Hai Bà Trưng, Q.1",
            "transferredAmount": 500000,
            "paymentProofImage": "https://example.com/receipt_backward.jpg"
        })
        self.assertEqual(res_create.status_code, 201)
        order_id = res_create.get_json()["data"]["id"]

        # 2. Xác nhận đơn -> status: confirmed (hợp lệ)
        res_conf = self.client.put(f"/api/flower/v1/admin/orders/{order_id}/status", headers={
            "Authorization": f"Bearer {self.admin_token}"
        }, json={"status": "confirmed"})
        self.assertEqual(res_conf.status_code, 200)

        # 3. Thử chuyển ngược từ confirmed về pending -> Phải bị từ chối 400
        res_revert_pending = self.client.put(f"/api/flower/v1/admin/orders/{order_id}/status", headers={
            "Authorization": f"Bearer {self.admin_token}"
        }, json={"status": "pending"})
        self.assertEqual(res_revert_pending.status_code, 400)
        self.assertIn("không thể đổi ngược", res_revert_pending.get_json()["message"].lower())

        # 4. Chuyển tiếp sang shipping -> status: shipping (hợp lệ)
        res_shipping = self.client.put(f"/api/flower/v1/admin/orders/{order_id}/status", headers={
            "Authorization": f"Bearer {self.admin_token}"
        }, json={"status": "shipping", "shipperName": "Bác Tư"})
        self.assertEqual(res_shipping.status_code, 200)

        # 5. Thử chuyển ngược từ shipping về arranging -> Phải bị từ chối 400
        res_revert_arranging = self.client.put(f"/api/flower/v1/admin/orders/{order_id}/status", headers={
            "Authorization": f"Bearer {self.admin_token}"
        }, json={"status": "arranging"})
        self.assertEqual(res_revert_arranging.status_code, 400)
        self.assertIn("không thể đổi ngược", res_revert_arranging.get_json()["message"].lower())

    def test_order_status_cannot_change_when_completed_or_cancelled(self):
        """
        Kiểm tra đơn hàng khi đã hoàn thành (delivered, completed) hoặc đã hủy (cancelled)
        thì bị khóa, không thể chỉnh sửa hoặc chuyển sang bất kỳ trạng thái nào khác.
        """
        save_livestream_config({"enableQuickOrder": True, "enabled": True})

        # 1. Tạo đơn & giao thành công
        res_create = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Khách Test Completed Lock",
            "phone": "0911556677",
            "address": "456 CMT8, Q.3",
            "transferredAmount": 800000,
            "paymentProofImage": "https://example.com/receipt_lock.jpg"
        })
        self.assertEqual(res_create.status_code, 201)
        order_id = res_create.get_json()["data"]["id"]

        # Chuyển tuần tự đến delivered
        self.client.put(f"/api/flower/v1/admin/orders/{order_id}/status", headers={"Authorization": f"Bearer {self.admin_token}"}, json={"status": "confirmed"})
        self.client.put(f"/api/flower/v1/admin/orders/{order_id}/status", headers={"Authorization": f"Bearer {self.admin_token}"}, json={"status": "shipping"})
        res_deliv = self.client.put(f"/api/flower/v1/admin/orders/{order_id}/status", headers={"Authorization": f"Bearer {self.admin_token}"}, json={"status": "delivered"})
        self.assertEqual(res_deliv.status_code, 200)

        # 2. Đơn đã delivered, cố gắng sửa sang bất kỳ trạng thái nào -> Phải bị chặn 400
        # Thử lùi về shipping
        res_mod1 = self.client.put(f"/api/flower/v1/admin/orders/{order_id}/status", headers={
            "Authorization": f"Bearer {self.admin_token}"
        }, json={"status": "shipping"})
        self.assertEqual(res_mod1.status_code, 400)
        self.assertIn("không thể thay đổi trạng thái", res_mod1.get_json()["message"].lower())

        # Thử hủy đơn đã delivered
        res_mod2 = self.client.put(f"/api/flower/v1/admin/orders/{order_id}/status", headers={
            "Authorization": f"Bearer {self.admin_token}"
        }, json={"status": "cancelled"})
        self.assertEqual(res_mod2.status_code, 400)

        # 3. Thử tải ảnh hoa khi đơn đã delivered -> Phải bị chặn 400
        res_photo = self.client.post(f"/api/flower/v1/admin/orders/{order_id}/photo", headers={
            "Authorization": f"Bearer {self.admin_token}"
        }, json={"photoUrl": "https://example.com/late_photo.jpg"})
        self.assertEqual(res_photo.status_code, 400)

    def test_lookup_phone_exact_match_not_substring(self):
        """Kiểm tra tra cứu SĐT phải khớp chính xác, không được trả về đơn cũ của số khác do trùng chuỗi con"""
        save_livestream_config({"enableQuickOrder": True, "enabled": True})
        # 1. Tạo đơn cho số 0356148008
        self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Khách Chính Chủ",
            "phone": "0356148008",
            "address": "123 Đường A, Q.1",
            "transferredAmount": 500000,
            "paymentProofImage": "https://example.com/proof1.jpg"
        })

        # 2. Khách nhập số mới 035614800 (9 chữ số, là chuỗi con của 0356148008)
        res_partial = self.client.get("/api/flower/v1/orders/lookup?query=035614800")
        self.assertEqual(res_partial.status_code, 200)
        data_partial = res_partial.get_json()["data"]
        # Phải trả về rỗng, không được hiện đơn của số 0356148008!
        self.assertEqual(len(data_partial), 0)

        # 3. Khách nhập đúng số 0356148008 -> Phải tìm thấy
        res_exact = self.client.get("/api/flower/v1/orders/lookup?query=0356148008")
        self.assertEqual(res_exact.status_code, 200)
        data_exact = res_exact.get_json()["data"]
        self.assertGreaterEqual(len(data_exact), 1)

    def test_multiple_orders_same_phone_preserves_all_orders(self):
        """Kiểm tra khi một số điện thoại đặt 2-3 lần trong phiên live:
        - Mỗi đơn có mã đơn riêng (LIVE-YYMMDD-XXXX)
        - Không đơn nào bị ghi đè hay mất
        - Tra cứu theo số điện thoại trả về đầy đủ tất cả các đơn đã đặt, sắp xếp mới nhất trước
        """
        save_livestream_config({"enableQuickOrder": True, "enabled": True})
        test_phone = "0934111222"

        # Đặt đơn 1
        res1 = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Khách Quen 3 Lần",
            "phone": test_phone,
            "address": "Địa chỉ đơn 1",
            "transferredAmount": 300000,
            "paymentProofImage": "https://example.com/bill1.jpg"
        })
        self.assertEqual(res1.status_code, 201)
        o1 = res1.get_json()["data"]

        # Đặt đơn 2
        res2 = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Khách Quen 3 Lần",
            "phone": test_phone,
            "address": "Địa chỉ đơn 2",
            "transferredAmount": 500000,
            "paymentProofImage": "https://example.com/bill2.jpg"
        })
        self.assertEqual(res2.status_code, 201)
        o2 = res2.get_json()["data"]

        # Đặt đơn 3
        res3 = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Khách Quen 3 Lần",
            "phone": test_phone,
            "address": "Địa chỉ đơn 3",
            "transferredAmount": 700000,
            "paymentProofImage": "https://example.com/bill3.jpg"
        })
        self.assertEqual(res3.status_code, 201)
        o3 = res3.get_json()["data"]

        # Kiểm tra mã đơn mỗi lần đặt là duy nhất và khác nhau
        self.assertNotEqual(o1["orderCode"], o2["orderCode"])
        self.assertNotEqual(o2["orderCode"], o3["orderCode"])
        self.assertTrue(o1["orderCode"].startswith("LIVE-"))
        self.assertTrue(o2["orderCode"].startswith("LIVE-"))
        self.assertTrue(o3["orderCode"].startswith("LIVE-"))

        # Tra cứu theo số điện thoại
        res_lookup = self.client.get(f"/api/flower/v1/orders/lookup?query={test_phone}")
        self.assertEqual(res_lookup.status_code, 200)
        orders = res_lookup.get_json()["data"]

        # Phải trả về đủ 3 đơn hàng
        self.assertEqual(len(orders), 3)
        amounts = [ord_item["totalAmount"] for ord_item in orders]
        self.assertEqual(amounts, [700000, 500000, 300000])

    def test_quick_order_delivery_date_and_time_defaults_to_today(self):
        """
        Kiểm tra ngày nhận hoa và thời gian nhận trong Quick Order:
        - Mặc định là ngày hôm nay (YYYY-MM-DD) và khung giờ mặc định khi không truyền.
        - Lưu và trả về đúng ngày nhận + khung giờ nhận khi khách chọn cụ thể.
        """
        from datetime import datetime
        today_str = datetime.now().strftime("%Y-%m-%d")

        # 1. Đặt đơn không truyền deliveryDate/deliveryTime -> mặc định hôm nay
        res_default = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Khách Mặc Định Hôm Nay",
            "phone": "0912000111",
            "address": "100 Nguyễn Huệ, Quận 1",
            "transferredAmount": 450000,
            "paymentProofImage": "https://example.com/bill_today.jpg"
        })
        self.assertEqual(res_default.status_code, 201)
        ord_default = res_default.get_json()["data"]
        self.assertEqual(ord_default.get("deliveryDate"), today_str)
        self.assertEqual(ord_default.get("delivery", {}).get("deliveryDate"), today_str)
        self.assertEqual(ord_default.get("delivery", {}).get("timeSlot"), "Giao ngay trong ngày (Sớm nhất)")

        # 2. Đặt đơn có chọn ngày nhận và khung giờ nhận cụ thể
        custom_date = "2026-12-25"
        custom_slot = "15:00 - 17:00 (Xế chiều)"
        res_custom = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Khách Hẹn Giờ Giao",
            "phone": "0912000222",
            "address": "200 Lê Lợi, Quận 1",
            "deliveryDate": custom_date,
            "deliveryTime": custom_slot,
            "transferredAmount": 650000,
            "paymentProofImage": "https://example.com/bill_custom.jpg"
        })
        self.assertEqual(res_custom.status_code, 201)
        ord_custom = res_custom.get_json()["data"]
        self.assertEqual(ord_custom.get("deliveryDate"), custom_date)
        self.assertEqual(ord_custom.get("deliveryTime"), custom_slot)
        self.assertEqual(ord_custom.get("delivery", {}).get("deliveryDate"), custom_date)
        self.assertEqual(ord_custom.get("delivery", {}).get("timeSlot"), custom_slot)

        # 3. Kiểm tra API lookup trả về đúng deliveryDate & deliveryTimeSlot
        res_lookup = self.client.get("/api/flower/v1/orders/lookup?query=0912000222")
        self.assertEqual(res_lookup.status_code, 200)
        lookup_list = res_lookup.get_json()["data"]
        self.assertTrue(len(lookup_list) >= 1)
        self.assertEqual(lookup_list[0].get("deliveryDate"), custom_date)
        self.assertEqual(lookup_list[0].get("deliveryTimeSlot"), custom_slot)

        # 4. Đặt đơn tích chọn "Nhận tại Shop" (isPickup=true / fulfillmentType="pickup"), không cần nhập địa chỉ
        res_pickup = self.client.post("/api/flower/v1/orders/quick-order", json={
            "recipientName": "Khách Nhận Tại Shop",
            "phone": "0912000333",
            "address": "",
            "isPickup": "true",
            "fulfillmentType": "pickup",
            "transferredAmount": 520000,
            "paymentProofImage": "https://example.com/bill_pickup.jpg"
        })
        self.assertEqual(res_pickup.status_code, 201)
        ord_pickup = res_pickup.get_json()["data"]
        self.assertEqual(ord_pickup.get("fulfillmentType"), "pickup")
        self.assertEqual(ord_pickup.get("delivery", {}).get("fulfillmentType"), "pickup")
        self.assertEqual(ord_pickup.get("recipient", {}).get("address"), "Nhận trực tiếp tại Shop")
        self.assertEqual(ord_pickup.get("deliveryDate"), today_str)

if __name__ == "__main__":
    unittest.main()


