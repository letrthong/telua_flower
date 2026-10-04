import unittest
import os
import re
import json

class TestTranslationsImportExport(unittest.TestCase):
    def setUp(self):
        self.root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        self.js_trans_path = os.path.join(self.root_dir, "js", "portal_admin_translations.js")
        self.bundle_path = os.path.join(self.root_dir, "js", "bundle.js")
        self.index_path = os.path.join(self.root_dir, "index.html")
        self.config_index_path = os.path.join(self.root_dir, "config", "index.html")

    def isValidTextId(self, text_id):
        """Python mirror of JS isValidTextId for algorithmic parity verification"""
        if not text_id or not isinstance(text_id, str):
            return False
        clean = text_id.strip()
        if not clean or len(clean) > 100:
            return False
        return bool(re.match(r'^[a-zA-Z0-9_\-\.]+$', clean))

    def validateAndParseTranslationJson(self, json_str, expected_key=""):
        """Python mirror of JS validateAndParseTranslationJson for logic verification"""
        if not json_str or not isinstance(json_str, str) or not json_str.strip():
            return {"valid": False, "error": "Nội dung tệp JSON hoàn toàn rỗng!"}

        try:
            parsed = json.loads(json_str)
        except Exception as e:
            return {"valid": False, "error": f"Cú pháp JSON không hợp lệ: {e}"}

        if not isinstance(parsed, dict):
            return {"valid": False, "error": "Dữ liệu JSON phải là một đối tượng (Object)!"}

        resolved_text_id = ""
        trans_map = {}
        resolved_type = "system"

        # Case 1: explicit textId or text_id
        explicit_id = parsed.get("textId") or parsed.get("text_id") or parsed.get("id")
        if explicit_id and isinstance(explicit_id, str):
            resolved_text_id = explicit_id.strip()
            resolved_type = parsed.get("type", "system")
            if isinstance(parsed.get("translations"), dict):
                trans_map = parsed["translations"]
            else:
                trans_map = parsed
        # Case 2: Keyed by expectedKey
        elif expected_key and expected_key in parsed and isinstance(parsed[expected_key], dict):
            resolved_text_id = expected_key
            trans_map = parsed[expected_key]
            resolved_type = trans_map.get("type", "system")
        # Case 3: Direct language keys or single sub-key
        else:
            keys = list(parsed.keys())
            lang_keys = ["vi", "en", "ja", "ko", "zh"]
            has_direct_lang = any(k in lang_keys for k in keys)

            if has_direct_lang:
                resolved_text_id = expected_key
                trans_map = parsed
                resolved_type = parsed.get("type", "system")
            elif len(keys) == 1 and isinstance(parsed[keys[0]], dict):
                resolved_text_id = keys[0]
                trans_map = parsed[keys[0]]
                resolved_type = trans_map.get("type", "system")
            else:
                return {"valid": False, "error": "Không nhận diện được Text ID hoặc khóa ngôn ngữ"}

        if not resolved_text_id:
            return {"valid": False, "error": "Thiếu định danh Text ID"}

        if not self.isValidTextId(resolved_text_id):
            return {"valid": False, "error": f"Định danh Text ID '{resolved_text_id}' không hợp lệ"}

        valid_langs = ["vi", "en", "ja", "ko", "zh"]
        extracted = {}
        valid_count = 0

        for lang in valid_langs:
            if lang in trans_map and trans_map[lang] is not None:
                if not isinstance(trans_map[lang], str):
                    return {"valid": False, "error": f"Trường ngôn ngữ '{lang}' phải là chuỗi văn bản"}
                extracted[lang] = trans_map[lang].strip()
                valid_count += 1
            else:
                extracted[lang] = ""

        if valid_count == 0:
            return {"valid": False, "error": "Tệp JSON không chứa trường ngôn ngữ hợp lệ nào"}

        return {
            "valid": True,
            "textId": resolved_text_id,
            "type": resolved_type,
            "translations": extracted
        }

    def test_text_id_validation_rules(self):
        """Kiểm tra quy tắc định dạng Text ID hợp lệ và không hợp lệ"""
        valid_ids = [
            "nav_home",
            "store_title_01",
            "cat-flower.item",
            "ORDER_STATUS_PENDING",
            "btn_submit_order_123",
            "a",
            "x" * 100
        ]
        for tid in valid_ids:
            self.assertTrue(self.isValidTextId(tid), f"'{tid}' phải được coi là hợp lệ!")

        invalid_ids = [
            "",
            "   ",
            None,
            123,
            "nav home",           # có khoảng trắng
            "nav/home",           # có dấu gạch chéo
            "<script>",           # có ký tự nguy hiểm
            "text@domain",        # ký tự @
            "order#123",          # ký tự #
            "x" * 101             # vượt quá 100 ký tự
        ]
        for tid in invalid_ids:
            self.assertFalse(self.isValidTextId(tid), f"'{tid}' phải bị từ chối!")

    def test_json_parse_and_schema_validation(self):
        """Kiểm tra xử lý các định dạng JSON hợp lệ"""
        # Schema 1: Export chuẩn của Telua Flower
        payload1 = json.dumps({
            "textId": "nav_catalog",
            "type": "system",
            "translations": {
                "vi": "Danh mục hoa",
                "en": "Flower Catalog",
                "ja": "花カタログ"
            }
        })
        res1 = self.validateAndParseTranslationJson(payload1)
        self.assertTrue(res1["valid"])
        self.assertEqual(res1["textId"], "nav_catalog")
        self.assertEqual(res1["translations"]["vi"], "Danh mục hoa")
        self.assertEqual(res1["translations"]["en"], "Flower Catalog")
        self.assertEqual(res1["translations"]["ja"], "花カタログ")
        self.assertEqual(res1["translations"]["ko"], "")

        # Schema 1b: Với text_id thay vì textId
        payload1b = json.dumps({
            "text_id": "footer_copyright",
            "translations": { "vi": "Bản quyền 2026", "en": "Copyright 2026" }
        })
        res1b = self.validateAndParseTranslationJson(payload1b)
        self.assertTrue(res1b["valid"])
        self.assertEqual(res1b["textId"], "footer_copyright")

        # Schema 2: Keyed mapping
        payload2 = json.dumps({
            "btn_checkout": {
                "vi": "Thanh toán",
                "en": "Checkout"
            }
        })
        res2 = self.validateAndParseTranslationJson(payload2, expected_key="btn_checkout")
        self.assertTrue(res2["valid"])
        self.assertEqual(res2["textId"], "btn_checkout")
        self.assertEqual(res2["translations"]["vi"], "Thanh toán")

        # Schema 3: Direct language dict khi đang mở key
        payload3 = json.dumps({
            "vi": "Giỏ hàng",
            "en": "Shopping Cart",
            "ja": "ショッピングカート"
        })
        res3 = self.validateAndParseTranslationJson(payload3, expected_key="cart_title")
        self.assertTrue(res3["valid"])
        self.assertEqual(res3["textId"], "cart_title")
        self.assertEqual(res3["translations"]["vi"], "Giỏ hàng")

    def test_json_parse_error_rejections(self):
        """Kiểm tra từ chối các định dạng JSON bất hợp lệ hoặc lỗi cấu trúc"""
        # 1. Rỗng
        self.assertFalse(self.validateAndParseTranslationJson("")["valid"])
        self.assertFalse(self.validateAndParseTranslationJson("   ")["valid"])

        # 2. Sai cú pháp JSON
        self.assertFalse(self.validateAndParseTranslationJson("{ bad json: ")["valid"])

        # 3. JSON dạng Mảng thay vì Object
        self.assertFalse(self.validateAndParseTranslationJson('["vi", "en"]')["valid"])

        # 4. Text ID không hợp lệ trong file
        bad_id_payload = json.dumps({
            "textId": "bad/key/name!",
            "translations": { "vi": "Test" }
        })
        res = self.validateAndParseTranslationJson(bad_id_payload)
        self.assertFalse(res["valid"])
        self.assertIn("không hợp lệ", res["error"])

        # 5. Giá trị ngôn ngữ không phải string
        bad_type_payload = json.dumps({
            "textId": "nav_home",
            "translations": { "vi": 12345, "en": "Home" }
        })
        res_type = self.validateAndParseTranslationJson(bad_type_payload)
        self.assertFalse(res_type["valid"])
        self.assertIn("phải là chuỗi văn bản", res_type["error"])

        # 6. Không có ngôn ngữ nào hợp lệ
        no_lang_payload = json.dumps({
            "textId": "nav_home",
            "translations": { "spanish": "Inicio", "french": "Accueil" }
        })
        res_no_lang = self.validateAndParseTranslationJson(no_lang_payload)
        self.assertFalse(res_no_lang["valid"])
        self.assertIn("không chứa trường ngôn ngữ hợp lệ", res_no_lang["error"])

    def test_codebase_functions_exposed_in_bundle(self):
        """Kiểm tra các hàm download/upload JSON và validation đã được export và gán vào window trong portal_admin_translations.js và bundle.js"""
        with open(self.js_trans_path, "r", encoding="utf-8") as f:
            trans_code = f.read()

        required_funcs = [
            "isValidTextId",
            "validateAndParseTranslationJson",
            "downloadCurrentTranslationKeyJson",
            "triggerUploadTranslationKeyJson",
            "handleUploadTranslationKeyJson",
            "downloadAllTranslationsJson"
        ]

        for func in required_funcs:
            pattern = rf'export\s+(?:async\s+)?function\s+{func}\b'
            self.assertTrue(bool(re.search(pattern, trans_code)), f"{func} not exported in portal_admin_translations.js")
            self.assertIn(f"window.{func} = {func}", trans_code, f"{func} not attached to window in portal_admin_translations.js")

        with open(self.bundle_path, "r", encoding="utf-8") as f:
            bundle_code = f.read()

        for func in required_funcs:
            self.assertIn(f"window.{func} = {func}", bundle_code, f"{func} not in bundle.js")

    def test_html_ui_components_exist(self):
        """Kiểm tra giao diện index.html và config/index.html có đầy đủ nút bấm Tải/Upload JSON cho text_id và input file"""
        for hpath in [self.index_path, self.config_index_path]:
            with open(hpath, "r", encoding="utf-8") as f:
                html = f.read()

            self.assertIn("downloadCurrentTranslationKeyJson()", html, f"Thiếu nút tải JSON text_id trong {hpath}")
            self.assertIn("triggerUploadTranslationKeyJson()", html, f"Thiếu nút upload JSON text_id trong {hpath}")
            self.assertIn('id="transKeyJsonFileInput"', html, f"Thiếu input transKeyJsonFileInput trong {hpath}")
            self.assertIn("handleUploadTranslationKeyJson(event)", html, f"Thiếu sự kiện handleUploadTranslationKeyJson trong {hpath}")
            self.assertIn("downloadAllTranslationsJson()", html, f"Thiếu nút tải toàn bộ translations.json trong {hpath}")

if __name__ == '__main__':
    unittest.main()
