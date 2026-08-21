import unittest
import os
import sys

# Ensure src is in sys.path
SRC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

class TestTeluaFlowerApp(unittest.TestCase):
    def test_root_discovery(self):
        """Kiểm tra tìm kiếm thư mục gốc của telua_flower"""
        from app import TELUA_ROOT, get_index_file

        self.assertTrue(os.path.exists(TELUA_ROOT), f"TELUA_ROOT không tồn tại: {TELUA_ROOT}")
        index_path = get_index_file()
        self.assertIsNotNone(index_path, "Không tìm thấy index.html")
        self.assertTrue(os.path.exists(index_path), f"File index.html không tồn tại: {index_path}")

    def test_static_file_resolution(self):
        """Kiểm tra resolve các file tài nguyên tĩnh trong js/"""
        from app import resolve_static_file

        js_files = [
            "js/products.js",
            "js/translations.js",
            "js/i18n.js",
            "js/utils.js",
            "js/flower_app.js"
        ]
        for js_file in js_files:
            resolved = resolve_static_file(js_file)
            self.assertIsNotNone(resolved, f"Không tìm thấy {js_file}")
            self.assertTrue(os.path.exists(resolved), f"File không tồn tại: {resolved}")

    def test_flask_endpoints(self):
        """Kiểm tra endpoint / và các module js trả về HTTP 200"""
        from app import app

        with app.test_client() as client:
            # 1. Trang chủ
            res = client.get('/')
            self.assertEqual(res.status_code, 200)
            self.assertIn(b"<!DOCTYPE html>", res.data)
            self.assertIn(b"js/products.js", res.data)
            self.assertIn(b"js/flower_app.js", res.data)

            # 2. Các file js tĩnh
            for js_route in ['/js/products.js', '/js/translations.js', '/js/i18n.js', '/js/utils.js', '/js/flower_app.js']:
                res_js = client.get(js_route)
                self.assertEqual(res_js.status_code, 200, f"Lỗi tải {js_route}: status {res_js.status_code}")

if __name__ == '__main__':
    unittest.main()
