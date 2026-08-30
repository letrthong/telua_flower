import os
import sys
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_service import (
    get_products,
    save_products,
    get_product_by_id,
    save_product_detail,
    get_product_detail_path,
    get_price_levels,
    get_price_level_by_id,
    get_branches,
    get_categories
)
from flower_image import save_flower_uploaded_image

DEFAULT_VALID_CATEGORIES = ["bo_hoa", "ke_hoa", "binh_hoa", "gio_hoa", "lan_ho_diep", "hoa_cuoi"]


def _sanitize_product_image_field(img_val: Any, prefix: str = "prod") -> str:
    """Tự động chuyển đổi chuỗi Base64 thành file tĩnh nếu nhận được từ Client/Form."""
    if not img_val or not isinstance(img_val, str):
        return f"/flower/images/{prefix}.webp"
    
    if img_val.startswith("data:image/") or ";base64," in img_val:
        success, relative_url, err = save_flower_uploaded_image(img_val, filename_prefix=prefix)
        if success and relative_url:
            return relative_url
            
    return img_val



def get_valid_category_ids() -> List[str]:
    """
    Lấy danh sách mã danh mục hợp lệ động từ categories.json.
    """
    try:
        cats = get_categories(use_cache=False, include_deleted=False)
        cat_ids = [c.get("id") for c in cats if isinstance(c, dict) and c.get("id")]
        if cat_ids:
            return cat_ids
    except Exception:
        pass
    return DEFAULT_VALID_CATEGORIES


def validate_product_price_governance(price_level_id: str, price_number: int) -> Tuple[bool, Optional[str]]:
    """
    HÀNG RÀO KIỂM SOÁT GIÁ AN TOÀN (PRICE GUARDRAILS):
    Ngăn chặn nhân viên bán phá giá hoặc gõ nhầm số 0.
    Giá bán bắt buộc phải nằm trong khoảng [minPrice, maxPrice] của phân tầng tương ứng.
    """
    price_level = get_price_level_by_id(price_level_id)
    if not price_level:
        return False, f"Phân tầng mức giá '{price_level_id}' không tồn tại trong hệ thống."

    min_p = int(price_level.get("minPrice", 0))
    max_p = int(price_level.get("maxPrice", 999999999))
    lvl_name = price_level.get("name", price_level_id)

    if price_number < min_p:
        return False, (
            f"❌ GIÁ QUÁ THẤP: Mức giá {price_number:,.0f}₫ thấp hơn giá sàn quy định "
            f"cho tầng '{lvl_name}' (Tối thiểu: {min_p:,.0f}₫)."
        )

    if price_number > max_p:
        return False, (
            f"❌ GIÁ QUÁ CAO: Mức giá {price_number:,.0f}₫ vượt quá giá trần quy định "
            f"cho tầng '{lvl_name}' (Tối đa: {max_p:,.0f}₫)."
        )

    return True, None


import unicodedata


def remove_vietnamese_accents(text: str) -> str:
    """
    Chuẩn hóa chuỗi tiếng Việt: loại bỏ dấu thanh, dấu mũ, chuyển đ/Đ -> d, chuyển về chữ thường.
    Hỗ trợ tìm kiếm không dấu (vd: 'hoa hong' khớp 'Hoa hồng').
    """
    if not text:
        return ""
    text = str(text).replace("đ", "d").replace("Đ", "d")
    nfkd = unicodedata.normalize("NFD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


def list_products(
    category: Optional[str] = None,
    search: Optional[str] = None,
    price_level_id: Optional[str] = None,
    is_active: Optional[bool] = None
) -> List[Dict[str, Any]]:
    """
    Lấy danh sách sản phẩm có bộ lọc theo danh mục, từ khóa tìm kiếm (hỗ trợ tiếng Việt không dấu) và trạng thái.
    """
    products = get_products()

    if is_active is True:
        active_cats = {c.get("id") for c in get_categories(use_cache=False, active_only=True)}
        products = [p for p in products if p.get("isActive", True) and p.get("category") in active_cats]
    elif is_active is False:
        products = [p for p in products if not p.get("isActive", True)]

    if category:
        products = [p for p in products if p.get("category") == category]

    if price_level_id:
        products = [p for p in products if p.get("priceLevelId") == price_level_id]

    if search:
        s_norm = remove_vietnamese_accents(search.strip())
        s_lower = search.strip().lower()
        matched = []
        for p in products:
            p_name = p.get("name") or ""
            p_id = (p.get("id") or "").lower()
            p_comp = p.get("flowerComposition") or ""
            p_desc = p.get("description") or ""

            p_name_norm = remove_vietnamese_accents(p_name)
            p_comp_norm = remove_vietnamese_accents(p_comp)
            p_desc_norm = remove_vietnamese_accents(p_desc)

            if (s_norm in p_name_norm or s_norm in p_id or s_lower in p_id or 
                (p_comp_norm and s_norm in p_comp_norm) or 
                (p_desc_norm and s_norm in p_desc_norm)):
                matched.append(p)
            else:
                # Kiểm tra thêm trong file chi tiết nếu cần tìm theo thành phần / mô tả hoa
                detail = get_product_by_id(p.get("id"))
                if detail:
                    d_comp = detail.get("flowerComposition") or ""
                    d_desc = detail.get("description") or ""
                    d_comp_norm = remove_vietnamese_accents(d_comp)
                    d_desc_norm = remove_vietnamese_accents(d_desc)
                    if s_norm in d_comp_norm or s_norm in d_desc_norm:
                        matched.append(p)
        products = matched

    return products


def create_or_update_product(
    product_data: Dict[str, Any],
    product_id: Optional[str] = None
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Thêm mới hoặc cập nhật thông tin sản phẩm vào danh mục Catalogue.
    Áp dụng kiểm tra Hàng rào giá (Price Guardrail) nghiêm ngặt.
    """
    if not product_data or not isinstance(product_data, dict):
        return False, None, "Dữ liệu sản phẩm không hợp lệ"

    name = (product_data.get("name") or "").strip()
    category = product_data.get("category") or "bo_hoa"
    price_level_id = product_data.get("priceLevelId") or "price_lvl_01"
    
    try:
        price_number = int(product_data.get("priceNumber") or 0)
    except (ValueError, TypeError):
        return False, None, "Giá bán sản phẩm phải là số nguyên hợp lệ"

    if not name:
        return False, None, "Vui lòng nhập tên sản phẩm hoa tươi"

    valid_categories = get_valid_category_ids()
    if category not in valid_categories:
        return False, None, f"Danh mục '{category}' không hợp lệ. Danh mục hiện có: {', '.join(valid_categories)}"

    # 1. Kiểm tra hàng rào giá an toàn
    is_price_valid, price_err = validate_product_price_governance(price_level_id, price_number)
    if not is_price_valid:
        return False, None, price_err

    # 2. Chuẩn bị định dạng giá hiển thị
    formatted_sale_price = f"{price_number:,}₫"
    original_price_num = int(product_data.get("originalPriceNumber") or price_number)
    formatted_orig_price = f"{original_price_num:,}₫"

    # 3. Phân bổ tồn kho theo từng chi nhánh
    stock_by_branch = product_data.get("stockByBranch") or {
        "branch_q10": 10,
        "branch_q1": 5,
        "branch_thao_dien": 5
    }

    products = get_products()
    now_iso = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")

    if product_id:
        # Cập nhật sản phẩm đã có
        existing_index = next((i for i, p in enumerate(products) if p.get("id") == product_id), -1)
        if existing_index == -1:
            return False, None, f"Không tìm thấy sản phẩm với mã '{product_id}'"

        old_detail = get_product_by_id(product_id) or {}
        
        name_text_id = product_data.get("nameTextId") or product_data.get("textId") or old_detail.get("nameTextId", "")
        comp_text_id = product_data.get("compTextId") or product_data.get("compositionTextId") or old_detail.get("compTextId", "")
        desc_text_id = product_data.get("descTextId") or product_data.get("descriptionTextId") or old_detail.get("descTextId", "")
        i18n_data = product_data.get("i18n") or old_detail.get("i18n", {})

        # Xử lý làm sạch ảnh đại diện & gallery (Tự động chống Base64)
        raw_image = product_data.get("image") or old_detail.get("image", "")

        clean_image = _sanitize_product_image_field(raw_image, prefix=product_id)

        raw_gallery = product_data.get("gallery") if "gallery" in product_data and isinstance(product_data.get("gallery"), list) else old_detail.get("gallery", [])
        clean_gallery = []
        if isinstance(raw_gallery, list):
            for g_idx, g_item in enumerate(raw_gallery):
                clean_gallery.append(_sanitize_product_image_field(g_item, prefix=f"{product_id}_gal_{g_idx}"))
        else:
            clean_gallery = [clean_image]

        # 1. Chi tiết đầy đủ
        full_detail = {
            "id": product_id,
            "name": name,
            "nameTextId": name_text_id or None,
            "category": category,
            "priceLevelId": price_level_id,
            "priceNumber": price_number,
            "salePrice": formatted_sale_price,
            "originalPrice": formatted_orig_price,
            "badge": product_data.get("badge") or old_detail.get("badge", ""),
            "image": clean_image,
            "gallery": clean_gallery,
            "description": product_data.get("description") if "description" in product_data else old_detail.get("description", ""),
            "descTextId": desc_text_id or None,
            "flowerComposition": product_data.get("flowerComposition") or old_detail.get("flowerComposition", ""),
            "compTextId": comp_text_id or None,
            "dimension": product_data.get("dimension") or old_detail.get("dimension", ""),
            "careTips": product_data.get("careTips") or old_detail.get("careTips", ""),
            "i18n": i18n_data if isinstance(i18n_data, dict) and i18n_data else None,
            "stockByBranch": stock_by_branch,
            "dailyQuota": int(product_data.get("dailyQuota") or old_detail.get("dailyQuota", 15)),
            "isActive": product_data.get("isActive", old_detail.get("isActive", True)),
            "updatedAt": now_iso
        }
        # Lưu file chi tiết riêng config/anne/products/{product_id}.json
        save_product_detail(product_id, full_detail)

        # 2. Bản ghi tóm tắt cho products.json (loại bỏ gallery, description dài, composition, careTips)
        summary_i18n = {}
        if isinstance(i18n_data, dict):
            for l_k, l_v in i18n_data.items():
                if isinstance(l_v, dict) and l_v.get("name"):
                    summary_i18n[l_k] = {"name": l_v["name"]}

        summary_prod = {
            "id": product_id,
            "name": name,
            "nameTextId": name_text_id or None,
            "category": category,
            "priceLevelId": price_level_id,
            "priceNumber": price_number,
            "salePrice": formatted_sale_price,
            "originalPrice": formatted_orig_price,
            "badge": full_detail["badge"],
            "image": full_detail["image"],
            "i18n": summary_i18n if summary_i18n else None,
            "stockByBranch": stock_by_branch,
            "dailyQuota": full_detail["dailyQuota"],
            "isActive": full_detail["isActive"],
            "updatedAt": now_iso
        }
        products[existing_index] = summary_prod
        save_products(products)
        return True, full_detail, None

    else:
        # Tạo mới sản phẩm
        new_id = product_data.get("id") or f"{category}_{int(datetime.now().timestamp())}"
        name_text_id = product_data.get("nameTextId") or product_data.get("textId") or ""
        comp_text_id = product_data.get("compTextId") or product_data.get("compositionTextId") or ""
        desc_text_id = product_data.get("descTextId") or product_data.get("descriptionTextId") or ""
        i18n_data = product_data.get("i18n", {})

        # Xử lý làm sạch ảnh đại diện & gallery (Tự động chống Base64)
        raw_image = product_data.get("image") or f"/flower/images/{new_id}.webp"
        clean_image = _sanitize_product_image_field(raw_image, prefix=new_id)

        raw_gallery = product_data.get("gallery", [])
        clean_gallery = []
        if isinstance(raw_gallery, list) and raw_gallery:
            for g_idx, g_item in enumerate(raw_gallery):
                clean_gallery.append(_sanitize_product_image_field(g_item, prefix=f"{new_id}_gal_{g_idx}"))
        else:
            clean_gallery = [clean_image]

        # 1. Chi tiết đầy đủ

        full_detail = {
            "id": new_id,
            "name": name,
            "nameTextId": name_text_id or None,
            "category": category,
            "priceLevelId": price_level_id,
            "priceNumber": price_number,
            "salePrice": formatted_sale_price,
            "originalPrice": formatted_orig_price,
            "badge": product_data.get("badge", "Mới"),
            "image": clean_image,
            "gallery": clean_gallery,
            "description": product_data.get("description", ""),
            "descTextId": desc_text_id or None,
            "flowerComposition": product_data.get("flowerComposition", ""),
            "compTextId": comp_text_id or None,
            "dimension": product_data.get("dimension", ""),
            "careTips": product_data.get("careTips", "Để nơi thoáng mát, phun sương mỗi ngày"),
            "i18n": i18n_data if isinstance(i18n_data, dict) and i18n_data else None,
            "stockByBranch": stock_by_branch,
            "dailyQuota": int(product_data.get("dailyQuota") or 15),
            "isActive": True,
            "createdAt": now_iso,
            "updatedAt": now_iso
        }
        # Lưu file chi tiết riêng config/anne/products/{new_id}.json
        save_product_detail(new_id, full_detail)

        # 2. Bản ghi tóm tắt cho products.json
        summary_i18n = {}
        if isinstance(i18n_data, dict):
            for l_k, l_v in i18n_data.items():
                if isinstance(l_v, dict) and l_v.get("name"):
                    summary_i18n[l_k] = {"name": l_v["name"]}

        summary_prod = {
            "id": new_id,
            "name": name,
            "nameTextId": name_text_id or None,
            "category": category,
            "priceLevelId": price_level_id,
            "priceNumber": price_number,
            "salePrice": formatted_sale_price,
            "originalPrice": formatted_orig_price,
            "badge": full_detail["badge"],
            "image": full_detail["image"],
            "i18n": summary_i18n if summary_i18n else None,
            "stockByBranch": stock_by_branch,
            "dailyQuota": full_detail["dailyQuota"],
            "isActive": True,
            "updatedAt": now_iso
        }
        products.insert(0, summary_prod)
        save_products(products)
        return True, full_detail, None


def toggle_product_active(product_id: str, is_active: Optional[bool] = None) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """Ẩn hoặc kích hoạt lại sản phẩm trên website."""
    products = get_products()
    now_iso = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
    for p in products:
        if p.get("id") == product_id:
            new_active = (not p.get("isActive", True)) if is_active is None else is_active
            p["isActive"] = new_active
            p["updatedAt"] = now_iso
            save_products(products)

            # Cập nhật cả file chi tiết nếu có
            detail = get_product_by_id(product_id)
            if detail:
                detail["isActive"] = new_active
                detail["updatedAt"] = now_iso
                save_product_detail(product_id, detail)

            return True, p, None
    return False, None, f"Không tìm thấy sản phẩm '{product_id}'"


def delete_product(product_id: str) -> Tuple[bool, Optional[str]]:
    """Xóa sản phẩm khỏi danh mục summary và file chi tiết."""
    products = get_products()
    initial_len = len(products)
    clean_products = [p for p in products if p.get("id") != product_id]
    if len(clean_products) == initial_len:
        return False, f"Không tìm thấy sản phẩm '{product_id}'"
    save_products(clean_products)

    # Xóa file chi tiết nếu có
    detail_path = get_product_detail_path(product_id)
    if os.path.exists(detail_path):
        try:
            os.remove(detail_path)
        except OSError:
            pass

    return True, None

