from functools import wraps
from typing import Any, Dict, List, Optional, Union
from flask import request, jsonify
from services.auth_service import verify_jwt_token


def require_role(allowed_roles: Union[str, List[str]]):
    """
    Decorator kiểm soát quyền truy cập API theo danh sách vai trò (RBAC).
    
    Tham số:
        allowed_roles: Chuỗi đơn (VD: 'super_admin') hoặc danh sách vai trò (VD: ['branch_manager', 'super_admin'])
    """
    if isinstance(allowed_roles, str):
        allowed_roles = [allowed_roles]

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get("Authorization")
            if not auth_header:
                return jsonify({
                    "success": False,
                    "message": "Yêu cầu đăng nhập để truy cập tài nguyên này"
                }), 401

            parts = auth_header.strip().split(" ")
            if len(parts) != 2 or parts[0].lower() != "bearer":
                return jsonify({
                    "success": False,
                    "message": "Định dạng Authorization Header không hợp lệ (Cần dạng: Bearer <token>)"
                }), 401

            token = parts[1]
            is_valid, payload, error_msg = verify_jwt_token(token)

            if not is_valid or not payload:
                return jsonify({
                    "success": False,
                    "message": error_msg or "Token không hợp lệ hoặc đã hết hạn"
                }), 401

            user_role = payload.get("role")
            if user_role not in allowed_roles:
                return jsonify({
                    "success": False,
                    "message": "Bạn không có quyền thực hiện thao tác này"
                }), 403

            # Đính kèm thông tin user vào context của request
            request.current_user = payload
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_auth(f):
    """
    Decorator yêu cầu đăng nhập hợp lệ cho bất kỳ vai trò nào (Customer, Florist, Sales, Manager, Admin).
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({
                "success": False,
                "message": "Yêu cầu đăng nhập để truy cập"
            }), 401

        parts = auth_header.strip().split(" ")
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({
                "success": False,
                "message": "Định dạng Token không hợp lệ"
            }), 401

        token = parts[1]
        is_valid, payload, error_msg = verify_jwt_token(token)

        if not is_valid or not payload:
            return jsonify({
                "success": False,
                "message": error_msg or "Token không hợp lệ hoặc đã hết hạn"
            }), 401

        request.current_user = payload
        return f(*args, **kwargs)
    return decorated_function


def can_access_branch(user: Dict[str, Any], branch_id: str) -> bool:
    """
    Kiểm tra phân lập dữ liệu chi nhánh (Data Isolation).
    - Super Admin: Toàn quyền truy cập mọi chi nhánh.
    - Quản lý / Florist / Sales: Chỉ được truy cập chi nhánh trực thuộc.
    """
    if not user:
        return False
    if user.get("role") == "super_admin":
        return True
    return user.get("branchId") == branch_id
