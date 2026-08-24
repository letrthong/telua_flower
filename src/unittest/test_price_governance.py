import os
import sys
import unittest
import json
import time

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from app import app
from services.product_service import (
    validate_product_price_governance,
    create_or_update_product,
    toggle_product_active,
    delete_product,
    list_products
)
from services.promotion_service import (
    create_or_update_promotion,
    toggle_promotion,
    list_all_promotions
)
from services.translation_service import (
    get_all_translations,
    update_translation_key,
    batch_update_translations
)
from services.auth_service import generate_jwt_token
from services.data_service import get_product_by_id


class TestPriceGovernanceAndProductCMS(unittest.TestCase):
    """Bộ kiểm thử Hàng Rào Giá An Toàn, CMS Sản Phẩm, Khuyến Mãi & Dịch Đa Ngôn Ngữ (TASK 07)"""

    def setUp(self):
        self.client = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()

        # Token Super Admin
        self.admin_token = generate_jwt_token({
            "userId": "staff_admin",
            "fullName": "Tổng Quản Trị Viên",
            "role": "super_admin",
            "branchId": None
        })

        # Token Customer (Không có quyền admin)
        self.customer_token = generate_jwt_token({
            "userId": "cust_001",
            "fullName": "Khách Hàng",
            "role": "customer",
            "branchId": None
        })

    def tearDown(self):
        self.app_context.pop()

    def test_01_price_governance_valid_range(self):
        """Kiểm tra giá hợp lệ nằm trong khoảng [minPrice, maxPrice] của phân tầng"""
        # LV_01: 300,000 - 550,000₫
        is_valid, err = validate_product_price_governance("price_lvl_01", 450000)
        self.assertTrue(is_valid)
        self.assertIsNone(err)

        # LV_04: 2,600,000 - 15,000,000₫
        is_valid_vip, err_vip = validate_product_price_governance("price_lvl_04", 5000000)
        self.assertTrue(is_valid_vip)
        self.assertIsNone(err_vip)

    def test_02_price_governance_reject_underpricing(self):
        """Kiểm tra chặn giá sàn (nhân viên bán phá giá hoặc gõ thiếu số 0)"""
        # LV_01 sàn là 300,000₫, nhập 150,000₫ -> Bị chặn
        is_valid, err = validate_product_price_governance("price_lvl_01", 150000)
        self.assertFalse(is_valid)
        self.assertIn("GIÁ QUÁ THẤP", err)

    def test_03_price_governance_reject_overpricing(self):
        """Kiểm tra chặn giá trần (nhân viên định giá vượt khung phân tầng)"""
        # LV_01 trần là 550,000₫, nhập 900,000₫ -> Bị chặn
        is_valid, err = validate_product_price_governance("price_lvl_01", 900000)
        self.assertFalse(is_valid)
        self.assertIn("GIÁ QUÁ CAO", err)

    def test_04_create_and_update_product_catalogue(self):
        """Kiểm tra Admin thêm mẫu hoa mới và cập nhật thông tin Catalogue"""
        test_prod_id = f"test_bo_{int(time.time())}"
        new_prod_data = {
            "id": test_prod_id,
            "name": "Bó Hoa Hồng David Austin Test",
            "category": "bo_hoa",
            "priceLevelId": "price_lvl_02",  # 600k - 950k
            "priceNumber": 850000,
            "badge": "Hot",
            "image": "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500",
            "flowerComposition": "Hồng Ohara (15 cành), Cúc Tana, Lá Bạc",
            "stockByBranch": {"branch_q10": 10, "branch_q1": 5, "branch_thao_dien": 3}
        }

        # 1. Thêm mới qua Service
        success, created_prod, err = create_or_update_product(new_prod_data)
        self.assertTrue(success, f"Lỗi tạo hoa: {err}")
        self.assertEqual(created_prod["id"], test_prod_id)
        self.assertEqual(created_prod["salePrice"], "850,000₫")

        # 2. Cập nhật thông tin hoa
        update_data = {
            "name": "Bó Hoa Hồng David Austin VIP (Updated)",
            "category": "bo_hoa",
            "priceLevelId": "price_lvl_02",
            "priceNumber": 920000,
            "badge": "Siêu Phẩm"
        }
        upd_success, updated_prod, _ = create_or_update_product(update_data, product_id=test_prod_id)
        self.assertTrue(upd_success)
        self.assertEqual(updated_prod["name"], "Bó Hoa Hồng David Austin VIP (Updated)")
        self.assertEqual(updated_prod["salePrice"], "920,000₫")

        # 3. Ẩn sản phẩm
        toggle_success, toggled_prod, _ = toggle_product_active(test_prod_id)
        self.assertTrue(toggle_success)
        self.assertFalse(toggled_prod["isActive"])

        # Dọn dẹp
        delete_product(test_prod_id)

    def test_05_promotions_toggle_and_crud(self):
        """Kiểm tra tạo voucher và gạt công tắc Bật/Tắt (ON/OFF)"""
        promo_data = {
            "title": "Mừng Khai Trương Chi Nhánh Thảo Điền",
            "code": f"THAODIEN{int(time.time()) % 1000}",
            "discountType": "percentage",
            "discountValue": 20,
            "maxDiscountAmount": 200000,
            "minOrderAmount": 500000
        }

        success, new_promo, _ = create_or_update_promotion(promo_data)
        self.assertTrue(success)
        self.assertTrue(new_promo["isActive"])

        # Gạt tắt voucher
        p_id = new_promo["id"]
        t_success, t_promo, _ = toggle_promotion(p_id)
        self.assertTrue(t_success)
        self.assertFalse(t_promo["isActive"])

    def test_06_dynamic_translations_update(self):
        """Kiểm tra cập nhật từ điển 5 ngôn ngữ động lưu tức thì vào translations.json"""
        test_key = "test_banner_slogan"
        new_translations = {
            "vi": "Nở Hoa Thả Bình - Sắc Hoa Yêu Thương",
            "en": "Nở Hoa Thả Bình - Blooms of Pure Love",
            "ja": "Nở Hoa Thả Bình - 愛の花びら",
            "ko": "Nở Hoa Thả Bình - 사랑의 꽃",
            "zh": "Nở Hoa Thả Bình - 爱的绽放"
        }

        success, data, err = update_translation_key(test_key, new_translations)
        self.assertTrue(success, f"Lỗi cập nhật bản dịch: {err}")
        self.assertEqual(data["vi"], "Nở Hoa Thả Bình - Sắc Hoa Yêu Thương")
        self.assertEqual(data["en"], "Nở Hoa Thả Bình - Blooms of Pure Love")
        self.assertEqual(data["ja"], "Nở Hoa Thả Bình - 愛の花びら")

    def test_07_rbac_protection_for_admin_endpoints(self):
        """Kiểm tra phân quyền: Chặn khách hàng vãng lai / customer không được vào API Quản trị sản phẩm"""
        bad_payload = {
            "name": "Hoa Giả Mạo",
            "category": "bo_hoa",
            "priceLevelId": "price_lvl_01",
            "priceNumber": 400000
        }

        # 1. Khách không gửi token -> 401 Unauthorized
        res_anon = self.client.post("/api/admin/products", json=bad_payload)
        self.assertEqual(res_anon.status_code, 401)

        # 2. Khách gửi token Customer -> 403 Forbidden
        headers_cust = {"Authorization": f"Bearer {self.customer_token}"}
        res_cust = self.client.post("/api/admin/products", json=bad_payload, headers=headers_cust)
        self.assertEqual(res_cust.status_code, 403)

        # 3. Super Admin gửi token -> 201 Created
        headers_admin = {"Authorization": f"Bearer {self.admin_token}"}
        res_admin = self.client.post("/api/admin/products", json=bad_payload, headers=headers_admin)
        self.assertEqual(res_admin.status_code, 201)

        # Dọn dẹp hoa vừa tạo
        created_id = res_admin.get_json()["data"]["id"]
        delete_product(created_id)

    def test_08_create_product_with_base64_image(self):
        """Kiểm tra thêm mẫu hoa lưu ảnh định dạng chuỗi Base64 Data URI"""
        mock_base64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
        test_prod_id = f"test_b64_{int(time.time())}"
        
        prod_payload = {
            "id": test_prod_id,
            "name": "Bình Hoa Gốm Nghệ Thuật Base64",
            "category": "binh_hoa",
            "priceLevelId": "price_lvl_03",
            "priceNumber": 1500000,
            "image": mock_base64,
            "flowerComposition": "Hoa Tulip & Cẩm Tú Cầu"
        }

        headers_admin = {"Authorization": f"Bearer {self.admin_token}"}
        res = self.client.post("/api/admin/products", json=prod_payload, headers=headers_admin)
        self.assertEqual(res.status_code, 201)
        
        created = res.get_json()["data"]
        self.assertEqual(created["id"], test_prod_id)
        self.assertTrue(created["image"].startswith("data:image/jpeg;base64,"))

        # Kiểm tra tra cứu lại từ API
        res_get = self.client.get(f"/api/products/{test_prod_id}")
        self.assertEqual(res_get.status_code, 200)
        self.assertEqual(res_get.get_json()["data"]["image"], mock_base64)

        # Dọn dẹp
        delete_product(test_prod_id)


if __name__ == "__main__":
    unittest.main()
