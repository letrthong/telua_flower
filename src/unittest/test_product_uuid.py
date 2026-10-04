import os
import sys
import unittest
import json
import re

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from app import app
from data_service import (
    get_product_uuid,
    resolve_product_id,
    get_products,
    get_product_by_id,
    save_products,
    get_materials,
    get_material_by_id,
    save_materials,
    sync_materials_from_products,
)


class TestProductUUID(unittest.TestCase):
    """
    Bộ kiểm thử Đơn vị (Unit Test) cho tính năng định danh che giấu mã sản phẩm bằng UUID v5 (RFC 4122):
    1. Kiểm tra tính chuẩn mực và cấu trúc RFC 4122 v5
    2. Kiểm tra tính xác định (Deterministic property) không đổi qua thời gian
    3. Kiểm tra phân giải 2 chiều: UUID <-> Product ID
    4. Kiểm tra nạp chi tiết sản phẩm qua get_product_by_id bằng UUID
    5. Kiểm tra cơ chế tự động cập nhật / di trú (Auto-migration) khi config cũ thiếu uuid
    6. Kiểm tra đồng bộ và tra cứu UUID trong materials.json
    7. Kiểm tra RESTful API Endpoint /api/flower/v1/products/<uuid>
    """

    def setUp(self):
        self.client = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()

    def tearDown(self):
        self.app_context.pop()

    def test_01_uuid5_format_and_rfc4122_compliance(self):
        """Kiểm tra định dạng UUID v5 tuân thủ chuẩn RFC 4122 (36 ký tự, version 5, variant chuẩn)"""
        uuid_pattern = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")

        test_ids = ["bo_hoa_01", "bo_hoa_02", "gio_hoa_01", "binh_hoa_01", "test_item_999"]
        for pid in test_ids:
            u = get_product_uuid(pid)
            self.assertEqual(len(u), 36, f"UUID của {pid} phải có đúng 36 ký tự")
            self.assertRegex(u, uuid_pattern, f"UUID {u} phải đúng chuẩn RFC 4122 v5")
            self.assertEqual(u[14], "5", "Ký tự thứ 15 phải là số 5 (UUID version 5)")
            self.assertIn(u[19], ["8", "9", "a", "b"], "Ký tự thứ 20 phải là variant chuẩn (8, 9, a, b)")

        # Trường hợp rỗng
        self.assertEqual(get_product_uuid(""), "")
        self.assertEqual(get_product_uuid(None), "")

    def test_02_deterministic_property(self):
        """Kiểm tra tính xác định: Cùng 1 mã hoa luôn luôn tạo ra đúng 1 UUID duy nhất qua các lần gọi"""
        # bo_hoa_02 phải luôn luôn khớp hash chuẩn xác định
        expected_bo_hoa_02_uuid = "9178febc-811b-5b89-835c-0601d680c63e"
        expected_bo_hoa_01_uuid = "c38c1067-9950-528c-94e1-88a5426ce753"

        self.assertEqual(get_product_uuid("bo_hoa_02"), expected_bo_hoa_02_uuid)
        self.assertEqual(get_product_uuid("bo_hoa_01"), expected_bo_hoa_01_uuid)

        # Chạy lại 50 lần liên tiếp để đảm bảo tính bất biến
        for _ in range(50):
            self.assertEqual(get_product_uuid("bo_hoa_02"), expected_bo_hoa_02_uuid)

        # Không trùng lặp giữa các sản phẩm khác nhau
        self.assertNotEqual(get_product_uuid("bo_hoa_01"), get_product_uuid("bo_hoa_02"))
        self.assertNotEqual(get_product_uuid("gio_hoa_01"), get_product_uuid("ke_hoa_01"))

    def test_03_bidirectional_resolve_product_id(self):
        """Kiểm tra hàm resolve_product_id phân giải ngược từ UUID sang mã sản phẩm thực tế"""
        # 1. Phân giải UUID sang ID gốc
        self.assertEqual(resolve_product_id("9178febc-811b-5b89-835c-0601d680c63e"), "bo_hoa_02")
        self.assertEqual(resolve_product_id("c38c1067-9950-528c-94e1-88a5426ce753"), "bo_hoa_01")

        # 2. Nếu truyền vào ID gốc thì giữ nguyên (tương thích ngược)
        self.assertEqual(resolve_product_id("bo_hoa_02"), "bo_hoa_02")
        self.assertEqual(resolve_product_id("bo_hoa_01"), "bo_hoa_01")

        # 3. An toàn với dữ liệu không hợp lệ hoặc rỗng
        self.assertEqual(resolve_product_id(""), "")
        self.assertEqual(resolve_product_id(None), "")
        self.assertEqual(resolve_product_id("unknown_non_uuid"), "unknown_non_uuid")

    def test_04_get_product_by_id_with_uuid(self):
        """Kiểm tra hàm get_product_by_id nạp chi tiết hoa bằng UUID hoặc ID gốc"""
        uuid_02 = "9178febc-811b-5b89-835c-0601d680c63e"

        # Nạp bằng UUID
        prod_via_uuid = get_product_by_id(uuid_02)
        self.assertIsNotNone(prod_via_uuid)
        self.assertEqual(prod_via_uuid.get("id"), "bo_hoa_02")
        self.assertEqual(prod_via_uuid.get("uuid"), uuid_02)
        self.assertEqual(prod_via_uuid.get("name"), "Hoàng Hôn Ấm Áp")

        # Nạp bằng ID gốc
        prod_via_id = get_product_by_id("bo_hoa_02")
        self.assertIsNotNone(prod_via_id)
        self.assertEqual(prod_via_id.get("uuid"), uuid_02)

        # Kiểm tra hỗ trợ đa ngôn ngữ khi truy vấn bằng UUID
        prod_en = get_product_by_id(uuid_02, lang="en")
        self.assertIsNotNone(prod_en)
        self.assertEqual(prod_en.get("uuid"), uuid_02)
        self.assertEqual(prod_en.get("id"), "bo_hoa_02")

    def test_05_auto_migration_products_missing_uuid(self):
        """Kiểm tra tính năng tự động cập nhật (Auto-migration) khi danh mục sản phẩm bị thiếu trường uuid"""
        prods = get_products()
        self.assertTrue(len(prods) > 0)

        # Tất cả sản phẩm hiện tại phải có trường uuid hợp lệ
        for p in prods:
            if isinstance(p, dict) and p.get("id"):
                self.assertIn("uuid", p, f"Sản phẩm {p.get('id')} phải có trường uuid")
                self.assertEqual(p["uuid"], get_product_uuid(p["id"]))

    def test_06_materials_uuid_and_auto_migration(self):
        """Kiểm tra materials.json có đầy đủ trường uuid và hỗ trợ tra cứu bằng UUID"""
        mats = get_materials()
        self.assertTrue(len(mats) > 0)

        for m in mats:
            if isinstance(m, dict) and m.get("id"):
                self.assertIn("uuid", m, f"Nguyên vật liệu {m.get('id')} phải có uuid")
                self.assertEqual(m["uuid"], get_product_uuid(m["id"]))

                # Tra cứu nguyên vật liệu bằng UUID
                found = get_material_by_id(m["uuid"])
                self.assertIsNotNone(found, f"Phải tìm được vật liệu qua UUID {m['uuid']}")
                self.assertEqual(found.get("id"), m["id"])

    def test_07_restful_api_products_endpoint_with_uuid(self):
        """Kiểm tra RESTful API GET /api/flower/v1/products/<uuid> trả về đúng sản phẩm"""
        uuid_02 = "9178febc-811b-5b89-835c-0601d680c63e"

        # 1. Gọi API bằng UUID
        res = self.client.get(f"/api/flower/v1/products/{uuid_02}")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        prod_data = data.get("data")
        self.assertEqual(prod_data.get("id"), "bo_hoa_02")
        self.assertEqual(prod_data.get("uuid"), uuid_02)
        self.assertEqual(prod_data.get("name"), "Hoàng Hôn Ấm Áp")

        # 2. Gọi API lấy toàn bộ danh sách sản phẩm /api/flower/v1/products
        list_res = self.client.get("/api/flower/v1/products")
        self.assertEqual(list_res.status_code, 200)
        list_data = list_res.get_json()
        self.assertTrue(list_data.get("success"))
        prods_list = list_data.get("data")
        self.assertTrue(isinstance(prods_list, list) and len(prods_list) > 0)

        # Mọi phần tử đều có trường uuid 36 ký tự
        for p in prods_list:
            if p.get("id"):
                self.assertIn("uuid", p)
                self.assertEqual(len(p["uuid"]), 36)


if __name__ == "__main__":
    unittest.main()
