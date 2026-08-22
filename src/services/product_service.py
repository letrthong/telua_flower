import os
import sys
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from services.data_service import (
    get_products,
    save_products,
    get_product_by_id,
    get_price_levels,
    get_price_level_by_id,
    get_branches
)

VALID_CATEGORIES = ["bo_hoa", "ke_hoa", "binh_hoa", "gio_hoa", "lan_ho_diep", "hoa_cuoi"]


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


def list_products(
    category: Optional[str] = None,
    search: Optional[str] = None,
    price_level_id: Optional[str] = None,
    is_active: Optional[bool] = None
) -> List[Dict[str, Any]]:
    """
    Lấy danh sách sản phẩm có bộ lọc theo danh mục, từ khóa tìm kiếm và trạng thái.
    """
    products = get_products()

    if is_active is not None:
        products = [p for p in products if p.get("isActive", True) == is_active]

    if category:
        products = [p for p in products if p.get("category") == category]

    if price_level_id:
        products = [p for p in products if p.get("priceLevelId") == price_level_id]

    if search:
        s_lower = search.strip().lower()
        products = [
            p for p in products
            if s_lower in (p.get("name") or "").lower() or s_lower in (p.get("flowerComposition") or "").lower()
        ]

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

    if category not in VALID_CATEGORIES:
        return False, None, f"Danh mục '{category}' không hợp lệ. Hỗ trợ: {', '.join(VALID_CATEGORIES)}"

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

        target_prod = products[existing_index]
        target_prod.update({
            "name": name,
            "category": category,
            "priceLevelId": price_level_id,
            "priceNumber": price_number,
            "salePrice": formatted_sale_price,
            "originalPrice": formatted_orig_price,
            "badge": product_data.get("badge") or target_prod.get("badge", ""),
            "image": product_data.get("image") or target_prod.get("image", ""),
            "gallery": product_data.get("gallery") or target_prod.get("gallery", []),
            "description": product_data.get("description") or target_prod.get("description", ""),
            "flowerComposition": product_data.get("flowerComposition") or target_prod.get("flowerComposition", ""),
            "dimension": product_data.get("dimension") or target_prod.get("dimension", ""),
            "careTips": product_data.get("careTips") or target_prod.get("careTips", ""),
            "stockByBranch": stock_by_branch,
            "dailyQuota": int(product_data.get("dailyQuota") or target_prod.get("dailyQuota", 15)),
            "isActive": product_data.get("isActive", target_prod.get("isActive", True)),
            "updatedAt": now_iso
        })
        save_products(products)
        return True, target_prod, None

    else:
        # Tạo mới sản phẩm
        new_id = product_data.get("id") or f"{category}_{int(datetime.now().timestamp())}"
        new_prod = {
            "id": new_id,
            "name": name,
            "category": category,
            "priceLevelId": price_level_id,
            "priceNumber": price_number,
            "salePrice": formatted_sale_price,
            "originalPrice": formatted_orig_price,
            "badge": product_data.get("badge", "Mới"),
            "image": product_data.get("image") or "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500",
            "gallery": product_data.get("gallery", []),
            "description": product_data.get("description", ""),
            "flowerComposition": product_data.get("flowerComposition", ""),
            "dimension": product_data.get("dimension", ""),
            "careTips": product_data.get("careTips", "Để nơi thoáng mát, phun sương mỗi ngày"),
            "stockByBranch": stock_by_branch,
            "dailyQuota": int(product_data.get("dailyQuota") or 15),
            "isActive": True,
            "createdAt": now_iso,
            "updatedAt": now_iso
        }
        products.insert(0, new_prod)
        save_products(products)
        return True, new_prod, None


def toggle_product_active(product_id: str, is_active: Optional[bool] = None) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """Ẩn hoặc kích hoạt lại sản phẩm trên website."""
    products = get_products()
    for p in products:
        if p.get("id") == product_id:
            p["isActive"] = (not p.get("isActive", True)) if is_active is None else is_active
            p["updatedAt"] = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
            save_products(products)
            return True, p, None
    return False, None, f"Không tìm thấy sản phẩm '{product_id}'"


def delete_product(product_id: str) -> Tuple[bool, Optional[str]]:
    """Xóa sản phẩm khỏi danh mục."""
    products = get_products()
    initial_len = len(products)
    clean_products = [p for p in products if p.get("id") != product_id]
    if len(clean_products) == initial_len:
        return False, f"Không tìm thấy sản phẩm '{product_id}'"
    save_products(clean_products)
    return True, None
