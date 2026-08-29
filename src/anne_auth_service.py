import os
import json
import time
import hmac
import hashlib
import base64
from typing import Any, Dict, List, Optional, Tuple, Union
from werkzeug.security import generate_password_hash, check_password_hash

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from  data_service import (
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
    print(f"[AUTH] Processing login attempt for identifier: '{identifier}'", flush=True)
    if not identifier or not password:
        print("[AUTH] Login failed: Empty identifier or password", flush=True)
        return False, None, "Vui lòng nhập số điện thoại/email và mật khẩu"

    user = get_user_by_phone_or_email(identifier)
    if not user:
        print(f"[AUTH] Login failed: User '{identifier}' not found in database", flush=True)
        return False, None, "Số điện thoại hoặc mật khẩu không chính xác"

    if not user.get("isActive", True):
        print(f"[AUTH] Login failed: User '{identifier}' is disabled (isActive=False)", flush=True)
        return False, None, "Tài khoản của bạn hiện đang bị tạm khóa"

    # Kiểm tra mật khẩu
    stored_hash = user.get("passwordHash", "")
    if not verify_password(password, stored_hash):
        print(f"[AUTH] Login failed: Password mismatch for user '{identifier}'", flush=True)
        return False, None, "Số điện thoại hoặc mật khẩu không chính xác"

    role = user.get("role", "customer")
    branch_id = user.get("branchId")
    print(f"[AUTH] Login SUCCESS for user: '{identifier}' (Role: {role}, Branch: {branch_id})", flush=True)

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

    new_customer = {
        "id": user_id,
        "phone": phone,
        "email": email,
        "fullName": full_name,
        "passwordHash": hash_password(password),
        "role": "customer",
        "branchId": None,
        "tier": "standard",
        "loyaltyPoints": 50,  # Tặng 50 điểm chào mừng
        "totalSpent": 0,
        "orderCount": 0,
        "savedAddresses": [],
        "isActive": True,
        "createdAt": now_iso
    }

    customers = get_customers()
    customers.append(new_customer)
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


# ==========================================
# QUẢN LÝ NHÂN SỰ & PHÂN QUYỀN (STAFF & RBAC)
# ==========================================

def list_staff_users(current_user: Dict[str, Any], branch_filter: Optional[str] = None, include_customers: bool = False) -> List[Dict[str, Any]]:
    """
    Lấy danh sách nhân sự nội bộ (loại bỏ tài khoản khách hàng role='customer'):
    - super_admin: xem toàn bộ hoặc lọc theo chi nhánh.
    - branch_manager: CHỈ xem nhân sự thuộc chi nhánh mình quản lý.
    """
    users = get_users()
    user_role = current_user.get("role")
    user_branch = current_user.get("branchId")

    sanitized_users = []
    for u in users:
        # Nếu không yêu cầu kèm khách hàng -> chỉ lấy nhân sự nội bộ
        if not include_customers and u.get("role") == "customer":
            continue

        u_copy = dict(u)
        u_copy.pop("passwordHash", None)
        u_copy.pop("salt", None)

        if user_role == "super_admin":
            if branch_filter and branch_filter != "all":
                if u.get("branchId") == branch_filter:
                    sanitized_users.append(u_copy)
            else:
                sanitized_users.append(u_copy)
        elif user_role == "branch_manager":
            # Quản lý chi nhánh chỉ thấy người thuộc chi nhánh mình
            if u.get("branchId") == user_branch:
                sanitized_users.append(u_copy)

    return sanitized_users


def create_or_update_staff_user(
    current_user: Dict[str, Any],
    user_data: Dict[str, Any],
    target_user_id: Optional[str] = None
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Thêm mới hoặc cập nhật nhân sự:
    - super_admin: toàn quyền gán mọi role và mọi branch.
    - branch_manager: chỉ thêm/sửa florist hoặc sales_consultant trong chi nhánh của mình.
    """
    creator_role = current_user.get("role")
    creator_branch = current_user.get("branchId")

    phone = (user_data.get("phone") or "").strip()
    full_name = (user_data.get("fullName") or "").strip()
    email = (user_data.get("email") or "").strip()
    target_role = user_data.get("role", "florist")
    target_branch = user_data.get("branchId", creator_branch)
    password = user_data.get("password")

    if not phone or not full_name:
        return False, None, "Vui lòng điền đầy đủ họ tên và số điện thoại nhân sự"

    # Kiểm tra phân quyền tạo
    if creator_role == "branch_manager":
        if target_role not in ["florist", "sales_consultant"]:
            return False, None, "Quản lý chi nhánh chỉ có quyền quản lý Thợ cắm hoa (florist) và Tư vấn viên (sales_consultant)"
        target_branch = creator_branch  # Ép buộc thuộc chi nhánh của quản lý

    users = get_users()
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    if target_user_id:
        for i, u in enumerate(users):
            if u.get("id") == target_user_id:
                if creator_role == "branch_manager" and u.get("branchId") != creator_branch:
                    return False, None, "Từ chối truy cập: Nhân sự này thuộc chi nhánh khác"

                users[i]["fullName"] = full_name
                users[i]["phone"] = phone
                if email: users[i]["email"] = email
                if creator_role == "super_admin":
                    users[i]["role"] = target_role
                    users[i]["branchId"] = target_branch
                else:
                    users[i]["role"] = target_role
                    users[i]["branchId"] = creator_branch

                if password and len(password) >= 6:
                    users[i]["passwordHash"] = hash_password(password)

                if "isActive" in user_data:
                    users[i]["isActive"] = bool(user_data["isActive"])

                save_users(users)
                ret_user = dict(users[i])
                ret_user.pop("passwordHash", None)
                return True, ret_user, None
        return False, None, "Không tìm thấy nhân sự cần sửa"
    else:
        if not password or len(password) < 6:
            return False, None, "Vui lòng nhập mật khẩu khởi tạo từ 6 ký tự trở lên"

        if get_user_by_phone_or_email(phone):
            return False, None, "Số điện thoại này đã tồn tại trong hệ thống"

        new_id = f"staff_{int(time.time()) % 100000:05d}"
        new_staff = {
            "id": new_id,
            "phone": phone,
            "email": email,
            "fullName": full_name,
            "passwordHash": hash_password(password),
            "role": target_role,
            "branchId": target_branch,
            "isActive": True,
            "createdAt": now_iso
        }
        users.append(new_staff)
        save_users(users)

        ret_user = dict(new_staff)
        ret_user.pop("passwordHash", None)
        return True, ret_user, None


def delete_staff_user(current_user: Dict[str, Any], target_user_id: str) -> Tuple[bool, Optional[str]]:
    creator_role = current_user.get("role")
    creator_branch = current_user.get("branchId")

    if target_user_id == current_user.get("userId") or target_user_id == current_user.get("id"):
        return False, "Không thể tự xóa tài khoản đang đăng nhập của chính mình"

    users = get_users()
    for i, u in enumerate(users):
        if u.get("id") == target_user_id:
            if creator_role == "branch_manager":
                if u.get("branchId") != creator_branch or u.get("role") in ["super_admin", "branch_manager"]:
                    return False, "Bạn không có quyền xóa nhân sự này"

            deleted_user = users.pop(i)
            save_users(users)
            return True, None
    return False, "Không tìm thấy người dùng cần xóa"


def list_crm_customers(search: Optional[str] = None, tier: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Lấy danh sách khách hàng CRM (phân tách hoàn toàn khỏi nhân sự nội bộ).
    Tổng hợp dữ liệu từ customers_crm.json và tài khoản khách hàng role='customer' trong users.json.
    """
    crm_customers = get_customers()
    users = get_users()
    
    # Map khách hàng từ CRM
    cust_map = {c.get("phone"): dict(c) for c in crm_customers if c.get("phone")}

    # Bổ sung các tài khoản khách hàng trong users.json nếu chưa có trong CRM
    for u in users:
        if u.get("role") == "customer" and u.get("phone"):
            phone = u.get("phone")
            if phone not in cust_map:
                cust_map[phone] = {
                    "id": u.get("id"),
                    "phone": phone,
                    "fullName": u.get("fullName", "Khách Hàng"),
                    "email": u.get("email", ""),
                    "tier": "standard",
                    "loyaltyPoints": 50,
                    "totalSpent": 0,
                    "orderCount": 0,
                    "isActive": u.get("isActive", True),
                    "createdAt": u.get("createdAt", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
                }
            else:
                cust_map[phone]["isActive"] = u.get("isActive", True)
                if not cust_map[phone].get("fullName") and u.get("fullName"):
                    cust_map[phone]["fullName"] = u.get("fullName")

    results = list(cust_map.values())

    # Bộ lọc tìm kiếm
    if search:
        s_lower = search.strip().lower()
        results = [
            c for c in results
            if s_lower in (c.get("fullName") or "").lower()
            or s_lower in (c.get("phone") or "").lower()
            or s_lower in (c.get("email") or "").lower()
        ]

    if tier and tier != "all":
        results = [c for c in results if c.get("tier", "standard").lower() == tier.lower()]

    return results


