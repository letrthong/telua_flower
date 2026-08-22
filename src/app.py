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

from services.auth_service import authenticate_user, register_customer
from services.data_service import get_user_by_id
from decorators.auth_decorator import require_auth, require_role

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
