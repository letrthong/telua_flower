"""
RESTful Blueprint Module cho Telua Flower Connect API
Hỗ trợ url_prefix='/api/flower/v1' chuẩn hóa tương tự Lu Quan (/api/hotelconnect/v1).
"""

import os
import sys
import logging
from flask import Blueprint, jsonify, request, make_response, send_file

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from  anne_auth_service import (
    authenticate_user,
    register_customer,
    verify_jwt_token,
    list_staff_users,
    create_or_update_staff_user,
    delete_staff_user,
    list_crm_customers
)
from   data_service import (
    get_config_path,
    get_user_by_id,
    get_order_by_id,
    read_orders_by_month,
    get_price_levels,
    get_product_by_id,
    get_branches,
    create_or_update_branch,
    toggle_branch_active,
    get_categories,
    create_or_update_category,
    toggle_category_active,
    delete_category,
    restore_category,
    move_category_order,
    get_user_orders,
    get_company_info,
    save_company_info,
    save_uploaded_image,
    find_image_file
)
from order_service import (
    get_available_delivery_slots,
    create_order,
    assign_nearest_branch,
    query_admin_orders
)
from product_service import (
    list_products,
    create_or_update_product,
    toggle_product_active,
    delete_product
)
from promotion_service import (
    list_all_promotions,
    toggle_promotion,
    create_or_update_promotion,
    delete_promotion,
    restore_promotion
)
from translation_service import (
    get_all_translations,
    batch_update_translations,
    update_translation_key,
    delete_translation_key
)
from flower_image import (
    find_flower_image_file,
    save_flower_uploaded_image,
    create_flower_image_response
)
from auth_decorator import require_auth, require_role, can_access_branch

# Khởi tạo Blueprint RESTful API Version 1 (Chuẩn hóa như Lu Quan /api/hotelconnect/v1)
flower_connect_api = Blueprint('flower_connect_api', __name__, url_prefix='/api/flower/v1')

# ==========================================
# CÁC API ENDPOINTS XÁC THỰC (AUTHENTICATION)
# ==========================================

@flower_connect_api.route("/auth/login", methods=["POST"])
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


@flower_connect_api.route("/admin/orders", methods=["GET"])
@require_role(["super_admin", "branch_manager", "florist", "sales_consultant"])
def api_admin_orders():
    """
    Quản lý & Thống kê đơn hàng bán theo Hôm nay, Tuần này, Tháng này hoặc khoảng thời gian tùy chọn:
    Query params:
    - timeframe: 'today', 'this_week', 'this_month', 'last_month', 'all', 'custom'
    - branchId: 'all', 'branch_q10', 'branch_q1', 'branch_thao_dien'
    - status: 'all', 'pending', 'arranging', 'shipping', 'completed', 'cancelled'
    - paymentStatus: 'all', 'paid', 'unpaid'
    - search: từ khóa tìm kiếm (mã đơn, SĐT, tên khách)
    - startDate / endDate: YYYY-MM-DD (khi timeframe='custom')
    - month: YYYY_MM (ví dụ: '2026_08')
    """
    timeframe = request.args.get("timeframe", "this_month")
    branch_id = request.args.get("branchId")
    status = request.args.get("status")
    payment_status = request.args.get("paymentStatus")
    search = request.args.get("search")
    start_date = request.args.get("startDate")
    end_date = request.args.get("endDate")
    month_key = request.args.get("month")

    result = query_admin_orders(
        current_user=request.current_user,
        timeframe=timeframe,
        branch_id=branch_id,
        status=status,
        payment_status=payment_status,
        search=search,
        start_date=start_date,
        end_date=end_date,
        month_key=month_key
    )

    return jsonify({
        "success": True,
        "data": result
    }), 200



# ==========================================
# CÁC API DANH MỤC HOA TƯƠI (CATEGORIES MANAGEMENT)
# ==========================================

@flower_connect_api.route("/categories", methods=["GET"])
def api_get_public_categories():
    """Lấy danh sách các danh mục hoa đang Bật hiển thị trên Frontend (hỗ trợ HTTP ETag & Cache-Control)."""
    return _build_cached_file_response(
        "categories.json",
        lambda: sorted(
            [c for c in get_categories(use_cache=True, active_only=True) if isinstance(c, dict)],
            key=lambda x: int(x.get("order") or 99)
        ),
        max_age=120
    )


@flower_connect_api.route("/admin/categories", methods=["GET"])
@require_role(["super_admin", "branch_manager"])
def api_get_admin_categories():
    """Lấy toàn bộ danh sách danh mục (cả đang hiện và đang ẩn) cho Admin."""
    categories = get_categories(use_cache=False, active_only=False)
    categories.sort(key=lambda x: int(x.get("order") or 99))
    return jsonify({"success": True, "data": categories}), 200


@flower_connect_api.route("/admin/categories", methods=["POST"])
@require_role(["super_admin", "branch_manager"])
def api_create_category():
    """Tạo mới danh mục hoa tươi."""
    payload = request.get_json(silent=True) or {}
    success, new_cat, err_msg = create_or_update_category(payload)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    return jsonify({"success": True, "message": "Tạo danh mục thành công", "data": new_cat}), 201


@flower_connect_api.route("/admin/categories/<cat_id>", methods=["PUT"])
@require_role(["super_admin", "branch_manager"])
def api_update_category(cat_id):
    """Cập nhật thông tin danh mục hoa tươi."""
    payload = request.get_json(silent=True) or {}
    success, updated_cat, err_msg = create_or_update_category(payload, cat_id=cat_id)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    return jsonify({"success": True, "message": "Cập nhật danh mục thành công", "data": updated_cat}), 200


@flower_connect_api.route("/admin/categories/<cat_id>/toggle", methods=["PATCH"])
@require_role(["super_admin", "branch_manager"])
def api_toggle_category(cat_id):
    """Bật/Tắt hiển thị danh mục hoa tươi trên Frontend (isActive)."""
    success, toggled_cat, err_msg = toggle_category_active(cat_id)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    status_str = "Hiển thị" if toggled_cat.get("isActive") else "Ẩn"
    return jsonify({
        "success": True,
        "message": f"Đã chuyển trạng thái danh mục sang: {status_str}",
        "data": toggled_cat
    }), 200


@flower_connect_api.route("/admin/categories/<cat_id>", methods=["DELETE"])
@require_role(["super_admin", "branch_manager"])
def api_delete_category(cat_id):
    """Xóa mềm danh mục (đổi status='deleted', isActive=False, giữ nguyên record trong JSON)."""
    success, err_msg = delete_category(cat_id)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    return jsonify({"success": True, "message": "Đã chuyển danh mục sang trạng thái Đã Xóa (Soft Deleted)"}), 200


@flower_connect_api.route("/admin/categories/<cat_id>/restore", methods=["PATCH"])
@require_role(["super_admin", "branch_manager"])
def api_restore_category(cat_id):
    """Khôi phục danh mục đã xóa mềm (status='active', isActive=True)."""
    success, restored_cat, err_msg = restore_category(cat_id)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    return jsonify({
        "success": True,
        "message": "Khôi phục danh mục thành công",
        "data": restored_cat
    }), 200


@flower_connect_api.route("/admin/categories/<cat_id>/move", methods=["PATCH", "POST"])
@require_role(["super_admin", "branch_manager"])
def api_move_category(cat_id):
    """Di chuyển thứ tự order danh mục lên (up) hoặc xuống (down) 1 bậc."""
    payload = request.get_json(silent=True) or {}
    direction = payload.get("direction", "up")
    success, updated_cats, err_msg = move_category_order(cat_id, direction)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    return jsonify({
        "success": True,
        "message": f"Đã di chuyển thứ tự danh mục thành công",
        "data": updated_cats
    }), 200




# ==========================================
# CÁC API ENDPOINTS QUẢN TRỊ SẢN PHẨM & GIÁ (TASK 07)
# ==========================================

@flower_connect_api.route("/price-levels", methods=["GET"])
def api_get_price_levels():
    """Lấy danh sách 4 phân tầng giá chuẩn kèm hạn mức min/max (hỗ trợ HTTP ETag Cache)."""
    return _build_cached_file_response("price_levels.json", lambda: get_price_levels(use_cache=True), max_age=120)


@flower_connect_api.route("/products", methods=["GET"])
def api_get_products():
    """Lấy danh sách sản phẩm hoa tươi (hỗ trợ lọc theo category, search, active có Cache-Control)."""
    category = request.args.get("category")
    search = request.args.get("search")
    is_active_param = request.args.get("active")
    is_active = True if is_active_param == "true" else (False if is_active_param == "false" else None)

    prods = list_products(category=category, search=search, is_active=is_active)
    resp = jsonify({"success": True, "data": prods})
    resp.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    return resp, 200


@flower_connect_api.route("/products/<product_id>", methods=["GET"])
def api_get_product_detail(product_id):
    """Lấy chi tiết một sản phẩm hoa tươi theo ID (hỗ trợ tham số ?lang= và có Cache-Control)."""
    lang = request.args.get("lang")
    prod = get_product_by_id(product_id, lang=lang)
    if not prod:
        return jsonify({"success": False, "message": "Không tìm thấy sản phẩm"}), 404
    resp = jsonify({"success": True, "data": prod})
    resp.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=300"
    return resp, 200


@flower_connect_api.route("/admin/products", methods=["POST"])
@require_role(["super_admin", "branch_manager"])
def api_create_product():
    """Thêm mẫu hoa mới vào Catalogue (có kiểm tra hàng rào giá an toàn)."""
    payload = request.get_json(silent=True) or {}
    success, new_prod, err_msg = create_or_update_product(payload)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    return jsonify({"success": True, "message": "Thêm mẫu hoa thành công", "data": new_prod}), 201


@flower_connect_api.route("/admin/products/<product_id>", methods=["PUT"])
@require_role(["super_admin", "branch_manager"])
def api_update_product(product_id):
    """Cập nhật thông tin và giá bán mẫu hoa."""
    payload = request.get_json(silent=True) or {}
    success, updated_prod, err_msg = create_or_update_product(payload, product_id=product_id)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    return jsonify({"success": True, "message": "Cập nhật sản phẩm thành công", "data": updated_prod}), 200


@flower_connect_api.route("/admin/products/<product_id>/toggle", methods=["PUT", "PATCH"])
@require_role(["super_admin", "branch_manager"])
def api_toggle_product(product_id):
    """Ẩn / Hiện mẫu hoa trên website."""
    success, updated_prod, err_msg = toggle_product_active(product_id)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    return jsonify({"success": True, "message": "Đã đổi trạng thái sản phẩm", "data": updated_prod}), 200


@flower_connect_api.route("/admin/products/<product_id>", methods=["DELETE"])
@require_role(["super_admin"])
def api_delete_product(product_id):
    """Xóa mẫu hoa khỏi danh mục (Chỉ Super Admin)."""
    success, err_msg = delete_product(product_id)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    return jsonify({"success": True, "message": "Đã xóa sản phẩm thành công"}), 200


@flower_connect_api.route("/admin/upload-image", methods=["POST"])
@require_role(["super_admin", "branch_manager", "florist", "sales_consultant"])
def api_upload_image():
    """
    Tải ảnh hoa tươi lên máy chủ (Chống phình to Base64 trong JSON):
    - Nhận file qua multipart/form-data ('file' hoặc 'image') hoặc payload JSON { "image": "data:image/..." }.
    - Lưu file vào thư mục tĩnh static/images/products và trả về URL ảnh.
    """
    # 1. Kiểm tra file trong multipart/form-data
    if "file" in request.files:
        file_obj = request.files["file"]
        success, img_url, err_msg = save_flower_uploaded_image(file_obj, filename_prefix="prod")
        if not success:
            return jsonify({"success": False, "message": err_msg}), 400
        return jsonify({
            "success": True,
            "message": "Tải ảnh lên thành công",
            "data": {"url": img_url}
        }), 200

    if "image" in request.files:
        file_obj = request.files["image"]
        success, img_url, err_msg = save_flower_uploaded_image(file_obj, filename_prefix="prod")
        if not success:
            return jsonify({"success": False, "message": err_msg}), 400
        return jsonify({
            "success": True,
            "message": "Tải ảnh lên thành công",
            "data": {"url": img_url}
        }), 200

    # 2. Kiểm tra chuỗi Base64 trong JSON body
    payload = request.get_json(silent=True) or {}
    b64_data = payload.get("image") or payload.get("data") or payload.get("base64")
    if b64_data:
        success, img_url, err_msg = save_flower_uploaded_image(b64_data, filename_prefix="prod")
        if not success:
            return jsonify({"success": False, "message": err_msg}), 400
        return jsonify({
            "success": True,
            "message": "Tải ảnh lên thành công",
            "data": {"url": img_url}
        }), 200

    return jsonify({"success": False, "message": "Vui lòng đính kèm tệp ảnh qua 'file'/'image' hoặc gửi chuỗi Base64 trong body"}), 400


# ==========================================
# REST API PHỤC VỤ HÌNH ẢNH HOA TƯƠI (/api/flower/v1/images/...)
# https://nohoathabinh.com/api/flower/v1/images/bo_hoa_01.webp
# ==========================================

@flower_connect_api.route("/images/<path:filename>", methods=["GET"])
@flower_connect_api.route("/images/products/<path:filename>", methods=["GET"])
@flower_connect_api.route("/products/images/<path:filename>", methods=["GET"])
@flower_connect_api.route("/flower/images/<path:filename>", methods=["GET"])
@flower_connect_api.route("/flower/products/images/<path:filename>", methods=["GET"])
@flower_connect_api.route("/flower/images/products/<path:filename>", methods=["GET"])
def serve_flower_image(filename):
    """
    Phục vụ và tải hình ảnh hoa tươi qua REST API:
    - /api/flower/v1/images/<filename>
    - /api/flower/v1/images/products/<filename>
    - /api/flower/v1/products/images/<filename>
    - /api/flower/v1/flower/images/<filename>
    - Tích hợp từ module flower_image.py (tìm kiếm đa tầng, tự động nạp GitHub CDN, gắn Cache-Control).
    """
    return create_flower_image_response(filename)





# ==========================================
# CÁC API ENDPOINTS KHUYẾN MÃI & VOUCHER (TASK 07)
# ==========================================

@flower_connect_api.route("/promotions", methods=["GET"])
def api_get_promotions():
    """Lấy danh sách tất cả khuyến mãi & voucher."""
    promos = list_all_promotions()
    return jsonify({"success": True, "data": promos}), 200


@flower_connect_api.route("/admin/promotions", methods=["POST"])
@require_role(["super_admin", "branch_manager"])
def api_create_promotion():
    """Tạo mới voucher khuyến mãi."""
    payload = request.get_json(silent=True) or {}
    success, new_promo, err = create_or_update_promotion(payload)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Tạo voucher thành công", "data": new_promo}), 201


@flower_connect_api.route("/admin/promotions/<promo_id>", methods=["PUT"])
@require_role(["super_admin", "branch_manager"])
def api_update_promotion(promo_id):
    """Cập nhật thông tin voucher khuyến mãi."""
    payload = request.get_json(silent=True) or {}
    success, updated_promo, err = create_or_update_promotion(payload, promo_id)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Cập nhật voucher thành công", "data": updated_promo}), 200


@flower_connect_api.route("/admin/promotions/<promo_id>/toggle", methods=["PUT", "PATCH"])
@require_role(["super_admin", "branch_manager"])
def api_toggle_promotion(promo_id):
    """Gạt công tắc Bật/Tắt (ON/OFF) voucher khuyến mãi."""
    success, updated_promo, err = toggle_promotion(promo_id)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Đã cập nhật trạng thái voucher", "data": updated_promo}), 200


@flower_connect_api.route("/admin/promotions/<promo_id>", methods=["DELETE"])
@require_role(["super_admin", "branch_manager"])
def api_delete_promotion(promo_id):
    """Xóa mềm (Soft Delete) voucher (không xóa vật lý trong JSON, chỉ đánh dấu status='deleted')."""
    success, err = delete_promotion(promo_id)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Đã chuyển voucher sang trạng thái Đã Xóa (Soft Deleted)"}), 200


@flower_connect_api.route("/admin/promotions/<promo_id>/restore", methods=["PATCH"])
@require_role(["super_admin", "branch_manager"])
def api_restore_promotion(promo_id):
    """Khôi phục voucher đã xóa mềm."""
    success, restored_promo, err = restore_promotion(promo_id)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Khôi phục voucher thành công", "data": restored_promo}), 200



def _build_cached_file_response(filename: str, data_fetcher, max_age: int = 60):
    """
    Helper chuẩn hóa sinh ETag theo mtime và kích thước file config JSON.
    Nếu client gửi If-None-Match trùng khớp, trả về HTTP 304 Not Modified ngay lập tức.
    """
    filepath = get_config_path(filename)
    raw_etag = None
    if os.path.exists(filepath):
        try:
            stat_res = os.stat(filepath)
            raw_etag = f"{int(stat_res.st_mtime)}-{stat_res.st_size}"
        except OSError:
            pass

    formatted_etag = f'W/"{raw_etag}"' if raw_etag else None
    client_etag = request.headers.get("If-None-Match", "")
    if raw_etag and client_etag in (formatted_etag, raw_etag, f'"{raw_etag}"'):
        resp = make_response("", 304)
        resp.headers["ETag"] = formatted_etag
        resp.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate=300"
        return resp

    data = data_fetcher()
    response = jsonify({"success": True, "data": data})
    if raw_etag:
        response.set_etag(raw_etag, weak=True)
    response.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate=300"
    return response, 200


# ==========================================
# CÁC API ENDPOINTS BIÊN DỊCH ĐA NGÔN NGỮ (TASK 07)
# ==========================================

@flower_connect_api.route("/translations", methods=["GET"])
def api_get_translations():
    """Lấy từ điển đa ngôn ngữ 5 thứ tiếng (hỗ trợ HTTP ETag / 304 Not Modified cache)."""
    return _build_cached_file_response("translations.json", lambda: get_all_translations(use_cache=True), max_age=120)


@flower_connect_api.route("/admin/translations", methods=["PUT"])
@require_role(["super_admin", "branch_manager"])
def api_update_translations():
    """Cập nhật ma trận biên dịch động 5 ngôn ngữ."""
    payload = request.get_json(silent=True) or {}
    success, data, err = batch_update_translations(payload)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Cập nhật từ điển đa ngôn ngữ thành công", "data": data}), 200


@flower_connect_api.route("/admin/translations/<key>", methods=["DELETE"])
@require_role(["super_admin", "branch_manager"])
def api_delete_translation_key(key: str):
    """Xóa 1 khóa bản dịch tùy chỉnh (chặn tuyệt đối xóa khóa hệ thống)."""
    success, err = delete_translation_key(key)
    if not success:
        status_code = 403 if "hệ thống" in (err or "").lower() else 400
        return jsonify({"success": False, "message": err}), status_code
    return jsonify({"success": True, "message": f"Đã xóa khóa bản dịch '{key}' thành công!"}), 200


# ==========================================
# CÁC API QUẢN LÝ NHÂN SỰ & PHÂN QUYỀN (STAFF & USERS)
# ==========================================

@flower_connect_api.route("/admin/users", methods=["GET"])
@require_role(["super_admin", "branch_manager"])
def api_get_staff_users():
    """Lấy danh sách nhân sự (Super Admin thấy tất cả, Quản lý chỉ thấy chi nhánh mình)."""
    branch_filter = request.args.get("branchId")
    users = list_staff_users(request.current_user, branch_filter=branch_filter)
    return jsonify({"success": True, "data": users}), 200


@flower_connect_api.route("/admin/users", methods=["POST"])
@require_role(["super_admin", "branch_manager"])
def api_create_staff_user():
    """Thêm nhân sự mới (Quản lý chỉ được thêm thợ cắm hoa / tư vấn viên cho chi nhánh mình)."""
    payload = request.get_json(silent=True) or {}
    success, user_data, err = create_or_update_staff_user(request.current_user, payload)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Thêm nhân sự thành công", "data": user_data}), 201


@flower_connect_api.route("/admin/users/<user_id>", methods=["PUT"])
@require_role(["super_admin", "branch_manager"])
def api_update_staff_user(user_id):
    """Cập nhật thông tin nhân sự."""
    payload = request.get_json(silent=True) or {}
    success, user_data, err = create_or_update_staff_user(request.current_user, payload, target_user_id=user_id)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Cập nhật nhân sự thành công", "data": user_data}), 200


@flower_connect_api.route("/admin/users/<user_id>", methods=["DELETE"])
@require_role(["super_admin", "branch_manager"])
def api_delete_staff_user(user_id):
    """Xóa nhân sự."""
    success, err = delete_staff_user(request.current_user, user_id)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Xóa nhân sự thành công"}), 200


@flower_connect_api.route("/admin/customers", methods=["GET"])
@require_role(["super_admin", "branch_manager", "sales_consultant"])
def api_get_admin_customers():
    """Lấy danh sách khách hàng & dữ liệu CRM (tích điểm, tổng chi tiêu, hạng VIP)."""
    search = request.args.get("search")
    tier = request.args.get("tier")
    customers = list_crm_customers(search=search, tier=tier)
    return jsonify({"success": True, "data": customers}), 200



# ==========================================
# CÁC API QUẢN LÝ CHUỖI CỬA HÀNG (BRANCHES MANAGEMENT)
# ==========================================

@flower_connect_api.route("/branches", methods=["GET"])
def api_get_public_branches():
    """Lấy danh sách các chi nhánh đang mở cửa hoạt động (hỗ trợ HTTP ETag / 304 Not Modified cache)."""
    return _build_cached_file_response(
        "branches.json",
        lambda: [b for b in get_branches(use_cache=True) if b.get("isActive", True)],
        max_age=60
    )


@flower_connect_api.route("/admin/branches", methods=["GET"])
@require_role(["super_admin", "branch_manager"])
def api_get_admin_branches():
    """Lấy danh sách chi nhánh chuỗi cửa hàng."""
    current_user = request.current_user
    branches = get_branches(use_cache=False)
    if current_user.get("role") == "branch_manager":
        branches = [b for b in branches if b.get("id") == current_user.get("branchId")]
    return jsonify({"success": True, "data": branches}), 200


@flower_connect_api.route("/admin/branches", methods=["POST"])
@require_role(["super_admin"])
def api_create_branch():
    """Tạo chi nhánh mới trong chuỗi (Chỉ Super Admin)."""
    payload = request.get_json(silent=True) or {}
    success, new_branch, err = create_or_update_branch(payload)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Thêm chi nhánh thành công", "data": new_branch}), 201


@flower_connect_api.route("/admin/branches/<branch_id>", methods=["PUT"])
@require_role(["super_admin"])
def api_update_branch(branch_id):
    """Cập nhật thông tin chi nhánh (Chỉ Super Admin)."""
    payload = request.get_json(silent=True) or {}
    success, updated_branch, err = create_or_update_branch(payload, branch_id=branch_id)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Cập nhật chi nhánh thành công", "data": updated_branch}), 200


@flower_connect_api.route("/admin/branches/<branch_id>/toggle", methods=["PATCH", "PUT"])
@require_role(["super_admin"])
def api_toggle_branch(branch_id):
    """Bật / Tắt trạng thái hoạt động của chi nhánh (Chỉ Super Admin)."""
    success, branch_data, err = toggle_branch_active(branch_id)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Đã cập nhật trạng thái chi nhánh", "data": branch_data}), 200


# ==========================================
# CÁC API TRUY VẤN ĐƠN HÀNG THEO KHÁCH HÀNG (MY ORDERS)
# Đọc trực tiếp từ config/anne/users/{user_id}/orders.json
# ==========================================

@flower_connect_api.route("/user/orders", methods=["GET"])
@require_auth
def api_get_my_orders():
    """Lấy danh sách lịch sử đơn hàng của chính khách hàng đang đăng nhập."""
    current_user = request.current_user
    identifier = current_user.get("phone") or current_user.get("id") or current_user.get("email")
    if not identifier:
        return jsonify({"success": False, "message": "Không xác định được danh tính người dùng"}), 400

    orders = get_user_orders(identifier)
    return jsonify({
        "success": True,
        "data": orders,
        "total": len(orders)
    }), 200


@flower_connect_api.route("/customers/<user_identifier>/orders", methods=["GET"])
@require_role(["super_admin", "branch_manager"])
def api_get_customer_orders(user_identifier):
    """Lấy lịch sử toàn bộ đơn hàng của một khách hàng cụ thể (Dành cho Admin/CRM)."""
    orders = get_user_orders(user_identifier)
    return jsonify({
        "success": True,
        "data": orders,
        "total": len(orders)
    }), 200


# ==========================================
# CÁC API THÔNG TIN DOANH NGHIỆP (COMPANY INFO)
# ==========================================

@flower_connect_api.route("/company-info", methods=["GET"])
def api_get_public_company_info():
    """Lấy thông tin liên hệ và thương hiệu công ty hiển thị trên Storefront (hỗ trợ HTTP ETag & Cache-Control)."""
    return _build_cached_file_response("infoCompany.json", lambda: get_company_info(use_cache=True), max_age=120)


@flower_connect_api.route("/admin/company-info", methods=["GET"])
@require_role(["super_admin", "branch_manager"])
def api_get_admin_company_info():
    """Lấy đầy đủ thông tin cấu hình công ty dành cho Cổng Quản Trị."""
    info = get_company_info(use_cache=False)
    return jsonify({
        "success": True,
        "data": info
    }), 200


@flower_connect_api.route("/admin/company-info", methods=["PUT", "POST"])
@require_role(["super_admin"])
def api_update_admin_company_info():
    """Cập nhật thông tin liên hệ, thương hiệu, địa chỉ, hotline, giờ mở cửa của công ty."""
    data = request.get_json(silent=True) or {}
    success, updated_info, err = save_company_info(data)
    if not success:
        return jsonify({
            "success": False,
            "message": err or "Không thể lưu thông tin công ty"
        }), 400

    return jsonify({
        "success": True,
        "message": "Đã cập nhật thông tin doanh nghiệp thành công!",
        "data": updated_info
    }), 200


