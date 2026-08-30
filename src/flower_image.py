"""
Module Quản Lý & Phục Vụ Hình Ảnh Hoa Tươi (Flower Image Service)
Chịu trách nhiệm:
1. Tìm kiếm và phục vụ file ảnh tĩnh cục bộ theo tiền tố /flower/images/... và /api/flower/v1/images/...
2. Tự động tải từ GitHub CDN (telua_public_marketing / telua_public_image) và lưu vào bộ nhớ đệm đĩa cứng.
3. Nhận tải lên (Upload) file ảnh nhị phân hoặc chuỗi Base64 từ Admin CMS và chuyển đổi thành file tĩnh WebP/JPG.
4. Gắn HTTP Cache Header (Cache-Control: public, max-age=604800, immutable) để trình duyệt nạp 0ms từ Disk Cache.
"""

import os
import sys
import time
import uuid
import base64
import logging
import urllib.request
from typing import Any, Optional, Tuple
from flask import send_file, make_response, abort, jsonify

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flower_config import (
    ROOT_DIR,
    FLOWER_CONFIG_DIR,
    PRODUCTS_DIR,
    PRODUCT_IMAGES_DIR,
    FLOWER_IMAGE_URL_PREFIX
)

logger = logging.getLogger("flower_image")

# Đảm bảo thư mục lưu ảnh tĩnh luôn tồn tại
os.makedirs(PRODUCT_IMAGES_DIR, exist_ok=True)


def find_flower_image_file(filename: str, auto_remote_fetch: bool = True) -> Optional[str]:
    """
    Tìm và tải file ảnh hoa tươi theo thứ tự ưu tiên:
    1. config/anne/images/<filename>
    2. config/anne/products/images/<filename>
    3. config/anne/images/products/<filename>
    4. d:/code/telua_public_marketing/config/anne/products/images/<filename>
    5. src/static/images/products/<filename>
    6. Nếu chưa có trên đĩa và auto_remote_fetch=True: Tự động nạp từ GitHub CDN và lưu vào config/anne/images.
    """
    if not filename or ".." in filename:
        return None

    # Tách basename nếu truyền kèm URL hoặc subpath
    clean_name = os.path.basename(filename)

    candidates = [
        os.path.join(FLOWER_CONFIG_DIR, "images", clean_name),
        os.path.join(FLOWER_CONFIG_DIR, "products", "images", clean_name),
        os.path.join(FLOWER_CONFIG_DIR, "images", "products", clean_name),
        os.path.join(PRODUCT_IMAGES_DIR, clean_name),
        os.path.join(r"d:\code\telua_public_marketing\config\anne\products\images", clean_name),
        os.path.join(r"d:\code\telua_public_marketing\images\products", clean_name),
        os.path.join(ROOT_DIR, "config", "anne", "images", clean_name),
        os.path.join(ROOT_DIR, "config", "anne", "products", "images", clean_name),
        os.path.join(ROOT_DIR, "src", "static", "images", "products", clean_name),
        os.path.join(ROOT_DIR, "src", "static", "images", clean_name)
    ]

    for path in candidates:
        abs_path = os.path.abspath(path)
        if os.path.isfile(abs_path):
            return abs_path

    # Tự động tải từ Remote GitHub và lưu vào cache tĩnh nếu chưa có
    if auto_remote_fetch:
        remote_sources = [
            f"https://raw.githubusercontent.com/letrthong/telua_public_marketing/main/config/anne/products/images/{clean_name}",
            f"https://raw.githubusercontent.com/letrthong/telua_public_image/main/anne/images/{clean_name}"
        ]
        target_save = os.path.join(FLOWER_CONFIG_DIR, "images", clean_name)
        for r_url in remote_sources:
            try:
                req = urllib.request.Request(r_url, headers={'User-Agent': 'FlowerConnect/1.0'})
                with urllib.request.urlopen(req, timeout=4) as resp:
                    if resp.status == 200:
                        content = resp.read()
                        os.makedirs(os.path.dirname(target_save), exist_ok=True)
                        with open(target_save, "wb") as f:
                            f.write(content)
                        # Đồng bộ sang config/anne/products/images nếu có
                        p_save = os.path.join(FLOWER_CONFIG_DIR, "products", "images", clean_name)
                        os.makedirs(os.path.dirname(p_save), exist_ok=True)
                        with open(p_save, "wb") as f:
                            f.write(content)
                        logger.info(f"Đã fetch và lưu ảnh từ GitHub CDN vào config/anne/images: {clean_name}")
                        return target_save
            except Exception:
                continue

    return None



def save_flower_uploaded_image(file_storage_or_data: Any, filename_prefix: str = "prod") -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Xử lý lưu file ảnh tĩnh tải lên từ Admin CMS (Chống phình to Base64 trong JSON):
    - Hỗ trợ cả Werkzeug FileStorage (Multipart Form) và chuỗi Base64.
    - Lưu file nhị phân vào thư mục tĩnh: src/static/images/products/<filename>.
    - Trả về đường dẫn tĩnh: /static/images/products/<filename> để lưu vào JSON.
    """
    if not file_storage_or_data:
        return False, None, "Dữ liệu tệp ảnh không được để trống"

    try:
        os.makedirs(PRODUCT_IMAGES_DIR, exist_ok=True)
        products_img_dir = os.path.join(FLOWER_CONFIG_DIR, "products", "images")
        os.makedirs(products_img_dir, exist_ok=True)
        unique_suffix = f"{int(time.time())}_{uuid.uuid4().hex[:8]}"

        # 1. Trường hợp chuỗi Base64 (data:image/...;base64,...)
        if isinstance(file_storage_or_data, str):
            data_str = file_storage_or_data.strip()
            ext = ".jpg"
            if data_str.startswith("data:image/"):
                header, b64_content = data_str.split(";base64,", 1)
                if "webp" in header: ext = ".webp"
                elif "png" in header: ext = ".png"
                elif "gif" in header: ext = ".gif"
                raw_bytes = base64.b64decode(b64_content)
            else:
                raw_bytes = base64.b64decode(data_str)

            filename = f"{filename_prefix}_{unique_suffix}{ext}"
            file_path = os.path.join(PRODUCT_IMAGES_DIR, filename)
            with open(file_path, "wb") as f:
                f.write(raw_bytes)

            # Đồng bộ sang config/anne/products/images
            p_path = os.path.join(products_img_dir, filename)
            with open(p_path, "wb") as f:
                f.write(raw_bytes)

            relative_url = f"{FLOWER_IMAGE_URL_PREFIX}/{filename}"
            return True, relative_url, None

        # 2. Trường hợp Werkzeug FileStorage (Multipart Upload)
        if hasattr(file_storage_or_data, "filename") and hasattr(file_storage_or_data, "save"):
            orig_name = file_storage_or_data.filename or "image.jpg"
            ext = os.path.splitext(orig_name)[1].lower()
            if not ext or ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]:
                ext = ".jpg"

            filename = f"{filename_prefix}_{unique_suffix}{ext}"
            file_path = os.path.join(PRODUCT_IMAGES_DIR, filename)
            file_storage_or_data.save(file_path)

            # Đồng bộ sang config/anne/products/images
            try:
                import shutil
                shutil.copy2(file_path, os.path.join(products_img_dir, filename))
            except Exception:
                pass

            relative_url = f"{FLOWER_IMAGE_URL_PREFIX}/{filename}"
            return True, relative_url, None

        # 3. Trường hợp bytes thô
        if isinstance(file_storage_or_data, (bytes, bytearray)):
            filename = f"{filename_prefix}_{unique_suffix}.jpg"
            file_path = os.path.join(PRODUCT_IMAGES_DIR, filename)
            with open(file_path, "wb") as f:
                f.write(file_storage_or_data)

            p_path = os.path.join(products_img_dir, filename)
            with open(p_path, "wb") as f:
                f.write(file_storage_or_data)

            relative_url = f"{FLOWER_IMAGE_URL_PREFIX}/{filename}"
            return True, relative_url, None



        return False, None, f"Kiểu dữ liệu tệp ảnh không được hỗ trợ: {type(file_storage_or_data)}"

    except Exception as e:
        logger.error(f"[IMAGE_UPLOAD_ERROR] Lỗi khi lưu ảnh sản phẩm: {e}")
        return False, None, f"Lỗi máy chủ khi lưu ảnh: {str(e)}"


def create_flower_image_response(filename: str, max_age: int = 604800):
    """
    Sinh HTTP Response gửi file ảnh kèm Cache-Control Header.
    """
    file_path = find_flower_image_file(filename)
    if not file_path:
        return jsonify({"success": False, "message": f"Không tìm thấy tệp ảnh: {filename}"}), 404

    resp = make_response(send_file(file_path))
    resp.headers["Cache-Control"] = f"public, max-age={max_age}, immutable"
    return resp
