import os
import sys
import logging
from flask import Flask, send_file, abort
from flask_cors import cross_origin

# Cấu hình logging
logging.basicConfig(level=logging.INFO)
sys.stdout.reconfigure(line_buffering=True)

# Xác định thư mục gốc của telua_flower (hỗ trợ cả Windows và Docker /app)
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
TELUA_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))

app = Flask(__name__, template_folder=TELUA_ROOT)


def get_index_file():
    """
    Tìm file index.html theo thứ tự ưu tiên:
    1. dist/index.html (file frontend đã build qua Vite)
    2. index.html (file html gốc tại thư mục dự án)
    3. config/index.html (file html dự phòng)
    4. Docker paths (/app/dist/index.html, /app/index.html)
    """
    candidates = [
        os.path.join(TELUA_ROOT, "dist", "index.html"),
        os.path.join(TELUA_ROOT, "index.html"),
        os.path.join(TELUA_ROOT, "config", "index.html"),
        "/app/dist/index.html",
        "/app/index.html",
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
