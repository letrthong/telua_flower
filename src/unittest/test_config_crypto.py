# -*- coding: utf-8 -*-
"""
Unit Test: Hệ Thống Mã Hóa & Lưu Trữ Cấu Hình JSON (Config Crypto Service)
Kiểm tra mã hóa/giải mã chuỗi, cấu trúc JSON sang Base64 và các hàm get/set file cấu hình.
"""

import os
import sys
import json
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from config_crypto_service import (
    encrypt_bytes,
    decrypt_bytes,
    encrypt_string,
    decrypt_string,
    encrypt_json,
    decrypt_json,
    get_encrypted_config,
    set_encrypted_config,
    is_encrypted_config,
    get_or_create_master_key
)


class TestConfigCryptoService(unittest.TestCase):
    def setUp(self):
        self.test_data = {
            "clusterName": "No Hoa Tha Binh Production Cluster",
            "version": "1.2.0",
            "secretTokens": {
                "telegramBotToken": "8943130850:AAG0bDnfrbNlrVRXoSaagAQ6CXdVffEX4UY",
                "webhookSecret": "top-secret-signing-key-xyz"
            },
            "instances": [
                {"instanceId": "node-01", "host": "192.168.1.10", "port": 5000},
                {"instanceId": "node-02", "host": "192.168.1.11", "port": 5000}
            ],
            "metrics": {
                "cpuPercent": 15.4,
                "memoryMb": 85.2,
                "requestCount": 1250
            }
        }
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        # Dọn dẹp thư mục tạm
        try:
            import shutil
            shutil.rmtree(self.temp_dir, ignore_errors=True)
        except Exception:
            pass

    def test_01_master_key_generation(self):
        """Kiểm tra sinh và lấy master key 256-bit (32 bytes) an toàn."""
        key = get_or_create_master_key()
        self.assertIsInstance(key, bytes)
        self.assertEqual(len(key), 32)

    def test_02_bytes_and_string_encryption(self):
        """Kiểm tra mã hóa và giải mã chuỗi văn bản UTF-8 sang Base64."""
        sample_text = "Tiệm hoa Nở Hoa Thả Bình - Đặt hoa hỏa tốc 2026!"
        encrypted_b64 = encrypt_string(sample_text)
        self.assertIsInstance(encrypted_b64, str)
        self.assertNotEqual(encrypted_b64, sample_text)

        # Giải mã
        decrypted_text = decrypt_string(encrypted_b64)
        self.assertEqual(decrypted_text, sample_text)

    def test_03_custom_key_encryption(self):
        """Kiểm tra mã hóa và giải mã với mật khẩu tùy biến (Custom Passphrase)."""
        custom_key = "MySuperSecretCustomKey@2026"
        sample_text = "Dữ liệu cấu hình bảo mật nội bộ"
        encrypted_b64 = encrypt_string(sample_text, secret_key=custom_key)

        # Giải mã bằng đúng khóa
        decrypted_text = decrypt_string(encrypted_b64, secret_key=custom_key)
        self.assertEqual(decrypted_text, sample_text)

        # Giải mã bằng sai khóa -> Phải raise ValueError (chống can thiệp)
        with self.assertRaises(ValueError):
            decrypt_string(encrypted_b64, secret_key="WrongKey123")

    def test_04_tamper_detection(self):
        """Kiểm tra cơ chế chống làm giả dữ liệu HMAC (Tamper Detection)."""
        encrypted_b64 = encrypt_string("Dữ liệu gốc")
        import base64
        raw = bytearray(base64.b64decode(encrypted_b64))
        # Thay đổi 1 byte trong payload
        raw[-1] ^= 0xFF
        tampered_b64 = base64.b64encode(raw).decode("ascii")

        with self.assertRaises(ValueError):
            decrypt_string(tampered_b64)

    def test_05_json_envelope_encryption(self):
        """Kiểm tra mã hóa đối tượng JSON sang Envelope chứa Base64."""
        encrypted_envelope = encrypt_json(self.test_data, format_as="envelope")
        self.assertIsInstance(encrypted_envelope, dict)
        self.assertTrue(encrypted_envelope.get("__encrypted__"))
        self.assertEqual(encrypted_envelope.get("format"), "base64")
        self.assertIn("data", encrypted_envelope)
        self.assertIsInstance(encrypted_envelope["data"], str)

        # Giải mã
        decrypted_data = decrypt_json(encrypted_envelope)
        self.assertEqual(decrypted_data, self.test_data)

    def test_06_json_pure_base64_encryption(self):
        """Kiểm tra mã hóa JSON sang chuỗi Base64 thuần túy."""
        b64_str = encrypt_json(self.test_data, format_as="base64")
        self.assertIsInstance(b64_str, str)

        # Giải mã chuỗi Base64
        decrypted_data = decrypt_json(b64_str)
        self.assertEqual(decrypted_data, self.test_data)

    def test_07_get_set_encrypted_config_file(self):
        """Kiểm tra lưu (SET) và đọc (GET) file JSON mã hóa trên ổ đĩa."""
        cfg_path = os.path.join(self.temp_dir, "app_config.json")
        success = set_encrypted_config(cfg_path, self.test_data)
        self.assertTrue(success)
        self.assertTrue(os.path.exists(cfg_path))

        # Kiểm tra nội dung trên đĩa là mã hóa
        self.assertTrue(is_encrypted_config(cfg_path))
        with open(cfg_path, "r", encoding="utf-8") as f:
            disk_content = json.load(f)
        self.assertTrue(disk_content.get("__encrypted__"))
        # Không được chứa plain text lộ token
        self.assertNotIn("telegramBotToken", json.dumps(disk_content))

        # Đọc lại bằng get_encrypted_config
        loaded_cfg = get_encrypted_config(cfg_path)
        self.assertEqual(loaded_cfg, self.test_data)
        self.assertEqual(loaded_cfg["secretTokens"]["telegramBotToken"],
                         "8943130850:AAG0bDnfrbNlrVRXoSaagAQ6CXdVffEX4UY")

    def test_08_backward_compatibility_plain_json(self):
        """Kiểm tra tương thích ngược 100%: get_encrypted_config tự động đọc file JSON dạng rõ thông thường."""
        plain_path = os.path.join(self.temp_dir, "legacy_plain.json")
        legacy_data = {"mode": "unencrypted", "port": 8080}
        with open(plain_path, "w", encoding="utf-8") as f:
            json.dump(legacy_data, f, indent=2)

        self.assertFalse(is_encrypted_config(plain_path))
        loaded_data = get_encrypted_config(plain_path)
        self.assertEqual(loaded_data, legacy_data)

    def test_09_get_encrypted_config_nonexistent_returns_default(self):
        """Kiểm tra file không tồn tại trả về default an toàn."""
        res = get_encrypted_config("/non/existent/path.json", default={"default": 123})
        self.assertEqual(res, {"default": 123})

    def test_10_set_encrypted_config_with_encrypt_false(self):
        """Kiểm tra set_encrypted_config khi encrypt=False sẽ lưu file plain JSON thông thường."""
        plain_path = os.path.join(self.temp_dir, "saved_plain.json")
        plain_data = {"cluster": "plaintext", "enabled": True}
        success = set_encrypted_config(plain_path, plain_data, encrypt=False)
        self.assertTrue(success)
        self.assertFalse(is_encrypted_config(plain_path))
        loaded = get_encrypted_config(plain_path)
        self.assertEqual(loaded, plain_data)

    def test_11_info_company_and_notify_config_encrypted_on_disk(self):
        """Kiểm tra file thực tế infoCompany.json, notifyConfig.json và staff_users.json được mã hóa trên đĩa và đọc giải mã thành công."""
        from data_service import get_config_path, get_company_info, get_notify_config, get_staff_users

        company_path = get_config_path("infoCompany.json")
        notify_path = get_config_path("notifyConfig.json")
        staff_path = get_config_path("staff_users.json")

        # 1. Các file phải ở trạng thái mã hóa trên đĩa
        self.assertTrue(is_encrypted_config(company_path), "infoCompany.json phải được mã hóa trên đĩa!")
        self.assertTrue(is_encrypted_config(notify_path), "notifyConfig.json phải được mã hóa trên đĩa!")
        self.assertTrue(is_encrypted_config(staff_path), "staff_users.json phải được mã hóa trên đĩa!")

        # 2. Không được để lộ token hay passwordHash dưới dạng văn bản rõ trên file đĩa
        with open(notify_path, "r", encoding="utf-8") as f:
            notify_raw = f.read()
        self.assertNotIn("8943130850", notify_raw, "Bot token không được lộ trong file notifyConfig.json thô!")

        with open(staff_path, "r", encoding="utf-8") as f:
            staff_raw = f.read()
        self.assertNotIn("pbkdf2:sha256:", staff_raw, "Password hash không được lộ trong file staff_users.json thô!")
        self.assertNotIn("admin@nohoathabinh.vn", staff_raw, "Email admin không được lộ trong file staff_users.json thô!")

        # 3. Đọc qua service phải giải mã trong suốt và trả về đúng dữ liệu
        company = get_company_info(use_cache=False)
        self.assertIsInstance(company, dict)
        self.assertIn("companyName", company)
        self.assertEqual(company["companyName"], "NỞ HOA THẢ BÌNH")

        notify = get_notify_config(use_cache=False)
        self.assertIsInstance(notify, dict)
        self.assertTrue(notify.get("enabled"))
        self.assertEqual(notify.get("telegram", {}).get("botToken"),
                         "8943130850:AAG0bDnfrbNlrVRXoSaagAQ6CXdVffEX4UY")

        staff = get_staff_users(use_cache=False)
        self.assertIsInstance(staff, list)
        self.assertGreaterEqual(len(staff), 5)
        admin_acc = next((u for u in staff if u.get("id") == "staff_admin"), None)
        self.assertIsNotNone(admin_acc)
        self.assertEqual(admin_acc["email"], "admin@nohoathabinh.vn")


if __name__ == "__main__":
    unittest.main()

