import os
import sys
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_service import (
    get_addons,
    save_addons,
    get_addon_by_id,
    create_or_update_addon as db_create_or_update_addon,
    toggle_addon_active as db_toggle_addon,
    delete_addon as db_delete_addon,
    restore_addon as db_restore_addon
)


def list_all_addons(active_only: bool = False) -> List[Dict[str, Any]]:
    """Lấy danh sách tất cả Add-Ons (sản phẩm kèm theo)."""
    return get_addons(active_only=active_only)


def toggle_addon(addon_id: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """Gạt công tắc Bật/Tắt (ON/OFF) hiển thị Add-On."""
    return db_toggle_addon(addon_id)


def create_or_update_addon(addon_data: Dict[str, Any], addon_id: Optional[str] = None) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """Tạo mới hoặc cập nhật thông tin Add-On."""
    return db_create_or_update_addon(addon_data, addon_id)


def delete_addon(addon_id: str) -> Tuple[bool, Optional[str]]:
    """Xóa mềm (Soft Delete) Add-On."""
    return db_delete_addon(addon_id)


def restore_addon(addon_id: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """Khôi phục Add-On đã xóa mềm."""
    return db_restore_addon(addon_id)
