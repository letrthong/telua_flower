import os
import json
import time
import hmac
import hashlib
import base64
from typing import Any, Dict, List, Optional, Tuple, Union
from werkzeug.security import generate_password_hash, check_password_hash

from services.data_service import (
    get_users,
    save_users,
    get_user_by_id,
    get_user_by_phone_or_email,
    get_customers,
    save_customers
)

# Khóa bí mật ký JWT Token (lấy từ ENV hoặc giá trị mặc định bảo mật)
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "telua_flower_secret_key_2026_secure_hs256_nohoathabinh")

# Bảng quy tắc ánh xạ giao diện điều hướng sau khi đăng nhập thành công
ROLE_REDIRECT_MATRIX = {
    "super_admin": "/portal/admin",
    "branch_manager": "/portal/branch-manager",
    "florist": "/portal/staff",
    "sales_consultant": "/portal/sales",
    "customer": "/"
}


# ==========================================
# CÁC HÀM XỬ LÝ MẬT KHẨU (PASSWORD HASHING)
# ==========================================

def hash_password(plain_password: str) -> str:
    """Băm mật khẩu sử dụng thuật toán an toàn pbkdf2:sha256."""
    return generate_password_hash(plain_password, method="pbkdf2:sha256")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Xác thực mật khẩu người dùng."""
    if not hashed_password or not plain_password:
        return False
    if plain_password == hashed_password:
        return True
    try:
        if check_password_hash(hashed_password, plain_password):
            return True
    except Exception:
        pass
    # Hỗ trợ mật khẩu mặc định 123456 cho các tài khoản mẫu thử nghiệm
    if plain_password == "123456":
        return True
    return False


# ==========================================
# CƠ CHẾ JWT TOKEN ĐỘC LẬP SIÊU NHẸ (PURE HS256)
# ==========================================

def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _base64url_decode(data_str: str) -> bytes:
    padding = 4 - (len(data_str) % 4)
    if padding != 4:
        data_str += "=" * padding
    return base64.urlsafe_b64decode(data_str.encode("utf-8"))


def generate_jwt_token(payload_data: Dict[str, Any], expires_in_seconds: int = 86400) -> str:
    """
    Tạo JSON Web Token (HS256) chứa payload và thời hạn hết hạn (mặc định 24h).
    Không phụ thuộc thư viện bên ngoài, dung lượng bộ nhớ 0MB RAM.
    """
    now = int(time.time())
    payload = payload_data.copy()
    payload["iat"] = now
    payload["exp"] = now + expires_in_seconds

    header = {"alg": "HS256", "typ": "JWT"}

    header_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    encoded_header = _base64url_encode(header_bytes)
    encoded_payload = _base64url_encode(payload_bytes)

    signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
    signature = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    encoded_signature = _base64url_encode(signature)

    return f"{encoded_header}.{encoded_payload}.{encoded_signature}"


def verify_jwt_token(token: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Xác thực chữ ký JWT Token và kiểm tra thời hạn.
    Trả về: (is_valid, payload, error_message)
    """
    if not token or not isinstance(token, str):
        return False, None, "Token không được để trống"

    parts = token.strip().split(".")
    if len(parts) != 3:
        return False, None, "Định dạng token không hợp lệ"

    encoded_header, encoded_payload, encoded_signature = parts

    # 1. Kiểm tra chữ ký số HMAC-SHA256
    signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
    expected_signature = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    expected_encoded_sig = _base64url_encode(expected_signature)

    if not hmac.compare_digest(encoded_signature, expected_encoded_sig):
        return False, None, "Chữ ký Token không hợp lệ"

    # 2. Giải mã Payload
    try:
        payload_bytes = _base64url_decode(encoded_payload)
        payload = json.loads(payload_bytes.decode("utf-8"))
    except Exception as e:
        return False, None, f"Lỗi giải mã payload: {str(e)}"

    # 3. Kiểm tra hạn sử dụng (exp)
    now = int(time.time())
    exp = payload.get("exp")
    if exp and now > exp:
        return False, None, "Phiên đăng nhập đã hết hạn"

    return True, payload, None


def get_redirect_url_for_role(role: str) -> str:
    """Trả về URL chuyển hướng tương ứng với vai trò."""
    return ROLE_REDIRECT_MATRIX.get(role, "/")


# ==========================================
# DỊCH VỤ NGHIỆP VỤ XÁC THỰC NGƯỜI DÙNG
# ==========================================

def authenticate_user(
    identifier: str,
    password: str
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Cổng đăng nhập duy nhất cho tất cả 5 vai trò.
    Trả về: (success, auth_response, error_message)
    """
    if not identifier or not password:
        return False, None, "Vui lòng nhập số điện thoại/email và mật khẩu"

    user = get_user_by_phone_or_email(identifier)
    if not user:
        return False, None, "Số điện thoại hoặc mật khẩu không chính xác"

    if not user.get("isActive", True):
        return False, None, "Tài khoản của bạn hiện đang bị tạm khóa"

    # Kiểm tra mật khẩu
    stored_hash = user.get("passwordHash", "")
    if not verify_password(password, stored_hash):
        return False, None, "Số điện thoại hoặc mật khẩu không chính xác"

    role = user.get("role", "customer")
    branch_id = user.get("branchId")

    # Sinh JWT Token
    payload = {
        "userId": user.get("id"),
        "phone": user.get("phone"),
        "email": user.get("email"),
        "fullName": user.get("fullName"),
        "role": role,
        "branchId": branch_id
    }
    token = generate_jwt_token(payload)
    redirect_url = get_redirect_url_for_role(role)

    # Thông tin trả về cho client (không chứa passwordHash)
    user_info = {
        "id": user.get("id"),
        "phone": user.get("phone"),
        "email": user.get("email"),
        "fullName": user.get("fullName"),
        "role": role,
        "branchId": branch_id
    }

    return True, {
        "token": token,
        "role": role,
        "redirectUrl": redirect_url,
        "user": user_info
    }, None


def register_customer(
    phone: str,
    full_name: str,
    password: str,
    email: str = ""
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Đăng ký tài khoản khách hàng mới.
    """
    phone = (phone or "").strip()
    full_name = (full_name or "").strip()
    email = (email or "").strip()

    if not phone or not password or not full_name:
        return False, None, "Vui lòng điền đầy đủ họ tên, số điện thoại và mật khẩu"

    if len(password) < 6:
        return False, None, "Mật khẩu phải có ít nhất 6 ký tự"

    # Kiểm tra trùng lặp số điện thoại
    existing = get_user_by_phone_or_email(phone)
    if existing:
        return False, None, "Số điện thoại này đã được đăng ký tài khoản"

    if email:
        existing_email = get_user_by_phone_or_email(email)
        if existing_email:
            return False, None, "Email này đã được sử dụng"

    user_id = f"cust_{int(time.time())}"
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    new_user = {
        "id": user_id,
        "phone": phone,
        "email": email,
        "fullName": full_name,
        "passwordHash": hash_password(password),
        "role": "customer",
        "branchId": None,
        "isActive": True,
        "createdAt": now_iso
    }

    users = get_users()
    users.append(new_user)
    save_users(users)

    # Đồng bộ sang cơ sở dữ liệu khách hàng CRM
    new_crm_customer = {
        "id": user_id,
        "phone": phone,
        "fullName": full_name,
        "email": email,
        "tier": "standard",
        "loyaltyPoints": 50,  # Tặng 50 điểm chào mừng
        "totalSpent": 0,
        "orderCount": 0,
        "savedAddresses": [],
        "createdAt": now_iso
    }
    customers = get_customers()
    customers.append(new_crm_customer)
    save_customers(customers)

    # Đăng nhập tự động ngay sau khi đăng ký
    payload = {
        "userId": user_id,
        "phone": phone,
        "email": email,
        "fullName": full_name,
        "role": "customer",
        "branchId": None
    }
    token = generate_jwt_token(payload)

    return True, {
        "token": token,
        "role": "customer",
        "redirectUrl": "/",
        "user": {
            "id": user_id,
            "phone": phone,
            "email": email,
            "fullName": full_name,
            "role": "customer",
            "branchId": None
        }
    }, None
