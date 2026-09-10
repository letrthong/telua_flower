import os
import sys
import unittest
from datetime import datetime, timezone, timedelta
from typing import Any, Dict

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from data_service import (
    get_products,
    save_products,
    get_branches,
    get_wastage_reports,
    save_wastage_reports
)
from inventory_service import (
    get_current_vn_date_str,
    get_product_stock_for_branch,
    get_inventory_matrix,
    update_batch_inventory,
    create_wastage_report,
    get_wastage_reports_list,
    find_best_routing_branch
)
from anne_auth_service import generate_jwt_token


class TestInventoryService(unittest.TestCase):
    """Bộ kiểm thử phân hệ Quản Lý Tồn Kho & Điều Phối Đa Chi Nhánh (TASK 06)."""

    def setUp(self):
        # Lưu backup danh sách sản phẩm và phiếu báo hủy ban đầu
        self.original_products = [dict(p) for p in get_products()]
        self.original_wastage = [dict(w) for w in get_wastage_reports()]

    def tearDown(self):
        # Phục hồi dữ liệu gốc sau khi test
        save_products(self.original_products)
        save_wastage_reports(self.original_wastage)

    def test_01_get_inventory_matrix_structure_and_formula(self):
        """Kiểm tra cấu trúc và tính toán ma trận tồn kho toàn chuỗi."""
        matrix_data = get_inventory_matrix()
        self.assertIn("date", matrix_data)
        self.assertIn("branches", matrix_data)
        self.assertIn("summary", matrix_data)
        self.assertIn("matrix", matrix_data)

        summary = matrix_data["summary"]
        self.assertIn("totalProducts", summary)
        self.assertIn("totalImported", summary)
        self.assertIn("totalSold", summary)
        self.assertIn("totalAvailable", summary)

        self.assertGreater(len(matrix_data["branches"]), 0)
        self.assertGreater(len(matrix_data["matrix"]), 0)

        # Kiểm tra tính toán trên từng hàng
        first_row = matrix_data["matrix"][0]
        self.assertIn("branches", first_row)
        for b in matrix_data["branches"]:
            b_id = b["id"]
            self.assertIn(b_id, first_row["branches"])
            b_stat = first_row["branches"][b_id]
            # Công thức Available = max(0, Imported - Sold - Wastage)
            expected_avail = max(0, b_stat["imported"] - b_stat["sold"] - b_stat["wastage"])
            self.assertEqual(b_stat["available"], expected_avail)
            self.assertIn(b_stat["status"], ["in_stock", "low_stock", "out_of_stock"])

    def test_02_update_batch_inventory_and_rbac(self):
        """Kiểm tra phân quyền cập nhật hạn mức tồn kho theo chi nhánh (RBAC)."""
        products = get_products()
        test_prod = products[0]
        p_id = test_prod["id"]

        # 1. Super Admin được sửa mọi chi nhánh
        updates_admin = [
            {"productId": p_id, "branchId": "branch_q10", "quota": 25},
            {"productId": p_id, "branchId": "branch_q1", "quota": 12}
        ]
        ok, res = update_batch_inventory(updates_admin, user_branch_id=None, is_super_admin=True)
        self.assertTrue(ok)
        self.assertEqual(res["updatedCount"], 2)

        # Kiểm tra dữ liệu đã lưu
        updated_prods = get_products()
        prod_after = next(p for p in updated_prods if p["id"] == p_id)
        self.assertEqual(prod_after["stockByBranch"].get("branch_q10"), 25)
        self.assertEqual(prod_after["stockByBranch"].get("branch_q1"), 12)

        # 2. Quản lý chi nhánh Q10 chỉ được sửa branch_q10
        updates_mgr_ok = [{"productId": p_id, "branchId": "branch_q10", "quota": 30}]
        ok_mgr, res_mgr = update_batch_inventory(updates_mgr_ok, user_branch_id="branch_q10", is_super_admin=False)
        self.assertTrue(ok_mgr)

        # 3. Quản lý chi nhánh Q10 sửa chi nhánh Q1 -> Bị từ chối
        updates_mgr_fail = [{"productId": p_id, "branchId": "branch_q1", "quota": 99}]
        ok_mgr_fail, err_msg = update_batch_inventory(updates_mgr_fail, user_branch_id="branch_q10", is_super_admin=False)
        self.assertFalse(ok_mgr_fail)
        self.assertIn("branch_q10", str(err_msg))

    def test_03_create_wastage_report_and_stock_deduction(self):
        """Kiểm tra lập phiếu báo hủy hoa hỏng và ảnh hưởng đến tồn khả dụng."""
        products = get_products()
        test_prod = products[0]
        p_id = test_prod["id"]
        today_str = get_current_vn_date_str()

        # Đặt hạn mức ban đầu 20 cành tại branch_q10
        update_batch_inventory([{"productId": p_id, "branchId": "branch_q10", "quota": 20}], is_super_admin=True)

        # Tồn ban đầu
        stock_before = get_product_stock_for_branch(test_prod, "branch_q10", today_str)

        # Lập phiếu báo hủy 3 cành của mẫu hoa này
        wastage_data = {
            "branchId": "branch_q10",
            "date": today_str,
            "items": [
                {
                    "productId": p_id,
                    "flowerType": test_prod.get("name", "Hoa tươi"),
                    "damagedStems": 3,
                    "unitCost": 50000,
                    "reason": "Dập cánh khi vận chuyển"
                }
            ],
            "notes": "Kiểm kê ca sáng"
        }
        ok, rep = create_wastage_report(wastage_data, user_dict={"role": "florist", "branchId": "branch_q10", "fullName": "Thợ Cắm Hoa"})
        self.assertTrue(ok)
        self.assertEqual(rep["totalLossAmount"], 150000)

        # Kiểm tra tồn sau khi báo hủy
        # Re-fetch product
        updated_prod = next(p for p in get_products() if p["id"] == p_id)
        stock_after = get_product_stock_for_branch(updated_prod, "branch_q10", today_str)
        self.assertEqual(stock_after["wastage"], stock_before["wastage"] + 3)
        self.assertEqual(stock_after["available"], max(0, stock_before["available"] - 3))

    def test_04_smart_routing_with_coordinates_and_stock(self):
        """Kiểm tra thuật toán điều phối thông minh (Smart Order Routing)."""
        # 1. Tọa độ Quận 10 (gần Showroom Q10)
        route_q10 = find_best_routing_branch(
            customer_lat=10.7730,
            customer_lng=106.6700,
            district_or_address="183 Đường 3 Tháng 2, Quận 10"
        )
        self.assertEqual(route_q10["assignedBranchId"], "branch_q10")

        # 2. Tọa độ Thảo Điền (gần Showroom Q2)
        route_td = find_best_routing_branch(
            customer_lat=10.8040,
            customer_lng=106.7330,
            district_or_address="Xuân Thủy, Thảo Điền, TP. Thủ Đức"
        )
        self.assertEqual(route_td["assignedBranchId"], "branch_thao_dien")

        # 3. Địa chỉ Hà Nội -> Chuyển về 'admin'
        route_admin = find_best_routing_branch(
            customer_lat=None,
            customer_lng=None,
            district_or_address="Quận Cầu Giấy, Hà Nội"
        )
        self.assertEqual(route_admin["assignedBranchId"], "admin")

    def test_05_rest_api_inventory_endpoints(self):
        """Kiểm tra tích hợp các REST API endpoints của phân hệ kho."""
        from flask import Flask
        from restful_blueprint_flower_connect import flower_connect_api

        app = Flask(__name__)
        app.config["TESTING"] = True
        app.register_blueprint(flower_connect_api)
        client = app.test_client()

        # Tạo JWT token cho Super Admin
        admin_token = generate_jwt_token({
            "id": "staff_admin",
            "phone": "admin@nohoathabinh.vn",
            "fullName": "Tổng Quản Trị",
            "role": "super_admin",
            "branchId": None
        })

        # 1. GET /api/flower/v1/admin/inventory/matrix
        res_matrix = client.get("/api/flower/v1/admin/inventory/matrix", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(res_matrix.status_code, 200)
        matrix_body = res_matrix.get_json()
        self.assertTrue(matrix_body["success"])

        # 2. PUT /api/flower/v1/admin/inventory/batch
        products = get_products()
        p_id = products[0]["id"]
        res_batch = client.put(
            "/api/flower/v1/admin/inventory/batch",
            json={"updates": [{"productId": p_id, "branchId": "branch_q10", "quota": 18}]},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        self.assertEqual(res_batch.status_code, 200)

        # 3. POST /api/flower/v1/admin/inventory/wastage
        res_wastage = client.post(
            "/api/flower/v1/admin/inventory/wastage",
            json={
                "branchId": "branch_q10",
                "items": [{"flowerType": "Lan Hồ Điệp", "damagedStems": 2, "unitCost": 100000, "reason": "Dập rễ"}],
                "notes": "Kiểm kê định kỳ"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        self.assertEqual(res_wastage.status_code, 201)

        # 4. GET /api/flower/v1/products/<product_id>/stock (Public)
        res_stock = client.get(f"/api/flower/v1/products/{p_id}/stock?branchId=branch_q10")
        self.assertEqual(res_stock.status_code, 200)
        self.assertTrue(res_stock.get_json()["success"])

        # 5. POST /api/flower/v1/inventory/smart-route (Public)
        res_route = client.post(
            "/api/flower/v1/inventory/smart-route",
            json={"lat": 10.7715, "lng": 106.7042, "address": "Số 2 Hải Triều, Q1"}
        )
        self.assertEqual(res_route.status_code, 200)
        self.assertEqual(res_route.get_json()["data"]["assignedBranchId"], "branch_q1")


if __name__ == "__main__":
    unittest.main()
