from operator import index
import os
import json
from json_utils import read_json_file, write_json_file
from hotel_schema_service import read_schema, write_schema, create_schema_item, update_schema_item, delete_schema_item
import logging
import sys
import threading
from flask import Flask, render_template, jsonify, request, abort, send_from_directory
from flask_cors import cross_origin
import uuid
from math import radians, sin, cos, sqrt, atan2
from geo_utils import haversine
from datetime import datetime, timezone

# Import all constants from hotel_constants.py
from hotel_constants import HOTEL_CONFIG_DIR as CONFIG_DIR, HotelField, HotelStatus
from hotel_helpers import get_hotel_file_path, read_requests, write_requests, read_reports, write_reports, validate_hotel_request, update_status

# Cấu hình logging hiển thị ra terminal
logging.basicConfig(level=logging.INFO)
sys.stdout.reconfigure(line_buffering=True)

app = Flask(__name__, template_folder='/app')

# Đảm bảo đường dẫn này đúng với cấu trúc thư mục của bạn
template_dir = "/app/"
template_dir_base = "./"
os.makedirs(CONFIG_DIR, exist_ok=True)

# --- API Quản lý hotel_schema.json ---
# Import and register the RESTful blueprint
from restful_blueprint_hotel_connect import hotel_connect_api
app.register_blueprint(hotel_connect_api)


@app.route('/luquan/')
@app.route('/')
@app.route('/luquan/<path:page_name>')
@cross_origin()
def hotel_connect_resource_sub(page_name=None):
    # 1. Xử lý mặc định cho index (ưu tiên file đã build trong dist)
    if not page_name or page_name.strip() == "/":
        dist_index_path = os.path.join(template_dir, "dist", "index.html")
        if os.path.exists(dist_index_path):
            return send_from_directory(os.path.join(template_dir, "dist"), "index.html")
        
        # Fallback cross-platform cho chạy cục bộ ngoài Docker (Windows)
        local_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))
        local_index = os.path.join(local_dist, "index.html")
        if os.path.exists(local_index):
            return send_from_directory(local_dist, "index.html")
            
        return render_template("index.html")

    # Đường dẫn gốc tới thư mục hotel_connect
    directory = os.path.join(template_dir, "")

    try:
        # 2. Xử lý các file tài nguyên tĩnh (js, json, css, png, v.v.)
        static_extensions = ('.js', '.json', '.css', '.png', '.jpg', '.svg', '.ico')

        # Kiểm tra xem page_name có kết thúc bằng đuôi file tĩnh không
        if any(page_name.endswith(ext) for ext in static_extensions):
            return send_from_directory(directory, page_name)

        # 3. Xử lý các route điều hướng (không có dấu chấm - giả định là page .html)
        if '.' not in page_name:
            return render_template(f"{page_name}.html")

        # 4. Nếu có đuôi file khác (như .html cụ thể)
        return render_template(f"{page_name}")

    except Exception as e:
        print(f"Lỗi truy cập file: {page_name} - Error: {e}")
        abort(404)

if __name__ == "__main__":
    # Khởi tạo geohash index cho nearby search
    from restful_blueprint_hotel_connect import init_geohash_index
    init_geohash_index()
    
    # Tắt debug để tránh Werkzeug Reloader quét file liên tục gây tràn RAM
    app.run(host="0.0.0.0", port=5000, threaded=True)
