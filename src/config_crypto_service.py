# -*- coding: utf-8 -*-
"""
Dịch Vụ Mã Hóa & Giải Mã Cấu Hình JSON (Config Crypto Service)
Cung cấp cơ chế get-set cấu hình JSON an toàn, hỗ trợ mã hóa và chuyển đổi sang Base64 để lưu trữ.
Hoạt động độc lập (Zero External Dependencies) sử dụng chuẩn AEAD ChaCha20 + HMAC-SHA256 & PBKDF2.
Tự động tương thích ngược: đọc được cả file cấu hình đã mã hóa lẫn file JSON dạng rõ thông thường.
"""

import os
import sys
import json
import hmac
import struct
import base64
import secrets
import hashlib
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple, Union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from flower_config import FLOWER_CONFIG_DIR

CONFIG_DIR = FLOWER_CONFIG_DIR
KEY_FILE = os.path.join(CONFIG_DIR, ".secret.key")
MAGIC_HEADER = b"TLENC\x01"  # 6 bytes định danh gói mã hóa telua v1

_CRYPTO_LOCK = threading.Lock()
_CACHED_MASTER_KEY: Optional[bytes] = None


# ==============================================================================
# 1. QUẢN LÝ MASTER KEY & DERIVATION (PBKDF2)
# ==============================================================================

def get_or_create_master_key() -> bytes:
    """
    Lấy master key 256-bit phục vụ mã hóa/giải mã config.
    Thứ tự ưu tiên:
    1. Bộ nhớ đệm RAM (_CACHED_MASTER_KEY)
    2. Biến môi trường: CONFIG_ENCRYPTION_KEY / FLOWER_SECRET_KEY / SECRET_KEY
    3. File cục bộ bí mật: config/anne/.secret.key (tự động sinh an toàn nếu chưa có)
    4. Fallback mặc định an toàn cho môi trường dev
    """
    global _CACHED_MASTER_KEY
    if _CACHED_MASTER_KEY:
        return _CACHED_MASTER_KEY

    with _CRYPTO_LOCK:
        if _CACHED_MASTER_KEY:
            return _CACHED_MASTER_KEY

        # 1. Biến môi trường
        for env_name in ("CONFIG_ENCRYPTION_KEY", "FLOWER_SECRET_KEY", "SECRET_KEY"):
            val = os.environ.get(env_name)
            if val and val.strip():
                raw = val.strip().encode("utf-8")
                _CACHED_MASTER_KEY = hashlib.sha256(raw).digest()
                return _CACHED_MASTER_KEY

        # 2. File bí mật cục bộ
        try:
            if os.path.isfile(KEY_FILE):
                with open(KEY_FILE, "rb") as f:
                    content = f.read().strip()
                    if len(content) == 32:
                        _CACHED_MASTER_KEY = content
                        return _CACHED_MASTER_KEY
                    elif len(content) > 0:
                        _CACHED_MASTER_KEY = hashlib.sha256(content).digest()
                        return _CACHED_MASTER_KEY

            # Sinh mới master key 256-bit an toàn
            os.makedirs(os.path.dirname(KEY_FILE), exist_ok=True)
            generated_key = secrets.token_bytes(32)
            with open(KEY_FILE, "wb") as f:
                f.write(generated_key)
            try:
                os.chmod(KEY_FILE, 0o600)
            except Exception:
                pass
            _CACHED_MASTER_KEY = generated_key
            return _CACHED_MASTER_KEY
        except Exception:
            # Fallback an toàn cố định trong nội bộ cụm
            fallback = hashlib.sha256(b"telua_flower_production_cluster_master_seed_2026").digest()
            _CACHED_MASTER_KEY = fallback
            return _CACHED_MASTER_KEY


def derive_keys(master_key: bytes, salt: bytes) -> Tuple[bytes, bytes]:
    """
    Dẫn xuất 2 khóa riêng biệt: Khóa mã hóa (32 bytes) và Khóa xác thực HMAC (32 bytes)
    bằng thuật toán PBKDF2-HMAC-SHA256 chuẩn bảo mật.
    """
    derived = hashlib.pbkdf2_hmac("sha256", master_key, salt, 50_000, dklen=64)
    enc_key = derived[:32]
    mac_key = derived[32:]
    return enc_key, mac_key


# ==============================================================================
# 2. THUẬT TOÁN MÃ HÓA CHACHA20 (RFC 7539 / RFC 8439) - PURE PYTHON
# ==============================================================================

def _rotl32(v: int, c: int) -> int:
    return ((v << c) & 0xFFFFFFFF) | (v >> (32 - c))


def _chacha20_quarter_round(x: list, a: int, b: int, c: int, d: int) -> None:
    x[a] = (x[a] + x[b]) & 0xFFFFFFFF; x[d] = _rotl32(x[d] ^ x[a], 16)
    x[c] = (x[c] + x[d]) & 0xFFFFFFFF; x[b] = _rotl32(x[b] ^ x[c], 12)
    x[a] = (x[a] + x[b]) & 0xFFFFFFFF; x[d] = _rotl32(x[d] ^ x[a], 8)
    x[c] = (x[c] + x[d]) & 0xFFFFFFFF; x[b] = _rotl32(x[b] ^ x[c], 7)


def _chacha20_block(key: bytes, counter: int, nonce: bytes) -> bytes:
    constants = [0x61707865, 0x3320646E, 0x79622D32, 0x6B206574]
    key_words = list(struct.unpack("<8I", key))
    nonce_words = list(struct.unpack("<3I", nonce))
    state = constants + key_words + [counter] + nonce_words
    working = list(state)
    for _ in range(10):
        _chacha20_quarter_round(working, 0, 4, 8, 12)
        _chacha20_quarter_round(working, 1, 5, 9, 13)
        _chacha20_quarter_round(working, 2, 6, 10, 14)
        _chacha20_quarter_round(working, 3, 7, 11, 15)
        _chacha20_quarter_round(working, 0, 5, 10, 15)
        _chacha20_quarter_round(working, 1, 6, 11, 12)
        _chacha20_quarter_round(working, 2, 7, 8, 13)
        _chacha20_quarter_round(working, 3, 4, 9, 14)
    out = [((working[i] + state[i]) & 0xFFFFFFFF) for i in range(16)]
    return struct.pack("<16I", *out)


def _chacha20_process(key: bytes, nonce: bytes, data: bytes) -> bytes:
    """Mã hóa / Giải mã ChaCha20 với keystream tương ứng."""
    keystream = bytearray()
    counter = 1
    for _ in range(0, len(data), 64):
        keystream.extend(_chacha20_block(key, counter, nonce))
        counter += 1
    return bytes(a ^ b for a, b in zip(data, keystream[:len(data)]))


# ==============================================================================
# 3. MÃ HÓA & GIẢI MÃ NHỊ PHÂN VÀ CHUYỂN ĐỔI BASE64
# ==============================================================================

def encrypt_bytes(plaintext: bytes, secret_key: Optional[Union[str, bytes]] = None) -> str:
    """
    Mã hóa mảng byte dữ liệu bằng ChaCha20 + HMAC-SHA256 và trả về chuỗi Base64.
    Định dạng gói nhị phân đóng gói:
    [6B MAGIC_HEADER][16B Salt][12B Nonce][32B HMAC-SHA256][Ciphertext...]
    """
    if isinstance(secret_key, str):
        master_key = hashlib.sha256(secret_key.encode("utf-8")).digest()
    elif isinstance(secret_key, bytes):
        master_key = hashlib.sha256(secret_key).digest() if len(secret_key) != 32 else secret_key
    else:
        master_key = get_or_create_master_key()

    salt = secrets.token_bytes(16)
    nonce = secrets.token_bytes(12)
    enc_key, mac_key = derive_keys(master_key, salt)

    ciphertext = _chacha20_process(enc_key, nonce, plaintext)

    # Tính toán chữ ký xác thực HMAC trên (MAGIC + salt + nonce + ciphertext)
    h = hmac.new(mac_key, MAGIC_HEADER + salt + nonce + ciphertext, hashlib.sha256)
    mac = h.digest()

    package = MAGIC_HEADER + salt + nonce + mac + ciphertext
    return base64.b64encode(package).decode("ascii")


def decrypt_bytes(ciphertext_b64: str, secret_key: Optional[Union[str, bytes]] = None) -> bytes:
    """
    Giải mã chuỗi Base64 trở về mảng byte dữ liệu gốc.
    Kiểm tra toàn vẹn chữ ký HMAC trong thời gian hằng số để chống tấn công giả mạo (Tamper-proof).
    """
    try:
        package = base64.b64decode(ciphertext_b64.encode("ascii"))
    except Exception as e:
        raise ValueError(f"Dữ liệu Base64 không hợp lệ: {e}")

    header_len = len(MAGIC_HEADER)
    min_len = header_len + 16 + 12 + 32
    if len(package) < min_len:
        raise ValueError("Gói dữ liệu mã hóa quá ngắn hoặc không đúng định dạng")

    magic = package[:header_len]
    if magic != MAGIC_HEADER:
        raise ValueError("Định dạng gói mã hóa không tương thích (Sai Magic Header)")

    salt = package[header_len:header_len + 16]
    nonce = package[header_len + 16:header_len + 28]
    expected_mac = package[header_len + 28:header_len + 60]
    ciphertext = package[header_len + 60:]

    if isinstance(secret_key, str):
        master_key = hashlib.sha256(secret_key.encode("utf-8")).digest()
    elif isinstance(secret_key, bytes):
        master_key = hashlib.sha256(secret_key).digest() if len(secret_key) != 32 else secret_key
    else:
        master_key = get_or_create_master_key()

    enc_key, mac_key = derive_keys(master_key, salt)

    # Xác thực tính toàn vẹn (HMAC)
    h = hmac.new(mac_key, MAGIC_HEADER + salt + nonce + ciphertext, hashlib.sha256)
    actual_mac = h.digest()
    if not hmac.compare_digest(expected_mac, actual_mac):
        raise ValueError("Xác thực HMAC thất bại: Dữ liệu đã bị can thiệp hoặc sai khóa giải mã!")

    return _chacha20_process(enc_key, nonce, ciphertext)


def encrypt_string(text: str, secret_key: Optional[Union[str, bytes]] = None) -> str:
    """Mã hóa chuỗi văn bản và trả về chuỗi Base64."""
    return encrypt_bytes(text.encode("utf-8"), secret_key)


def decrypt_string(ciphertext_b64: str, secret_key: Optional[Union[str, bytes]] = None) -> str:
    """Giải mã chuỗi Base64 trở về chuỗi văn bản UTF-8."""
    raw = decrypt_bytes(ciphertext_b64, secret_key)
    return raw.decode("utf-8")


# ==============================================================================
# 4. MÃ HÓA & GIẢI MÃ CẤU TRÚC JSON
# ==============================================================================

def encrypt_json(
    data: Any,
    secret_key: Optional[Union[str, bytes]] = None,
    format_as: str = "envelope"
) -> Union[Dict[str, Any], str]:
    """
    Chuyển đổi đối tượng Python (dict/list) sang JSON -> Mã hóa -> Convert sang Base64.
    Tham số format_as:
    - 'envelope' (Mặc định): Trả về dict có cờ __encrypted__, thuật toán, thời gian và trường 'data' là base64.
    - 'base64': Trả về chuỗi base64 thuần túy.
    """
    json_bytes = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    b64_payload = encrypt_bytes(json_bytes, secret_key)

    if format_as == "base64":
        return b64_payload

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "__encrypted__": True,
        "algorithm": "ChaCha20-HMAC-SHA256",
        "version": 1,
        "format": "base64",
        "updatedAt": now_iso,
        "data": b64_payload
    }


def decrypt_json(
    encrypted_payload: Union[str, Dict[str, Any]],
    secret_key: Optional[Union[str, bytes]] = None
) -> Any:
    """
    Giải mã payload đã mã hóa và parse trở về đối tượng JSON (dict/list).
    Hỗ trợ cả định dạng envelope {'__encrypted__': True, 'data': '...'} lẫn chuỗi Base64 thuần.
    Nếu dữ liệu truyền vào là dict/list thường (chưa mã hóa), hàm trả về nguyên trạng để tương thích ngược.
    """
    if isinstance(encrypted_payload, dict):
        if encrypted_payload.get("__encrypted__") is True:
            b64_str = encrypted_payload.get("data")
            if not b64_str or not isinstance(b64_str, str):
                raise ValueError("Phong bì mã hóa thiếu trường 'data' base64 hợp lệ")
            raw_bytes = decrypt_bytes(b64_str, secret_key)
            return json.loads(raw_bytes.decode("utf-8"))
        # Đối tượng dict thông thường chưa mã hóa -> Trả về nguyên trạng
        return encrypted_payload

    elif isinstance(encrypted_payload, str):
        # Kiểm tra xem có phải chuỗi JSON envelope không
        s_clean = encrypted_payload.strip()
        if s_clean.startswith("{") and s_clean.endswith("}"):
            try:
                parsed = json.loads(s_clean)
                if isinstance(parsed, dict) and parsed.get("__encrypted__") is True:
                    return decrypt_json(parsed, secret_key)
            except Exception:
                pass

        # Chuỗi base64 thuần túy
        raw_bytes = decrypt_bytes(s_clean, secret_key)
        return json.loads(raw_bytes.decode("utf-8"))

    return encrypted_payload


def is_encrypted_config(content: Union[str, bytes, Dict[str, Any]]) -> bool:
    """Kiểm tra xem dữ liệu hoặc nội dung file có đang ở trạng thái mã hóa hay không."""
    if isinstance(content, dict):
        return content.get("__encrypted__") is True

    if isinstance(content, str) and os.path.isfile(content):
        try:
            with open(content, "r", encoding="utf-8") as f:
                content = f.read().strip()
        except Exception:
            return False

    if isinstance(content, bytes):
        if content.startswith(MAGIC_HEADER):
            return True
        try:
            content = content.decode("utf-8").strip()
        except Exception:
            return False

    if isinstance(content, str):
        s = content.strip()
        if s.startswith("{") and '"__encrypted__": true' in s.lower():
            return True
        # Thử kiểm tra định dạng base64 chứa Magic Header
        try:
            sample = base64.b64decode(s[:40].encode("ascii"))
            return sample.startswith(MAGIC_HEADER)
        except Exception:
            return False

    return False


# ==============================================================================
# 5. GET & SET CẤU HÌNH JSON FILE TRÊN Ổ ĐĨA
# ==============================================================================

def get_encrypted_config(
    filepath: str,
    default: Any = None,
    secret_key: Optional[Union[str, bytes]] = None
) -> Any:
    """
    GET: Đọc cấu hình JSON từ file trên đĩa một cách an toàn.
    - Nếu file chưa tồn tại -> Trả về giá trị default.
    - Tự động nhận diện nếu file đang được mã hóa (Base64 hoặc Envelope) -> Tự động giải mã và parse JSON.
    - Nếu file là file JSON dạng rõ thông thường -> Đọc và parse bình thường (100% tương thích ngược).
    """
    if not os.path.exists(filepath):
        return default

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            raw_content = f.read().strip()

        if not raw_content:
            return default

        # 1. Thử parse JSON
        parsed = json.loads(raw_content)
        if isinstance(parsed, dict) and parsed.get("__encrypted__") is True:
            return decrypt_json(parsed, secret_key)
        return parsed

    except (json.JSONDecodeError, UnicodeDecodeError):
        # 2. Thử giải mã nếu nội dung là chuỗi Base64 mã hóa trực tiếp
        try:
            return decrypt_json(raw_content, secret_key)
        except Exception:
            return default
    except Exception:
        return default


def set_encrypted_config(
    filepath: str,
    data: Any,
    secret_key: Optional[Union[str, bytes]] = None,
    format_as: str = "envelope",
    encrypt: bool = True
) -> bool:
    """
    SET: Lưu cấu hình JSON an toàn ra file (Atomic Write).
    - Nếu encrypt=True (Mặc định): Mã hóa dữ liệu JSON sang Base64 trước khi lưu.
    - Nếu encrypt=False: Lưu file JSON dạng rõ thông thường (Plain JSON).
    - format_as='envelope': Lưu dưới dạng JSON envelope chuẩn (khuyên dùng, dễ kiểm soát metadata).
    - format_as='base64': Lưu dưới dạng file text chứa chuỗi base64 thuần túy.
    """
    try:
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        temp_file = f"{filepath}.tmp.{os.getpid()}"

        if not encrypt:
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(temp_file, filepath)
            return True

        encrypted_result = encrypt_json(data, secret_key=secret_key, format_as=format_as)
        with open(temp_file, "w", encoding="utf-8") as f:
            if isinstance(encrypted_result, dict):
                json.dump(encrypted_result, f, ensure_ascii=False, indent=2)
            else:
                f.write(encrypted_result)

        os.replace(temp_file, filepath)
        return True
    except Exception:
        return False
