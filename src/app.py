import os
import sys
import logging
from flask import Flask, request, jsonify, send_file, abort
from flask_cors import cross_origin

# Cấu hình logging
logging.basicConfig(level=logging.INFO)
sys.stdout.reconfigure(line_buffering=True)

# Xác định thư mục gốc của telua_flower (hỗ trợ cả Windows và Docker /app)
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
TELUA_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))

if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from services.auth_service import authenticate_user, register_customer, verify_jwt_token
from services.data_service import get_user_by_id, get_order_by_id, read_orders_by_month, get_price_levels
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

app = Flask(__name__, template_folder=TELUA_ROOT)


def get_index_file():
    """
    Tìm file index.html theo thứ tự ưu tiên:
    1. index.html (file html cập nhật trực tiếp tại thư mục dự án)
    2. dist/index.html (file frontend đã build qua Vite)
    3. config/index.html (file html dự phòng)
    4. Docker paths (/app/index.html, /app/dist/index.html)
    """
    candidates = [
        os.path.join(TELUA_ROOT, "index.html"),
        os.path.join(TELUA_ROOT, "dist", "index.html"),
        os.path.join(TELUA_ROOT, "config", "index.html"),
        "/app/index.html",
        "/app/dist/index.html",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def resolve_static_file(relative_path):
    """
    Tìm file tài nguyên tĩnh trong các thư mục của telua_flower
    (dist, js, config, static hoặc thư mục gốc)
    """
    subdirs = ["", "dist", "js", "config", "src/static"]
    for sub in subdirs:
        full_path = os.path.abspath(os.path.join(TELUA_ROOT, sub, relative_path))
        if os.path.isfile(full_path):
            return full_path
    return None


# ==========================================
# CÁC API ENDPOINTS XÁC THỰC (AUTHENTICATION)
# ==========================================

@app.route("/api/auth/login", methods=["POST"])
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


@app.route("/api/auth/register", methods=["POST"])
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


@app.route("/api/auth/me", methods=["GET"])
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


@app.route("/api/auth/logout", methods=["POST"])
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

@app.route("/api/delivery/slots", methods=["GET"])
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


@app.route("/api/orders", methods=["POST"])
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


@app.route("/api/orders/<order_id>", methods=["GET"])
@cross_origin()
def api_get_order(order_id):
    """
    Tra cứu chi tiết đơn hàng theo ID.
    """
    order = get_order_by_id(order_id)
    if not order:
        return jsonify({"success": False, "message": "Không tìm thấy đơn hàng"}), 404

    return jsonify({
        "success": True,
        "data": order
    }), 200


@app.route("/api/orders/my-orders", methods=["GET"])
@cross_origin()
@require_auth
def api_my_orders():
    """
    Lấy danh sách đơn hàng của khách hàng hiện tại.
    """
    current_user = request.current_user
    user_id = current_user.get("userId")
    user_phone = current_user.get("phone")

    # Đọc đơn hàng tháng hiện tại
    all_orders = read_orders_by_month()
    my_orders = [
        o for o in all_orders
        if (o.get("customerId") == user_id) or (o.get("sender", {}).get("phone") == user_phone)
    ]

    return jsonify({
        "success": True,
        "data": my_orders
    }), 200


@app.route("/api/branch/<branch_id>/orders", methods=["GET"])
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

@app.route("/api/price-levels", methods=["GET"])
@cross_origin()
def api_get_price_levels():
    """Lấy danh sách 4 phân tầng giá chuẩn kèm hạn mức min/max."""
    levels = get_price_levels()
    return jsonify({"success": True, "data": levels}), 200


@app.route("/api/products", methods=["GET"])
@cross_origin()
def api_get_products():
    """Lấy danh sách sản phẩm hoa tươi (hỗ trợ lọc theo category, search, active)."""
    category = request.args.get("category")
    search = request.args.get("search")
    is_active_param = request.args.get("active")
    is_active = True if is_active_param == "true" else (False if is_active_param == "false" else None)

    prods = list_products(category=category, search=search, is_active=is_active)
    return jsonify({"success": True, "data": prods}), 200


@app.route("/api/admin/products", methods=["POST"])
@cross_origin()
@require_role(["super_admin", "branch_manager"])
def api_create_product():
    """Thêm mẫu hoa mới vào Catalogue (có kiểm tra hàng rào giá an toàn)."""
    payload = request.get_json(silent=True) or {}
    success, new_prod, err_msg = create_or_update_product(payload)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    return jsonify({"success": True, "message": "Thêm mẫu hoa thành công", "data": new_prod}), 201


@app.route("/api/admin/products/<product_id>", methods=["PUT"])
@cross_origin()
@require_role(["super_admin", "branch_manager"])
def api_update_product(product_id):
    """Cập nhật thông tin và giá bán mẫu hoa."""
    payload = request.get_json(silent=True) or {}
    success, updated_prod, err_msg = create_or_update_product(payload, product_id=product_id)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    return jsonify({"success": True, "message": "Cập nhật sản phẩm thành công", "data": updated_prod}), 200


@app.route("/api/admin/products/<product_id>/toggle", methods=["PUT"])
@cross_origin()
@require_role(["super_admin", "branch_manager"])
def api_toggle_product(product_id):
    """Ẩn / Hiện mẫu hoa trên website."""
    success, updated_prod, err_msg = toggle_product_active(product_id)
    if not success:
        return jsonify({"success": False, "message": err_msg}), 400
    return jsonify({"success": True, "message": "Đã đổi trạng thái sản phẩm", "data": updated_prod}), 200


@app.route("/api/admin/products/<product_id>", methods=["DELETE"])
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

@app.route("/api/promotions", methods=["GET"])
@cross_origin()
def api_get_promotions():
    """Lấy danh sách tất cả khuyến mãi & voucher."""
    promos = list_all_promotions()
    return jsonify({"success": True, "data": promos}), 200


@app.route("/api/admin/promotions", methods=["POST"])
@cross_origin()
@require_role(["super_admin", "branch_manager"])
def api_create_promotion():
    """Tạo mới voucher khuyến mãi."""
    payload = request.get_json(silent=True) or {}
    success, new_promo, err = create_or_update_promotion(payload)
    if not success:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "message": "Tạo voucher thành công", "data": new_promo}), 201


@app.route("/api/admin/promotions/<promo_id>/toggle", methods=["PUT"])
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

@app.route("/api/translations", methods=["GET"])
@cross_origin()
def api_get_translations():
    """Lấy từ điển đa ngôn ngữ 5 thứ tiếng."""
    data = get_all_translations()
    return jsonify({"success": True, "data": data}), 200


@app.route("/api/admin/translations", methods=["PUT"])
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
# PHỤC VỤ STATIC FILES & TRANG CHỦ
# ==========================================

@app.route("/")
@app.route("/index.html")
@cross_origin()
def index():
    """Phục vụ file index.html cho trang chủ"""
    index_path = get_index_file()
    if index_path:
        return send_file(index_path)
    abort(404, description="index.html not found")


@app.route("/<path:filename>")
@cross_origin()
def static_files(filename):
    """Phục vụ các file tĩnh (js, css, json, hình ảnh...) và các trang html con"""
    file_path = resolve_static_file(filename)
    if file_path:
        return send_file(file_path)

    # Nếu không có đuôi mở rộng, kiểm tra xem có file .html tương ứng không
    if "." not in filename:
        html_file = resolve_static_file(f"{filename}.html")
        if html_file:
            return send_file(html_file)

    abort(404, description=f"File not found: {filename}")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, threaded=True)
