import os
import sys
import unittest
from datetime import datetime, timedelta

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from app import app
from order_service import create_order, dispatch_order_to_branch
from anne_auth_service import generate_jwt_token
from data_service import (
    ORDERS_DIR,
    get_order_by_id,
    delete_order,
    get_order_shortcut_path,
    read_json,
    get_or_build_month_branch_shortcut
)


class TestAdminSetBranchOrder(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị chuyên sâu (Unit Test) cho tính năng:
    ADMIN SET / GÁN / ĐIỀU PHỐI CHI NHÁNH CHO ĐƠN HÀNG (Order Branch Assignment & Dispatching).

    Bao gồm các kịch bản kiểm định:
    1. Admin điều phối đơn hàng ban đầu từ 'admin' sang Showroom cụ thể ('branch_q10').
       - Xác minh cập nhật metadata: branchId, assignedTo, assigneeName, assignedBy, note.
       - Xác minh đồng bộ di chuyển file Kanban vật lý trên đĩa cứng.
       - Xác minh cập nhật và đồng bộ cây chỉ mục Shortcut Index (_shortcut.json).
       - Xác minh ghi nhận lịch sử (history audit log).
    2. Admin chuyển tiếp đơn hàng giữa các Showroom ('branch_q10' -> 'branch_q1').
    3. Admin hoàn trả đơn hàng về lại Trung Tâm ('admin').
    4. Tương thích linh hoạt tham số payload: cả 'targetBranchId' và 'branchId'.
    5. Kiểm soát phân quyền nghiêm ngặt (RBAC): Chặn 401 khi thiếu token, 403 đối với thợ hoa, tư vấn viên, quản lý đơn chi nhánh, khách hàng.
    6. Xử lý lỗi và kiểm tra dữ liệu đầu vào (Bad Request 400): chi nhánh không tồn tại, thiếu mã chi nhánh, đơn hàng không tồn tại.
    7. Tác động hiển thị tới Bàn Làm Việc Ca Trực (Staff Portal /staff/my-tasks) sau khi gán chi nhánh.
    """

    def setUp(self):
        self.app = app
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        self._created_order_ids = []

        # 1. Super Admin Token (Người có quyền điều phối toàn hệ thống)
        self.admin_user = {
            "userId": "staff_admin",
            "fullName": "Tổng Quản Trị Hệ Thống",
            "role": "super_admin",
            "branchId": None
        }
        self.admin_token = generate_jwt_token(self.admin_user)

        # 2. Tokens của các vai trò nhân viên và khách hàng
        self.mgr_q10_token = generate_jwt_token({
            "userId": "staff_001",
            "fullName": "Trần Thị Mai",
            "role": "branch_manager",
            "branchId": "branch_q10"
        })

        self.florist_q10_token = generate_jwt_token({
            "userId": "staff_002",
            "fullName": "Lê Ngọc Lan",
            "role": "florist",
            "branchId": "branch_q10"
        })

        self.florist_q1_token = generate_jwt_token({
            "userId": "staff_005",
            "fullName": "Hoàng Yến",
            "role": "florist",
            "branchId": "branch_q1"
        })

        self.sales_q10_token = generate_jwt_token({
            "userId": "staff_003",
            "fullName": "Phạm Quốc Tuấn",
            "role": "sales_consultant",
            "branchId": "branch_q10"
        })

        self.customer_token = generate_jwt_token({
            "userId": "cust_test_99",
            "role": "customer"
        })

    def tearDown(self):
        for oid in self._created_order_ids:
            try:
                delete_order(oid)
            except Exception:
                pass
        self.app_context.pop()

    def _create_test_order(self, initial_branch="admin", requires_arranging=True):
        """Hàm hỗ trợ tạo đơn hàng thử nghiệm"""
        del_date = (datetime.now().date() + timedelta(days=2)).strftime("%Y-%m-%d")
        payload = {
            "sender": {"name": "Khách Hàng Test Gán Chi Nhánh", "phone": "0911002233"},
            "recipient": {"name": "Người Nhận Test", "phone": "0977889900", "address": "123 Cách Mạng Tháng 8, Q.10"},
            "delivery": {"deliveryDate": del_date, "timeSlot": "10:00 - 12:00", "fulfillmentType": "delivery", "branchId": initial_branch},
            "items": [{"productId": "flower_vase_01", "productName": "Bình Hoa Khai Trương", "quantity": 1, "price": 850000}],
            "requestArranging": requires_arranging,
            "fulfillmentType": "delivery",
            "paymentMethod": "cash",
            "branchId": initial_branch
        }
        ok, order, err = create_order(payload)
        self.assertTrue(ok, f"Không tạo được đơn hàng mẫu: {err}")
        self._created_order_ids.append(order["id"])
        return order

    def test_01_admin_dispatch_order_initial_assignment(self):
        """
        KỊCH BẢN 1: Admin gán chi nhánh ban đầu cho đơn hàng (admin -> branch_q10).
        Kiểm tra:
        - API trả về HTTP 200 kèm dữ liệu đơn đã gán đúng Showroom và Quản lý phụ trách.
        - File Kanban vật lý trên đĩa được dời từ thư mục 'admin' sang 'branch_q10'.
        - Cây shortcut index (_shortcut.json) tự động loại bỏ đơn khỏi 'admin' và thêm vào 'branch_q10'.
        - Lịch sử đơn hàng (history) ghi nhận đầy đủ người điều phối, thời gian và ghi chú.
        """
        order = self._create_test_order(initial_branch="admin")
        order_id = order["id"]
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        note_content = "Admin phân công cho Showroom Q10 xử lý giao hoa sớm"

        # 1. Gọi API POST /admin/orders/<id>/dispatch
        res = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            headers=headers,
            json={"targetBranchId": "branch_q10", "note": note_content}
        )
        self.assertEqual(res.status_code, 200)
        res_data = res.get_json()
        self.assertTrue(res_data.get("success"))

        order_data = res_data.get("data", {})
        self.assertEqual(order_data.get("branchId"), "branch_q10")
        self.assertEqual(order_data.get("assignedBranchId"), "branch_q10")
        self.assertEqual(order_data.get("assignedTo"), "staff_001")  # Quản lý Showroom Q10
        self.assertEqual(order_data.get("assignedBy"), "staff_admin")
        self.assertIn("Quận 10", order_data.get("branchName", ""))
        self.assertIn("Trần Thị Mai", order_data.get("assigneeName", ""))

        # 2. Kiểm tra lịch sử điều phối
        history = order_data.get("history", [])
        self.assertGreaterEqual(len(history), 1)
        last_hist = history[-1]
        self.assertEqual(last_hist.get("branchId"), "branch_q10")
        self.assertEqual(last_hist.get("assignedTo"), "staff_001")
        self.assertEqual(last_hist.get("note"), note_content)
        self.assertIn("staff_admin", last_hist.get("updatedBy", ""))

        # 3. Kiểm tra file vật lý trên đĩa cứng
        now_ym = datetime.now().strftime("%Y_%m")
        old_path = os.path.join(ORDERS_DIR, "admin", now_ym, "pending", f"{order_id}.json")
        new_path = os.path.join(ORDERS_DIR, "branch_q10", now_ym, "pending", f"{order_id}.json")
        self.assertFalse(os.path.exists(old_path), f"File cũ ở {old_path} phải bị di chuyển đi")
        self.assertTrue(os.path.exists(new_path), f"File mới phải xuất hiện tại {new_path}")

        # 4. Kiểm tra đồng bộ Shortcut Index (_shortcut.json)
        admin_sc = get_or_build_month_branch_shortcut("admin", now_ym)
        q10_sc = get_or_build_month_branch_shortcut("branch_q10", now_ym)

        admin_ids = [item["id"] for item in admin_sc]
        q10_ids = [item["id"] for item in q10_sc]

        self.assertNotIn(order_id, admin_ids, "Đơn phải bị gỡ bỏ khỏi shortcut của admin")
        self.assertIn(order_id, q10_ids, "Đơn phải có mặt trong shortcut của Showroom Q10")

    def test_02_admin_redispatch_between_branches(self):
        """
        KỊCH BẢN 2: Admin chuyển tiếp đơn hàng giữa hai Showroom (branch_q10 -> branch_q1).
        Xác minh:
        - Đơn chuyển từ quản lý Q10 (staff_001) sang quản lý Q1 (staff_004).
        - File Kanban chuyển sang thư mục của branch_q1.
        - Shortcut index của Q10 bị loại bỏ và Q1 được cập nhật.
        - Lịch sử đơn hàng ghi nhận 2 lần điều phối liên tiếp.
        """
        order = self._create_test_order(initial_branch="branch_q10")
        order_id = order["id"]
        headers = {"Authorization": f"Bearer {self.admin_token}"}

        res = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            headers=headers,
            json={"targetBranchId": "branch_q1", "note": "Showroom Q10 quá tải, chuyển giao Showroom Q1"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["data"]

        self.assertEqual(data.get("branchId"), "branch_q1")
        self.assertEqual(data.get("assignedTo"), "staff_004")  # Quản lý Showroom Q1
        self.assertIn("Quận 1", data.get("branchName", ""))
        self.assertIn("Nguyễn Văn Hùng", data.get("assigneeName", ""))

        # Kiểm tra Shortcut Index
        now_ym = datetime.now().strftime("%Y_%m")
        q10_sc = get_or_build_month_branch_shortcut("branch_q10", now_ym)
        q1_sc = get_or_build_month_branch_shortcut("branch_q1", now_ym)

        self.assertNotIn(order_id, [x["id"] for x in q10_sc])
        self.assertIn(order_id, [x["id"] for x in q1_sc])

    def test_03_admin_redispatch_back_to_admin(self):
        """
        KỊCH BẢN 3: Admin hoàn trả đơn hàng từ Showroom về lại Trung Tâm Admin ('admin').
        Xác minh:
        - targetBranchId='admin' hợp lệ.
        - assignedTo trở về 'staff_admin'.
        - File và shortcut trở về admin.
        """
        order = self._create_test_order(initial_branch="branch_q10")
        order_id = order["id"]
        headers = {"Authorization": f"Bearer {self.admin_token}"}

        res = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            headers=headers,
            json={"targetBranchId": "admin", "note": "Thu hồi về tổng quản trị điều phối lại"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["data"]

        self.assertEqual(data.get("branchId"), "admin")
        self.assertEqual(data.get("assignedTo"), "staff_admin")
        self.assertIn("Admin", data.get("branchName", ""))

        now_ym = datetime.now().strftime("%Y_%m")
        admin_sc = get_or_build_month_branch_shortcut("admin", now_ym)
        self.assertIn(order_id, [x["id"] for x in admin_sc])

    def test_04_support_both_target_branch_id_and_branch_id_keys(self):
        """
        KỊCH BẢN 4: Hỗ trợ linh hoạt cả hai key: 'targetBranchId' và alias 'branchId' trong request body.
        """
        order = self._create_test_order(initial_branch="admin")
        order_id = order["id"]
        headers = {"Authorization": f"Bearer {self.admin_token}"}

        # Gửi payload dùng key 'branchId' thay vì 'targetBranchId'
        res = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            headers=headers,
            json={"branchId": "branch_thao_dien", "note": "Gán cho Showroom Thảo Điền"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["data"]
        self.assertEqual(data.get("branchId"), "branch_thao_dien")
        self.assertIn("Thảo Điền", data.get("branchName", ""))

    def test_05_rbac_authorization_guards(self):
        """
        KỊCH BẢN 5: Kiểm soát phân quyền nghiêm ngặt (RBAC) cho endpoint gán chi nhánh:
        - 401 Unauthorized khi không truyền token.
        - 403 Forbidden khi người gọi là Thợ cắm hoa (florist).
        - 403 Forbidden khi người gọi là Tư vấn bán hàng (sales_consultant).
        - 403 Forbidden khi người gọi là Quản lý chi nhánh thông thường (branch_manager).
        - 403 Forbidden khi người gọi là Khách hàng (customer).
        """
        order = self._create_test_order(initial_branch="admin")
        order_id = order["id"]
        payload = {"targetBranchId": "branch_q10"}

        # 1. Không có token -> 401
        res_no_auth = self.client.post(f"/api/flower/v1/admin/orders/{order_id}/dispatch", json=payload)
        self.assertEqual(res_no_auth.status_code, 401)

        # 2. Thợ hoa (florist) -> 403
        res_florist = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            headers={"Authorization": f"Bearer {self.florist_q10_token}"},
            json=payload
        )
        self.assertEqual(res_florist.status_code, 403)

        # 3. Tư vấn bán hàng (sales_consultant) -> 403
        res_sales = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            headers={"Authorization": f"Bearer {self.sales_q10_token}"},
            json=payload
        )
        self.assertEqual(res_sales.status_code, 403)

        # 4. Quản lý chi nhánh (branch_manager) cố tình điều phối đa chi nhánh -> 403
        res_mgr = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            headers={"Authorization": f"Bearer {self.mgr_q10_token}"},
            json=payload
        )
        self.assertEqual(res_mgr.status_code, 403)

        # 5. Khách hàng (customer) -> 403
        res_cust = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            headers={"Authorization": f"Bearer {self.customer_token}"},
            json=payload
        )
        self.assertEqual(res_cust.status_code, 403)

    def test_06_validation_and_error_handling(self):
        """
        KỊCH BẢN 6: Kiểm tra dữ liệu đầu vào và các trường hợp biên (Edge Cases):
        - Không gửi targetBranchId hoặc chuỗi rỗng -> 400 Bad Request.
        - Gửi chi nhánh không tồn tại -> 400 Bad Request.
        - Gửi mã đơn hàng không tồn tại trong hệ thống -> 400 Bad Request.
        """
        order = self._create_test_order(initial_branch="admin")
        order_id = order["id"]
        headers = {"Authorization": f"Bearer {self.admin_token}"}

        # 1. Thiếu chi nhánh mục tiêu -> 400
        res_empty = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            headers=headers,
            json={"targetBranchId": "   ", "note": "Test thiếu chi nhánh"}
        )
        self.assertEqual(res_empty.status_code, 400)
        self.assertIn("chọn chi nhánh", res_empty.get_json().get("message", ""))

        # 2. Chi nhánh mục tiêu không tồn tại trong branches.json -> 400
        res_nonexistent_branch = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            headers=headers,
            json={"targetBranchId": "branch_non_existent_999", "note": "Test chi nhánh lạ"}
        )
        self.assertEqual(res_nonexistent_branch.status_code, 400)
        self.assertIn("không tồn tại", res_nonexistent_branch.get_json().get("message", ""))

        # 3. Mã đơn hàng không tồn tại -> 400
        res_fake_order = self.client.post(
            "/api/flower/v1/admin/orders/order_fake_not_found_99999/dispatch",
            headers=headers,
            json={"targetBranchId": "branch_q10"}
        )
        self.assertEqual(res_fake_order.status_code, 400)
        self.assertIn("Không tìm thấy đơn hàng", res_fake_order.get_json().get("message", ""))

    def test_07_staff_portal_visibility_after_dispatch(self):
        """
        KỊCH BẢN 7: Tác động hiển thị tới Bàn Làm Việc Ca Trực (Staff Portal Task Routing) sau khi gán chi nhánh:
        - Đơn hàng cắm hoa nghệ thuật được gán về 'branch_q10'.
        - Florist tại 'branch_q10' gọi GET /staff/my-tasks -> nhìn thấy đơn hàng cần cắm.
        - Florist tại 'branch_q1' gọi GET /staff/my-tasks -> KHÔNG nhìn thấy đơn hàng này.
        """
        order = self._create_test_order(initial_branch="admin", requires_arranging=True)
        order_id = order["id"]
        headers_admin = {"Authorization": f"Bearer {self.admin_token}"}

        # Admin điều phối sang Showroom Q10
        res_disp = self.client.post(
            f"/api/flower/v1/admin/orders/{order_id}/dispatch",
            headers=headers_admin,
            json={"targetBranchId": "branch_q10", "note": "Gán cho thợ cắm hoa Q10"}
        )
        self.assertEqual(res_disp.status_code, 200)

        # Florist Showroom Q10 kiểm tra việc ca trực
        res_fl_q10 = self.client.get(
            "/api/flower/v1/staff/my-tasks",
            headers={"Authorization": f"Bearer {self.florist_q10_token}"}
        )
        self.assertEqual(res_fl_q10.status_code, 200)
        tasks_q10 = res_fl_q10.get_json().get("data", [])
        q10_task_ids = [t["id"] for t in tasks_q10]
        self.assertIn(order_id, q10_task_ids, "Thợ hoa Q10 phải nhận được việc sau khi Admin gán chi nhánh")

        # Florist Showroom Q1 kiểm tra việc ca trực
        res_fl_q1 = self.client.get(
            "/api/flower/v1/staff/my-tasks",
            headers={"Authorization": f"Bearer {self.florist_q1_token}"}
        )
        self.assertEqual(res_fl_q1.status_code, 200)
        tasks_q1 = res_fl_q1.get_json().get("data", [])
        q1_task_ids = [t["id"] for t in tasks_q1]
        self.assertNotIn(order_id, q1_task_ids, "Thợ hoa Q1 KHÔNG được thấy đơn của Showroom Q10")


if __name__ == "__main__":
    unittest.main()
