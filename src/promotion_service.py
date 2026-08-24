import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_service import (
    get_promotions,
    save_promotions,
    get_promotion_by_code,
    get_promotion_by_id,
    create_or_update_promotion as db_create_or_update_promotion,
    toggle_promotion_active as db_toggle_promotion,
    delete_promotion as db_delete_promotion,
    restore_promotion as db_restore_promotion
)


def list_all_promotions(include_deleted: bool = True, active_only: bool = False) -> List[Dict[str, Any]]:
    """Lấy danh sách tất cả các chiến dịch khuyến mãi & voucher."""
    return get_promotions(include_deleted=include_deleted, active_only=active_only)


def toggle_promotion(promo_id: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """Gạt công tắc Bật/Tắt (ON/OFF) voucher hoặc chiến dịch."""
    return db_toggle_promotion(promo_id)


def create_or_update_promotion(promo_data: Dict[str, Any], promo_id: Optional[str] = None) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """Tạo mới hoặc cập nhật thông tin khuyến mãi."""
    return db_create_or_update_promotion(promo_data, promo_id)


def delete_promotion(promo_id_or_code: str) -> Tuple[bool, Optional[str]]:
    """Xóa mềm (Soft Delete) voucher."""
    return db_delete_promotion(promo_id_or_code)


def restore_promotion(promo_id_or_code: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """Khôi phục voucher đã xóa mềm."""
    return db_restore_promotion(promo_id_or_code)

