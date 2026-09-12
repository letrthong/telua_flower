import os
import sys
import unittest
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import app
from data_service import (
    ORDERS_DIR,
    get_order_shortcut_path,
    build_order_shortcut_item,
    get_or_build_month_branch_shortcut,
    upsert_order_shortcut,
    remove_order_shortcut,
    read_orders_by_month,
    get_all_orders_across_all_months,
    save_order,
    get_order_by_id,
    delete_order,
    read_json
)
from anne_auth_service import generate_jwt_token


class TestOrderShortcutIndex(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.client = self.app.test_client()
        self.super_admin_token = generate_jwt_token({
            "userId": "staff_admin",
            "role": "super_admin",
            "phone": "0900000000",
            "branchId": None
        })

    def test_01_build_shortcut_item(self):
        sample_order = {
            "id": "test_sc_001",
            "orderCode": "NHTB-TEST-001",
            "createdAt": "2026-09-12T10:00:00Z",
            "updatedAt": "2026-09-12T10:05:00Z",
            "status": "pending",
            "branchId": "branch_q10",
            "branchName": "Showroom Quận 10 Flagship",
            "totalAmount": 1250000,
            "financials": {
                "totalAmount": 1250000,
                "itemsTotal": 1200000,
                "shippingFee": 50000
            },
            "payment": {
                "status": "paid",
                "method": "vietqr"
            },
            "recipient": {
                "name": "Nguyễn Thị Hoa",
                "phone": "0901234567",
                "address": "123 Cách Mạng Tháng 8, Q.10"
            },
            "sender": {
                "name": "Lê Văn Tuấn",
                "phone": "0907654321"
            },
            "items": [
                {"productId": "flower_01", "productName": "Bình Hoa Mẫu Đơn", "quantity": 1, "price": 1200000}
            ]
        }

        shortcut = build_order_shortcut_item(sample_order)
        self.assertEqual(shortcut["id"], "test_sc_001")
        self.assertEqual(shortcut["orderCode"], "NHTB-TEST-001")
        self.assertEqual(shortcut["status"], "pending")
        self.assertEqual(shortcut["branchId"], "branch_q10")
        self.assertEqual(shortcut["totalAmount"], 1250000)
        self.assertEqual(shortcut["payment"]["status"], "paid")
        self.assertEqual(shortcut["recipient"]["name"], "Nguyễn Thị Hoa")
        self.assertIn("Bình Hoa Mẫu Đơn x1", shortcut["itemSummary"])
        self.assertEqual(shortcut["itemCount"], 1)
        self.assertIn("orders/branch_q10/2026_09/pending/test_sc_001.json", shortcut["detailPath"])

    def test_02_get_or_build_month_branch_shortcut(self):
        # Kiểm tra tự động sinh file _shortcut.json cho branch_q10 tháng 2026_09 nếu có đơn
        q10_shortcuts = get_or_build_month_branch_shortcut("branch_q10", "2026_09", force_rebuild=True)
        shortcut_file = get_order_shortcut_path("branch_q10", "2026_09")
        
        self.assertTrue(os.path.exists(shortcut_file), "File _shortcut.json phải được tạo tự động")
        disk_data = read_json(shortcut_file, default=[])
        self.assertIsInstance(disk_data, list)
        self.assertEqual(len(q10_shortcuts), len(disk_data))

    def test_03_read_orders_by_month_shortcut_consistency(self):
        # Đọc theo shortcut và đọc full-scan phải cho cùng tập order ID
        orders_sc = read_orders_by_month("2026_09", branch_id="branch_q10", use_shortcut=True)
        orders_full = read_orders_by_month("2026_09", branch_id="branch_q10", use_shortcut=False)

        ids_sc = {o["id"] for o in orders_sc if o.get("id")}
        ids_full = {o["id"] for o in orders_full if o.get("id")}
        self.assertEqual(ids_sc, ids_full, "Danh sách ID từ shortcut phải khớp hoàn toàn với full-scan")

    def test_04_save_order_lifecycle_and_shortcut_sync(self):
        test_id = f"test_order_sc_{int(datetime.now().timestamp())}"
        test_order = {
            "id": test_id,
            "orderCode": f"NHTB-SC-{test_id[-6:]}",
            "createdAt": "2026-09-12T10:15:00Z",
            "updatedAt": "2026-09-12T10:15:00Z",
            "status": "pending",
            "branchId": "branch_q10",
            "totalAmount": 750000,
            "recipient": {
                "name": "Khách Test Shortcut",
                "phone": "0912345678",
                "address": "456 Ba Tháng Hai, Q.10"
            },
            "sender": {
                "name": "Người Gửi Test",
                "phone": "0987654321"
            },
            "items": [
                {"productId": "prod_test", "productName": "Bó Hoa Test", "quantity": 1}
            ]
        }

        # 1. Lưu đơn mới
        saved = save_order(test_order)
        self.assertTrue(saved)

        # Kiểm tra đơn có trong shortcut index
        sc_items = get_or_build_month_branch_shortcut("branch_q10", "2026_09")
        found = any(x["id"] == test_id for x in sc_items)
        self.assertTrue(found, "Đơn mới tạo phải lập tức xuất hiện trong _shortcut.json")

        # 2. Cập nhật trạng thái sang arranging
        test_order["status"] = "arranging"
        save_order(test_order)

        sc_items_updated = get_or_build_month_branch_shortcut("branch_q10", "2026_09")
        matched = next((x for x in sc_items_updated if x["id"] == test_id), None)
        self.assertIsNotNone(matched)
        self.assertEqual(matched["status"], "arranging", "Trạng thái trong _shortcut.json phải được đồng bộ")

        # 3. Xóa đơn hàng
        del_ok = delete_order(test_id, year_month="2026_09", branch_id="branch_q10")
        self.assertTrue(del_ok)

        sc_items_after_del = get_or_build_month_branch_shortcut("branch_q10", "2026_09")
        found_after_del = any(x["id"] == test_id for x in sc_items_after_del)
        self.assertFalse(found_after_del, "Đơn đã xóa phải được loại khỏi _shortcut.json")

    def test_05_api_admin_orders_and_order_detail_lazy_load(self):
        # 1. Gọi GET /admin/orders (danh sách tóm tắt qua shortcut)
        headers = {"Authorization": f"Bearer {self.super_admin_token}"}
        res_list = self.client.get("/api/flower/v1/admin/orders?timeframe=this_month", headers=headers)
        self.assertEqual(res_list.status_code, 200)
        data_list = res_list.get_json()
        self.assertTrue(data_list.get("success"))
        orders = data_list.get("data", {}).get("orders", [])
        self.assertIsInstance(orders, list)

        if len(orders) > 0:
            sample_id = orders[0].get("id")
            # 2. Gọi GET /orders/<id> (tải chi tiết đầy đủ on-demand)
            res_detail = self.client.get(f"/api/flower/v1/orders/{sample_id}", headers=headers)
            self.assertEqual(res_detail.status_code, 200)
            data_detail = res_detail.get_json()
            self.assertTrue(data_detail.get("success"))
            detail_order = data_detail.get("data")
            self.assertEqual(detail_order.get("id"), sample_id)


if __name__ == "__main__":
    unittest.main()
