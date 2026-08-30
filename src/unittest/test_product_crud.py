import os
import sys
import unittest
import json
import time

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from flower_config import FLOWER_CONFIG_DIR, PRODUCTS_FILE_PATH, PRODUCTS_DIR
from app import app
from product_service import (
    create_or_update_product,
    toggle_product_active,
    delete_product,
    list_products,
    validate_product_price_governance,
    get_valid_category_ids
)
from data_service import get_product_by_id, get_products
from anne_auth_service import generate_jwt_token


class TestProductCreateAndUpdate(unittest.TestCase):
    """
    Bộ kiểm thử Đơn vị (Unit Test) toàn diện cho chức năng Thêm Mới & Cập Nhật Sản Phẩm (Add & Edit Product)
    bao gồm cả Service Layer và RESTful API Endpoint với cơ chế Price Guardrail & Lưu trữ 2 tầng.
    """

    def setUp(self):
        self.client = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()

        # Tạo mã test ngẫu nhiên để tránh xung đột dữ liệu thực
        self.test_suffix = f"test_{int(time.time() * 1000)}"
        self.created_product_ids = []

        # JWT Token Super Admin
        self.admin_token = generate_jwt_token({
            "userId": "staff_admin",
            "fullName": "Tổng Quản Trị Hệ Thống",
            "role": "super_admin",
            "branchId": None
        })

        # JWT Token Khách hàng (Không có quyền Admin CMS)
        self.customer_token = generate_jwt_token({
            "userId": "cust_001",
            "fullName": "Nguyễn Văn A",
            "role": "customer",
            "branchId": None
        })

    def tearDown(self):
        # Dọn dẹp sạch sẽ tất cả sản phẩm thử nghiệm đã tạo
        for pid in self.created_product_ids:
            try:
                delete_product(pid)
            except Exception:
                pass
        self.app_context.pop()

    # ==========================================
    # 1. KIỂM THỬ THÊM MỚI SẢN PHẨM (CREATE / ADD)
    # ==========================================

    def test_01_create_product_success_saves_both_summary_and_detail(self):
        """Kiểm tra thêm mới sản phẩm hợp lệ: Tự động lưu cả products.json và file chi tiết products/{id}.json"""
        prod_id = f"bo_hoa_{self.test_suffix}"
        self.created_product_ids.append(prod_id)

        payload = {
            "id": prod_id,
            "name": "Bó Hoa Hồng Juliet Test",
            "category": "bo_hoa",
            "priceLevelId": "price_lvl_01",  # Chuẩn: 300,000đ - 550,000đ
            "priceNumber": 450000,
            "originalPriceNumber": 500000,
            "badge": "Mới",
            "image": "https://images.unsplash.com/photo-test.jpg",
            "gallery": [
                "https://images.unsplash.com/photo-test-1.jpg",
                "https://images.unsplash.com/photo-test-2.jpg"
            ],
            "description": "Mẫu hoa thử nghiệm cắm theo phong cách hiện đại.",
            "flowerComposition": "Hồng Juliet (10 cành), Baby trắng, Lá Bạc",
            "dimension": "Cao 50cm x Rộng 40cm",
            "careTips": "Cắt gốc 45 độ, thay nước sạch mỗi ngày.",
            "stockByBranch": {
                "branch_q10": 15,
                "branch_q1": 8,
                "branch_thao_dien": 5
            },
            "dailyQuota": 25
        }

        # 1. Gọi Service tạo sản phẩm
        success, detail_data, err = create_or_update_product(payload)
        self.assertTrue(success, f"Thêm sản phẩm thất bại: {err}")
        self.assertIsNotNone(detail_data)
        self.assertEqual(detail_data.get("id"), prod_id)
        self.assertEqual(detail_data.get("salePrice"), "450,000₫")

        # 2. Kiểm tra bản ghi trong summary products.json
        all_prods = get_products()
        summary = next((p for p in all_prods if p.get("id") == prod_id), None)
        self.assertIsNotNone(summary, "Sản phẩm mới phải có trong products.json")
        self.assertEqual(summary.get("name"), "Bó Hoa Hồng Juliet Test")
        self.assertEqual(summary.get("priceNumber"), 450000)
        self.assertEqual(summary.get("stockByBranch", {}).get("branch_q10"), 15)

        # 3. Kiểm tra file chi tiết riêng config/anne/products/{id}.json
        detail_path = os.path.join(PRODUCTS_DIR, f"{prod_id}.json")
        self.assertTrue(os.path.exists(detail_path), f"File chi tiết {detail_path} phải được tạo ra")
        with open(detail_path, "r", encoding="utf-8") as f:
            disk_detail = json.load(f)

        self.assertEqual(disk_detail.get("id"), prod_id)
        self.assertEqual(len(disk_detail.get("gallery", [])), 2)
        self.assertEqual(disk_detail.get("flowerComposition"), "Hồng Juliet (10 cành), Baby trắng, Lá Bạc")
        self.assertEqual(disk_detail.get("dimension"), "Cao 50cm x Rộng 40cm")

    def test_02_create_product_missing_required_fields_validation(self):
        """Kiểm tra xác thực đầu vào khi thêm sản phẩm: Chặn thiếu tên, dữ liệu rỗng hoặc sai định dạng giá"""
        # 1. Dữ liệu rỗng
        ok, _, err = create_or_update_product({})
        self.assertFalse(ok)
        self.assertIn("không hợp lệ", err)

        # 2. Tên bị để trống hoặc toàn dấu cách
        ok2, _, err2 = create_or_update_product({
            "name": "   ",
            "category": "bo_hoa",
            "priceLevelId": "price_lvl_01",
            "priceNumber": 400000
        })
        self.assertFalse(ok2)
        self.assertIn("Vui lòng nhập tên sản phẩm", err2)

        # 3. Giá bán không phải số
        ok3, _, err3 = create_or_update_product({
            "name": "Bó Hoa Sai Giá",
            "category": "bo_hoa",
            "priceLevelId": "price_lvl_01",
            "priceNumber": "chu_khong_phai_so"
        })
        self.assertFalse(ok3)
        self.assertIn("phải là số nguyên", err3)

    # ==========================================
    # 2. KIỂM THỬ CẬP NHẬT SẢN PHẨM (UPDATE / EDIT)
    # ==========================================

    def test_03_update_existing_product_success(self):
        """Kiểm tra cập nhật thông tin sản phẩm đã có: Đồng bộ giá, tên và tồn kho trên cả 2 tầng lưu trữ"""
        prod_id = f"ke_hoa_{self.test_suffix}"
        self.created_product_ids.append(prod_id)

        # Bước 1: Tạo sản phẩm ban đầu (Phân khúc Sang Trọng LV_03: 1,000,000đ - 2,500,000đ)
        init_payload = {
            "id": prod_id,
            "name": "Kệ Hoa Khai Trương Bản Đầu",
            "category": "ke_hoa",
            "priceLevelId": "price_lvl_03",
            "priceNumber": 1800000,
            "stockByBranch": {
                "branch_q10": 5,
                "branch_q1": 3,
                "branch_thao_dien": 2
            }
        }
        success, _, _ = create_or_update_product(init_payload)
        self.assertTrue(success)

        # Bước 2: Cập nhật thông tin mới (đổi giá lên 2,200,000đ, đổi tên và tồn kho)
        update_payload = {
            "name": "Kệ Hoa Khai Trương Đại Hồng Phát (Đã Cập Nhật)",
            "category": "ke_hoa",
            "priceLevelId": "price_lvl_03",
            "priceNumber": 2200000,
            "originalPriceNumber": 2500000,
            "badge": "Hot Deal",
            "stockByBranch": {
                "branch_q10": 20,
                "branch_q1": 10,
                "branch_thao_dien": 8
            },
            "careTips": "Tưới nước ẩm xốp cắm mỗi sáng."
        }

        up_success, up_detail, up_err = create_or_update_product(update_payload, product_id=prod_id)
        self.assertTrue(up_success, f"Cập nhật sản phẩm thất bại: {up_err}")
        self.assertEqual(up_detail.get("name"), "Kệ Hoa Khai Trương Đại Hồng Phát (Đã Cập Nhật)")
        self.assertEqual(up_detail.get("salePrice"), "2,200,000₫")
        self.assertEqual(up_detail.get("badge"), "Hot Deal")

        # Bước 3: Xác minh trong products.json
        summary = next((p for p in get_products() if p.get("id") == prod_id), None)
        self.assertIsNotNone(summary)
        self.assertEqual(summary.get("name"), "Kệ Hoa Khai Trương Đại Hồng Phát (Đã Cập Nhật)")
        self.assertEqual(summary.get("priceNumber"), 2200000)
        self.assertEqual(summary.get("stockByBranch", {}).get("branch_q10"), 20)

        # Bước 4: Xác minh trong file chi tiết riêng
        detail = get_product_by_id(prod_id)
        self.assertIsNotNone(detail)
        self.assertEqual(detail.get("careTips"), "Tưới nước ẩm xốp cắm mỗi sáng.")

    def test_04_update_non_existent_product_returns_error(self):
        """Kiểm tra cập nhật với mã sản phẩm không tồn tại: Trả về lỗi rõ ràng"""
        fake_id = f"non_existent_prod_{self.test_suffix}"
        ok, _, err = create_or_update_product({
            "name": "Hoa Cập Nhật Giả",
            "category": "bo_hoa",
            "priceLevelId": "price_lvl_01",
            "priceNumber": 400000
        }, product_id=fake_id)

        self.assertFalse(ok)
        self.assertIn("Không tìm thấy sản phẩm", err)

    def test_05_edit_product_price_level_transition(self):
        """Kiểm tra chuyển đổi phân tầng mức giá khi Sửa (VD: nâng cấp từ Standard LV_01 lên Luxury LV_03)"""
        prod_id = f"bo_nang_cap_{self.test_suffix}"
        self.created_product_ids.append(prod_id)

        # 1. Tạo ban đầu ở LV_01 (400,000đ)
        create_or_update_product({
            "id": prod_id,
            "name": "Bó Hoa Standard",
            "category": "bo_hoa",
            "priceLevelId": "price_lvl_01",
            "priceNumber": 400000
        })

        # 2. Cố tình sửa giá lên 1,800,000đ nhưng quên đổi priceLevelId (vẫn là price_lvl_01) -> Bị chặn
        ok_fail, _, err_fail = create_or_update_product({
            "name": "Bó Hoa Standard Nâng Cấp",
            "category": "bo_hoa",
            "priceLevelId": "price_lvl_01",
            "priceNumber": 1800000
        }, product_id=prod_id)
        self.assertFalse(ok_fail)
        self.assertIn("GIÁ QUÁ CAO", err_fail)

        # 3. Sửa đồng thời cả priceLevelId lên price_lvl_03 và giá 1,800,000đ -> Thành công
        ok_pass, detail_pass, _ = create_or_update_product({
            "name": "Bó Hoa Standard Nâng Cấp Luxury",
            "category": "bo_hoa",
            "priceLevelId": "price_lvl_03",
            "priceNumber": 1800000
        }, product_id=prod_id)
        self.assertTrue(ok_pass)
        self.assertEqual(detail_pass.get("priceLevelId"), "price_lvl_03")
        self.assertEqual(detail_pass.get("priceNumber"), 1800000)

    # ==========================================
    # 3. KIỂM THỬ HÀNG RÀO GIÁ AN TOÀN & GIÁ TRỊ BIÊN (PRICE BOUNDARIES)
    # ==========================================

    def test_06_price_governance_rejects_below_minimum(self):
        """Hàng rào giá: Từ chối giá bán thấp hơn giá sàn quy định của phân tầng"""
        # price_lvl_01 (Phổ Thông): Min 300,000₫ - Max 550,000₫
        payload = {
            "name": "Hoa Bán Phá Giá",
            "category": "bo_hoa",
            "priceLevelId": "price_lvl_01",
            "priceNumber": 150000  # < 300,000đ -> Bị chặn
        }
        success, _, err = create_or_update_product(payload)
        self.assertFalse(success)
        self.assertIn("GIÁ QUÁ THẤP", err or "")

    def test_07_price_governance_rejects_above_maximum(self):
        """Hàng rào giá: Từ chối giá bán vượt quá giá trần quy định của phân tầng (tránh gõ thừa số 0)"""
        # price_lvl_01 (Phổ Thông): Min 300,000₫ - Max 550,000₫
        payload = {
            "name": "Hoa Gõ Nhầm Số 0",
            "category": "bo_hoa",
            "priceLevelId": "price_lvl_01",
            "priceNumber": 4500000  # > 550,000đ -> Bị chặn
        }
        success, _, err = create_or_update_product(payload)
        self.assertFalse(success)
        self.assertIn("GIÁ QUÁ CAO", err or "")

    def test_08_price_exact_boundary_values(self):
        """Kiểm tra các giá trị biên chính xác: Chạm đúng minPrice, maxPrice, lệch 1 đồng"""
        # price_lvl_02 (Cao Cấp): Min 600,000₫ - Max 950,000₫
        
        # Biên dưới: 600,000₫ -> Hợp lệ
        ok1, err1 = validate_product_price_governance("price_lvl_02", 600000)
        self.assertTrue(ok1)
        self.assertIsNone(err1)

        # Dưới biên 1đ: 599,999₫ -> Không hợp lệ
        ok2, err2 = validate_product_price_governance("price_lvl_02", 599999)
        self.assertFalse(ok2)
        self.assertIn("GIÁ QUÁ THẤP", err2)

        # Biên trên: 950,000₫ -> Hợp lệ
        ok3, err3 = validate_product_price_governance("price_lvl_02", 950000)
        self.assertTrue(ok3)
        self.assertIsNone(err3)

        # Vượt biên 1đ: 950,001₫ -> Không hợp lệ
        ok4, err4 = validate_product_price_governance("price_lvl_02", 950001)
        self.assertFalse(ok4)
        self.assertIn("GIÁ QUÁ CAO", err4)

    def test_09_reject_invalid_category(self):
        """Kiểm tra xác thực danh mục: Từ chối danh mục không tồn tại trong categories.json"""
        payload = {
            "name": "Hoa Danh Mục Lạ",
            "category": "danh_muc_khong_ton_tai_xyz",
            "priceLevelId": "price_lvl_01",
            "priceNumber": 400000
        }
        success, _, err = create_or_update_product(payload)
        self.assertFalse(success)
        self.assertIn("không hợp lệ", err or "")

    # ==========================================
    # 4. KIỂM THỬ BẬT/ẨN & XÓA SẢN PHẨM (TOGGLE & DELETE)
    # ==========================================

    def test_10_toggle_product_active_status(self):
        """Kiểm tra tính năng Bật/Ẩn sản phẩm hiển thị trên website"""
        prod_id = f"binh_hoa_{self.test_suffix}"
        self.created_product_ids.append(prod_id)

        # Tạo sản phẩm mặc định isActive=True
        create_or_update_product({
            "id": prod_id,
            "name": "Bình Thủy Tinh Test",
            "category": "binh_hoa",
            "priceLevelId": "price_lvl_01",
            "priceNumber": 450000
        })

        # Ẩn sản phẩm
        ok, toggled, _ = toggle_product_active(prod_id, is_active=False)
        self.assertTrue(ok)
        self.assertFalse(toggled.get("isActive"))

        # Kiểm tra file chi tiết cũng được chuyển isActive=False
        detail = get_product_by_id(prod_id)
        self.assertFalse(detail.get("isActive"))

        # Bật lại sản phẩm
        ok2, toggled2, _ = toggle_product_active(prod_id, is_active=True)
        self.assertTrue(ok2)
        self.assertTrue(toggled2.get("isActive"))

    def test_11_delete_product_removes_both_summary_and_detail(self):
        """Kiểm tra xóa sản phẩm: Dọn dẹp sạch cả products.json và file chi tiết {id}.json"""
        prod_id = f"lan_{self.test_suffix}"

        create_or_update_product({
            "id": prod_id,
            "name": "Chậu Lan Test Xóa",
            "category": "lan_ho_diep",
            "priceLevelId": "price_lvl_04",
            "priceNumber": 3500000
        })

        detail_file = os.path.join(PRODUCTS_DIR, f"{prod_id}.json")
        self.assertTrue(os.path.exists(detail_file))

        # Thực hiện xóa
        del_ok, del_err = delete_product(prod_id)
        self.assertTrue(del_ok, f"Xóa thất bại: {del_err}")

        # Kiểm tra không còn trong summary
        summary = next((p for p in get_products() if p.get("id") == prod_id), None)
        self.assertIsNone(summary)

        # Kiểm tra file chi tiết đã bị xóa
        self.assertFalse(os.path.exists(detail_file), "File chi tiết sản phẩm phải được xóa khỏi đĩa")

    # ==========================================
    # 5. KIỂM THỬ TÌM KIẾM & BỘ LỌC SAU KHI THÊM / SỬA (LIST & SEARCH)
    # ==========================================

    def test_12_search_and_filter_after_add_and_edit(self):
        """Kiểm tra tìm kiếm sản phẩm theo tên, thành phần hoa và bộ lọc danh mục sau khi thêm/sửa"""
        prod_id = f"bo_search_{self.test_suffix}"
        self.created_product_ids.append(prod_id)

        create_or_update_product({
            "id": prod_id,
            "name": "Bó Hoa Hương Lavender Độc Quyền",
            "category": "bo_hoa",
            "priceLevelId": "price_lvl_02",
            "priceNumber": 880000,
            "flowerComposition": "Hoa Lavender Pháp khô, Hồng Sa Mạc, Lá Bạch Đàn",
            "isActive": True
        })

        # 1. Tìm theo tên
        results_name = list_products(search="Lavender Độc Quyền")
        self.assertTrue(any(p.get("id") == prod_id for p in results_name))

        # 2. Tìm theo thành phần hoa
        results_comp = list_products(search="Bạch Đàn")
        self.assertTrue(any(p.get("id") == prod_id for p in results_comp))

        # 3. Lọc theo danh mục
        results_cat = list_products(category="bo_hoa")
        self.assertTrue(any(p.get("id") == prod_id for p in results_cat))

        # 4. Lọc theo danh mục khác -> Không thấy sản phẩm này
        results_other_cat = list_products(category="binh_hoa")
        self.assertFalse(any(p.get("id") == prod_id for p in results_other_cat))

    # ==========================================
    # 6. KIỂM THỬ RESTFUL API (HTTP ENDPOINTS)
    # ==========================================

    def test_13_api_create_and_update_product_endpoints(self):
        """Kiểm thử API Endpoint POST /admin/products & PUT /admin/products/<id>"""
        prod_id = f"api_prod_{self.test_suffix}"
        self.created_product_ids.append(prod_id)

        # 1. Thử tạo mà không có JWT Token -> 401 Unauthorized
        res_unauth = self.client.post("/api/flower/v1/admin/products", json={"name": "Test"})
        self.assertEqual(res_unauth.status_code, 401)

        # 2. Thử tạo với quyền Customer -> 403 Forbidden
        res_forbidden = self.client.post(
            "/api/flower/v1/admin/products",
            headers={"Authorization": f"Bearer {self.customer_token}"},
            json={"name": "Test"}
        )
        self.assertEqual(res_forbidden.status_code, 403)

        # 3. Tạo thành công với quyền Super Admin
        create_payload = {
            "id": prod_id,
            "name": "Hoa Cưới Mẫu API Test",
            "category": "hoa_cuoi",
            "priceLevelId": "price_lvl_03",
            "priceNumber": 1650000,
            "description": "Tạo qua REST API",
            "stockByBranch": {"branch_q10": 10, "branch_q1": 5, "branch_thao_dien": 3}
        }
        res_create = self.client.post(
            "/api/flower/v1/admin/products",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json=create_payload
        )
        self.assertEqual(res_create.status_code, 201)
        data_create = res_create.get_json()
        self.assertTrue(data_create.get("success"))
        self.assertEqual(data_create.get("data", {}).get("id"), prod_id)

        # 4. Cập nhật qua PUT API
        update_payload = {
            "name": "Hoa Cưới Mẫu API Test (Đã Sửa)",
            "category": "hoa_cuoi",
            "priceLevelId": "price_lvl_03",
            "priceNumber": 1850000
        }
        res_update = self.client.put(
            f"/api/flower/v1/admin/products/{prod_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json=update_payload
        )
        self.assertEqual(res_update.status_code, 200)
        data_update = res_update.get_json()
        self.assertTrue(data_update.get("success"))
        self.assertEqual(data_update.get("data", {}).get("name"), "Hoa Cưới Mẫu API Test (Đã Sửa)")
        self.assertEqual(data_update.get("data", {}).get("salePrice"), "1,850,000₫")

        # 5. Đọc chi tiết sản phẩm qua Public API GET /api/flower/v1/products/<id>
        res_detail = self.client.get(f"/api/flower/v1/products/{prod_id}")
        self.assertEqual(res_detail.status_code, 200)
        detail_json = res_detail.get_json()
        self.assertTrue(detail_json.get("success"))
        self.assertEqual(detail_json.get("data", {}).get("priceNumber"), 1850000)

    def test_14_api_update_with_validation_errors(self):
        """Kiểm thử API PUT /admin/products/<id> khi gửi giá sai hàng rào kiểm soát -> Trả về lỗi 400 Bad Request"""
        prod_id = f"api_err_{self.test_suffix}"
        self.created_product_ids.append(prod_id)

        # Tạo trước sản phẩm
        create_or_update_product({
            "id": prod_id,
            "name": "Sản Phẩm Test Lỗi",
            "category": "bo_hoa",
            "priceLevelId": "price_lvl_01",
            "priceNumber": 400000
        })

        # Gửi PUT giá phá giá 50,000đ (< minPrice 300,000đ)
        res_bad = self.client.put(
            f"/api/flower/v1/admin/products/{prod_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json={
                "name": "Sản Phẩm Bán Phá Giá",
                "category": "bo_hoa",
                "priceLevelId": "price_lvl_01",
                "priceNumber": 50000
            }
        )
        self.assertEqual(res_bad.status_code, 400)
        data_bad = res_bad.get_json()
        self.assertFalse(data_bad.get("success"))
        self.assertIn("GIÁ QUÁ THẤP", data_bad.get("message", ""))

    def test_15_search_products_unaccented_vietnamese(self):
        """Kiểm thử tìm kiếm sản phẩm hỗ trợ tiếng Việt không dấu (vd: 'hoa hong' -> khớp 'Hoa hồng đỏ')"""
        prod_id = f"test_search_{self.test_suffix}"
        self.created_product_ids.append(prod_id)

        create_or_update_product({
            "id": prod_id,
            "name": "Bó Hoa Hồng Đỏ Ecuador Tình Yêu",
            "category": "bo_hoa",
            "priceLevelId": "price_lvl_02",
            "priceNumber": 750000,
            "flowerComposition": "Hoa hồng đỏ Ecuador, hoa baby trắng, lá phụ nhập khẩu",
            "description": "Bó hoa hồng sang trọng dành tặng người yêu"
        })

        # 1. Tìm kiếm không dấu: "hoa hong do"
        res_unaccented = list_products(search="hoa hong do")
        self.assertTrue(any(p.get("id") == prod_id for p in res_unaccented))

        # 2. Tìm kiếm không dấu từ thành phần hoa: "baby trang"
        res_comp = list_products(search="baby trang")
        self.assertTrue(any(p.get("id") == prod_id for p in res_comp))

        # 3. Tìm kiếm qua REST API GET /products?search=nguoi%20yeu
        res_api = self.client.get("/api/flower/v1/products?search=nguoi%20yeu")
        self.assertEqual(res_api.status_code, 200)
        data = res_api.get_json()
        self.assertTrue(data.get("success"))
        self.assertTrue(any(p.get("id") == prod_id for p in data.get("data", [])))

    def test_16_upload_image_endpoint_and_zero_base64(self):
        """Kiểm thử API upload ảnh sản phẩm /admin/upload-image trả về static URL (Zero-Base64 standard)."""
        import io
        fake_img_content = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00"

        # 1. Thử gọi không có token -> 401
        res_unauth = self.client.post("/api/flower/v1/admin/upload-image")
        self.assertEqual(res_unauth.status_code, 401)

        # 2. Upload file ảnh hợp lệ qua multipart form-data
        res = self.client.post(
            "/api/flower/v1/admin/upload-image",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            data={"file": (io.BytesIO(fake_img_content), "test_flower.jpg")},
            content_type="multipart/form-data"
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        img_url = data.get("data", {}).get("url", "")
        self.assertTrue(img_url.startswith(("/api/flower/v1/images/", "/flower/images/")))
        self.assertTrue(img_url.endswith(".jpg"))

        # 3. Upload qua payload Base64 -> chuyển đổi thành static URL
        sample_b64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
        res_b64 = self.client.post(
            "/api/flower/v1/admin/upload-image",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json={"image": sample_b64}
        )
        self.assertEqual(res_b64.status_code, 200)
        data_b64 = res_b64.get_json()
        self.assertTrue(data_b64.get("success"))
        img_b64_url = data_b64.get("data", {}).get("url", "")
        self.assertTrue(img_b64_url.startswith(("/api/flower/v1/images/", "/flower/images/")))


    def test_17_get_image_endpoints(self):
        """Kiểm thử API phục vụ file ảnh tĩnh tiền tố /api/flower/v1/images/<file> và các alias."""
        # 1. Gọi API lấy ảnh sản phẩm /api/flower/v1/images/products/bo_hoa_01.webp
        res = self.client.get("/api/flower/v1/images/products/bo_hoa_01.webp")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.content_type, "image/webp")
        self.assertIn("Cache-Control", res.headers)

        # 2. Gọi route chuẩn tiền tố /api/flower/v1/images/bo_hoa_01.webp
        res_flower = self.client.get("/api/flower/v1/images/bo_hoa_01.webp")
        self.assertEqual(res_flower.status_code, 200)
        self.assertEqual(res_flower.content_type, "image/webp")
        self.assertIn("Cache-Control", res_flower.headers)

        # 3. Gọi route alias /api/flower/v1/products/images/bo_hoa_01.webp
        res_flower_sub = self.client.get("/api/flower/v1/products/images/bo_hoa_01.webp")
        self.assertEqual(res_flower_sub.status_code, 200)

        # 4. Gọi route alias /api/flower/v1/flower/images/bo_hoa_01.webp
        res_alias = self.client.get("/api/flower/v1/flower/images/bo_hoa_01.webp")
        self.assertEqual(res_alias.status_code, 200)

        # 5. Thử lấy ảnh không tồn tại -> 404
        res_404 = self.client.get("/api/flower/v1/images/khong_ton_tai_123.jpg")
        self.assertEqual(res_404.status_code, 404)


if __name__ == "__main__":
    unittest.main()



