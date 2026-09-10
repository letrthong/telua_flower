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
            "openUserProfileModal",
            "closeUserProfileModal",
            "switchProfileTab",
            "handleProfileFormSubmit",
            "handlePasswordChangeSubmit",
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

    def test_no_duplicate_top_level_declarations(self):
        """Kiểm tra không có biến top-level const/let nào bị trùng lặp giữa các file JS module khi ghép vào bundle.js (chống SyntaxError: Identifier has already been declared)"""
        build_script = os.path.join(self.root_dir, "scripts", "build_bundle.py")
        with open(build_script, "r", encoding="utf-8") as f:
            text = f.read()

        m = re.search(r"MODULE_ORDER\s*=\s*\[(.*?)\]", text, re.DOTALL)
        self.assertIsNotNone(m, "Không tìm thấy MODULE_ORDER trong build_bundle.py")
        modules = [s.strip().strip('"\'') for s in m.group(1).split(",") if s.strip().strip('"\'')]

        top_declarations = {}
        duplicates = []

        for mod in modules:
            path = os.path.join(self.root_dir, "js", mod)
            if not os.path.exists(path):
                continue
            with open(path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            for i, line in enumerate(lines, 1):
                m_dec = re.match(r"^(?:export\s+)?(const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)", line)
                if m_dec:
                    kind = m_dec.group(1)
                    name = m_dec.group(2)
                    if name in top_declarations:
                        duplicates.append(
                            f"'{name}' bị khai báo trùng: lần 1 tại {top_declarations[name]}, lần 2 tại {mod}:{i} ({kind})"
                        )
                    else:
                        top_declarations[name] = f"{mod}:{i}"

        self.assertEqual(len(duplicates), 0, "Phát hiện biến const/let top-level trùng lặp trong bundle:\n" + "\n".join(duplicates))

    def test_html_event_handlers_bound_to_window(self):
        """Kiểm tra tất cả các hàm được gọi từ sự kiện HTML (onclick, onchange, onsubmit) trong index.html đều được khai báo và gán vào window.* trong bundle.js"""
        html_files = [self.index_path]
        config_index = os.path.join(self.root_dir, "config", "index.html")
        if os.path.exists(config_index):
            html_files.append(config_index)

        with open(self.bundle_path, "r", encoding="utf-8") as f:
            bundle = f.read()

        pattern = r'\bon(?:click|change|submit|input)\s*=\s*["\']\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\('
        event_calls = set()
        for hpath in html_files:
            with open(hpath, "r", encoding="utf-8") as f:
                event_calls.update(re.findall(pattern, f.read()))

        # Loại trừ các từ khóa chuẩn của JS hoặc hàm có sẵn của trình duyệt
        js_builtins = {"alert", "confirm", "prompt", "console", "parseInt", "parseFloat", "if", "for", "while", "switch", "catch", "return"}
        event_calls = event_calls - js_builtins

        missing_handlers = []
        for func in sorted(event_calls):
            if f"window.{func}" not in bundle and f"function {func}" not in bundle:
                missing_handlers.append(func)

        self.assertEqual(
            len(missing_handlers), 0,
            f"Các hàm được gọi từ sự kiện HTML nhưng không được gán vào window.* trong bundle.js: {missing_handlers}"
        )


if __name__ == '__main__':
    unittest.main()
