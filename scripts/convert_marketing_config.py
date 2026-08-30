#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script chuyển đổi & đồng bộ dữ liệu cấu hình Đa Ngôn Ngữ từ telua_flower sang telua_public_marketing.
- Nguồn mới: D:\\wmshare\\telua_flower\\config\\anne
- Đích cập nhật: D:\\code\\telua_public_marketing\\config\\anne
"""

import os
import sys
import json
import shutil
from datetime import datetime

SOURCE_DIR = r"D:\wmshare\telua_flower\config\anne"
TARGET_DIR = r"D:\code\telua_public_marketing\config\anne"

def ensure_i18n_product(prod_data):
    """Bổ sung cấu trúc i18n chuẩn cho sản phẩm nếu chưa có"""
    if "i18n" not in prod_data or not isinstance(prod_data.get("i18n"), dict):
        prod_data["i18n"] = {}

    name_vi = prod_data.get("name", "")
    comp_vi = prod_data.get("flowerComposition", prod_data.get("composition", ""))
    desc_vi = prod_data.get("description", "")
    care_vi = prod_data.get("careTips", "")

    for lang, default_suffix in [("en", " (EN)"), ("ja", " (JA)"), ("ko", " (KO)"), ("zh", " (ZH)")]:
        if lang not in prod_data["i18n"] or not isinstance(prod_data["i18n"][lang], dict):
            prod_data["i18n"][lang] = {
                "name": name_vi if name_vi else "",
                "flowerComposition": comp_vi if comp_vi else "",
                "description": desc_vi if desc_vi else "",
                "careTips": care_vi if care_vi else ""
            }
        else:
            lang_obj = prod_data["i18n"][lang]
            if "name" not in lang_obj: lang_obj["name"] = name_vi
            if "flowerComposition" not in lang_obj: lang_obj["flowerComposition"] = comp_vi
            if "description" not in lang_obj: lang_obj["description"] = desc_vi
            if "careTips" not in lang_obj: lang_obj["careTips"] = care_vi

    return prod_data

def ensure_i18n_category(cat_data):
    """Bổ sung cấu trúc i18n chuẩn cho danh mục nếu chưa có"""
    if "i18n" not in cat_data or not isinstance(cat_data.get("i18n"), dict):
        cat_data["i18n"] = {}

    name_vi = cat_data.get("name", "")
    desc_vi = cat_data.get("description", "")

    for lang in ["en", "ja", "ko", "zh"]:
        if lang not in cat_data["i18n"] or not isinstance(cat_data["i18n"][lang], dict):
            cat_data["i18n"][lang] = {
                "name": name_vi,
                "description": desc_vi
            }
        else:
            lang_obj = cat_data["i18n"][lang]
            if "name" not in lang_obj: lang_obj["name"] = name_vi
            if "description" not in lang_obj: lang_obj["description"] = desc_vi

    return cat_data

def convert_and_sync(source_dir=SOURCE_DIR, target_dir=TARGET_DIR):
    print("=" * 70)
    print(f"🚀 BẮT ĐẦU CHUYỂN ĐỔI CẤU TRÚC ĐA NGÔN NGỮ CHO CONFIG ANNE")
    print(f"📂 Nguồn chuẩn: {source_dir}")
    print(f"📂 Thư mục đích: {target_dir}")
    print("=" * 70)

    if not os.path.exists(source_dir):
        print(f"❌ Lỗi: Thư mục nguồn {source_dir} không tồn tại!")
        return False

    # 1. Sao lưu dữ liệu cũ nếu thư mục đích tồn tại
    if os.path.exists(target_dir):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = f"{target_dir}_backup_{timestamp}"
        print(f"📦 Đang tạo bản sao lưu tại: {backup_dir} ...")
        try:
            shutil.copytree(target_dir, backup_dir)
            print("✅ Đã sao lưu thành công!")
        except Exception as e:
            print(f"⚠️ Cảnh báo sao lưu: {e}")
    else:
        os.makedirs(target_dir, exist_ok=True)

    # 2. Đồng bộ các tệp JSON gốc & thư mục con từ Source sang Target
    for root, dirs, files in os.walk(source_dir):
        rel_path = os.path.relpath(root, source_dir)
        dest_root = os.path.join(target_dir, rel_path) if rel_path != "." else target_dir
        os.makedirs(dest_root, exist_ok=True)

        for file in files:
            if not file.endswith(".json"):
                continue

            src_file = os.path.join(root, file)
            dest_file = os.path.join(dest_root, file)

            try:
                with open(src_file, "r", encoding="utf-8") as f:
                    data = json.load(f)

                # Format theo cấu trúc chuyên biệt nếu là product hoặc category
                if file == "categories.json" and isinstance(data, list):
                    data = [ensure_i18n_category(c) for c in data]
                elif file == "products.json" and isinstance(data, list):
                    data = [ensure_i18n_product(p) for p in data]
                elif rel_path == "products" and isinstance(data, dict):
                    data = ensure_i18n_product(data)

                with open(dest_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)

                print(f"  ✨ Đã đồng bộ & chuẩn hóa: {os.path.join(rel_path, file)}")

            except Exception as e:
                print(f"  ❌ Lỗi khi xử lý {file}: {e}")
                # Fallback: Copy trực tiếp nếu parse JSON lỗi
                shutil.copy2(src_file, dest_file)

    print("=" * 70)
    print("🎉 HOÀN TẤT CHUYỂN ĐỔI! Toàn bộ cấu trúc Đa Ngôn Ngữ đã được cập nhật.")
    print(f"📌 Đích: {target_dir}")
    print("=" * 70)
    return True

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else SOURCE_DIR
    dst = sys.argv[2] if len(sys.argv) > 2 else TARGET_DIR
    convert_and_sync(src, dst)
