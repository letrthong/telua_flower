import os
import sys
import unittest
import json
import time

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from data_service import (
    get_branches,
    get_price_levels,
    get_price_level_by_id,
    get_products,
    get_product_by_id,
    get_promotions,
    get_promotion_by_code,
    get_translations,
    get_wastage_reports,
    add_wastage_report,
    get_customers,
    get_customer_by_phone,
    read_orders_by_month,
    write_orders_by_month,
    get_order_by_id,
    save_order,
    update_order_status
)


class TestCatalogAndPromotions(unittest.TestCase):
    """Bộ kiểm thử nghiệp vụ Danh mục, Khuyến mãi, Tồn kho, CRM, Hao hụt & Đa ngôn ngữ"""

    def test_01_promotions_and_vouchers_validation(self):
        """Kiểm tra danh sách voucher khuyến mãi và tính toán giảm giá"""
        promos = get_promotions()
        self.assertGreaterEqual(len(promos), 3, "Cần có ít nhất 3 mã giảm giá mẫu")

        # 1. Voucher phần trăm PHUNU15
        p15 = get_promotion_by_code("PHUNU15")
        self.assertIsNotNone(p15)
        self.assertEqual(p15["discountType"], "percentage")
        self.assertEqual(p15["discountValue"], 15)
        self.assertEqual(p15["minOrderAmount"], 400000)

        # 2. Voucher cố định FREESHIP
        p_ship = get_promotion_by_code("FREESHIP")
        self.assertIsNotNone(p_ship)
        self.assertEqual(p_ship["discountType"], "fixed")
        self.assertEqual(p_ship["discountValue"], 35000)

        # 3. Mã không tồn tại
        p_invalid = get_promotion_by_code("KHONG_CO_MA_NAY")
        self.assertIsNone(p_invalid)

    def test_02_price_levels_4_tiers(self):
        """Kiểm tra 4 tầng giá chuẩn Bán lẻ, Sự kiện, Thân thiết, Đại lý"""
        levels = get_price_levels()
        self.assertEqual(len(levels), 4, "Phải có đúng 4 tầng giá chuẩn")

        codes = [lvl["code"] for lvl in levels]
        self.assertIn("LV_01", codes)
        self.assertIn("LV_02", codes)
        self.assertIn("LV_03", codes)
        self.assertIn("LV_04", codes)

        lv1 = get_price_level_by_id("price_lvl_01")
        self.assertIsNotNone(lv1)
        self.assertEqual(lv1["code"], "LV_01")
        self.assertEqual(lv1["name"], "Phổ Thông (Standard)")

    def test_03_products_multi_branch_stock_and_quota(self):
        """Kiểm tra danh mục sản phẩm, tồn kho từng chi nhánh và hạn mức ngày"""
        products = get_products()
        self.assertGreaterEqual(len(products), 5, "Cần ít nhất 5 sản phẩm hoa & bình mẫu")

        for prod in products:
            self.assertIn("id", prod)
            self.assertIn("name", prod)
            self.assertIn("priceNumber", prod)
            self.assertIn("category", prod)
            self.assertIn("stockByBranch", prod)
            # Kiểm tra phân bổ tồn kho theo chi nhánh Q10
            self.assertIn("branch_q10", prod["stockByBranch"])

        # Tìm sản phẩm cụ thể
        prod_01 = get_product_by_id("bo_hoa_01")
        self.assertIsNotNone(prod_01)
        self.assertEqual(prod_01["category"], "bo_hoa")
        self.assertGreater(prod_01["priceNumber"], 0)

    def test_04_wastage_reporting_system(self):
        """Kiểm tra báo cáo hoa hỏng, hoa thừa cuối ca của thợ cắm hoa"""
        initial_reports = get_wastage_reports()
        initial_count = len(initial_reports)

        new_report = {
            "id": f"wastage_test_{int(time.time())}",
            "branchId": "branch_q10",
            "reportedBy": "staff_002",
            "date": "2026-08-22",
            "items": [
                {
                    "flowerType": "Hoa Hồng Juliet",
                    "damagedStems": 3,
                    "reason": "gãy_canh_khi_cam",
                    "unitCost": 30000,
                    "totalLoss": 90000
                }
            ],
            "totalLossAmount": 90000,
            "notes": "Kiểm thử thêm báo cáo hao hụt tự động"
        }

        success = add_wastage_report(new_report)
        self.assertTrue(success)

        updated_reports = get_wastage_reports()
        self.assertEqual(len(updated_reports), initial_count + 1)
        first_report = updated_reports[0]
        loss_val = first_report.get("totalLossAmount", first_report.get("totalLossValue"))
        self.assertEqual(loss_val, 90000)

        # Dọn dẹp dữ liệu test
        from data_service import save_wastage_reports
        clean_reports = [r for r in get_wastage_reports() if not str(r.get("id", "")).startswith("wastage_test_")]
        save_wastage_reports(clean_reports)

    def test_05_customers_crm_and_loyalty_points(self):
        """Kiểm tra hệ thống CRM, điểm tích lũy và gu hoa của khách"""
        customers = get_customers()
        self.assertGreaterEqual(len(customers), 2)

        cust_nva = get_customer_by_phone("0987654321")
        self.assertIsNotNone(cust_nva)
        self.assertEqual(cust_nva["fullName"], "Nguyễn Văn A")
        self.assertGreaterEqual(cust_nva.get("loyaltyPoints", 0), 50)
        self.assertIn("tier", cust_nva)
        self.assertIn("savedAddresses", cust_nva)

    def test_06_translations_i18n_dictionary_completeness(self):
        """Kiểm tra từ điển 5 ngôn ngữ (VI, EN, JA, KO, ZH) có đầy đủ các khóa giao diện"""
        trans = get_translations()
        self.assertIsNotNone(trans)
        self.assertIn("languages", trans)
        self.assertEqual(len(trans["languages"]), 5)

        translations_dict = trans.get("translations", {})
        self.assertIn("site_title", translations_dict)
        self.assertIn("hotline", translations_dict)
        self.assertIn("hero_heading", translations_dict)

        for lang in trans["languages"]:
            self.assertIn(lang, translations_dict["site_title"], f"Thiếu ngôn ngữ {lang} trong site_title")

    def test_07_monthly_order_storage_and_status_lifecycle(self):
        """Kiểm tra vòng đời trạng thái đơn hàng (Lifecycle: pending -> completed)"""
        test_order_id = f"TEST_ORD_{int(time.time())}"
        test_order = {
            "id": test_order_id,
            "orderCode": f"NHTB-TEST-{int(time.time()) % 10000:04d}",
            "orderDate": "2026-08-22T14:00:00Z",
            "branchId": "branch_q10",
            "customerId": "cust_001",
            "sender": {
                "name": "Nguyễn Văn A",
                "phone": "0987654321"
            },
            "recipient": {
                "name": "Trần Thị B",
                "phone": "0912345678",
                "address": "123 Cách Mạng Tháng 8, Q.3, TP.HCM"
            },
            "items": [
                {
                    "productId": "bo_hoa_01",
                    "productName": "Mây Trắng Bồng Bềnh",
                    "quantity": 1,
                    "price": 420000
                }
            ],
            "cardMessage": "Chúc mừng sinh nhật em!",
            "ribbonBanner": "Happy Birthday",
            "anonymousSender": False,
            "totalAmount": 420000,
            "status": "pending",
            "history": [
                {"status": "pending", "updatedAt": "2026-08-22T14:00:00Z", "note": "Đơn mới tạo"}
            ]
        }

        # 1. Lưu đơn hàng
        save_success = save_order(test_order)
        self.assertTrue(save_success)

        # 2. Tìm đơn theo ID
        found_order = get_order_by_id(test_order_id)
        self.assertIsNotNone(found_order)
        self.assertEqual(found_order["status"], "pending")

        # 3. Chuyển trạng thái -> confirmed
        updated = update_order_status(test_order_id, "confirmed", note="Nhân viên xác nhận đơn")
        self.assertIsNotNone(updated)
        self.assertEqual(get_order_by_id(test_order_id)["status"], "confirmed")

        # 4. Chuyển trạng thái -> in_progress (Thợ cắm)
        updated = update_order_status(test_order_id, "in_progress", note="Thợ đang cắm hoa")
        self.assertIsNotNone(updated)
        self.assertEqual(get_order_by_id(test_order_id)["status"], "in_progress")

        # 5. Chuyển trạng thái -> photo_sent (Gửi ảnh duyệt)
        updated = update_order_status(test_order_id, "photo_sent", note="Đã gửi ảnh thành phẩm cho khách")
        self.assertIsNotNone(updated)
        self.assertEqual(get_order_by_id(test_order_id)["status"], "photo_sent")

        # 6. Chuyển trạng thái -> completed
        updated = update_order_status(test_order_id, "completed", note="Giao hoa thành công")
        self.assertIsNotNone(updated)
        self.assertEqual(get_order_by_id(test_order_id)["status"], "completed")

    def test_08_pre_write_json_validation_and_integrity_guard(self):
        """Kiểm tra cơ chế xác thực định dạng JSON trước khi ghi file (Pre-Write Validation)"""
        from data_service import write_json, save_product_detail
        
        # 1. Dữ liệu chứa đối tượng không thể serialize (non-serializable object) -> Phải trả về False an toàn
        invalid_data = {
            "title": "Hoa Lan",
            "invalid_func": lambda x: x,
            "invalid_set": {1, 2, 3}
        }
        res = write_json("config/anne/test_invalid.json", invalid_data)
        self.assertFalse(res, "write_json phải từ chối ghi dữ liệu không hợp lệ")

        # 2. save_product_detail với product_id nguy hiểm (Path Traversal) -> Phải từ chối an toàn
        bad_id_res = save_product_detail("../../../etc/passwd", {"name": "test"})
        self.assertFalse(bad_id_res, "save_product_detail phải chặn path traversal")

        # 3. save_product_detail với dữ liệu không phải dict -> Phải từ chối an toàn
        bad_type_res = save_product_detail("test_prod_01", "not_a_dict")
        self.assertFalse(bad_type_res, "save_product_detail phải từ chối kiểu dữ liệu không phải dict")

    def test_09_multi_language_json_validation_and_safety(self):
        """Kiểm tra cơ chế xác thực từ điển đa ngôn ngữ (Multi-language JSON Validation)"""
        from data_service import validate_translations_matrix, save_translations

        # 1. Kiểm tra từ điển rỗng hoặc sai kiểu
        ok, err = validate_translations_matrix([])
        self.assertFalse(ok)
        ok, err = validate_translations_matrix({})
        self.assertFalse(ok)

        # 2. Kiểm tra từ điển thiếu ngôn ngữ gốc 'vi'
        bad_matrix = {
            "hero_title": {"en": "Welcome to Flower Shop"}
        }
        ok, err = validate_translations_matrix(bad_matrix)
        self.assertFalse(ok, "Phải bắt buộc có bản dịch gốc 'vi'")

        # 3. Kiểm tra từ điển chứa giá trị không phải chuỗi
        bad_type_matrix = {
            "hero_title": {"vi": 12345, "en": "Welcome"}
        }
        ok, err = validate_translations_matrix(bad_type_matrix)
        self.assertFalse(ok, "Bản dịch phải là kiểu chuỗi")

        # 4. Kiểm tra từ điển hợp lệ
        valid_matrix = {
            "hotline": {
                "type": "system",
                "vi": "Hotline:",
                "en": "Hotline:",
                "ja": "ホットライン:",
                "ko": "고객센터:",
                "zh": "服务热线:"
            }
        }
        ok, err = validate_translations_matrix(valid_matrix)
        self.assertTrue(ok)

    def test_10_system_vs_user_translations_immutability_guard(self):
        """Kiểm tra cơ chế phân loại system/user và bảo vệ chống xóa khóa hệ thống"""
        from translation_service import update_translation_key, delete_translation_key, get_all_translations

        # 1. Thêm một khóa bản dịch tùy chỉnh của người dùng (user key)
        user_key = "promo_autumn_2026"
        user_texts = {
            "vi": "Chào Thu Rực Rỡ",
            "en": "Welcome Autumn Season"
        }
        success, data, err = update_translation_key(user_key, user_texts)
        self.assertTrue(success)
        self.assertEqual(data.get("type"), "user", "Khóa mới thêm từ GUI/API phải tự động gán type='user'")

        # 2. Thử xóa khóa hệ thống (type='system') -> Phải bị chặn tuyệt đối
        del_sys_ok, del_sys_err = delete_translation_key("hotline")
        self.assertFalse(del_sys_ok, "Tuyệt đối không được phép xóa khóa hệ thống")
        self.assertIn("hệ thống", del_sys_err.lower())

        del_site_ok, del_site_err = delete_translation_key("site_title")
        self.assertFalse(del_site_ok, "Tuyệt đối không được phép xóa khóa site_title")

        # 3. Xóa khóa người dùng tùy chỉnh (type='user') -> Phải thành công
        del_user_ok, del_user_err = delete_translation_key(user_key)
        self.assertTrue(del_user_ok, f"Phải xóa được khóa user tùy chỉnh: {del_user_err}")

        # Xác thực khóa đã bị xóa khỏi từ điển
        all_trans = get_all_translations(use_cache=False).get("translations", {})
        self.assertNotIn(user_key, all_trans)


if __name__ == "__main__":
    unittest.main()
