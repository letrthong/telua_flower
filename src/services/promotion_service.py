import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from services.data_service import (
    get_promotions,
    save_promotions,
    get_promotion_by_code
)


def list_all_promotions() -> List[Dict[str, Any]]:
    """Lấy danh sách tất cả các chiến dịch khuyến mãi & voucher."""
    return get_promotions()


def toggle_promotion(promo_id: str, is_active: Optional[bool] = None) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """Gạt công tắc Bật/Tắt (ON/OFF) voucher hoặc chiến dịch."""
    promotions = get_promotions()
    for promo in promotions:
        if promo.get("id") == promo_id:
            promo["isActive"] = (not promo.get("isActive", True)) if is_active is None else is_active
            save_promotions(promotions)
            return True, promo, None
    return False, None, f"Không tìm thấy chiến dịch khuyến mãi với ID '{promo_id}'"


def create_or_update_promotion(promo_data: Dict[str, Any], promo_id: Optional[str] = None) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """Tạo mới hoặc cập nhật thông tin khuyến mãi."""
    if not promo_data or not isinstance(promo_data, dict):
        return False, None, "Dữ liệu khuyến mãi không hợp lệ"

    code = (promo_data.get("code") or "").strip().upper()
    title = (promo_data.get("title") or "").strip()
    if not code or not title:
        return False, None, "Vui lòng nhập đầy đủ mã voucher và tiêu đề"

    promotions = get_promotions()

    if promo_id:
        existing_idx = next((i for i, p in enumerate(promotions) if p.get("id") == promo_id), -1)
        if existing_idx == -1:
            return False, None, f"Không tìm thấy voucher '{promo_id}'"
        target_promo = promotions[existing_idx]
        target_promo.update({
            "title": title,
            "code": code,
            "discountType": promo_data.get("discountType", "percentage"),
            "discountValue": int(promo_data.get("discountValue") or 10),
            "maxDiscountAmount": int(promo_data.get("maxDiscountAmount") or 100000),
            "minOrderAmount": int(promo_data.get("minOrderAmount") or 300000),
            "startDate": promo_data.get("startDate") or target_promo.get("startDate"),
            "endDate": promo_data.get("endDate") or target_promo.get("endDate"),
            "usageLimit": int(promo_data.get("usageLimit") or 500),
            "topBarMessage": promo_data.get("topBarMessage") or target_promo.get("topBarMessage", ""),
            "heroBannerUrl": promo_data.get("heroBannerUrl") or target_promo.get("heroBannerUrl", ""),
            "isActive": promo_data.get("isActive", target_promo.get("isActive", True))
        })
        save_promotions(promotions)
        return True, target_promo, None
    else:
        new_id = f"promo_{code.lower()}_{int(datetime.now().timestamp())}"
        new_promo = {
            "id": new_id,
            "title": title,
            "code": code,
            "discountType": promo_data.get("discountType", "percentage"),
            "discountValue": int(promo_data.get("discountValue") or 10),
            "maxDiscountAmount": int(promo_data.get("maxDiscountAmount") or 100000),
            "minOrderAmount": int(promo_data.get("minOrderAmount") or 300000),
            "startDate": promo_data.get("startDate") or "2026-01-01T00:00:00Z",
            "endDate": promo_data.get("endDate") or "2026-12-31T23:59:59Z",
            "usageLimit": int(promo_data.get("usageLimit") or 500),
            "usedCount": 0,
            "topBarMessage": promo_data.get("topBarMessage", ""),
            "heroBannerUrl": promo_data.get("heroBannerUrl", ""),
            "isActive": True
        }
        promotions.insert(0, new_promo)
        save_promotions(promotions)
        return True, new_promo, None
