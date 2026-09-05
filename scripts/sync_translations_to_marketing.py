#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script đồng bộ textID và từ điển đa ngôn ngữ (5 ngôn ngữ)
từ D:\\wmshare\\telua_flower\\config\\anne\\translations.json
sang D:\\code\\telua_public_marketing\\config\\anne\\translations.json
"""

import os
import sys
import json
import shutil
from datetime import datetime

# Đảm bảo in UTF-8 không bị lỗi trên Windows PowerShell cp1252
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

SOURCE_FILE = r"D:\wmshare\telua_flower\config\anne\translations.json"
TARGET_DIR = r"D:\code\telua_public_marketing\config\anne"
TARGET_FILE = os.path.join(TARGET_DIR, "translations.json")

def sync_translations():
    print("=" * 70)
    print("BAT DAU DONG BO TEXT_ID VA BAN DICH CHO TELUA_PUBLIC_MARKETING")
    print(f"Nguon: {SOURCE_FILE}")
    print(f"Dich : {TARGET_FILE}")
    print("=" * 70)

    if not os.path.exists(SOURCE_FILE):
        print(f"Loi: Khong tim thay file nguon: {SOURCE_FILE}")
        return False

    with open(SOURCE_FILE, "r", encoding="utf-8") as f:
        source_data = json.load(f)

    source_translations = source_data.get("translations", {})
    print(f"Da doc {len(source_translations)} textID tu file nguon.")

    # Đảm bảo thư mục đích tồn tại
    os.makedirs(TARGET_DIR, exist_ok=True)

    target_data = {"version": "1.0.0", "languages": ["vi", "en", "ja", "ko", "zh"], "translations": {}}
    target_translations = {}

    if os.path.exists(TARGET_FILE):
        # Tạo bản sao lưu trước khi ghi đè / merge
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = os.path.join(TARGET_DIR, f"translations_backup_{timestamp}.json")
        try:
            shutil.copy2(TARGET_FILE, backup_file)
            print(f"Da tao ban sao luu: {backup_file}")
        except Exception as e:
            print(f"Canh bao khi tao ban sao luu: {e}")

        try:
            with open(TARGET_FILE, "r", encoding="utf-8") as f:
                target_data = json.load(f)
                target_translations = target_data.get("translations", {})
                print(f"Da doc {len(target_translations)} textID hien co tai dich.")
        except Exception as e:
            print(f"Canh bao khi doc file dich: {e}. Se dung ban tu nguon.")
            target_translations = {}

    # Merge: giữ các textID hiện có ở target (nếu có riêng), và cập nhật/bổ sung toàn bộ textID từ source
    added_count = 0
    updated_count = 0
    for key, val in source_translations.items():
        if key not in target_translations:
            target_translations[key] = val
            added_count += 1
        else:
            target_translations[key] = val
            updated_count += 1

    target_data["translations"] = target_translations
    if "languages" not in target_data or len(target_data.get("languages", [])) < 5:
        target_data["languages"] = ["vi", "en", "ja", "ko", "zh"]
    if "version" not in target_data:
        target_data["version"] = source_data.get("version", "1.0.0")

    with open(TARGET_FILE, "w", encoding="utf-8") as f:
        json.dump(target_data, f, ensure_ascii=False, indent=2)

    print("Dong bo thanh cong!")
    print(f"- TextID moi them vao: {added_count}")
    print(f"- TextID cap nhat: {updated_count}")
    print(f"- Tong so TextID tai dich: {len(target_translations)}")
    print("=" * 70)
    return True

if __name__ == "__main__":
    sync_translations()
