import os
import sys
import logging
from flask import Flask, send_file, abort, jsonify
from flask_cors import cross_origin

# Cấu hình logging
logging.basicConfig(level=logging.INFO)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
TELUA_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))

if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

# Khởi tạo Flask Application
app = Flask(__name__, template_folder=TELUA_ROOT)

# --- Register RESTful Blueprint (Kiến trúc tương tự Lu Quan /api/flower/v1 & tương thích ngược /api) ---
from restful_blueprint_flower_connect import flower_connect_api
app.register_blueprint(flower_connect_api)  # /api/flower/v1/*
app.register_blueprint(flower_connect_api, name='flower_connect_api_legacy', url_prefix='/api')  # /api/*


def get_index_file():
    """
    Tìm file index.html theo thứ tự ưu tiên:
    1. index.html (file HTML nguồn đang phát triển trực tiếp cùng các file modular js/)
    2. /app/index.html
    3. dist/index.html (file bundle)
    4. /app/dist/index.html
    5. config/index.html (file bundle dự phòng)
    """
    candidates = [
        os.path.join(TELUA_ROOT, "index.html"),
        "/app/index.html",
        os.path.join(TELUA_ROOT, "dist", "index.html"),
        "/app/dist/index.html",
        os.path.join(TELUA_ROOT, "config", "index.html"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def resolve_static_file(relative_path):
    """
    Tìm file tài nguyên tĩnh trong các thư mục của telua_flower
    (dist, js, config, static, images hoặc thư mục gốc)
    """
    subdirs = [
        "",
        "dist",
        "js",
        "config",
        "src/static",
        "src/static/images/products",
        "config/anne/products/images",
        "config/anne/images",
        "images",
        "images/products"
    ]
    for sub in subdirs:
        full_path = os.path.abspath(os.path.join(TELUA_ROOT, sub, relative_path))
        if os.path.isfile(full_path):
            return full_path
    return None



# ==========================================
# PHỤC VỤ STATIC FILES & TRANG CHỦ SPA
# ==========================================

@app.route("/")
@app.route("/index.html")
@app.route("/search")
@app.route("/portal")
@app.route("/portal/<path:subpath>")
@cross_origin()
def index(subpath=None):
    """Phục vụ file index.html cho trang chủ và các route SPA (/portal/admin...)"""
    index_path = get_index_file()
    if index_path:
        return send_file(index_path)
    abort(404, description="index.html not found")


@app.route("/favicon.ico")
@cross_origin()
def favicon():
    """Phục vụ favicon hoặc trả về icon SVG hoa tươi."""
    file_path = resolve_static_file("favicon.ico")
    if file_path:
        return send_file(file_path)
    svg_favicon = """<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌸</text></svg>"""
    return svg_favicon, 200, {"Content-Type": "image/svg+xml"}

 


@app.route("/<path:filename>")
@cross_origin()
def static_files(filename):
    """Phục vụ các file tĩnh (js, css, json, hình ảnh...) và fallback SPA"""
    # Nếu là đường dẫn API không khớp route nào, trả về JSON 404 thay vì fallback index.html
    if filename.startswith("api/") or filename.startswith("api"):
        return jsonify({"success": False, "message": f"API endpoint không tồn tại: /{filename}"}), 404

    file_path = resolve_static_file(filename)
    if file_path:
        return send_file(file_path)

    # Nếu không có đuôi mở rộng, kiểm tra xem có file .html tương ứng không
    if "." not in filename:
        html_file = resolve_static_file(f"{filename}.html")
        if html_file:
            return send_file(html_file)
        # Fallback SPA về index.html
        index_path = get_index_file()
        if index_path:
            return send_file(index_path)

    abort(404, description=f"File not found: {filename}")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, threaded=True)
