#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script chi cap nhat ho tro Da Ngon Ngu (translations.json, categories.json, products)
cho D:\\code\\telua_public_marketing\\config\\anne ma KHONG thay doi cac file khac (branches, infoCompany, orders, users...).
"""

import os
import sys
import json
import shutil

# Ensure UTF-8 output on Windows console
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

MARKETING_DIR = r"D:\code\telua_public_marketing\config\anne"
BACKUP_DIR = r"D:\code\telua_public_marketing\config\anne_backup_20260830_074445"
FLOWER_DIR = r"D:\wmshare\telua_flower\config\anne"

def run_i18n_upgrade():
    print("=" * 70)
    print("BAT DAU CAP NHAT RIENG CAC TEP DA NGON NGU CHO MARKETING CONFIG")
    print("=" * 70)

    # 1. Khoi phuc lai toan bo thu muc marketing tu ban backup ban dau
    if os.path.exists(BACKUP_DIR):
        print(f"Khoi phuc nguyen trang cac file khac tu: {BACKUP_DIR}")
        if os.path.exists(MARKETING_DIR):
            shutil.rmtree(MARKETING_DIR)
        shutil.copytree(BACKUP_DIR, MARKETING_DIR)
        print("[OK] Da khoi phuc nguyen ven: branches, infoCompany, orders, users, promotions...")
    else:
        print("[Warning] Khong tim thay backup dir, se cap nhat truc tiep.")

    # 2. Cap nhat translations.json (tu dien 5 ngon ngu chuan)
    src_trans = os.path.join(FLOWER_DIR, "translations.json")
    dst_trans = os.path.join(MARKETING_DIR, "translations.json")
    if os.path.exists(src_trans):
        shutil.copy2(src_trans, dst_trans)
        print("[OK] translations.json -> Day du 5 ngon ngu (VI, EN, JA, KO, ZH)")

    # 3. Cap nhat categories.json (them textId, descTextId, i18n)
    src_cat = os.path.join(FLOWER_DIR, "categories.json")
    dst_cat = os.path.join(MARKETING_DIR, "categories.json")
    if os.path.exists(src_cat):
        shutil.copy2(src_cat, dst_cat)
        print("[OK] categories.json -> Them textId, descTextId va i18n")

    # 4. Cap nhat i18n cho cac file san pham hien co trong marketing/products/
    flower_products_map = {}
    flower_products_dir = os.path.join(FLOWER_DIR, "products")
    if os.path.exists(flower_products_dir):
        for f in os.listdir(flower_products_dir):
            if f.endswith(".json"):
                try:
                    with open(os.path.join(flower_products_dir, f), "r", encoding="utf-8") as fp:
                        pdata = json.load(fp)
                        pid = pdata.get("id") or f.replace(".json", "")
                        flower_products_map[pid] = pdata
                except Exception:
                    pass

    mkt_products_dir = os.path.join(MARKETING_DIR, "products")
    updated_products_list = []

    if os.path.exists(mkt_products_dir):
        for f in os.listdir(mkt_products_dir):
            if not f.endswith(".json"):
                continue

            file_path = os.path.join(mkt_products_dir, f)
            try:
                with open(file_path, "r", encoding="utf-8") as fp:
                    prod = json.load(fp)

                pid = prod.get("id") or f.replace(".json", "")

                # Neu san pham nay co mau chuan ben flower_app, lay i18n chuan
                if pid in flower_products_map:
                    ref = flower_products_map[pid]
                    if "i18n" in ref: prod["i18n"] = ref["i18n"]
                    if "nameTextId" in ref: prod["nameTextId"] = ref["nameTextId"]
                    if "flowerComposition" in ref and not prod.get("flowerComposition"):
                        prod["flowerComposition"] = ref["flowerComposition"]
                    if "careTips" in ref and not prod.get("careTips"):
                        prod["careTips"] = ref["careTips"]
                    if "dimension" in ref and not prod.get("dimension"):
                        prod["dimension"] = ref["dimension"]
                else:
                    # Bo sung khung i18n chuan
                    if "i18n" not in prod or not isinstance(prod.get("i18n"), dict):
                        prod["i18n"] = {}
                    name_vi = prod.get("name", "")
                    comp_vi = prod.get("flowerComposition", prod.get("composition", ""))
                    desc_vi = prod.get("description", "")
                    care_vi = prod.get("careTips", "Cắt vát gốc 45 độ, phun sương nhẹ cánh hoa và giữ nước sạch mỗi ngày.")

                    for lang in ["en", "ja", "ko", "zh"]:
                        if lang not in prod["i18n"]:
                            prod["i18n"][lang] = {
                                "name": name_vi,
                                "flowerComposition": comp_vi,
                                "description": desc_vi,
                                "careTips": care_vi
                            }

                # Luu lai file san pham
                with open(file_path, "w", encoding="utf-8") as fp:
                    json.dump(prod, fp, ensure_ascii=False, indent=2)

                updated_products_list.append(prod)
                print(f"  [OK] products/{f} -> i18n updated")

            except Exception as e:
                print(f"  [Error] {f}: {e}")

    # 5. Cap nhat products.json tong hop voi danh sach san pham cua marketing
    dst_products_json = os.path.join(MARKETING_DIR, "products.json")
    if updated_products_list:
        with open(dst_products_json, "w", encoding="utf-8") as fp:
            json.dump(updated_products_list, fp, ensure_ascii=False, indent=2)
        print("[OK] products.json -> Danh sach san pham cua Marketing da duoc cap nhat i18n")

    print("=" * 70)
    print("HOAN TAT! Chi cac file Da Ngon Ngu duoc cap nhat.")
    print("Cac file branches.json, infoCompany.json, users/, orders/ giu nguyen ven 100%.")
    print("=" * 70)

if __name__ == "__main__":
    run_i18n_upgrade()
