import unittest
import os
import re

class TestBundleIntegrity(unittest.TestCase):
    def setUp(self):
        self.root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        self.bundle_path = os.path.join(self.root_dir, "js", "bundle.js")
        self.index_path = os.path.join(self.root_dir, "index.html")

    def test_bundle_file_exists_and_substantial(self):
        """Kiểm tra js/bundle.js tồn tại và dung lượng > 200KB"""
        self.assertTrue(os.path.exists(self.bundle_path), "File js/bundle.js không tồn tại!")
        size = os.path.getsize(self.bundle_path)
        self.assertGreater(size, 200000, f"Dung lượng bundle.js ({size} bytes) quá nhỏ!")

    def test_no_illegal_export_import_in_bundle(self):
        """Kiểm tra bundle.js không còn cú pháp import/export ES6 gây lỗi cú pháp trình duyệt"""
        with open(self.bundle_path, "r", encoding="utf-8") as f:
            content = f.read()

        illegal_export = re.search(r'^\s*export\s+(const|let|var|function|async|class|default|\{)', content, re.MULTILINE)
        self.assertIsNone(illegal_export, f"Phát hiện cú pháp 'export' chưa được gọt bỏ: {illegal_export.group(0) if illegal_export else ''}")

        illegal_import = re.search(r'^\s*import\s+[\s\S]*?from', content, re.MULTILINE)
        self.assertIsNone(illegal_import, f"Phát hiện cú pháp 'import' chưa được gọt bỏ: {illegal_import.group(0) if illegal_import else ''}")

    def test_html_base_href_and_absolute_script_path(self):
        """Kiểm tra index.html chứa <base href=\"/\"> và đường dẫn script tuyệt đối chống lỗi SPA route"""
        with open(self.index_path, "r", encoding="utf-8") as f:
            html = f.read()

        self.assertIn('<base href="/">', html, "index.html thiếu thẻ <base href=\"/\">!")
        self.assertTrue(
            re.search(r'<script\s+src="/js/bundle\.js(\?v=[^"]+)?"\s*>', html),
            "Thẻ script của bundle.js trong index.html phải bắt đầu bằng '/js/bundle.js' (tuyệt đối từ root domain)!"
        )

    def test_critical_window_bindings_exist(self):
        """Kiểm tra tất cả hàm tương tác cốt lõi đều được gán vào window.* trong bundle.js"""
        with open(self.bundle_path, "r", encoding="utf-8") as f:
            bundle = f.read()

        critical_functions = [
            "openAuthModal",
            "closeAuthModal",
            "saveCurrentProdI18nDraft",
            "syncSingleKeyInputToDictionary",
            "saveCurrentCatI18nDraft",
            "openProductModal",
            "closeProductModal",
            "loadAdminProducts",
            "loadAdminTranslations",
            "openSystemConfigModal",
            "closeSystemConfigModal",
            "addToCart",
            "updateCartQuantity",
            "openCheckoutModal",
            "closeCheckoutModal",
            "loadAdminCategories",
            "loadAdminBranches",
            "loadAdminInventory",
            "loadAdminOrders"
        ]

        missing = []
        for func in critical_functions:
            pattern = f"window.{func}"
            if pattern not in bundle:
                missing.append(func)

        self.assertEqual(len(missing), 0, f"Các hàm quan trọng bị thiếu gắn vào window.*: {missing}")


if __name__ == '__main__':
    unittest.main()
