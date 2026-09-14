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
from product_service import (
    create_or_update_product,
    delete_product
)
from data_service import (
    get_products,
    get_product_by_id,
    save_products,
    get_materials,
    get_material_by_id,
    save_materials,
    update_material_stock
)
from anne_auth_service import generate_jwt_token


class TestProductsMaterialsSync(unittest.TestCase):
    """
    Bộ kiểm thử Đơn vị (Unit Test) cho cơ chế đồng bộ giữa products.json và materials.json:
    - Khi thêm sản phẩm mới có productType == 'direct' -> tự động xuất hiện trong materials.json.
    - Khi sửa productType từ 'arranged' sang 'direct' -> tự động thêm vào materials.json.
    - Khi sửa productType từ 'direct' sang 'arranged' -> tự động xóa khỏi materials.json.
    - Khi cập nhật thông tin (tên, giá vốn, tồn kho) của sản phẩm direct -> materials.json tự động cập nhật.
    - Khi tăng/giảm tồn kho qua update_material_stock -> products.json tự động đồng bộ.
    - Khi xóa sản phẩm direct -> tự động xóa khỏi materials.json.
    - Kiểm thử cả qua tầng Service và RESTful API Endpoint.
    """

    def setUp(self):
        self.client = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()

        # Backup dữ liệu gốc để khôi phục sau khi test
        self.original_products = [dict(p) for p in get_products()]
        self.original_materials = [dict(m) for m in get_materials()]

        self.test_suffix = f"sync_test_{int(time.time() * 1000)}"
        self.test_branch = "branch_q10"
        self.created_product_ids = []

        # JWT Token Super Admin cho test API
        self.admin_token = generate_jwt_token({
            "userId": "staff_admin",
            "fullName": "Tổng Quản Trị Hệ Thống",
            "role": "super_admin",
            "branchId": None
        })

    def tearDown(self):
        # Dọn dẹp các sản phẩm test đã tạo
        for pid in self.created_product_ids:
            try:
                delete_product(pid)
            except Exception:
                pass

        # Phục hồi dữ liệu gốc
        save_products(self.original_products)
        save_materials(self.original_materials)
        self.app_context.pop()

    def test_01_create_product_direct_auto_syncs_to_materials(self):
        """Khi thêm sản phẩm mới có productType == 'direct' -> tự động xuất hiện trong materials.json."""
        prod_id = f"direct_{self.test_suffix}"
        self.created_product_ids.append(prod_id)

        product_data = {
            "id": prod_id,
            "name": "Bình Gốm Men Lam Test Direct",
            "category": "binh_hoa",
            "productType": "direct",
            "stemCount": 5,
            "unit": "bình",
            "costPrice": 350000,
            "priceLevelId": "price_lvl_02",
            "priceNumber": 750000,
            "salePrice": "750,000₫",
            "image": "/images/test_direct.jpg",
            "stockByBranch": {
                "branch_q10": 20,
                "branch_q1": 10,
                "branch_thao_dien": 5
            }
        }

        success, prod, err = create_or_update_product(product_data)
        self.assertTrue(success, f"Tạo sản phẩm direct thất bại: {err}")

        # Kiểm tra trong products.json
        p_check = get_product_by_id(prod_id)
        self.assertIsNotNone(p_check)
        self.assertEqual(p_check.get("productType"), "direct")

        # Kiểm tra tự động xuất hiện trong materials.json
        materials = get_materials()
        mat_ids = [m.get("id") for m in materials]
        self.assertIn(prod_id, mat_ids, f"Sản phẩm direct {prod_id} phải tự động có trong materials.json")

        mat = get_material_by_id(prod_id)
        self.assertIsNotNone(mat)
        self.assertEqual(mat.get("name"), "Bình Gốm Men Lam Test Direct")
        self.assertEqual(mat.get("productType"), "direct")
        self.assertEqual(mat.get("unit"), "bình")
        self.assertEqual(int(mat.get("costPrice", 0)), 350000)
        self.assertEqual(int(mat.get("stockByBranch", {}).get(self.test_branch, 0)), 20)

    def test_02_create_product_arranged_does_not_appear_in_materials(self):
        """Khi thêm sản phẩm có productType == 'arranged' -> KHÔNG xuất hiện trong materials.json."""
        prod_id = f"arranged_{self.test_suffix}"
        self.created_product_ids.append(prod_id)

        product_data = {
            "id": prod_id,
            "name": "Bó Hoa Tươi Mẫu Arranged",
            "category": "bo_hoa",
            "productType": "arranged",
            "recipe": [],
            "stemCount": 10,
            "priceLevelId": "price_lvl_01",
            "priceNumber": 450000,
            "image": "/images/test_arranged.jpg",
            "stockByBranch": {"branch_q10": 15}
        }

        success, prod, err = create_or_update_product(product_data)
        self.assertTrue(success, f"Tạo sản phẩm arranged thất bại: {err}")

        # Kiểm tra không có trong materials.json
        materials = get_materials()
        mat_ids = [m.get("id") for m in materials]
        self.assertNotIn(prod_id, mat_ids, f"Sản phẩm arranged {prod_id} KHÔNG được có trong materials.json")

    def test_03_switch_product_type_arranged_to_direct_and_vice_versa(self):
        """
        Kiểm tra chuyển đổi qua lại giữa 'arranged' và 'direct':
        - Chuyển từ 'arranged' sang 'direct' -> tự động xuất hiện trong materials.json.
        - Chuyển từ 'direct' sang 'arranged' -> tự động biến mất khỏi materials.json.
        """
        prod_id = f"switch_{self.test_suffix}"
        self.created_product_ids.append(prod_id)

        # 1. Ban đầu tạo loại 'arranged'
        product_data = {
            "id": prod_id,
            "name": "Mẫu Hoa Chuyển Đổi Phân Loại",
            "category": "bo_hoa",
            "productType": "arranged",
            "priceLevelId": "price_lvl_01",
            "priceNumber": 450000,
            "image": "/images/test_switch.jpg",
            "stockByBranch": {"branch_q10": 10}
        }
        success, _, err = create_or_update_product(product_data)
        self.assertTrue(success, f"Tạo ban đầu thất bại: {err}")
        self.assertNotIn(prod_id, [m.get("id") for m in get_materials()])

        # 2. Chuyển sang 'direct'
        product_data["productType"] = "direct"
        product_data["costPrice"] = 180000
        product_data["unit"] = "cành"
        success, prod, err = create_or_update_product(product_data, product_id=prod_id)
        self.assertTrue(success, f"Cập nhật sang direct thất bại: {err}")
        self.assertIn(prod_id, [m.get("id") for m in get_materials()], "Phải xuất hiện trong materials.json sau khi đổi sang direct")

        # 3. Chuyển ngược lại sang 'arranged'
        product_data["productType"] = "arranged"
        success, prod, err = create_or_update_product(product_data, product_id=prod_id)
        self.assertTrue(success, f"Cập nhật sang arranged thất bại: {err}")
        self.assertNotIn(prod_id, [m.get("id") for m in get_materials()], "Phải tự động xóa khỏi materials.json sau khi đổi về arranged")

    def test_04_update_direct_product_details_syncs_to_materials(self):
        """Khi cập nhật thông tin sản phẩm direct (tên, giá vốn, tồn kho) -> materials.json tự động đồng bộ."""
        prod_id = f"update_detail_{self.test_suffix}"
        self.created_product_ids.append(prod_id)

        product_data = {
            "id": prod_id,
            "name": "Bình Thủy Tinh Bản Ban Đầu",
            "category": "binh_hoa",
            "productType": "direct",
            "unit": "bình",
            "costPrice": 200000,
            "priceLevelId": "price_lvl_01",
            "priceNumber": 450000,
            "image": "/images/test_update.jpg",
            "stockByBranch": {"branch_q10": 10}
        }
        success, _, err = create_or_update_product(product_data)
        self.assertTrue(success, f"Tạo thất bại: {err}")

        # Cập nhật thông tin mới
        product_data["name"] = "Bình Thủy Tinh Đã Đổi Tên"
        product_data["costPrice"] = 220000
        product_data["stockByBranch"] = {"branch_q10": 35, "branch_q1": 15}
        success, _, err = create_or_update_product(product_data, product_id=prod_id)
        self.assertTrue(success, f"Update thất bại: {err}")

        # Kiểm tra materials.json
        mat = get_material_by_id(prod_id)
        self.assertIsNotNone(mat)
        self.assertEqual(mat.get("name"), "Bình Thủy Tinh Đã Đổi Tên")
        self.assertEqual(int(mat.get("costPrice", 0)), 220000)
        self.assertEqual(int(mat.get("stockByBranch", {}).get("branch_q10", 0)), 35)
        self.assertEqual(int(mat.get("stockByBranch", {}).get("branch_q1", 0)), 15)

    def test_05_update_material_stock_syncs_back_to_products(self):
        """Khi tăng/giảm tồn kho qua update_material_stock -> products.json tự động đồng bộ."""
        prod_id = f"stock_sync_{self.test_suffix}"
        self.created_product_ids.append(prod_id)

        product_data = {
            "id": prod_id,
            "name": "Chậu Gốm Sứ Đồng Bộ Tồn",
            "category": "binh_hoa",
            "productType": "direct",
            "unit": "chậu",
            "costPrice": 300000,
            "priceLevelId": "price_lvl_02",
            "priceNumber": 750000,
            "image": "/images/test_stock.jpg",
            "stockByBranch": {"branch_q10": 20, "branch_q1": 10}
        }
        success, _, err = create_or_update_product(product_data)
        self.assertTrue(success, f"Tạo thất bại: {err}")

        # Cập nhật tăng tồn kho +15 tại branch_q10
        ok = update_material_stock(prod_id, "branch_q10", delta=15)
        self.assertTrue(ok)

        # Kiểm tra trong materials.json
        mat = get_material_by_id(prod_id)
        self.assertEqual(int(mat["stockByBranch"]["branch_q10"]), 35)

        # Kiểm tra trong products.json (phải được đồng bộ cả stockByBranch và dailyQuota)
        prod = get_product_by_id(prod_id)
        self.assertEqual(int(prod["stockByBranch"]["branch_q10"]), 35)
        self.assertEqual(int(prod["dailyQuota"]), 45) # 35 (q10) + 10 (q1)

        # Cập nhật giảm tồn kho -10 tại branch_q10
        ok = update_material_stock(prod_id, "branch_q10", delta=-10)
        self.assertTrue(ok)

        mat_after = get_material_by_id(prod_id)
        self.assertEqual(int(mat_after["stockByBranch"]["branch_q10"]), 25)

        prod_after = get_product_by_id(prod_id)
        self.assertEqual(int(prod_after["stockByBranch"]["branch_q10"]), 25)
        self.assertEqual(int(prod_after["dailyQuota"]), 35)

    def test_06_delete_direct_product_removes_from_materials(self):
        """Khi xóa sản phẩm direct -> tự động xóa khỏi materials.json."""
        prod_id = f"delete_test_{self.test_suffix}"

        product_data = {
            "id": prod_id,
            "name": "Bình Test Xóa",
            "category": "binh_hoa",
            "productType": "direct",
            "priceLevelId": "price_lvl_01",
            "priceNumber": 400000,
            "image": "/images/test_delete.jpg",
            "stockByBranch": {"branch_q10": 5}
        }
        success, _, err = create_or_update_product(product_data)
        self.assertTrue(success, f"Tạo thất bại: {err}")
        self.assertIn(prod_id, [m.get("id") for m in get_materials()])

        # Thực hiện xóa
        del_ok, err = delete_product(prod_id)
        self.assertTrue(del_ok, f"Xóa thất bại: {err}")

        # Kiểm tra không còn trong products.json
        self.assertIsNone(get_product_by_id(prod_id))

        # Kiểm tra không còn trong materials.json
        self.assertNotIn(prod_id, [m.get("id") for m in get_materials()])

    def test_07_api_product_create_and_type_change_syncs_materials(self):
        """Kiểm thử thông qua RESTful API Endpoint /api/flower/v1/admin/products."""
        prod_id = f"api_sync_{self.test_suffix}"
        self.created_product_ids.append(prod_id)

        headers = {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }

        # 1. Tạo sản phẩm direct qua API POST
        payload = {
            "id": prod_id,
            "name": "Bình Hoa Thủy Tinh API Test",
            "category": "binh_hoa",
            "productType": "direct",
            "priceLevelId": "price_lvl_01",
            "priceNumber": 450000,
            "image": "/images/api_test.jpg",
            "stockByBranch": {"branch_q10": 12}
        }
        resp = self.client.post("/api/flower/v1/admin/products", json=payload, headers=headers)
        self.assertIn(resp.status_code, [200, 201], f"API POST thất bại: {resp.get_data(as_text=True)}")

        # Gọi API lấy materials để xác minh
        resp_mat = self.client.get("/api/flower/v1/admin/inventory/materials", headers=headers)
        self.assertEqual(resp_mat.status_code, 200)
        mats = resp_mat.get_json().get("data", [])
        self.assertIn(prod_id, [m.get("id") for m in mats])

        # 2. Sửa sang arranged qua API PUT
        payload["productType"] = "arranged"
        resp_put = self.client.put(f"/api/flower/v1/admin/products/{prod_id}", json=payload, headers=headers)
        self.assertEqual(resp_put.status_code, 200, f"API PUT thất bại: {resp_put.get_data(as_text=True)}")

        # Kiểm tra lại materials API -> Không còn
        resp_mat2 = self.client.get("/api/flower/v1/admin/inventory/materials", headers=headers)
        mats2 = resp_mat2.get_json().get("data", [])
        self.assertNotIn(prod_id, [m.get("id") for m in mats2])


if __name__ == "__main__":
    unittest.main()
