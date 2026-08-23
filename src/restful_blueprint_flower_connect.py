"""
RESTful Blueprint Module cho Telua Flower Connect API
Hỗ trợ url_prefix='/api/flower/v1' chuẩn hóa tương tự Lu Quan (/api/hotelconnect/v1).
Đồng thời hỗ trợ legacy prefix '/api' đảm bảo 100% tương thích ngược.
"""

import os
import sys
import logging
from flask import Blueprint, jsonify, request
from flask_cors import cross_origin

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from services.auth_service import (
    authenticate_user,
    register_customer,
    verify_jwt_token,
    list_staff_users,
    create_or_update_staff_user,
    delete_staff_user
)
from services.data_service import (
    get_user_by_id,
    get_order_by_id,
    read_orders_by_month,
    get_price_levels,
    get_product_by_id,
    get_branches,
    create_or_update_branch,
    toggle_branch_active
)
from services.order_service import (
    get_available_delivery_slots,
    create_order,
    assign_nearest_branch
)
from services.product_service import (
    list_products,
    create_or_update_product,
    toggle_product_active,
    delete_product
)
from services.promotion_service import (
    list_all_promotions,
    toggle_promotion,
    create_or_update_promotion
)
from services.translation_service import (
    get_all_translations,
    batch_update_translations,
    update_translation_key
)
from decorators.auth_decorator import require_auth, require_role, can_access_branch

# Khởi tạo Blueprint RESTful API Version 1 (Chuẩn hóa như Lu Quan /api/hotelconnect/v1)
flower_connect_api = Blueprint('flower_connect_api', __name__, url_prefix='/api/flower/v1')

# Blueprint Legacy Fallback (Đảm bảo tương thích ngược 100% cho các client gọi /api/...)
flower_legacy_api = Blueprint('flower_legacy_api', __name__, url_prefix='/api')


# ==========================================
# CÁC API ENDPOINTS XÁC THỰC (AUTHENTICATION)
# ==========================================

@flower_connect_api.route("/auth/login", methods=["POST"])
@flower_legacy_api.route("/auth/login", methods=["POST"])
@cross_origin()
def api_login():
    """
    Cổng đăng nhập duy nhất cho cả 5 vai trò.
    Body: { "identifier": "0909123456" / "admin@nohoathabinh.vn", "password": "..." }
    """
    data = request.get_json(silent=True) or {}
    identifier = data.get("identifier") or data.get("phone") or data.get("email") or ""
    password = data.get("password") or ""

    success, auth_data, error_msg = authenticate_user(identifier, password)
    if not success:
        return jsonify({"success": False, "message": error_msg}), 401

    return jsonify({
        "success": True,
        "message": "Đăng nhập thành công",
        "data": auth_data
    }), 200


@flower_connect_api.route("/auth/register", methods=["POST"])
@flower_legacy_api.route("/auth/register", methods=["POST"])
@cross_origin()
def api_register():
    """
    Đăng ký tài khoản khách hàng mới.
    Body: { "phone": "...", "fullName": "...", "password": "...", "email": "..." }
    """
    data = request.get_json(silent=True) or {}
    phone = data.get("phone") or ""
    full_name = data.get("fullName") or data.get("name") or ""
    password = data.get("password") or ""
    email = data.get("email") or ""

    success, auth_data, error_msg = register_customer(phone, full_name, password, email)
    if not success:
        return jsonify({"success": False, "message": error_msg}), 400

    return jsonify({
        "success": True,
        "message": "Đăng ký tài khoản thành công",
        "data": auth_data
    }), 201


@flower_connect_api.route("/auth/me", methods=["GET"])
@flower_legacy_api.route("/auth/me", methods=["GET"])
@cross_origin()
@require_auth
def api_get_me():
    """
    Lấy thông tin tài khoản hiện tại từ JWT Token.
    """
    current_user = request.current_user
    user_record = get_user_by_id(current_user.get("userId"))
    if not user_record:
        return jsonify({"success": False, "message": "Không tìm thấy thông tin tài khoản"}), 404

    # Loại bỏ hash mật khẩu
    safe_info = {k: v for k, v in user_record.items() if k != "passwordHash"}
    return jsonify({
        "success": True,
        "data": safe_info
    }), 200


@flower_connect_api.route("/auth/logout", methods=["POST"])
@flower_legacy_api.route("/auth/logout", methods=["POST"])
@cross_origin()
def api_logout():
    """
    Đăng xuất (Client chủ động xóa token khỏi localStorage).
    """
    return jsonify({
        "success": True,
        "message": "Đăng xuất thành công"
    }), 200


# ==========================================
# CÁC API ENDPOINTS ĐẶT HÀNG & GIAO HOA (TASK 03)
# ==========================================

@flower_connect_api.route("/delivery/slots", methods=["GET"])
@flower_legacy_api.route("/delivery/slots", methods=["GET"])
@cross_origin()
def api_delivery_slots():
    """
    Lấy danh sách khung giờ giao hàng còn trống theo ngày đã chọn (trong vòng 30 ngày).
    Query: ?date=YYYY-MM-DD
    """
    date_str = request.args.get("date") or ""
    slots = get_available_delivery_slots(date_str)
    return jsonify({
        "success": True,
        "data": {
            "date": date_str,
            "slots": slots
        }
    }), 200


@flower_connect_api.route("/orders", methods=["POST"])
@flower_legacy_api.route("/orders", methods=["POST"])
@cross_origin()
def api_create_order():
    """
    Tạo đơn hàng hoa tươi mới.
    Hỗ trợ cả khách vãng lai và khách đã đăng nhập.
    """
    order_data = request.get_json(silent=True) or {}
    
    # Kiểm tra xem có token đăng nhập không
    auth_header = request.headers.get("Authorization", "")
    authenticated_user = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        is_valid, payload, _ = verify_jwt_token(token)
        if is_valid:
            authenticated_user = payload

    success, new_order, err_msg = create_order(order_data, authenticated_user=authenticated_user)
    if not success:
        return jsonify({
            "success": False,
            "message": err_msg or "Không thể tạo đơn hàng"
        }), 400

    return jsonify({
        "success": True,
        "message": "Đặt hàng thành công! Vui lòng hoàn tất thanh toán.",
        "data": new_order
    }), 201


@flower_connect_api.route("/orders/<order_id>", methods=["GET"])
@flower_legacy_api.route("/orders/<order_id>", methods=["GET"])
@cross_origin()
def api_get_order(order_id):
    """
    Tra cứu chi tiết đơn hàng theo ID (Có kiểm tra bảo mật phân quyền RBAC).
    """
    order = get_order_by_id(order_id)
    if not order:
        return jsonify({"success": False, "message": "Không tìm thấy đơn hàng"}), 404

    # Kiểm tra token nếu có gửi kèm (Bảo vệ dữ liệu khách hàng)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        valid, payload, _ = verify_jwt_token(token)
        if valid and payload:
            role = payload.get("role")
            user_id = payload.get("userId")
            user_phone = payload.get("phone")
            branch_id = payload.get("branchId")

            # Khách hàng chỉ được xem đơn của chính mình
            if role == "customer":
                is_owner = (order.get("customerId") == user_id) or (order.get("sender", {}).get("phone") == user_phone)
                if not is_owner:
                    return jsonify({
                        "success": False,
                        "message": "Từ chối truy cập: Bạn không có quyền xem dữ liệu đơn hàng của khách hàng khác"
                    }), 403

            # Nhân viên chi nhánh chỉ xem đơn của chi nhánh mình
            elif role in ["branch_manager", "florist", "sales_consultant"] and branch_id != "all":
                if order.get("branchId") and order.get("branchId") != branch_id:
                    return jsonify({
                        "success": False,
                        "message": "Từ chối truy cập: Đơn hàng này thuộc chi nhánh khác"
                    }), 403

    return jsonify({
        "success": True,
        "data": order
    }), 200


@flower_connect_api.route("/orders/my-orders", methods=["GET"])
@flower_legacy_api.route("/orders/my-orders", methods=["GET"])
@cross_origin()
@require_auth
def api_my_orders():
    """
    Lấy danh sách đơn hàng của khách hàng hiện tại.
    """
    current_user = request.current_user
    user_id = current_user.get("userId")
    user_phone = current_user.get("phone")

    all_orders = read_orders_by_month()
    my_orders = [
        o for o in all_orders
        if (o.get("customerId") == user_id) or (o.get("sender", {}).get("phone") == user_phone)
    ]

    return jsonify({
        "success": True,
        "data": my_orders
    }), 200


@flower_connect_api.route("/branch/<branch_id>/orders", methods=["GET"])
@flower_legacy_api.route("/branch/<branch_id>/orders", methods=["GET"])
@cross_origin()
@require_role(["super_admin", "branch_manager", "florist", "sales_consultant"])
def api_branch_orders(branch_id):
    """
    Lấy danh sách đơn hàng được gán cho chi nhánh.
    """
    current_user = request.current_user
    if not can_access_branch(current_user, branch_id):
        return jsonify({"success": False, "message": "Bạn không có quyền truy cập chi nhánh này"}), 403

    all_orders = read_orders_by_month()
    branch_orders = [o for o in all_orders if o.get("branchId") == branch_id]

    return jsonify({
        "success": True,
        "data": branch_orders
    }), 200


# ==========================================
# CÁC API ENDPOINTS QUẢN TRỊ SẢN PHẨM & GIÁ (TASK 07)
# ==========================================

@flower_connect_api.route("/price-levels", methods=["GET"])
@flower_legacy_api.route("/price-levels", methods=["GET"])
@cross_origin()
def api_get_price_levels():
    """Lấy danh sách 4 phân tầng giá chuẩn kèm hạn mức min/max."""
    levels = get_price_levels()
    return jsonify({"success": True, "data": levels}), 200


@flower_connect_api.route("/products", methods=["GET"])
@flower_legacy_api.route("/products", methods=["GET"])
@cross_origin()
def api_get_products():
    """Lấy danh sách sản phẩm hoa tươi (hỗ trợ lọc theo category, search, active)."""
    category = request.args.get("category")
    search = request.args.get("search")
    is_active_param = request.args.get("active")
    is_active = True if is_active_param == "true" else (False if is_active_param == "false" else None)

    prods = list_products(category=category, search=search, is_active=is_active)
    return jsonify({"success": True, "data": prods}), 200


@flower_connect_api.route("/products/<product_id>", methods=["GET"])
@flower_legacy_api.route("/products/<product_id>", methods=["GET"])
@cross_origin()
def api_get_product_detail(product_id):
    """Lấy chi tiết một sản phẩm hoa tươi theo ID."""
    prod = get_product_by_id(product_id)
    if not prod:
        return jsonify({"success": False, "message": "Không tìm thấy sản phẩm"}), 404
    return jsonify({"success": True, "data": prod}), 200


@flower_connect_api.route("/admin/products", methods=["POST"])
@flower_legacy_api.route("/admin/products", methods=["POST"])
@cross_origin()
@require_role(["super_admin", "branch_manager"])
def api_create_product():
    """Thêm mẫu hoa mới vào Catalogue (có kiểm tra hàng rào giá an toàn)."""
    payload = request.get_json(silent=True) or {}
    success, new_prod, err_msg = create_or_update_product(payload)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    return jsonify({"success": True, "message": "Thêm mẫu hoa thành công", "data": new_prod}), 201


@flower_connect_api.route("/admin/products/<product_id>", methods=["PUT"])
@flower_legacy_api.route("/admin/products/<product_id>", methods=["PUT"])
@cross_origin()
@require_role(["super_admin", "branch_manager"])
def api_update_product(product_id):
    """Cập nhật thông tin và giá bán mẫu hoa."""
    payload = request.get_json(silent=True) or {}
    success, updated_prod, err_msg = create_or_update_product(payload, product_id=product_id)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    return jsonify({"success": True, "message": "Cập nhật sản phẩm thành công", "data": updated_prod}), 200


@flower_connect_api.route("/admin/products/<product_id>/toggle", methods=["PUT", "PATCH"])
@flower_legacy_api.route("/admin/products/<product_id>/toggle", methods=["PUT", "PATCH"])
@cross_origin()
@require_role(["super_admin", "branch_manager"])
def api_toggle_product(product_id):
    """Ẩn / Hiện mẫu hoa trên website."""
    success, updated_prod, err_msg = toggle_product_active(product_id)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    return jsonify({"success": True, "message": "Đã đổi trạng thái sản phẩm", "data": updated_prod}), 200


@flower_connect_api.route("/admin/products/<product_id>", methods=["DELETE"])
@flower_legacy_api.route("/admin/products/<product_id>", methods=["DELETE"])
@cross_origin()
@require_role(["super_admin"])
def api_delete_product(product_id):
    """Xóa mẫu hoa khỏi danh mục (Chỉ Super Admin)."""
    success, err_msg = delete_product(product_id)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    return jsonify({"success": True, "message": "Đã xóa sản phẩm thành công"}), 200


# ==========================================
# CÁC API ENDPOINTS KHUYẾN MÃI & VOUCHER (TASK 07)
# ==========================================

@flower_connect_api.route("/promotions", methods=["GET"])
@flower_legacy_api.route("/promotions", methods=["GET"])
@cross_origin()
def api_get_promotions():
    """Lấy danh sách tất cả khuyến mãi & voucher."""
    promos = list_all_promotions()
    return jsonify({"success": True, "data": promos}), 200


@flower_connect_api.route("/admin/promotions", methods=["POST"])
@flower_legacy_api.route("/admin/promotions", methods=["POST"])
@cross_origin()
@require_role(["super_admin", "branch_manager"])
def api_create_promotion():
    """Tạo mới voucher khuyến mãi."""
    payload = request.get_json(silent=True) or {}
    success, new_promo, err = create_or_update_promotion(payload)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Tạo voucher thành công", "data": new_promo}), 201


@flower_connect_api.route("/admin/promotions/<promo_id>/toggle", methods=["PUT", "PATCH"])
@flower_legacy_api.route("/admin/promotions/<promo_id>/toggle", methods=["PUT", "PATCH"])
@cross_origin()
@require_role(["super_admin", "branch_manager"])
def api_toggle_promotion(promo_id):
    """Gạt công tắc Bật/Tắt (ON/OFF) voucher khuyến mãi."""
    success, updated_promo, err = toggle_promotion(promo_id)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Đã cập nhật trạng thái voucher", "data": updated_promo}), 200


# ==========================================
# CÁC API ENDPOINTS BIÊN DỊCH ĐA NGÔN NGỮ (TASK 07)
# ==========================================

@flower_connect_api.route("/translations", methods=["GET"])
@flower_legacy_api.route("/translations", methods=["GET"])
@cross_origin()
def api_get_translations():
    """Lấy từ điển đa ngôn ngữ 5 thứ tiếng."""
    data = get_all_translations()
    return jsonify({"success": True, "data": data}), 200


@flower_connect_api.route("/admin/translations", methods=["PUT"])
@flower_legacy_api.route("/admin/translations", methods=["PUT"])
@cross_origin()
@require_role(["super_admin", "branch_manager"])
def api_update_translations():
    """Cập nhật ma trận biên dịch động 5 ngôn ngữ."""
    payload = request.get_json(silent=True) or {}
    success, data, err = batch_update_translations(payload)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Cập nhật từ điển đa ngôn ngữ thành công", "data": data}), 200


# ==========================================
# CÁC API QUẢN LÝ NHÂN SỰ & PHÂN QUYỀN (STAFF & USERS)
# ==========================================

@flower_connect_api.route("/admin/users", methods=["GET"])
@flower_legacy_api.route("/admin/users", methods=["GET"])
@cross_origin()
@require_role(["super_admin", "branch_manager"])
def api_get_staff_users():
    """Lấy danh sách nhân sự (Super Admin thấy tất cả, Quản lý chỉ thấy chi nhánh mình)."""
    branch_filter = request.args.get("branchId")
    users = list_staff_users(request.current_user, branch_filter=branch_filter)
    return jsonify({"success": True, "data": users}), 200


@flower_connect_api.route("/admin/users", methods=["POST"])
@flower_legacy_api.route("/admin/users", methods=["POST"])
@cross_origin()
@require_role(["super_admin", "branch_manager"])
def api_create_staff_user():
    """Thêm nhân sự mới (Quản lý chỉ được thêm thợ cắm hoa / tư vấn viên cho chi nhánh mình)."""
    payload = request.get_json(silent=True) or {}
    success, user_data, err = create_or_update_staff_user(request.current_user, payload)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Thêm nhân sự thành công", "data": user_data}), 201


@flower_connect_api.route("/admin/users/<user_id>", methods=["PUT"])
@flower_legacy_api.route("/admin/users/<user_id>", methods=["PUT"])
@cross_origin()
@require_role(["super_admin", "branch_manager"])
def api_update_staff_user(user_id):
    """Cập nhật thông tin nhân sự."""
    payload = request.get_json(silent=True) or {}
    success, user_data, err = create_or_update_staff_user(request.current_user, payload, target_user_id=user_id)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Cập nhật nhân sự thành công", "data": user_data}), 200


@flower_connect_api.route("/admin/users/<user_id>", methods=["DELETE"])
@flower_legacy_api.route("/admin/users/<user_id>", methods=["DELETE"])
@cross_origin()
@require_role(["super_admin", "branch_manager"])
def api_delete_staff_user(user_id):
    """Xóa nhân sự."""
    success, err = delete_staff_user(request.current_user, user_id)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Xóa nhân sự thành công"}), 200


# ==========================================
# CÁC API QUẢN LÝ CHUỖI CỬA HÀNG (BRANCHES MANAGEMENT)
# ==========================================

@flower_connect_api.route("/branches", methods=["GET"])
@flower_legacy_api.route("/branches", methods=["GET"])
@cross_origin()
def api_get_public_branches():
    """Lấy danh sách các chi nhánh đang mở cửa hoạt động (dành cho khách hàng)."""
    branches = [b for b in get_branches() if b.get("isActive", True)]
    return jsonify({"success": True, "data": branches}), 200


@flower_connect_api.route("/admin/branches", methods=["GET"])
@flower_legacy_api.route("/admin/branches", methods=["GET"])
@cross_origin()
@require_role(["super_admin", "branch_manager"])
def api_get_admin_branches():
    """Lấy danh sách chi nhánh chuỗi cửa hàng."""
    current_user = request.current_user
    branches = get_branches(use_cache=False)
    if current_user.get("role") == "branch_manager":
        branches = [b for b in branches if b.get("id") == current_user.get("branchId")]
    return jsonify({"success": True, "data": branches}), 200


@flower_connect_api.route("/admin/branches", methods=["POST"])
@flower_legacy_api.route("/admin/branches", methods=["POST"])
@cross_origin()
@require_role(["super_admin"])
def api_create_branch():
    """Tạo chi nhánh mới trong chuỗi (Chỉ Super Admin)."""
    payload = request.get_json(silent=True) or {}
    success, new_branch, err = create_or_update_branch(payload)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Thêm chi nhánh thành công", "data": new_branch}), 201


@flower_connect_api.route("/admin/branches/<branch_id>", methods=["PUT"])
@flower_legacy_api.route("/admin/branches/<branch_id>", methods=["PUT"])
@cross_origin()
@require_role(["super_admin"])
def api_update_branch(branch_id):
    """Cập nhật thông tin chi nhánh (Chỉ Super Admin)."""
    payload = request.get_json(silent=True) or {}
    success, updated_branch, err = create_or_update_branch(payload, branch_id=branch_id)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Cập nhật chi nhánh thành công", "data": updated_branch}), 200


@flower_connect_api.route("/admin/branches/<branch_id>/toggle", methods=["PATCH", "PUT"])
@flower_legacy_api.route("/admin/branches/<branch_id>/toggle", methods=["PATCH", "PUT"])
@cross_origin()
@require_role(["super_admin"])
def api_toggle_branch(branch_id):
    """Bật / Tắt trạng thái hoạt động của chi nhánh (Chỉ Super Admin)."""
    success, branch_data, err = toggle_branch_active(branch_id)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Đã cập nhật trạng thái chi nhánh", "data": branch_data}), 200
