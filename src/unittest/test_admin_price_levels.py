import os
import sys
import unittest
import time
from typing import List, Dict, Any

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from app import app
from data_service import (
    get_price_levels,
    get_price_level_by_id,
    save_price_levels,
    create_or_update_price_level,
    delete_price_level,
    get_products
)
from product_service import validate_product_price_governance
from anne_auth_service import generate_jwt_token


class TestAdminPriceLevels(unittest.TestCase):
    """
    Bộ kiểm thử Đơn vị (Unit Test) cho Tính năng Quản lý Phân Tầng Mức Giá (price_levels.json):
    1. Lấy danh sách mức giá qua Public API và Admin API (yêu cầu phân quyền).
    2. Thêm mới phân tầng giá hợp lệ và xác thực lưu trữ tệp.
    3. Xác thực các lỗi ràng buộc nghiệp vụ (Validation Rules: min <= def <= max, trùng code).
    4. Cập nhật phân tầng giá hiện có.
    5. Hàng rào an toàn (Safety Guardrail): Chặn xóa phân tầng giá đang được gán cho sản phẩm.
    6. Xóa thành công phân tầng giá không có sản phẩm nào sử dụng.
    7. Tích hợp kiểm soát giá an toàn (Price Governance Guardrail) với phân tầng mới tạo.
    """

    def setUp(self):
        self.client = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()

        # Sao lưu danh sách gốc của price_levels.json để khôi phục sau test
        self.original_price_levels = [dict(lvl) for lvl in get_price_levels(use_cache=False)]

        # Tạo JWT Token Super Admin và Florist (để test phân quyền)
        self.admin_token = generate_jwt_token({
            "userId": "staff_admin",
            "fullName": "Tổng Quản Trị Hệ Thống",
            "role": "super_admin",
            "branchId": None
        })
        self.florist_token = generate_jwt_token({
            "userId": "staff_002",
            "fullName": "Florist Thợ Hoa",
            "role": "florist",
            "branchId": "branch_q10"
        })

        self.test_code = f"LV_T{int(time.time() % 10000)}"

    def tearDown(self):
        # Khôi phục nguyên vẹn price_levels.json ban đầu
        save_price_levels(self.original_price_levels)
        self.app_context.pop()

    def test_01_get_price_levels_public_and_admin(self):
        """Test API lấy danh sách price levels công khai và trong cổng quản trị."""
        # Public GET /api/flower/v1/price-levels
        res_pub = self.client.get("/api/flower/v1/price-levels")
        self.assertEqual(res_pub.status_code, 200)
        data_pub = res_pub.get_json()
        self.assertTrue(data_pub.get("success"))
        self.assertTrue(isinstance(data_pub.get("data"), list))
        self.assertGreaterEqual(len(data_pub["data"]), 1)

        # Admin GET không có token -> 401
        res_no_auth = self.client.get("/api/flower/v1/admin/price-levels")
        self.assertEqual(res_no_auth.status_code, 401)

        # Admin GET có token super_admin -> 200
        res_admin = self.client.get(
            "/api/flower/v1/admin/price-levels",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(res_admin.status_code, 200)
        data_admin = res_admin.get_json()
        self.assertTrue(data_admin.get("success"))
        self.assertEqual(len(data_admin["data"]), len(data_pub["data"]))

    def test_02_create_price_level_success(self):
        """Test thêm mới một phân tầng giá thành công qua Admin API."""
        payload = {
            "code": self.test_code,
            "name": "Phân Tầng Thử Nghiệm Đặc Biệt",
            "description": "Dành cho bộ sưu tập hoa dạ hội cao cấp",
            "minPrice": 3500000,
            "defaultPrice": 4500000,
            "maxPrice": 8000000
        }

        res = self.client.post(
            "/api/flower/v1/admin/price-levels",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json=payload
        )
        self.assertEqual(res.status_code, 201)
        json_data = res.get_json()
        self.assertTrue(json_data.get("success"))
        created = json_data.get("data")
        self.assertEqual(created["code"], self.test_code)
        self.assertEqual(created["minPrice"], 3500000)
        self.assertEqual(created["defaultPrice"], 4500000)
        self.assertEqual(created["maxPrice"], 8000000)

        # Xác minh trong data_service
        found = get_price_level_by_id(created["id"])
        self.assertIsNotNone(found)
        self.assertEqual(found["name"], "Phân Tầng Thử Nghiệm Đặc Biệt")

    def test_03_create_price_level_validation_errors(self):
        """Test các trường hợp vi phạm quy tắc validation khi thêm phân tầng giá."""
        # 1. Thiếu mã code
        res1 = self.client.post(
            "/api/flower/v1/admin/price-levels",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json={"name": "No Code", "minPrice": 100000, "maxPrice": 200000}
        )
        self.assertEqual(res1.status_code, 400)
        self.assertIn("Mã phân tầng giá", res1.get_json().get("message", ""))

        # 2. Giá trần thấp hơn giá sàn
        res2 = self.client.post(
            "/api/flower/v1/admin/price-levels",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json={"code": f"{self.test_code}_ERR", "name": "Invalid Max", "minPrice": 500000, "maxPrice": 300000}
        )
        self.assertEqual(res2.status_code, 400)
        self.assertIn("không được thấp hơn", res2.get_json().get("message", ""))

        # 3. Giá đề xuất nằm ngoài khoảng sàn - trần
        res3 = self.client.post(
            "/api/flower/v1/admin/price-levels",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json={
                "code": f"{self.test_code}_DEF",
                "name": "Invalid Default",
                "minPrice": 200000,
                "maxPrice": 500000,
                "defaultPrice": 600000
            }
        )
        self.assertEqual(res3.status_code, 400)
        self.assertIn("Giá đề xuất", res3.get_json().get("message", ""))

        # 4. Trùng lặp code đã có sẵn (VD: LV_01)
        res4 = self.client.post(
            "/api/flower/v1/admin/price-levels",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json={
                "code": "LV_01",
                "name": "Duplicate LV_01",
                "minPrice": 200000,
                "maxPrice": 500000,
                "defaultPrice": 300000
            }
        )
        self.assertEqual(res4.status_code, 400)
        self.assertIn("đã tồn tại", res4.get_json().get("message", ""))

    def test_04_update_price_level(self):
        """Test cập nhật phân tầng giá qua API PUT /admin/price-levels/<id>."""
        # Tạo mức giá thử nghiệm
        ok, item, _ = create_or_update_price_level({
            "code": self.test_code,
            "name": "Mức Giá Gốc",
            "minPrice": 1000000,
            "maxPrice": 2000000,
            "defaultPrice": 1500000
        })
        self.assertTrue(ok)
        level_id = item["id"]

        # Cập nhật qua PUT
        update_payload = {
            "code": self.test_code,
            "name": "Mức Giá Đã Nâng Cấp",
            "description": "Cập nhật giá mới",
            "minPrice": 1200000,
            "maxPrice": 2500000,
            "defaultPrice": 1800000
        }
        res = self.client.put(
            f"/api/flower/v1/admin/price-levels/{level_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json=update_payload
        )
        self.assertEqual(res.status_code, 200)

        updated = get_price_level_by_id(level_id)
        self.assertEqual(updated["name"], "Mức Giá Đã Nâng Cấp")
        self.assertEqual(updated["minPrice"], 1200000)
        self.assertEqual(updated["maxPrice"], 2500000)
        self.assertEqual(updated["defaultPrice"], 1800000)

    def test_05_delete_price_level_guardrail_prevents_in_use(self):
        """Test cơ chế an toàn: Chặn xóa phân tầng mức giá đang có sản phẩm sử dụng."""
        # price_lvl_01 đang được gán cho nhiều sản phẩm trong products.json
        res = self.client.delete(
            "/api/flower/v1/admin/price-levels/price_lvl_01",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(res.status_code, 400)
        json_data = res.get_json()
        self.assertFalse(json_data.get("success"))
        self.assertIn("Không thể xóa", json_data.get("message", ""))
        self.assertIn("đang được gán", json_data.get("message", ""))

        # Đảm bảo price_lvl_01 vẫn còn trong danh sách
        self.assertIsNotNone(get_price_level_by_id("price_lvl_01"))

    def test_06_delete_price_level_success(self):
        """Test xóa thành công phân tầng giá khi không bị sản phẩm nào ràng buộc."""
        # Tạo mức giá mới
        ok, item, _ = create_or_update_price_level({
            "code": self.test_code,
            "name": "Tầng Tạm Thời Để Xóa",
            "minPrice": 50000,
            "maxPrice": 90000,
            "defaultPrice": 70000
        })
        self.assertTrue(ok)
        level_id = item["id"]

        # Xóa qua DELETE API
        res = self.client.delete(
            f"/api/flower/v1/admin/price-levels/{level_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get_json().get("success"))

        # Xác minh đã biến mất khỏi hệ thống
        self.assertIsNone(get_price_level_by_id(level_id))

    def test_07_price_governance_with_new_price_level(self):
        """Test hàng rào kiểm soát giá (Price Governance) hoạt động tức thì với phân tầng mới."""
        ok, item, _ = create_or_update_price_level({
            "code": self.test_code,
            "name": "Tầng Mini Budget",
            "minPrice": 100000,
            "maxPrice": 250000,
            "defaultPrice": 180000
        })
        self.assertTrue(ok)
        level_id = item["id"]

        # Giá hợp lệ (nằm trong [100k, 250k])
        valid, err = validate_product_price_governance(level_id, 180000)
        self.assertTrue(valid)
        self.assertIsNone(err)

        # Giá bán phá giá (< 100k) -> Bị chặn
        under, under_err = validate_product_price_governance(level_id, 80000)
        self.assertFalse(under)
        self.assertIn("thấp hơn giá sàn", under_err)

        # Giá bán quá trần (> 250k) -> Bị chặn
        over, over_err = validate_product_price_governance(level_id, 300000)
        self.assertFalse(over)
        self.assertIn("vượt quá giá trần", over_err)


if __name__ == "__main__":
    unittest.main()
