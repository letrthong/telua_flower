import os
import sys
import unittest
import time
from datetime import datetime, timedelta

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from app import app
from order_service import create_order, dispatch_order_to_branch
from anne_auth_service import generate_jwt_token
from data_service import get_order_by_id, delete_order, update_order_status


class TestStaffPortalAndDispatch(unittest.TestCase):
    """
    Bộ kiểm thử cho Bàn Làm Việc Ca Trực & Cơ chế Điều Phối Đơn Hàng (Staff Portal & Order Dispatching):
    1. Super Admin truy vấn đơn theo bộ lọc chi nhánh (all, admin, specific branch).
    2. Super Admin điều phối đơn hàng từ admin sang các Showroom chi nhánh.
    3. Chặn quyền điều phối (403/401) đối với các vai trò không phải super_admin.
    4. Kiểm tra hợp đồng dữ liệu cho luồng Fast-track (requiresArranging: false) vs Cắm hoa nghệ thuật.
    5. Kiểm tra quy tắc xác nhận thanh toán tiền mặt theo phương thức nhận hàng (pickup vs delivery).
    """

    def setUp(self):
        self.client = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()
        self._created_order_ids = []

        # Token người dùng các vai trò
        self.admin_user = {"userId": "staff_admin", "fullName": "Tổng Quản Trị Hệ Thống", "role": "super_admin"}
        self.admin_token = generate_jwt_token(self.admin_user)

        self.mgr_q10_user = {"userId": "staff_001", "fullName": "Trần Thị Mai", "role": "branch_manager", "branchId": "branch_q10"}
        self.mgr_q10_token = generate_jwt_token(self.mgr_q10_user)

        self.florist_user = {"userId": "staff_002", "fullName": "Lê Ngọc Lan", "role": "florist", "branchId": "branch_q10"}
        self.florist_token = generate_jwt_token(self.florist_user)

        self.sales_user = {"userId": "staff_003", "fullName": "Phạm Quốc Tuấn", "role": "sales_consultant", "branchId": "branch_q10"}
        self.sales_token = generate_jwt_token(self.sales_user)

        self.cust_user = {"userId": "cust_test_01", "phone": "0988001122", "role": "customer"}
        self.cust_token = generate_jwt_token(self.cust_user)

    def tearDown(self):
        for oid in self._created_order_ids:
            try:
                delete_order(oid)
            except Exception:
                pass
        self.app_context.pop()

    def _create_test_order(self, branch_id="admin", requires_arranging=True, fulfillment="delivery"):
        """Tạo đơn hàng hỗ trợ kiểm thử"""
        del_date = (datetime.now().date() + timedelta(days=2)).strftime("%Y-%m-%d")
        addr = "183 Đường 3/2, Quận 10, TP.HCM" if branch_id == "branch_q10" else "Ngoại tỉnh, chưa rõ chi nhánh"
        payload = {
            "sender": {"name": "Khách Test Portal", "phone": "0911223344"},
            "recipient": {"name": "Người Nhận Test", "phone": "0955667788", "address": addr},
            "delivery": {"deliveryDate": del_date, "timeSlot": "10:00 - 12:00", "fulfillmentType": fulfillment, "branchId": branch_id},
            "items": [{"productId": "bo_hoa_01", "quantity": 1, "price": 420000}],
            "requestArranging": requires_arranging,
            "fulfillmentType": fulfillment,
            "paymentMethod": "cash",
            "branchId": branch_id
        }
        ok, order, err = create_order(payload)
        self.assertTrue(ok, f"Không tạo được đơn test: {err}")
        self._created_order_ids.append(order["id"])
        return order

    def test_01_admin_query_orders_with_branch_filter(self):
        """Kiểm tra Super Admin truy vấn danh sách đơn hàng với các bộ lọc branchId: 'all', 'admin', 'branch_q10'"""
        order_admin = self._create_test_order(branch_id="admin")
        order_q10 = self._create_test_order(branch_id="branch_q10")

        headers = {"Authorization": f"Bearer {self.admin_token}"}

        # 1. Truy vấn toàn bộ (branchId = 'all')
        res_all = self.client.get("/api/flower/v1/admin/orders?timeframe=all&branchId=all", headers=headers)
        self.assertEqual(res_all.status_code, 200)
        all_orders = res_all.get_json()["data"]["orders"]
        all_ids = [o["id"] for o in all_orders]
        self.assertIn(order_admin["id"], all_ids)
        self.assertIn(order_q10["id"], all_ids)

        # 2. Truy vấn chỉ đơn chờ điều phối (branchId = 'admin')
        res_admin = self.client.get("/api/flower/v1/admin/orders?timeframe=all&branchId=admin", headers=headers)
        self.assertEqual(res_admin.status_code, 200)
        admin_orders = res_admin.get_json()["data"]["orders"]
        for o in admin_orders:
            b = o.get("branchId") or o.get("assignedBranchId")
            self.assertEqual(b, "admin")

        # 3. Truy vấn chỉ đơn của chi nhánh Q10 (branchId = 'branch_q10')
        res_q10 = self.client.get("/api/flower/v1/admin/orders?timeframe=all&branchId=branch_q10", headers=headers)
        self.assertEqual(res_q10.status_code, 200)
        q10_orders = res_q10.get_json()["data"]["orders"]
        for o in q10_orders:
            b = o.get("branchId") or o.get("assignedBranchId")
            self.assertEqual(b, "branch_q10")

    def test_02_admin_dispatch_order_to_branch(self):
        """Kiểm tra Super Admin điều phối đơn hàng từ Admin sang Showroom Q10 và chuyển tiếp sang Q1"""
        order = self._create_test_order(branch_id="admin")
        order_id = order["id"]
        headers = {"Authorization": f"Bearer {self.admin_token}"}

        # 1. Điều phối từ admin -> branch_q10
        res_disp_1 = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            headers=headers,
            json={"targetBranchId": "branch_q10", "note": "Admin gán cho showroom Q10 xử lý"}
        )
        self.assertEqual(res_disp_1.status_code, 200)
        data_1 = res_disp_1.get_json()["data"]
        self.assertEqual(data_1["branchId"], "branch_q10")
        self.assertEqual(data_1["assignedTo"], "staff_001")  # Quản lý Showroom Q10
        self.assertIn("Trần Thị Mai", data_1.get("assigneeName", ""))
        self.assertIn("Showroom Quận 10", data_1.get("branchName", ""))

        # Kiểm tra lịch sử cập nhật
        hist_1 = data_1.get("history", [])
        self.assertTrue(any("Admin gán cho showroom Q10" in h.get("note", "") for h in hist_1))

        # 2. Điều phối chuyển tiếp từ branch_q10 -> branch_q1
        res_disp_2 = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            headers=headers,
            json={"targetBranchId": "branch_q1", "note": "Chuyển tiếp Showroom Q1"}
        )
        self.assertEqual(res_disp_2.status_code, 200)
        data_2 = res_disp_2.get_json()["data"]
        self.assertEqual(data_2["branchId"], "branch_q1")
        self.assertEqual(data_2["assignedTo"], "staff_004")  # Quản lý Showroom Q1
        self.assertIn("Quận 1", data_2.get("branchName", ""))

    def test_03_non_admin_cannot_dispatch_order(self):
        """Kiểm tra chặn quyền điều phối đơn hàng đối với các vai trò không phải Super Admin"""
        order = self._create_test_order(branch_id="admin")
        order_id = order["id"]
        payload = {"targetBranchId": "branch_q10"}

        # 1. Florist gọi -> 403 Forbidden
        res_fl = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            headers={"Authorization": f"Bearer {self.florist_token}"},
            json=payload
        )
        self.assertEqual(res_fl.status_code, 403)

        # 2. Sales gọi -> 403 Forbidden
        res_sa = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            headers={"Authorization": f"Bearer {self.sales_token}"},
            json=payload
        )
        self.assertEqual(res_sa.status_code, 403)

        # 3. Customer gọi -> 403 Forbidden
        res_cu = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            headers={"Authorization": f"Bearer {self.cust_token}"},
            json=payload
        )
        self.assertEqual(res_cu.status_code, 403)

        # 4. Không có token -> 401 Unauthorized
        res_no = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            json=payload
        )
        self.assertEqual(res_no.status_code, 401)

    def test_04_fast_track_vs_arranging_order_flags(self):
        """Kiểm tra hợp đồng dữ liệu đơn Fast-track (requiresArranging: false) vs Đơn cắm hoa nghệ thuật"""
        # Đơn cắm hoa nghệ thuật
        order_art = self._create_test_order(requires_arranging=True)
        self.assertTrue(order_art["requiresArranging"])
        self.assertGreater(order_art["financials"]["arrangingFee"], 0)

        # Đơn hoa cành / bó tiêu chuẩn (Fast-track)
        order_fast = self._create_test_order(requires_arranging=False)
        self.assertFalse(order_fast["requiresArranging"])
        self.assertEqual(order_fast["financials"]["arrangingFee"], 0)

    def test_05_pickup_vs_delivery_payment_rules(self):
        """Kiểm tra quy tắc thanh toán tiền mặt cho Pickup (thu ngay) vs Delivery COD (chỉ thu sau khi giao xong)"""
        headers_mgr = {"Authorization": f"Bearer {self.mgr_q10_token}"}

        # 1. Đơn Pickup -> xác nhận paid ngay lập tức thành công (200)
        order_pickup = self._create_test_order(branch_id="branch_q10", fulfillment="pickup")
        res_pick = self.client.put(
            f"/api/flower/v1/admin/orders/{order_pickup['id']}/payment",
            headers=headers_mgr,
            json={"paymentStatus": "paid"}
        )
        self.assertEqual(res_pick.status_code, 200)

        # 2. Đơn Delivery COD -> chưa giao xong bị chặn (400)
        order_deliv = self._create_test_order(branch_id="branch_q10", fulfillment="delivery")
        res_deliv_blocked = self.client.put(
            f"/api/flower/v1/admin/orders/{order_deliv['id']}/payment",
            headers=headers_mgr,
            json={"paymentStatus": "paid"}
        )
        self.assertEqual(res_deliv_blocked.status_code, 400)

        # Sau khi giao thành công -> xác nhận paid thành công (200)
        update_order_status(order_deliv["id"], "delivered")
        res_deliv_ok = self.client.put(
            f"/api/flower/v1/admin/orders/{order_deliv['id']}/payment",
            headers=headers_mgr,
            json={"paymentStatus": "paid"}
        )
        self.assertEqual(res_deliv_ok.status_code, 200)

    def test_06_store_location_security_and_role_task_routing(self):
        """
        Kiểm tra an toàn đơn hàng theo vị trí cửa hàng và phân bổ công việc theo vai trò tại backend:
        1. Nhân viên không có vị trí cửa hàng (branchId) bị chặn (403).
        2. Nhân viên chi nhánh A cố tình truy cập chi nhánh B bị chặn (403).
        3. Super Admin không ràng buộc vị trí cửa hàng, truy cập mọi chi nhánh đều thành công (200).
        4. Florist chỉ nhận đúng các đơn cần cắm nghệ thuật (requiresArranging=True), loại trừ đơn fast-track/completed.
        5. Sales consultant chỉ nhận đơn mới hoặc đơn chưa thanh toán.
        6. Branch manager xem được toàn bộ đơn hàng chi nhánh của mình.
        7. Nhân viên cố tình truy vấn chi nhánh khác qua /admin/orders bị chặn (403).
        """
        # 1. Nhân viên không có vị trí cửa hàng -> 403
        no_branch_token = generate_jwt_token({"userId": "staff_homeless", "role": "florist"})
        res_no_branch = self.client.get(
            "/api/flower/v1/branch/branch_q10/orders",
            headers={"Authorization": f"Bearer {no_branch_token}"}
        )
        self.assertEqual(res_no_branch.status_code, 403)
        self.assertIn("vị trí cửa hàng", res_no_branch.get_json()["message"])

        # 2. Florist chi nhánh Q10 gọi chi nhánh Q1 -> 403
        res_cross_branch = self.client.get(
            "/api/flower/v1/branch/branch_q1/orders",
            headers={"Authorization": f"Bearer {self.florist_token}"}
        )
        self.assertEqual(res_cross_branch.status_code, 403)

        # 3. Super Admin không ràng buộc vị trí cửa hàng -> 200 cho cả Q10, Q1 và admin
        headers_admin = {"Authorization": f"Bearer {self.admin_token}"}
        self.assertEqual(self.client.get("/api/flower/v1/branch/branch_q10/orders", headers=headers_admin).status_code, 200)
        self.assertEqual(self.client.get("/api/flower/v1/branch/branch_q1/orders", headers=headers_admin).status_code, 200)
        self.assertEqual(self.client.get("/api/flower/v1/branch/admin/orders", headers=headers_admin).status_code, 200)

        # 4. Tạo các đơn hàng thử nghiệm tại Showroom Q10
        # Đơn A: Cần cắm hoa, trạng thái confirmed, chưa thanh toán tiền mặt
        order_a = self._create_test_order(branch_id="branch_q10", requires_arranging=True)
        update_order_status(order_a["id"], "confirmed")

        # Đơn B: Fast-track hoa cành bó sẵn (requiresArranging: false)
        order_b = self._create_test_order(branch_id="branch_q10", requires_arranging=False)
        update_order_status(order_b["id"], "confirmed")

        # Đơn C: Cần cắm hoa nhưng đã giao xong (completed)
        order_c = self._create_test_order(branch_id="branch_q10", requires_arranging=True)
        update_order_status(order_c["id"], "completed")

        # 5. Florist Showroom Q10 tải công việc
        res_fl_orders = self.client.get(
            "/api/flower/v1/branch/branch_q10/orders",
            headers={"Authorization": f"Bearer {self.florist_token}"}
        )
        self.assertEqual(res_fl_orders.status_code, 200)
        fl_tasks = res_fl_orders.get_json()["data"]
        fl_ids = [o["id"] for o in fl_tasks]

        # Florist phải thấy Đơn A (cắm hoa)
        self.assertIn(order_a["id"], fl_ids)
        # Florist KHÔNG được thấy Đơn B (fast-track không cắm) và Đơn C (đã xong)
        self.assertNotIn(order_b["id"], fl_ids)
        self.assertNotIn(order_c["id"], fl_ids)

        # 6. Sales Consultant Showroom Q10 tải công việc
        res_sa_orders = self.client.get(
            "/api/flower/v1/branch/branch_q10/orders",
            headers={"Authorization": f"Bearer {self.sales_token}"}
        )
        self.assertEqual(res_sa_orders.status_code, 200)
        sa_tasks = res_sa_orders.get_json()["data"]
        sa_ids = [o["id"] for o in sa_tasks]
        # Thấy Đơn A (chưa thanh toán tiền mặt)
        self.assertIn(order_a["id"], sa_ids)

        # 7. Quản lý Showroom Q10 tải công việc -> thấy cả 3 đơn
        res_mgr_orders = self.client.get(
            "/api/flower/v1/branch/branch_q10/orders",
            headers={"Authorization": f"Bearer {self.mgr_q10_token}"}
        )
        self.assertEqual(res_mgr_orders.status_code, 200)
        mgr_tasks = res_mgr_orders.get_json()["data"]
        mgr_ids = [o["id"] for o in mgr_tasks]
        self.assertIn(order_a["id"], mgr_ids)
        self.assertIn(order_b["id"], mgr_ids)
        self.assertIn(order_c["id"], mgr_ids)

        # 8. Nhân viên cố tình truy vấn chi nhánh khác qua /admin/orders -> bị chặn 403
        res_admin_cross = self.client.get(
            "/api/flower/v1/admin/orders?branchId=branch_q1",
            headers={"Authorization": f"Bearer {self.florist_token}"}
        )
        self.assertEqual(res_admin_cross.status_code, 403)

    def test_07_staff_task_api_and_claim(self):
        """
        Kiểm tra chuyên biệt bộ Task API độc lập dành cho nhân viên ca trực tác nghiệp:
        1. GET /api/flower/v1/staff/my-tasks: Không cần truyền branchId, tự nạp đúng chi nhánh và việc của nhân viên.
        2. GET /api/flower/v1/staff/tasks/summary: Thống kê nhanh số lượng task theo ca trực.
        3. POST /api/flower/v1/staff/tasks/<order_id>/claim: Nhân viên nhận việc thành công, cập nhật assignedTo & history.
        4. Chặn nhận việc nếu nhân viên khác chi nhánh (403).
        """
        # Tạo đơn cắm hoa mới tại Showroom Q10
        order = self._create_test_order(branch_id="branch_q10", requires_arranging=True)
        update_order_status(order["id"], "confirmed")

        # 1. Florist Showroom Q10 gọi /staff/my-tasks
        headers_fl = {"Authorization": f"Bearer {self.florist_token}"}
        res_tasks = self.client.get("/api/flower/v1/staff/my-tasks", headers=headers_fl)
        self.assertEqual(res_tasks.status_code, 200)
        tasks_json = res_tasks.get_json()
        self.assertTrue(tasks_json["success"])
        self.assertEqual(tasks_json["branchId"], "branch_q10")
        self.assertEqual(tasks_json["staffId"], "staff_002")
        task_ids = [t["id"] for t in tasks_json["data"]]
        self.assertIn(order["id"], task_ids)

        # 2. Kiểm tra thống kê ca trực /staff/tasks/summary
        res_sum = self.client.get("/api/flower/v1/staff/tasks/summary", headers=headers_fl)
        self.assertEqual(res_sum.status_code, 200)
        sum_data = res_sum.get_json()["data"]
        self.assertGreaterEqual(sum_data["total"], 1)
        self.assertIn("pending", sum_data)
        self.assertIn("arranging", sum_data)

        # 3. Florist bấm nhận việc (claim task)
        res_claim = self.client.post(
            f"/api/flower/v1/staff/tasks/{order['id']}/claim",
            headers=headers_fl
        )
        self.assertEqual(res_claim.status_code, 200)
        claim_data = res_claim.get_json()["data"]
        self.assertEqual(claim_data["assignedTo"], "staff_002")
        self.assertTrue(any("đã nhận nhiệm vụ" in h.get("note", "") for h in claim_data.get("history", [])))

        # 4. Nhân viên Showroom Q1 cố tình nhận đơn của Showroom Q10 -> 403 Forbidden
        florist_q1_token = generate_jwt_token({"userId": "staff_005", "role": "florist", "branchId": "branch_q1"})
        res_claim_blocked = self.client.post(
            f"/api/flower/v1/staff/tasks/{order['id']}/claim",
            headers={"Authorization": f"Bearer {florist_q1_token}"}
        )
        self.assertEqual(res_claim_blocked.status_code, 403)


if __name__ == "__main__":
    unittest.main()
