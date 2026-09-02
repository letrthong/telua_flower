import os
import sys
import unittest
from datetime import datetime, timedelta

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from app import app
from order_service import create_order
from anne_auth_service import generate_jwt_token
from data_service import update_order_status, get_order_by_id, delete_order

PAYMENT_URL = "/api/flower/v1/admin/orders/{oid}/payment"


class TestPaymentConfirmationRBAC(unittest.TestCase):
    """
    Bộ kiểm thử Quyền & Luồng Xác Nhận Thanh Toán (payment.status) theo vai trò.
    Tham chiếu: docs/design/PAYMENT_CANCELLATION_RETURN_DESIGN.md mục 1B.
    - Nhân viên (sales/florist/manager) chỉ xác nhận tiền mặt cho chi nhánh mình.
    - Online (vietqr) do backend tự xác nhận -> chặn chỉnh tay (409).
    - Pickup: đánh dấu paid ngay; Delivery COD: chỉ paid sau khi giao thành công.
    """

    def setUp(self):
        self.client = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()
        self._created_ids = []

    def tearDown(self):
        for oid in self._created_ids:
            try:
                delete_order(oid)
            except Exception:
                pass
        self.app_context.pop()

    # ---------- Helpers ----------
    def _make_order(self, method, fulfillment, address):
        del_date = (datetime.now().date() + timedelta(days=2)).strftime("%Y-%m-%d")
        order_req = {
            "sender": {"name": "Người Gửi Test", "phone": "0900000001", "isAnonymous": False},
            "recipient": {"name": "Người Nhận Test", "phone": "0900000002", "address": address},
            "delivery": {"deliveryDate": del_date, "timeSlot": "09:00 - 11:00", "isExpress2H": False},
            "items": [{"productId": "bo_hoa_01", "quantity": 1, "price": 420000}],
            "paymentMethod": method,
            "fulfillmentType": fulfillment
        }
        ok, order, err = create_order(order_req)
        self.assertTrue(ok, f"Không tạo được đơn test: {err}")
        self._created_ids.append(order["id"])
        return order

    def _token(self, role, branch=None, uid="u_test"):
        payload = {"role": role, "userId": uid, "phone": "0900000009"}
        if branch:
            payload["branchId"] = branch
        return generate_jwt_token(payload)

    def _put_payment(self, oid, token, body):
        return self.client.put(
            PAYMENT_URL.format(oid=oid),
            json=body,
            headers={"Authorization": f"Bearer {token}"} if token else {}
        )

    # ---------- Tests ----------
    def test_01_customer_forbidden(self):
        """Khách hàng KHÔNG được xác nhận thanh toán (403)."""
        order = self._make_order("cash", "pickup", "183 Đường 3/2, Quận 10")
        res = self._put_payment(order["id"], self._token("customer", uid="cust1"), {"paymentStatus": "paid"})
        self.assertEqual(res.status_code, 403)

    def test_02_no_token_unauthorized(self):
        """Không có token -> 401."""
        order = self._make_order("cash", "pickup", "183 Đường 3/2, Quận 10")
        res = self._put_payment(order["id"], None, {"paymentStatus": "paid"})
        self.assertEqual(res.status_code, 401)

    def test_03_online_cannot_be_marked_manually(self):
        """Đơn thanh toán online (vietqr) không cho nhân viên chỉnh tay (409)."""
        order = self._make_order("vietqr", "pickup", "183 Đường 3/2, Quận 10")
        token = self._token("sales_consultant", branch=order["branchId"])
        res = self._put_payment(order["id"], token, {"paymentStatus": "paid"})
        self.assertEqual(res.status_code, 409)

    def test_04_pickup_cash_marked_paid_immediately(self):
        """Tiền mặt + nhận tại chỗ (pickup): xác nhận paid ngay lập tức (200)."""
        order = self._make_order("cash", "pickup", "183 Đường 3/2, Quận 10")
        token = self._token("sales_consultant", branch=order["branchId"])
        res = self._put_payment(order["id"], token, {"paymentStatus": "paid"})
        self.assertEqual(res.status_code, 200)

        refreshed = get_order_by_id(order["id"])
        self.assertEqual(refreshed["payment"]["status"], "paid")
        self.assertIsNotNone(refreshed["payment"]["paidAt"])
        # order.status không bị thay đổi bởi thao tác thanh toán
        self.assertEqual(refreshed["status"], "pending")

    def test_05_delivery_cod_requires_delivered_first(self):
        """Tiền mặt + giao hàng (COD): chưa giao xong -> 400; sau khi delivered -> 200."""
        order = self._make_order("cash", "delivery", "183 Đường 3/2, Quận 10")
        token = self._token("sales_consultant", branch=order["branchId"])

        # Chưa giao xong -> bị chặn
        res_before = self._put_payment(order["id"], token, {"paymentStatus": "paid"})
        self.assertEqual(res_before.status_code, 400)

        # Sau khi giao thành công -> cho phép
        update_order_status(order["id"], "delivered")
        res_after = self._put_payment(order["id"], token, {"paymentStatus": "paid"})
        self.assertEqual(res_after.status_code, 200)
        refreshed = get_order_by_id(order["id"])
        self.assertEqual(refreshed["payment"]["status"], "paid")

    def test_06_branch_isolation_blocks_other_branch_staff(self):
        """Nhân viên chi nhánh khác không được xác nhận đơn không thuộc chi nhánh mình (403)."""
        order = self._make_order("cash", "pickup", "183 Đường 3/2, Quận 10")  # branch_q10
        other_token = self._token("branch_manager", branch="branch_q1", uid="mgr_q1")
        res = self._put_payment(order["id"], other_token, {"paymentStatus": "paid"})
        self.assertEqual(res.status_code, 403)

    def test_07_super_admin_can_confirm_any_branch(self):
        """Super Admin xác nhận thanh toán cho mọi chi nhánh (200)."""
        order = self._make_order("cash", "pickup", "183 Đường 3/2, Quận 10")
        res = self._put_payment(order["id"], self._token("super_admin", uid="admin1"), {"paymentStatus": "paid"})
        self.assertEqual(res.status_code, 200)

    def test_08_invalid_status_and_not_found(self):
        """Trạng thái thanh toán không hợp lệ -> 400; đơn không tồn tại -> 404."""
        order = self._make_order("cash", "pickup", "183 Đường 3/2, Quận 10")
        token = self._token("sales_consultant", branch=order["branchId"])

        res_invalid = self._put_payment(order["id"], token, {"paymentStatus": "banana"})
        self.assertEqual(res_invalid.status_code, 400)

        res_404 = self._put_payment("order_khong_ton_tai_xyz", token, {"paymentStatus": "paid"})
        self.assertEqual(res_404.status_code, 404)


if __name__ == "__main__":
    unittest.main()
