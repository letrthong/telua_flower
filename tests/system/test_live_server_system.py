import os
import sys
import time
import socket
import threading
import unittest
from datetime import datetime
from pathlib import Path
from typing import Optional
from werkzeug.serving import make_server

# Đảm bảo đường dẫn import
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent.parent
SRC_DIR = PROJECT_ROOT / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

# Bật chế độ Test Mode cách ly trước khi import app
os.environ["FLOWER_TEST_MODE"] = "1"

from app import app
from http_client import TestHttpClient
from data_service import get_materials, save_materials, get_products, save_products


class TestLiveServerSystem(unittest.TestCase):
    """
    SYSTEM TESTING SUITE (E2E LIVE HTTP OVER TCP)
    Khởi động máy chủ Flask HTTP Server thật trên cổng TCP ngẫu nhiên.
    Gửi các request RESTful API thực tế qua mạng để nghiệm thu toàn bộ hệ thống.
    Đảm bảo tính ổn định và không phát sinh lỗi (Zero-Error Guarantee) ở cấp độ hệ thống.
    """

    server = None
    server_thread = None
    port = None
    client: TestHttpClient = None

    @classmethod
    def setUpClass(cls):
        # 1. Tìm một cổng TCP còn trống ngẫu nhiên
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('127.0.0.1', 0))
            s.listen(1)
            cls.port = s.getsockname()[1]

        # 2. Khởi tạo máy chủ Werkzeug Live Server
        app.config["TESTING"] = True
        cls.server = make_server('127.0.0.1', cls.port, app, threaded=True)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()

        # 3. Khởi tạo HTTP Client
        base_url = f"http://127.0.0.1:{cls.port}"
        cls.client = TestHttpClient(base_url=base_url, timeout=6.0)

        # 4. Thăm dò (Health Poll) chờ máy chủ sẵn sàng
        ready = False
        start_time = time.time()
        while time.time() - start_time < 6.0:
            resp = cls.client.get("/")
            if resp.status_code == 200:
                ready = True
                break
            time.sleep(0.1)

        if not ready:
            raise RuntimeError(f"Không thể khởi động Live Server trên cổng {cls.port} trong vòng 6s!")

    @classmethod
    def tearDownClass(cls):
        # Đóng máy chủ sau khi hoàn thành toàn bộ test
        if cls.server:
            cls.server.shutdown()
        if cls.server_thread and cls.server_thread.is_alive():
            cls.server_thread.join(timeout=2.0)

    def setUp(self):
        # Lưu bản sao dữ liệu trước mỗi test method để tránh side effects
        self.orig_materials = [dict(m) for m in get_materials()]
        self.orig_products = [dict(p) for p in get_products()]

    def tearDown(self):
        # Khôi phục dữ liệu nguyên trạng
        save_materials(self.orig_materials)
        save_products(self.orig_products)

    # ------------------------------------------------------------------------
    # 1. LIVE SERVER & SPA STATIC ROUTING
    # ------------------------------------------------------------------------
    def test_01_server_live_health_and_spa_routing(self):
        """Xác thực máy chủ phản hồi đúng HTTP 200, HTML Content-Type và SPA fallback."""
        # Trang chủ
        resp_index = self.client.get("/")
        self.assertEqual(resp_index.status_code, 200)
        self.assertIn("text/html", resp_index.headers.get("Content-Type", "").lower())
        self.assertIn("<html", resp_index.raw_text.lower())

        # Fallback SPA cho các route quản trị
        resp_spa = self.client.get("/portal/admin")
        self.assertEqual(resp_spa.status_code, 200)
        self.assertIn("text/html", resp_spa.headers.get("Content-Type", "").lower())

        # Favicon SVG
        resp_fav = self.client.get("/favicon.ico")
        self.assertEqual(resp_fav.status_code, 200)

    # ------------------------------------------------------------------------
    # 2. XÁC THỰC ĐA VAI TRÒ & JWT RBAC TOKENS
    # ------------------------------------------------------------------------
    def test_02_auth_system_login_and_jwt_rbac(self):
        """Xác thực đăng nhập đa vai trò qua HTTP API, cấp token JWT và thông tin tài khoản."""
        # 1. Đăng nhập Super Admin
        resp_admin = self.client.post("/api/flower/v1/auth/login", {
            "identifier": "admin@nohoathabinh.vn",
            "password": "123456"
        })
        # Nếu mật khẩu mặc định là '123456' hoặc 'password'
        if resp_admin.status_code != 200:
            resp_admin = self.client.post("/api/flower/v1/auth/login", {
                "identifier": "admin@nohoathabinh.vn",
                "password": "password"
            })
        if resp_admin.status_code != 200:
            resp_admin = self.client.post("/api/flower/v1/auth/login", {
                "identifier": "admin@nohoathabinh.vn",
                "password": "admin"
            })

        self.assertEqual(resp_admin.status_code, 200, f"Đăng nhập Super Admin thất bại: {resp_admin.raw_text}")
        self.assertTrue(resp_admin.data.get("success"))
        admin_token = resp_admin.data.get("token") or resp_admin.data.get("data", {}).get("token")
        self.assertTrue(bool(admin_token))

        # 2. Đăng nhập Quản Lý Chi Nhánh (Branch Manager)
        resp_bm = self.client.post("/api/flower/v1/auth/login", {
            "identifier": "0909123456",
            "password": "123456"
        })
        self.assertEqual(resp_bm.status_code, 200)
        self.assertTrue(resp_bm.data.get("success"))

        # 3. Đăng nhập sai mật khẩu -> HTTP 401
        resp_fail = self.client.post("/api/flower/v1/auth/login", {
            "identifier": "admin@nohoathabinh.vn",
            "password": "wrong_password_xyz"
        })
        self.assertEqual(resp_fail.status_code, 401)
        self.assertFalse(resp_fail.data.get("success", True))

    # ------------------------------------------------------------------------
    # 3. PUBLIC CATALOG & CATEGORIES API
    # ------------------------------------------------------------------------
    def test_03_public_catalog_and_categories_live_api(self):
        """Kiểm tra API danh mục hoa công khai và danh sách sản phẩm qua HTTP."""
        resp_prods = self.client.get("/api/flower/v1/products")
        self.assertEqual(resp_prods.status_code, 200)
        prods = resp_prods.data.get("data") if isinstance(resp_prods.data, dict) else resp_prods.data
        self.assertIsInstance(prods, list)
        self.assertGreater(len(prods), 0)
        # Đảm bảo mỗi sản phẩm có trường productType
        for p in prods[:5]:
            self.assertIn("productType", p)
            self.assertIn(p["productType"], ["direct", "arranged"])

        resp_cats = self.client.get("/api/flower/v1/categories")
        self.assertEqual(resp_cats.status_code, 200)
        cats = resp_cats.data.get("data") if isinstance(resp_cats.data, dict) else resp_cats.data
        self.assertIsInstance(cats, list)
        self.assertGreater(len(cats), 0)

    # ------------------------------------------------------------------------
    # 4. KHO NGUYÊN LIỆU CÀNH HOA (RAW MATERIALS API & RBAC)
    # ------------------------------------------------------------------------
    def test_04_inventory_materials_rbac_live_api(self):
        """Xác thực truy vấn kho cành hoa có bảo vệ quyền truy cập Bearer Token."""
        # 1. Truy vấn không kèm token -> HTTP 401
        self.client.clear_token()
        resp_unauth = self.client.get("/api/flower/v1/admin/inventory/materials")
        self.assertEqual(resp_unauth.status_code, 401)

        # 2. Đăng nhập Super Admin và truy vấn -> HTTP 200
        resp_login = self.client.post("/api/flower/v1/auth/login", {
            "identifier": "admin@nohoathabinh.vn",
            "password": "123456"
        })
        token = resp_login.data.get("token") or resp_login.data.get("data", {}).get("token")
        self.client.set_token(token)

        resp_mats = self.client.get("/api/flower/v1/admin/inventory/materials")
        self.assertEqual(resp_mats.status_code, 200)
        self.assertTrue(resp_mats.data.get("success"))
        materials = resp_mats.data.get("data", [])
        self.assertIsInstance(materials, list)
        self.assertGreater(len(materials), 0)

        first_mat = materials[0]
        self.assertIn("id", first_mat)
        self.assertIn("name", first_mat)
        self.assertIn("stockByBranch", first_mat)
        self.assertIn("costPrice", first_mat)

    # ------------------------------------------------------------------------
    # 5. VÒNG ĐỜI LẬP PHIẾU NHẬP KHO (INBOUND RECEIPT E2E LIFECYCLE)
    # ------------------------------------------------------------------------
    def test_05_inbound_receipt_live_system_flow(self):
        """
        Kiểm thử E2E: Gửi HTTP POST lập phiếu nhập kho cành hoa và bình hoa.
        Xác thực số lượng tồn kho tự động tăng lên và phiếu được lưu trữ chính xác.
        """
        # Đăng nhập Branch Manager
        resp_login = self.client.post("/api/flower/v1/auth/login", {
            "identifier": "0909123456",
            "password": "123456"
        })
        token = resp_login.data.get("token") or resp_login.data.get("data", {}).get("token")
        self.client.set_token(token)

        # Lấy số lượng ban đầu của cành hoa test
        resp_before = self.client.get("/api/flower/v1/admin/inventory/materials")
        mats_before = {m["id"]: m for m in resp_before.data.get("data", [])}
        test_mat_id = "mat_rose_ohara_white"
        qty_before = mats_before[test_mat_id]["stockByBranch"].get("branch_q10", 0)

        # Gửi request lập phiếu nhập kho mới
        receipt_payload = {
            "branchId": "branch_q10",
            "date": "2026-09-13",
            "supplier": "Đà Lạt Hasfarm Live System Testing",
            "notes": "Nhập hoa tươi kiểm thử hệ thống tự động qua HTTP",
            "items": [
                {
                    "type": "material",
                    "id": test_mat_id,
                    "name": "Hoa Hồng O'Hara Trắng",
                    "quantity": 30,
                    "unitPrice": 14500
                }
            ]
        }

        resp_inbound = self.client.post("/api/flower/v1/admin/inventory/inbounds", receipt_payload)
        self.assertIn(resp_inbound.status_code, [200, 201], f"Lập phiếu nhập kho thất bại: {resp_inbound.raw_text}")
        self.assertTrue(resp_inbound.data.get("success"))
        receipt_data = resp_inbound.data.get("data", {})
        receipt_id = receipt_data.get("id") or receipt_data.get("receiptId")
        self.assertTrue(bool(receipt_id))
        total_cost = receipt_data.get("totalCost") if "totalCost" in receipt_data else receipt_data.get("totalAmount")
        self.assertEqual(total_cost, 30 * 14500)

        # Kiểm tra tồn kho cành hoa sau khi nhập: Phải tăng đúng 30 cành
        resp_after = self.client.get("/api/flower/v1/admin/inventory/materials")
        mats_after = {m["id"]: m for m in resp_after.data.get("data", [])}
        qty_after = mats_after[test_mat_id]["stockByBranch"].get("branch_q10", 0)
        self.assertEqual(qty_after, qty_before + 30)

        # Kiểm tra danh sách phiếu nhập kho trong tháng: Phải chứa phiếu vừa lập
        resp_list = self.client.get("/api/flower/v1/admin/inventory/inbounds?month=2026-09&branchId=branch_q10")
        self.assertEqual(resp_list.status_code, 200)
        inbounds_list = resp_list.data.get("data", [])
        found = any((r.get("id") == receipt_id or r.get("receiptId") == receipt_id) for r in inbounds_list)
        self.assertTrue(found, "Không tìm thấy phiếu nhập kho vừa tạo trong danh sách inbounds!")

    # ------------------------------------------------------------------------
    # 6. BÁO HỦY HOA HỎNG & TRỪ TỒN KHO (WASTAGE REPORT E2E FLOW)
    # ------------------------------------------------------------------------
    def test_06_wastage_report_live_system_flow(self):
        """
        Kiểm thử E2E: Gửi HTTP POST báo hủy cành hoa dập hỏng.
        Xác thực số lượng cành hoa trong kho tự động giảm đi đúng số lượng báo hủy.
        """
        resp_login = self.client.post("/api/flower/v1/auth/login", {
            "identifier": "0909123456",
            "password": "123456"
        })
        token = resp_login.data.get("token") or resp_login.data.get("data", {}).get("token")
        self.client.set_token(token)

        test_mat_id = "mat_rose_ohara_white"
        resp_before = self.client.get("/api/flower/v1/admin/inventory/materials")
        mats_before = {m["id"]: m for m in resp_before.data.get("data", [])}
        qty_before = mats_before[test_mat_id]["stockByBranch"].get("branch_q10", 0)

        wastage_payload = {
            "branchId": "branch_q10",
            "materialId": test_mat_id,
            "productName": "Hoa Hồng O'Hara Trắng",
            "quantity": 5,
            "costPrice": 14000,
            "reason": "Dập nát khi vận chuyển (System Testing)",
            "reporter": "tester_system"
        }

        resp_wastage = self.client.post("/api/flower/v1/admin/inventory/wastage", wastage_payload)
        self.assertIn(resp_wastage.status_code, [200, 201])
        self.assertTrue(resp_wastage.data.get("success"))

        # Kiểm tra tồn kho: Phải giảm đúng 5 cành
        resp_after = self.client.get("/api/flower/v1/admin/inventory/materials")
        mats_after = {m["id"]: m for m in resp_after.data.get("data", [])}
        qty_after = mats_after[test_mat_id]["stockByBranch"].get("branch_q10", 0)
        self.assertEqual(qty_after, qty_before - 5)

    # ------------------------------------------------------------------------
    # 7. BÁO CÁO CÂN ĐỐI TỒN KHO THÁNG & LỢI NHUẬN (MONTHLY REPORT LIVE API)
    # ------------------------------------------------------------------------
    def test_07_monthly_inventory_report_live_api(self):
        """
        Kiểm thử E2E: Truy vấn Báo Cáo Nhập - Xuất - Tồn và PnL tài chính qua HTTP API.
        Xác thực đầy đủ 4 thẻ KPI (Doanh thu, COGS, Lợi nhuận gộp, Biên lãi %) và bảng cân đối 10 cột.
        """
        resp_login = self.client.post("/api/flower/v1/auth/login", {
            "identifier": "admin@nohoathabinh.vn",
            "password": "123456"
        })
        token = resp_login.data.get("token") or resp_login.data.get("data", {}).get("token")
        self.client.set_token(token)

        resp_report = self.client.get("/api/flower/v1/admin/inventory/monthly-report?month=2026-09&branchId=branch_q10")
        self.assertEqual(resp_report.status_code, 200, f"Báo cáo tháng lỗi: {resp_report.raw_text}")
        self.assertTrue(resp_report.data.get("success"))
        report = resp_report.data.get("data", {})

        # Xác thực cấu trúc Summary / KPI
        self.assertIn("summary", report)
        summary = report["summary"]
        self.assertIn("totalOpeningValue", summary)
        self.assertIn("totalInboundValue", summary)
        self.assertIn("totalClosingValue", summary)
        self.assertIsInstance(summary["totalClosingValue"], (int, float))

        # Xác thực danh sách cân đối Nhập - Xuất - Tồn
        items = report.get("items") or report.get("balanceTable")
        self.assertIsInstance(items, list)
        self.assertGreater(len(items), 0)

        first_row = items[0]
        self.assertIn("id", first_row)
        self.assertIn("name", first_row)
        self.assertIn("opening", first_row)
        self.assertIn("inbound", first_row)
        self.assertIn("sold", first_row)
        self.assertIn("wastage", first_row)
        self.assertIn("closing", first_row)
        self.assertIn("closingValue", first_row)

    # ------------------------------------------------------------------------
    # 8. E2E FLOW: MUA HÀNG ONLINE - GIAO TẬN NƠI (HOME DELIVERY)
    # ------------------------------------------------------------------------
    def test_08_e2e_online_order_with_home_delivery(self):
        """
        Quy trình E2E hoàn chỉnh:
        1. Khách hàng đặt mua hoa Online hẹn giờ, viết thiệp, giao tận nhà (fulfillmentType='delivery').
        2. Quản lý chi nhánh tiếp nhận đơn, xác nhận, chuyển thợ cắm hoa, chuyển giao hàng.
        3. Shipper giao hoa thành công, thu tiền COD và xác nhận 'paid'.
        """
        del_date = datetime.now().strftime("%Y-%m-%d")
        online_order_req = {
            "sender": {
                "name": "Trần Khách Hàng Online",
                "phone": "0987654321",
                "email": "online.customer@gmail.com",
                "isAnonymous": False
            },
            "recipient": {
                "name": "Nguyễn Người Nhận Nhà Riêng",
                "phone": "0912345678",
                "address": "183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP.HCM",
                "deliveryNotes": "Giao tận tay lầu 2, gọi trước khi đến"
            },
            "delivery": {
                "fulfillmentType": "delivery",
                "deliveryDate": del_date,
                "timeSlot": "14:00 - 16:00",
                "isExpress2H": False
            },
            "customization": {
                "cardMessage": "Chúc mừng khai trương hồng phát và vạn sự như ý!",
                "ribbonBanner": "Kính Mừng Khai Trương"
            },
            "items": [
                {
                    "productId": "bo_hoa_01",
                    "quantity": 1,
                    "price": 420000
                }
            ],
            "paymentMethod": "cod"
        }

        # 1. Khách đặt hàng online
        self.client.clear_token()
        resp_order = self.client.post("/api/flower/v1/orders", online_order_req)
        self.assertEqual(resp_order.status_code, 201, f"Đặt hàng online thất bại: {resp_order.raw_text}")
        self.assertTrue(resp_order.data.get("success"))
        order_data = resp_order.data.get("data", {})
        order_id = order_data.get("id")
        self.assertTrue(bool(order_id))
        self.assertEqual(order_data.get("status"), "pending")

        # 2. Super Admin tiếp nhận đơn Online và Điều Phối (Dispatch) về cho Showroom Quận 10
        resp_admin_login = self.client.post("/api/flower/v1/auth/login", {
            "identifier": "admin@nohoathabinh.vn",
            "password": "123456"
        })
        admin_token = resp_admin_login.data.get("token") or resp_admin_login.data.get("data", {}).get("token")
        self.client.set_token(admin_token)

        resp_dispatch = self.client.post(f"/api/flower/v1/admin/orders/{order_id}/dispatch", {
            "targetBranchId": "branch_q10",
            "note": "Tổng Quản Trị điều phối đơn Online về cho Showroom Quận 10 thực hiện cắm hoa"
        })
        self.assertEqual(resp_dispatch.status_code, 200, f"Điều phối đơn hàng thất bại: {resp_dispatch.raw_text}")
        self.assertTrue(resp_dispatch.data.get("success"))

        # 3. Quản lý chi nhánh Quận 10 đăng nhập để xử lý đơn được giao
        resp_login = self.client.post("/api/flower/v1/auth/login", {
            "identifier": "0909123456",
            "password": "123456"
        })
        token = resp_login.data.get("token") or resp_login.data.get("data", {}).get("token")
        self.client.set_token(token)

        # 4. Tiến trình trạng thái: confirmed -> arranging -> shipping -> delivered
        for next_status in ["confirmed", "arranging", "shipping", "delivered"]:
            resp_st = self.client.put(f"/api/flower/v1/admin/orders/{order_id}/status", {
                "status": next_status
            })
            self.assertEqual(resp_st.status_code, 200, f"Cập nhật trạng thái {next_status} lỗi: {resp_st.raw_text}")
            self.assertTrue(resp_st.data.get("success"))

        # 5. Xác nhận thanh toán COD sau khi giao thành công
        resp_pay = self.client.put(f"/api/flower/v1/admin/orders/{order_id}/payment", {
            "paymentStatus": "paid",
            "note": "Thu tiền mặt khi giao hàng (COD)"
        })
        self.assertEqual(resp_pay.status_code, 200, f"Cập nhật thanh toán COD lỗi: {resp_pay.raw_text}")
        self.assertTrue(resp_pay.data.get("success"))

        # 6. Kiểm tra chi tiết đơn hàng cuối cùng
        resp_final = self.client.get(f"/api/flower/v1/orders/{order_id}")
        self.assertEqual(resp_final.status_code, 200)
        final_order = resp_final.data.get("data", {})
        self.assertEqual(final_order.get("status"), "delivered")
        self.assertEqual((final_order.get("payment") or {}).get("status"), "paid")

    # ------------------------------------------------------------------------
    # 9. E2E FLOW: ĐẶT HÀNG / MUA TẠI CHỖ - NHẬN TẠI CỬA HÀNG (STORE PICKUP)
    # ------------------------------------------------------------------------
    def test_09_e2e_store_pickup_and_takeaway_order(self):
        """
        Quy trình E2E hoàn chỉnh:
        1. Khách đặt hoa chọn nhận trực tiếp tại Showroom Quận 10 (fulfillmentType='pickup').
        2. Nhân viên chi nhánh chuẩn bị hoa và chuyển trạng thái 'ready_for_pickup'.
        3. Khách đến nhận hoa tại quầy, thu tiền và hoàn tất đơn 'completed'.
        """
        del_date = datetime.now().strftime("%Y-%m-%d")
        pickup_order_req = {
            "sender": {
                "name": "Lê Khách Mua Tại Quầy",
                "phone": "0911223344",
                "email": "pickup.customer@gmail.com"
            },
            "recipient": {
                "name": "Lê Khách Mua Tại Quầy",
                "phone": "0911223344",
                "address": "Nhận trực tiếp tại Showroom Q.10 Flagship"
            },
            "branchId": "branch_q10",
            "fulfillmentType": "pickup",
            "delivery": {
                "fulfillmentType": "pickup",
                "branchId": "branch_q10",
                "deliveryDate": del_date,
                "timeSlot": "10:00 - 12:00"
            },
            "items": [
                {
                    "productId": "binh_hoa_01",
                    "quantity": 1,
                    "price": 480000
                }
            ],
            "paymentMethod": "cod"
        }

        # 1. Tạo đơn nhận tại quầy
        self.client.clear_token()
        resp_order = self.client.post("/api/flower/v1/orders", pickup_order_req)
        self.assertEqual(resp_order.status_code, 201, f"Tạo đơn pickup thất bại: {resp_order.raw_text}")
        self.assertTrue(resp_order.data.get("success"))
        order_data = resp_order.data.get("data", {})
        order_id = order_data.get("id")
        self.assertTrue(bool(order_id))

        # 2. Quản lý chi nhánh đăng nhập
        resp_login = self.client.post("/api/flower/v1/auth/login", {
            "identifier": "0909123456",
            "password": "123456"
        })
        token = resp_login.data.get("token") or resp_login.data.get("data", {}).get("token")
        self.client.set_token(token)

        # 3. Chuẩn bị hoa: confirmed -> ready_for_pickup
        for next_status in ["confirmed", "ready_for_pickup"]:
            resp_st = self.client.put(f"/api/flower/v1/admin/orders/{order_id}/status", {
                "status": next_status
            })
            self.assertEqual(resp_st.status_code, 200)

        # 4. Khách nhận hoa tại quầy -> Thu tiền và chuyển thành 'paid' ngay lập tức (cho phép với pickup)
        resp_pay = self.client.put(f"/api/flower/v1/admin/orders/{order_id}/payment", {
            "paymentStatus": "paid",
            "note": "Khách thanh toán tiền mặt tại quầy Showroom Q10"
        })
        self.assertEqual(resp_pay.status_code, 200, f"Thanh toán tại quầy lỗi: {resp_pay.raw_text}")

        # 5. Hoàn tất nhận hoa: ready_for_pickup -> completed
        resp_comp = self.client.put(f"/api/flower/v1/admin/orders/{order_id}/status", {
            "status": "completed"
        })
        self.assertEqual(resp_comp.status_code, 200)

        # 6. Kiểm tra chi tiết đơn hàng hoàn tất
        resp_final = self.client.get(f"/api/flower/v1/orders/{order_id}")
        self.assertEqual(resp_final.status_code, 200)
        final_order = resp_final.data.get("data", {})
        self.assertEqual(final_order.get("status"), "completed")
        self.assertEqual((final_order.get("payment") or {}).get("status"), "paid")

    # ------------------------------------------------------------------------
    # 10. STRESS & MEMORY LEAK CHECK (100+ REAL HTTP REQUESTS)
    # ------------------------------------------------------------------------
    def test_10_stress_and_memory_leak_check(self):
        """
        Kiểm tra độ ổn định bộ nhớ và rò rỉ RAM (Memory Leak Detection):
        Gửi liên tiếp 100 requests thực tế qua cổng mạng TCP:
        - Đăng nhập & cấp phát JWT
        - Tải danh mục sản phẩm (Products catalog)
        - Truy vấn kho nguyên liệu cành hoa (Materials)
        - Tính toán báo cáo tài chính PnL tháng (Financial reports)
        - Lấy danh sách phiếu nhập kho (Inbounds)
        Đo lường bộ nhớ RAM trước và sau 100 requests, đảm bảo không bị rò rỉ (bounded memory growth).
        """
        import gc
        import tracemalloc

        # Đăng nhập lấy token trước
        resp_login = self.client.post("/api/flower/v1/auth/login", {
            "identifier": "admin@nohoathabinh.vn",
            "password": "123456"
        })
        token = resp_login.data.get("token") or resp_login.data.get("data", {}).get("token")
        self.client.set_token(token)

        # Danh mục endpoint thực tế của hệ thống để kiểm thử tải
        endpoints = [
            ("GET", "/", None),
            ("GET", "/api/flower/v1/products", None),
            ("GET", "/api/flower/v1/categories", None),
            ("GET", "/api/flower/v1/admin/inventory/materials", None),
            ("GET", "/api/flower/v1/admin/inventory/monthly-report?month=2026-09&branchId=branch_q10", None),
            ("GET", "/api/flower/v1/admin/inventory/inbounds?month=2026-09&branchId=branch_q10", None),
        ]

        # 1. Khởi động tracemalloc nếu chưa bật
        if not tracemalloc.is_tracing():
            tracemalloc.start()

        # 2. Warmup 15 requests để Flask nạp Router, WSGI thread pool và in-memory data cache
        for i in range(15):
            method, path, body = endpoints[i % len(endpoints)]
            if method == "GET":
                self.client.get(path)
            else:
                self.client.post(path, body)

        # Thu dọn rác và lấy mốc bộ nhớ cơ sở (Baseline Memory sau Warmup)
        gc.collect()
        initial_mem, _ = tracemalloc.get_traced_memory()
        initial_mem_mb = initial_mem / (1024 * 1024)

        # 3. Gửi liên tiếp 100 requests hỗn hợp
        success_count = 0
        total_requests = 100
        start_req_time = time.time()

        for i in range(total_requests):
            method, path, body = endpoints[i % len(endpoints)]
            if method == "GET":
                resp = self.client.get(path)
            else:
                resp = self.client.post(path, body)

            if resp.status_code in [200, 201]:
                success_count += 1

        req_elapsed = time.time() - start_req_time

        # 4. Thu dọn rác và lấy mốc bộ nhớ kết thúc
        gc.collect()
        final_mem, peak_mem = tracemalloc.get_traced_memory()
        final_mem_mb = final_mem / (1024 * 1024)
        peak_mem_mb = peak_mem / (1024 * 1024)
        delta_mb = final_mem_mb - initial_mem_mb

        # 4. Xác minh kết quả
        self.assertEqual(success_count, total_requests, f"Chỉ có {success_count}/{total_requests} requests thành công!")

        # In thông tin phân tích bộ nhớ
        avg_latency = (req_elapsed / total_requests) * 1000
        print(f"\n[MEMORY AUDIT 100 REQUESTS] Initial: {initial_mem_mb:.2f}MB | Peak: {peak_mem_mb:.2f}MB | Final: {final_mem_mb:.2f}MB | Delta: {delta_mb:.2f}MB | Avg Latency: {avg_latency:.2f}ms")

        # Ngưỡng an toàn: Mức tăng RAM sau GC sau 100 requests phải < 8MB (không bị rò rỉ tuyến tính)
        self.assertLess(delta_mb, 8.0, f"Phát hiện rò rỉ bộ nhớ (Memory Leak)! RAM tăng {delta_mb:.2f}MB sau {total_requests} requests.")


if __name__ == "__main__":
    unittest.main(verbosity=2)

