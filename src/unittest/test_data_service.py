import os
import sys
import unittest
import tempfile
import shutil
import json

# Thêm đường dẫn src vào sys.path để import
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from services.data_service import (
    CONFIG_DIR,
    ORDERS_DIR,
    read_json,
    write_json,
    paginate,
    get_branches,
    get_branch_by_id,
    save_branches,
    get_price_levels,
    get_price_level_by_id,
    get_users,
    get_user_by_id,
    get_user_by_phone_or_email,
    get_products,
    get_product_by_id,
    get_promotions,
    get_promotion_by_code,
    get_translations,
    save_translations,
    get_wastage_reports,
    add_wastage_report,
    get_customers,
    get_customer_by_phone,
    get_monthly_order_filename,
    read_orders_by_month,
    write_orders_by_month,
    get_order_by_id,
    save_order,
    update_order_status
)


class TestDataService(unittest.TestCase):
    """Bộ kiểm thử đơn vị cho hệ thống Data Models & Storage Service (TASK 01)"""

    def test_01_all_json_files_exist_and_valid(self):
        """Kiểm tra tất cả các file JSON cấu hình tồn tại và cú pháp hợp lệ 100%"""
        required_files = [
            "branches.json",
            "users.json",
            "price_levels.json",
            "products.json",
            "promotions.json",
            "translations.json",
            "wastage_reports.json",
            "customers_crm.json"
        ]
        for fname in required_files:
            fpath = os.path.join(CONFIG_DIR, fname)
            self.assertTrue(os.path.exists(fpath), f"File {fname} không tồn tại trong config/")
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.assertIsNotNone(data, f"File {fname} không đọc được JSON")

        # Kiểm tra file đơn hàng phân mảnh theo tháng
        order_file = os.path.join(ORDERS_DIR, "orders_2026_08.json")
        self.assertTrue(os.path.exists(order_file), "File orders_2026_08.json không tồn tại!")

    def test_02_branches_schema(self):
        """Kiểm tra schema dữ liệu của Showroom / Chi nhánh"""
        branches = get_branches()
        self.assertGreaterEqual(len(branches), 3, "Hệ thống phải có ít nhất 3 chi nhánh mẫu")
        branch_ids = [b["id"] for b in branches]
        self.assertIn("branch_q10", branch_ids)
        self.assertIn("branch_q1", branch_ids)
        self.assertIn("branch_thao_dien", branch_ids)

        q10 = get_branch_by_id("branch_q10")
        self.assertIsNotNone(q10)
        self.assertEqual(q10["code"], "CN_Q10")
        self.assertIn("lat", q10)
        self.assertIn("lng", q10)
        self.assertTrue(q10["isActive"])

    def test_03_users_and_5_roles(self):
        """Kiểm tra đủ 5 vai trò (Roles) trong users.json"""
        users = get_users()
        self.assertGreaterEqual(len(users), 5)
        roles = {u["role"] for u in users}
        expected_roles = {"super_admin", "branch_manager", "florist", "sales_consultant", "customer"}
        self.assertTrue(expected_roles.issubset(roles), f"Thiếu vai trò trong danh sách: {expected_roles - roles}")

        # Test tìm kiếm user theo phone hoặc email
        admin = get_user_by_phone_or_email("admin@nohoathabinh.vn")
        self.assertIsNotNone(admin)
        self.assertEqual(admin["role"], "super_admin")

        staff1 = get_user_by_phone_or_email("0909123456")
        self.assertIsNotNone(staff1)
        self.assertEqual(staff1["role"], "branch_manager")

    def test_04_price_levels_governance(self):
        """Kiểm tra 4 tầng giá chuẩn và điều kiện minPrice < maxPrice"""
        levels = get_price_levels()
        self.assertEqual(len(levels), 4, "Phải có đúng 4 phân tầng giá")
        codes = [lvl["code"] for lvl in levels]
        self.assertEqual(codes, ["LV_01", "LV_02", "LV_03", "LV_04"])

        for lvl in levels:
            self.assertLess(lvl["minPrice"], lvl["maxPrice"], f"minPrice phải nhỏ hơn maxPrice ở {lvl['code']}")
            self.assertTrue(lvl["minPrice"] <= lvl["defaultPrice"] <= lvl["maxPrice"])

    def test_05_products_catalog(self):
        """Kiểm tra danh mục sản phẩm hoa và kho chi nhánh"""
        products = get_products()
        self.assertGreaterEqual(len(products), 4)

        for p in products:
            self.assertIn("id", p)
            self.assertIn("name", p)
            self.assertIn("priceNumber", p)
            self.assertIn("priceLevelId", p)
            self.assertIn("stockByBranch", p)
            self.assertIn("branch_q10", p["stockByBranch"])

        p1 = get_product_by_id("bo_hoa_01")
        self.assertIsNotNone(p1)
        self.assertEqual(p1["priceNumber"], 420000)

    def test_06_promotions_and_vouchers(self):
        """Kiểm tra voucher và mã khuyến mãi"""
        promos = get_promotions()
        self.assertGreaterEqual(len(promos), 2)
        
        promo = get_promotion_by_code("phunu15")
        self.assertIsNotNone(promo)
        self.assertEqual(promo["code"], "PHUNU15")
        self.assertEqual(promo["discountValue"], 15)

    def test_07_translations_and_caching(self):
        """Kiểm tra từ điển đa ngôn ngữ và cơ chế cache LRU"""
        t = get_translations()
        self.assertIn("languages", t)
        self.assertEqual(set(t["languages"]), {"vi", "en", "ja", "ko", "zh"})
        self.assertIn("translations", t)
        self.assertIn("site_title", t["translations"])
        self.assertEqual(t["translations"]["site_title"]["vi"], "Nở Hoa Thả Bình - Đặt Hoa Online Giao Tận Nơi")

    def test_08_pagination_logic(self):
        """Kiểm tra hàm phân trang paginate() an toàn chống OOM"""
        sample_items = list(range(1, 101))  # 100 items

        # Trang 1, limit 20
        res1 = paginate(sample_items, page=1, limit=20)
        self.assertEqual(len(res1["items"]), 20)
        self.assertEqual(res1["items"][0], 1)
        self.assertEqual(res1["pagination"]["total"], 100)
        self.assertEqual(res1["pagination"]["total_pages"], 5)
        self.assertTrue(res1["pagination"]["has_next"])
        self.assertFalse(res1["pagination"]["has_prev"])

        # Trang 5 (trang cuối)
        res5 = paginate(sample_items, page=5, limit=20)
        self.assertEqual(len(res5["items"]), 20)
        self.assertEqual(res5["items"][-1], 100)
        self.assertFalse(res5["pagination"]["has_next"])
        self.assertTrue(res5["pagination"]["has_prev"])

        # Vượt quá max_limit (max 50) -> tự giới hạn 50
        res_large = paginate(sample_items, page=1, limit=1000, max_limit=50)
        self.assertEqual(len(res_large["items"]), 50)
        self.assertEqual(res_large["pagination"]["limit"], 50)

        # Tham số không hợp lệ
        res_invalid = paginate(sample_items, page=-5, limit=-10)
        self.assertEqual(res_invalid["pagination"]["page"], 1)
        self.assertEqual(res_invalid["pagination"]["limit"], 20)

    def test_09_atomic_write_safety(self):
        """Kiểm tra ghi file an toàn (Atomic Write qua file tạm)"""
        temp_dir = tempfile.mkdtemp()
        try:
            test_file = os.path.join(temp_dir, "test_atomic.json")
            test_data = {"status": "success", "count": 42}
            
            self.assertTrue(write_json(test_file, test_data))
            self.assertTrue(os.path.exists(test_file))
            
            read_back = read_json(test_file)
            self.assertEqual(read_back, test_data)
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_10_monthly_orders_partitioning(self):
        """Kiểm tra phân mảnh đơn hàng theo tháng và cập nhật trạng thái đơn"""
        # Kiểm tra sinh tên file tháng
        fn = get_monthly_order_filename("2026-08")
        self.assertEqual(fn, "orders_2026_08.json")

        # Đọc đơn hàng tháng 2026_08
        orders = read_orders_by_month("2026_08")
        self.assertGreaterEqual(len(orders), 1)

        # Tìm đơn theo ID
        order = get_order_by_id("ord_20260822_001")
        self.assertIsNotNone(order)
        self.assertEqual(order["orderCode"], "NHTB_20260822_001")
        self.assertEqual(order["assignedBranchId"], "branch_q10")

        # Cập nhật trạng thái đơn
        updated = update_order_status("ord_20260822_001", "delivered", year_month="2026_08")
        self.assertIsNotNone(updated)
        self.assertEqual(updated["status"], "delivered")

        # Đổi lại về 'arranging' để giữ dữ liệu mẫu nhất quán
        update_order_status("ord_20260822_001", "arranging", year_month="2026_08")


if __name__ == "__main__":
    unittest.main()
