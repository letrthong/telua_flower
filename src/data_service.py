import os
import json
import time
import threading
import functools
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flower_config import (
    FLOWER_CONFIG_DIR,
    FLOWER_ORDERS_DIR,
    USERS_DIR,
    USERS_FILE_PATH,
    BRANCHES_FILE_PATH,
    PRODUCTS_FILE_PATH,
    PRICE_LEVELS_FILE_PATH,
    PROMOTIONS_FILE_PATH,
    TRANSLATIONS_FILE_PATH,
    WASTAGE_REPORTS_FILE_PATH,
    COMPANY_INFO_FILE_PATH
)

CONFIG_DIR = FLOWER_CONFIG_DIR
ORDERS_DIR = FLOWER_ORDERS_DIR

# Thread lock để tránh xung đột race-condition khi ghi đồng thời
_IO_LOCK = threading.Lock()

# Cache lưu trữ dữ liệu JSON trong RAM theo thời gian sửa đổi (mtime) của file (chống rò rỉ RAM với bounded limit)
_FILE_MTIME_CACHE: Dict[str, Dict[str, Any]] = {}
_MAX_MTIME_CACHE_SIZE = 64
_MTIME_CACHE_LOCK = threading.Lock()


def get_config_path(filename: str) -> str:
    """Trả về đường dẫn tuyệt đối đến file trong thư mục config."""
    return os.path.join(CONFIG_DIR, filename)


def read_json(filepath: str, default: Any = None) -> Any:
    """
    Đọc dữ liệu từ file JSON một cách an toàn.
    Nếu file không tồn tại hoặc lỗi định dạng, trả về default hoặc [] / {}.
    """
    if not os.path.exists(filepath):
        return default if default is not None else []

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError, UnicodeDecodeError):
        return default if default is not None else []


def read_json_cached(filepath: str, default: Any = None) -> Any:
    """
    Đọc dữ liệu từ file JSON có bộ nhớ đệm RAM tự động kiểm tra mtime (file modification time).
    Nếu file không thay đổi trên đĩa, trả về dữ liệu parse từ RAM (0ms I/O).
    Nếu file bị thay đổi trên đĩa, tự động tải lại dữ liệu mới nhất.
    """
    if not os.path.exists(filepath):
        return default if default is not None else []

    try:
        current_mtime = os.path.getmtime(filepath)
    except OSError:
        return read_json(filepath, default)

    with _MTIME_CACHE_LOCK:
        cached_entry = _FILE_MTIME_CACHE.get(filepath)
        if cached_entry and cached_entry.get("mtime") == current_mtime:
            return cached_entry.get("data")

    # Đọc từ đĩa nếu chưa có hoặc file đã thay đổi mtime
    data = read_json(filepath, default)
    with _MTIME_CACHE_LOCK:
        if len(_FILE_MTIME_CACHE) >= _MAX_MTIME_CACHE_SIZE and filepath not in _FILE_MTIME_CACHE:
            # Thu hồi phần tử cũ nhất theo FIFO để giữ dung lượng RAM cố định
            first_key = next(iter(_FILE_MTIME_CACHE))
            _FILE_MTIME_CACHE.pop(first_key, None)
        _FILE_MTIME_CACHE[filepath] = {
            "mtime": current_mtime,
            "data": data
        }
    return data


def invalidate_file_cache(filepath: Optional[str] = None) -> None:
    """Xóa cache RAM cho một file cụ thể hoặc toàn bộ file cache."""
    with _MTIME_CACHE_LOCK:
        if filepath:
            _FILE_MTIME_CACHE.pop(filepath, None)
        else:
            _FILE_MTIME_CACHE.clear()


def _normalize_list_of_dicts(data: Any) -> List[Dict[str, Any]]:
    """
    Đảm bảo dữ liệu đọc từ JSON luôn là List[Dict[str, Any]],
    phòng tránh hoàn toàn lỗi AttributeError ('str' object has no attribute 'get')
    khi file JSON có cấu trúc dict {key: user} hoặc sai schema.
    """
    if isinstance(data, list):
        return [dict(item) for item in data if isinstance(item, dict)]
    elif isinstance(data, dict):
        for key in ["users", "staff_users", "customers", "data", "branches", "products", "categories", "promotions"]:
            if key in data and isinstance(data[key], list):
                return [dict(item) for item in data[key] if isinstance(item, dict)]
        res = []
        for k, v in data.items():
            if isinstance(v, dict):
                item = dict(v)
                if "id" not in item:
                    item["id"] = k
                res.append(item)
        return res
    return []


def write_json(filepath: str, data: Any, indent: int = 2) -> bool:
    """
    Ghi dữ liệu ra file JSON nguyên tử (Atomic Write với Windows retry/fallback).
    """
    dir_name = os.path.dirname(filepath)
    if dir_name and not os.path.exists(dir_name):
        os.makedirs(dir_name, exist_ok=True)

    temp_path = f"{filepath}.tmp"
    with _IO_LOCK:
        try:
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=indent)
                f.flush()
                os.fsync(f.fileno())
            try:
                os.replace(temp_path, filepath)
            except Exception:
                # Fallback ghi trực tiếp trên Windows nếu os.replace bị lock
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=indent)
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except Exception:
                        pass
            # Xóa cache RAM khi file được ghi mới
            invalidate_file_cache(filepath)
            return True
        except Exception as e:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    pass
            raise IOError(f"Lỗi khi ghi dữ liệu ra file {filepath}: {str(e)}")



def paginate(
    items: List[Any],
    page: int = 1,
    limit: int = 20,
    max_limit: int = 50
) -> Dict[str, Any]:
    """
    Cắt trang (Pagination) mượt mà kèm metadata, chặn giới hạn max_limit chống tràn RAM.
    """
    try:
        page = int(page)
    except (TypeError, ValueError):
        page = 1

    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = 20

    if page < 1:
        page = 1
    if limit < 1:
        limit = 20
    if limit > max_limit:
        limit = max_limit

    total = len(items)
    total_pages = (total + limit - 1) // limit if total > 0 else 1

    start = (page - 1) * limit
    end = start + limit
    paginated_items = items[start:end]

    return {
        "items": paginated_items,
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }


# ==========================================
# CÁC SERVICE TRUY XUẤT CHO TỪNG ĐỐI TƯỢNG
# ==========================================

# 1. Chi Nhánh (Branches) - Hỗ trợ cache RAM theo mtime file
@functools.lru_cache(maxsize=32)
def _get_cached_branches() -> List[Dict[str, Any]]:
    return _normalize_list_of_dicts(read_json_cached(get_config_path("branches.json"), default=[]))


def get_branches(use_cache: bool = True) -> List[Dict[str, Any]]:
    if use_cache:
        raw = read_json_cached(get_config_path("branches.json"), default=[])
    else:
        raw = read_json(get_config_path("branches.json"), default=[])
    return _normalize_list_of_dicts(raw)


def get_branch_by_id(branch_id: str) -> Optional[Dict[str, Any]]:
    branches = get_branches()
    for b in branches:
        if b.get("id") == branch_id or b.get("code") == branch_id:
            return b
    return None


def save_branches(branches: List[Dict[str, Any]]) -> bool:
    filepath = get_config_path("branches.json")
    success = write_json(filepath, branches)
    invalidate_file_cache(filepath)
    _get_cached_branches.cache_clear()
    return success


def create_or_update_branch(
    branch_data: Dict[str, Any],
    branch_id: Optional[str] = None
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Tạo mới hoặc cập nhật chi nhánh chuỗi cửa hàng (Dành riêng cho Super Admin).
    """
    name = (branch_data.get("name") or "").strip()
    address = (branch_data.get("address") or "").strip()
    phone = (branch_data.get("phone") or "").strip()
    code = (branch_data.get("code") or "").strip().upper()

    if not name or not address:
        return False, None, "Vui lòng nhập tên chi nhánh và địa chỉ"

    branches = get_branches(use_cache=False)
    now_iso = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")

    if branch_id:
        for i, b in enumerate(branches):
            if b.get("id") == branch_id:
                branches[i]["name"] = name
                branches[i]["address"] = address
                branches[i]["phone"] = phone or b.get("phone")
                if code: branches[i]["code"] = code
                if "lat" in branch_data: branches[i]["lat"] = float(branch_data["lat"])
                if "lng" in branch_data: branches[i]["lng"] = float(branch_data["lng"])
                if "openHours" in branch_data: branches[i]["openHours"] = branch_data["openHours"]
                if "deliveryRadiusKm" in branch_data: branches[i]["deliveryRadiusKm"] = int(branch_data["deliveryRadiusKm"])
                if "managerId" in branch_data: branches[i]["managerId"] = branch_data["managerId"]
                if "amenities" in branch_data: branches[i]["amenities"] = branch_data["amenities"]
                if "isActive" in branch_data: branches[i]["isActive"] = bool(branch_data["isActive"])
                branches[i]["updatedAt"] = now_iso
                save_branches(branches)
                return True, branches[i], None
        return False, None, "Không tìm thấy chi nhánh cần sửa"
    else:
        new_id = branch_data.get("id") or f"branch_{int(time.time())}"
        if not code:
            code = f"CN_Q{len(branches) + 1}"

        if any(b.get("id") == new_id or b.get("code") == code for b in branches):
            return False, None, "Mã chi nhánh hoặc ID chi nhánh đã tồn tại"

        new_branch = {
            "id": new_id,
            "code": code,
            "name": name,
            "address": address,
            "lat": float(branch_data.get("lat", 10.7769)),
            "lng": float(branch_data.get("lng", 106.7009)),
            "phone": phone or "0976.491.322",
            "openHours": branch_data.get("openHours", "07:30 - 21:00"),
            "deliveryRadiusKm": int(branch_data.get("deliveryRadiusKm", 10)),
            "managerId": branch_data.get("managerId", None),
            "amenities": branch_data.get("amenities", "Phòng lạnh bảo quản hoa, giao hỏa tốc 2H"),
            "isActive": branch_data.get("isActive", True),
            "createdAt": now_iso
        }
        branches.append(new_branch)
        save_branches(branches)
        return True, new_branch, None


def toggle_branch_active(branch_id: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    branches = get_branches(use_cache=False)
    for i, b in enumerate(branches):
        if b.get("id") == branch_id:
            branches[i]["isActive"] = not branches[i].get("isActive", True)
            save_branches(branches)
            return True, branches[i], None
    return False, None, "Không tìm thấy chi nhánh"



# 2. Phân Tầng Mức Giá (Price Levels) - Hỗ trợ cache LRU
@functools.lru_cache(maxsize=32)
def _get_cached_price_levels() -> List[Dict[str, Any]]:
    return _normalize_list_of_dicts(read_json(get_config_path("price_levels.json"), default=[]))


def get_price_levels(use_cache: bool = True) -> List[Dict[str, Any]]:
    if use_cache:
        return _get_cached_price_levels()
    return _normalize_list_of_dicts(read_json(get_config_path("price_levels.json"), default=[]))


def get_price_level_by_id(price_lvl_id: str) -> Optional[Dict[str, Any]]:
    levels = get_price_levels()
    for lvl in levels:
        if isinstance(lvl, dict) and (lvl.get("id") == price_lvl_id or lvl.get("code") == price_lvl_id):
            return lvl
    return None


def save_price_levels(price_levels: List[Dict[str, Any]]) -> bool:
    success = write_json(get_config_path("price_levels.json"), price_levels)
    _get_cached_price_levels.cache_clear()
    return success


DEFAULT_CATEGORIES = [
    {
        "id": "gio_hoa",
        "name": "Giỏ & Lẵng Hoa",
        "slug": "gio-hoa",
        "image": "https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80",
        "icon": "fa-solid fa-basket-shopping",
        "order": 1,
        "status": "active",
        "isActive": True,
        "isDeleted": False,
        "description": "Giỏ hoa và lẵng hoa để bàn sang trọng, tinh tế",
        "createdAt": "2026-08-20T08:00:00Z",
        "updatedAt": "2026-08-24T12:00:00Z"
    },
    {
        "id": "bo_hoa",
        "name": "Bó Hoa Tươi",
        "slug": "bo-hoa",
        "image": "https://images.unsplash.com/photo-1591886960571-74d43a9d4166?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80",
        "icon": "fa-solid fa-spa",
        "order": 2,
        "status": "active",
        "isActive": True,
        "isDeleted": False,
        "description": "Các mẫu bó hoa tươi thiết kế cao cấp cho sinh nhật, tình yêu, tốt nghiệp",
        "createdAt": "2026-08-20T08:00:00Z",
        "updatedAt": "2026-08-24T12:00:00Z"
    },
    {
        "id": "ke_hoa",
        "name": "Kệ Hoa Khai Trương",
        "slug": "ke-hoa",
        "image": "https://images.unsplash.com/photo-1507290439931-a861b5a38200?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80",
        "icon": "fa-solid fa-crown",
        "order": 3,
        "status": "active",
        "isActive": True,
        "isDeleted": False,
        "description": "Kệ hoa chúc mừng khai trương, kỷ niệm, sự kiện hồng phát",
        "createdAt": "2026-08-20T08:00:00Z",
        "updatedAt": "2026-08-24T12:00:00Z"
    },
    {
        "id": "binh_hoa",
        "name": "Bình Cắm Hoa",
        "slug": "binh-cam-hoa",
        "image": "https://raw.githubusercontent.com/letrthong/telua_public_image/main/anne/images/binh_ho_phach.png",
        "icon": "fa-solid fa-wine-glass",
        "order": 4,
        "status": "active",
        "isActive": True,
        "isDeleted": False,
        "description": "Mẫu bình cắm hoa nghệ thuật phong cách 'Thả Bình' tinh tế cho không gian sống",
        "createdAt": "2026-08-20T08:00:00Z",
        "updatedAt": "2026-08-24T12:00:00Z"
    },
    {
        "id": "lan_ho_diep",
        "name": "Lan Hồ Điệp",
        "slug": "lan-ho-diep",
        "image": "https://raw.githubusercontent.com/letrthong/telua_public_image/main/anne/images/moth_orchid.jpg",
        "icon": "fa-solid fa-seedling",
        "order": 5,
        "status": "active",
        "isActive": True,
        "isDeleted": False,
        "description": "Chậu hoa lan hồ điệp thuần khiết, quà tặng cao cấp",
        "createdAt": "2026-08-20T08:00:00Z",
        "updatedAt": "2026-08-24T12:00:00Z"
    },
    {
        "id": "hoa_cuoi",
        "name": "Hoa Cưới Cầm Tay",
        "slug": "hoa-cuoi",
        "image": "https://images.unsplash.com/photo-1520763185298-1b434c919102?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80",
        "icon": "fa-solid fa-heart",
        "order": 6,
        "status": "active",
        "isActive": True,
        "isDeleted": False,
        "description": "Bó hoa cưới cô dâu lộng lẫy và hoa cài áo chú rể ngày trọng đại",
        "createdAt": "2026-08-20T08:00:00Z",
        "updatedAt": "2026-08-24T12:00:00Z"
    }
]

# 2b. Danh Mục Hoa Tươi (Categories) - Hỗ trợ cache LRU, Timestamps & Xóa Mềm (Soft Delete)
@functools.lru_cache(maxsize=32)
def _get_cached_categories() -> List[Dict[str, Any]]:
    cat_file = get_config_path("categories.json")
    cats = _normalize_list_of_dicts(read_json(cat_file, default=[]))
    if not cats:
        cats = DEFAULT_CATEGORIES
        write_json(cat_file, DEFAULT_CATEGORIES)
    try:
        cats = sorted(cats, key=lambda x: int(x.get("order", 99)) if isinstance(x, dict) and str(x.get("order", "")).isdigit() else 99)
    except Exception:
        pass
    return cats


def get_categories(use_cache: bool = True, active_only: bool = False, include_deleted: bool = True) -> List[Dict[str, Any]]:
    if use_cache:
        cats = _get_cached_categories()
    else:
        cat_file = get_config_path("categories.json")
        cats = _normalize_list_of_dicts(read_json(cat_file, default=[]))
        if not cats:
            cats = DEFAULT_CATEGORIES
            write_json(cat_file, DEFAULT_CATEGORIES)
        try:
            cats = sorted(cats, key=lambda x: int(x.get("order", 99)) if isinstance(x, dict) and str(x.get("order", "")).isdigit() else 99)
        except Exception:
            pass

    if active_only:
        return [
            c for c in cats 
            if isinstance(c, dict) 
            and c.get("isActive") not in (False, "false", 0, "0") 
            and c.get("status") not in ("inactive", "deleted") 
            and not c.get("isDeleted")
        ]
    if not include_deleted:
        return [c for c in cats if isinstance(c, dict) and c.get("status") != "deleted" and not c.get("isDeleted")]
    return [c for c in cats if isinstance(c, dict)]


def get_category_by_id(category_id: str) -> Optional[Dict[str, Any]]:
    for c in get_categories(use_cache=False, include_deleted=True):
        if c.get("id") == category_id:
            return c
    return None


def save_categories(categories: List[Dict[str, Any]]) -> bool:
    try:
        categories.sort(key=lambda x: int(x.get("order", 99)))
    except Exception:
        pass
    success = write_json(get_config_path("categories.json"), categories)
    _get_cached_categories.cache_clear()
    return success


def move_category_order(cat_id: str, direction: str) -> Tuple[bool, Optional[List[Dict[str, Any]]], Optional[str]]:
    """
    Di chuyển thứ tự hiển thị của danh mục lên (up) hoặc xuống (down) 1 bậc:
    - Tự động hoán đổi số thứ tự (order) với danh mục liền kề.
    - Cập nhật updatedAt.
    """
    categories = get_categories(use_cache=False, include_deleted=True)
    categories.sort(key=lambda x: int(x.get("order", 99)))
    
    idx = next((i for i, c in enumerate(categories) if c.get("id") == cat_id), -1)
    if idx == -1:
        return False, None, "Không tìm thấy danh mục"

    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    if direction == "up":
        if idx == 0:
            return False, None, "Danh mục này đã ở vị trí đầu tiên"
        # Hoán đổi với phần tử phía trước
        prev_idx = idx - 1
        curr_order = categories[idx].get("order", idx + 1)
        prev_order = categories[prev_idx].get("order", prev_idx + 1)
        if curr_order == prev_order:
            categories[idx]["order"] = prev_order
            categories[prev_idx]["order"] = prev_order + 1
        else:
            categories[idx]["order"], categories[prev_idx]["order"] = prev_order, curr_order
        categories[idx]["updatedAt"] = now_iso
        categories[prev_idx]["updatedAt"] = now_iso

    elif direction == "down":
        if idx >= len(categories) - 1:
            return False, None, "Danh mục này đã ở vị trí cuối cùng"
        # Hoán đổi với phần tử phía sau
        next_idx = idx + 1
        curr_order = categories[idx].get("order", idx + 1)
        next_order = categories[next_idx].get("order", next_idx + 1)
        if curr_order == next_order:
            categories[idx]["order"] = next_order + 1
            categories[next_idx]["order"] = next_order
        else:
            categories[idx]["order"], categories[next_idx]["order"] = next_order, curr_order
        categories[idx]["updatedAt"] = now_iso
        categories[next_idx]["updatedAt"] = now_iso

    else:
        return False, None, "Hướng di chuyển không hợp lệ (chỉ hỗ trợ 'up' hoặc 'down')"

    # Chuẩn hóa lại thứ tự 1, 2, 3, 4...
    categories.sort(key=lambda x: int(x.get("order", 99)))
    for i, c in enumerate(categories):
        c["order"] = i + 1

    save_categories(categories)
    return True, categories, None



def create_or_update_category(
    cat_data: Dict[str, Any],
    cat_id: Optional[str] = None
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    name = (cat_data.get("name") or "").strip()
    if not name:
        return False, None, "Vui lòng nhập tên danh mục"

    categories = get_categories(use_cache=False, include_deleted=True)
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    order = int(cat_data.get("order") or len(categories) + 1)
    icon = (cat_data.get("icon") or "fa-solid fa-spa").strip()
    image = (cat_data.get("image") or "").strip()
    description = (cat_data.get("description") or "").strip()
    is_active = bool(cat_data.get("isActive", True))
    status = cat_data.get("status") or ("active" if is_active else "inactive")

    if cat_id:
        target_idx = next((i for i, c in enumerate(categories) if c.get("id") == cat_id), -1)
        if target_idx == -1:
            return False, None, "Không tìm thấy danh mục cần sửa"

        target_cat = categories[target_idx]
        target_cat["name"] = name
        target_cat["icon"] = icon
        if image:
            target_cat["image"] = image
        target_cat["description"] = description
        target_cat["isActive"] = is_active
        target_cat["status"] = status
        if status == "deleted":
            target_cat["isDeleted"] = True
            target_cat["deletedAt"] = target_cat.get("deletedAt") or now_iso
        else:
            target_cat["isDeleted"] = False
            target_cat["deletedAt"] = None
        target_cat["updatedAt"] = now_iso

        # Chèn vào vị trí order mới và đánh số lại chuẩn xác
        categories.pop(target_idx)
        insert_idx = max(0, min(order - 1, len(categories)))
        categories.insert(insert_idx, target_cat)

        for i, c in enumerate(categories):
            c["order"] = i + 1

        save_categories(categories)
        return True, target_cat, None
    else:
        new_id = (cat_data.get("id") or "").strip().lower()
        if not new_id:
            new_id = f"cat_{int(time.time()) % 100000}"
        
        if any(c.get("id") == new_id for c in categories):
            return False, None, f"Mã danh mục '{new_id}' đã tồn tại"

        new_cat = {
            "id": new_id,
            "name": name,
            "slug": new_id.replace("_", "-"),
            "image": image or "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500",
            "icon": icon,
            "order": order,
            "status": status,
            "isActive": is_active,
            "isDeleted": False,
            "description": description,
            "createdAt": now_iso,
            "updatedAt": now_iso
        }
        insert_idx = max(0, min(order - 1, len(categories)))
        categories.insert(insert_idx, new_cat)
        for i, c in enumerate(categories):
            c["order"] = i + 1
        save_categories(categories)
        return True, new_cat, None


def toggle_category_active(cat_id: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    categories = get_categories(use_cache=False, include_deleted=True)
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    for i, c in enumerate(categories):
        if c.get("id") == cat_id:
            if c.get("status") == "deleted" or c.get("isDeleted"):
                return False, None, "Danh mục này đang ở trạng thái Đã Xóa (deleted). Hãy bấm Khôi Phục trước khi Bật/Tắt."

            new_active = not categories[i].get("isActive", True)
            categories[i]["isActive"] = new_active
            categories[i]["status"] = "active" if new_active else "inactive"
            categories[i]["updatedAt"] = now_iso
            save_categories(categories)
            return True, categories[i], None
    return False, None, "Không tìm thấy danh mục"


def delete_category(cat_id: str) -> Tuple[bool, Optional[str]]:
    """
    Xóa mềm (Soft Delete) danh mục:
    - Đổi status = 'deleted', isActive = False, isDeleted = True
    - Ghi nhận deletedAt và updatedAt, giữ nguyên dữ liệu trong JSON không xóa vật lý.
    """
    categories = get_categories(use_cache=False, include_deleted=True)
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    for i, c in enumerate(categories):
        if c.get("id") == cat_id:
            categories[i]["status"] = "deleted"
            categories[i]["isDeleted"] = True
            categories[i]["isActive"] = False
            categories[i]["deletedAt"] = now_iso
            categories[i]["updatedAt"] = now_iso
            save_categories(categories)
            return True, None
    return False, "Không tìm thấy danh mục cần xóa"


def restore_category(cat_id: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Khôi phục danh mục đã bị xóa mềm:
    - Đổi status = 'active', isActive = True, isDeleted = False, deletedAt = None
    """
    categories = get_categories(use_cache=False, include_deleted=True)
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    for i, c in enumerate(categories):
        if c.get("id") == cat_id:
            categories[i]["status"] = "active"
            categories[i]["isDeleted"] = False
            categories[i]["isActive"] = True
            categories[i]["deletedAt"] = None
            categories[i]["updatedAt"] = now_iso
            save_categories(categories)
            return True, categories[i], None
    return False, None, "Không tìm thấy danh mục cần khôi phục"




DEFAULT_STAFF_USERS = [
    {
        "id": "user_super_admin",
        "username": "admin",
        "fullName": "Super Administrator",
        "phone": "0901234567",
        "email": "admin@telua.vn",
        "role": "super_admin",
        "branchId": None,
        "isActive": True,
        "passwordHash": "",
        "createdAt": "2026-01-01T00:00:00Z"
    },
    {
        "id": "user_manager_q1",
        "username": "manager_q1",
        "fullName": "Quản Lý Chi Nhánh Q1",
        "phone": "0909999001",
        "email": "manager.q1@telua.vn",
        "role": "branch_manager",
        "branchId": "branch_01",
        "isActive": True,
        "passwordHash": "",
        "createdAt": "2026-01-01T00:00:00Z"
    }
]


# 3. Nhân Sự & Người Dùng Nội Bộ (Staff & Users)
def get_staff_users() -> List[Dict[str, Any]]:
    staff_file = get_config_path("staff_users.json")
    if os.path.exists(staff_file):
        data = read_json(staff_file, default=[])
        used_path = staff_file
    else:
        # Nếu chưa có file staff_users.json, tự động khởi tạo dữ liệu mẫu
        data = DEFAULT_STAFF_USERS
        used_path = staff_file
        save_staff_users(DEFAULT_STAFF_USERS)
        print(f"[DATA_SERVICE] Auto-seeded default staff users into: {staff_file}", flush=True)

    normalized = _normalize_list_of_dicts(data)
    print(f"[DATA_SERVICE] get_staff_users() | Path: {used_path} | Found {len(normalized)} users", flush=True)
    return normalized


def save_staff_users(staff_users: List[Dict[str, Any]]) -> bool:
    target_path = get_config_path("staff_users.json")
    success = write_json(target_path, staff_users)
    print(f"[DATA_SERVICE] save_staff_users() -> Saved {len(staff_users)} users to: {target_path}", flush=True)
    return success


def get_users() -> List[Dict[str, Any]]:
    """Trả về danh sách nhân sự nội bộ (tương thích ngược)."""
    return get_staff_users()


def save_users(users: List[Dict[str, Any]]) -> bool:
    return save_staff_users(users)


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    if not user_id:
        return None
    target_id = str(user_id).strip()
    # 1. Tìm trong nhân sự nội bộ
    for u in get_staff_users():
        if isinstance(u, dict) and str(u.get("id") or "").strip() == target_id:
            return u
    # 2. Tìm trong khách hàng
    for c in get_customers():
        if isinstance(c, dict) and str(c.get("id") or "").strip() == target_id:
            return c
    return None


def get_user_by_phone_or_email(identifier: str) -> Optional[Dict[str, Any]]:
    if not identifier:
        return None
    clean_id = str(identifier).strip().lower()
    # 1. Tìm trong nhân sự nội bộ
    staff = get_staff_users()
    for u in staff:
        if not isinstance(u, dict):
            continue
        phone = str(u.get("phone") or "").strip().lower()
        email = str(u.get("email") or "").strip().lower()
        username = str(u.get("username") or "").strip().lower()
        uid = str(u.get("id") or "").strip().lower()
        if clean_id in (phone, email, username, uid):
            print(f"[DATA_SERVICE] Match found in staff for '{identifier}': id={u.get('id')}, role={u.get('role')}", flush=True)
            return u

    # 2. Tìm trong khách hàng
    customers = get_customers()
    for c in customers:
        if not isinstance(c, dict):
            continue
        phone = str(c.get("phone") or "").strip().lower()
        email = str(c.get("email") or "").strip().lower()
        username = str(c.get("username") or "").strip().lower()
        cid = str(c.get("id") or "").strip().lower()
        if clean_id in (phone, email, username, cid):
            print(f"[DATA_SERVICE] Match found in customers for '{identifier}': id={c.get('id')}", flush=True)
            return c

    avail_staff = [s.get("phone") or s.get("username") or s.get("id") for s in staff if isinstance(s, dict)]
    print(f"[DATA_SERVICE] No user found for '{identifier}'. Available staff identifiers: {avail_staff}", flush=True)
    return None


# 4. Sản Phẩm Hoa & Bình Cắm (Products - Summary & Detail Lazy Loading)
def get_product_detail_path(product_id: str) -> str:
    products_dir = os.path.join(FLOWER_CONFIG_DIR, "products")
    if not os.path.exists(products_dir):
        os.makedirs(products_dir, exist_ok=True)
    return os.path.join(products_dir, f"{product_id}.json")


def get_products() -> List[Dict[str, Any]]:
    """Lấy danh mục tóm tắt siêu nhẹ cho toàn bộ sản phẩm (phục vụ Grid & List)."""
    return _normalize_list_of_dicts(read_json(get_config_path("products.json"), default=[]))


def get_product_by_id(product_id: str) -> Optional[Dict[str, Any]]:
    """
    Lấy thông tin chi tiết đầy đủ của một sản phẩm (On-demand Lazy Load):
    - Ưu tiên đọc file chi tiết riêng config/anne/products/{product_id}.json
    - Nếu chưa có file chi tiết riêng -> đọc từ products.json
    """
    if not product_id:
        return None
    detail_file = get_product_detail_path(product_id)
    if os.path.exists(detail_file):
        detail = read_json(detail_file, default=None)
        if isinstance(detail, dict):
            return detail

    # Fallback tìm trong products.json
    products = get_products()
    for p in products:
        if isinstance(p, dict) and p.get("id") == product_id:
            return p
    return None


def save_product_detail(product_id: str, product_data: Dict[str, Any]) -> bool:
    """Lưu file chi tiết riêng cho sản phẩm vào config/anne/products/{product_id}.json."""
    detail_file = get_product_detail_path(product_id)
    return write_json(detail_file, product_data)


def save_products(products: List[Dict[str, Any]]) -> bool:
    """Lưu danh mục sản phẩm tóm tắt vào products.json."""
    return write_json(get_config_path("products.json"), products)



# 5. Khuyến Mãi & Voucher (Promotions & Archival History)
def get_promotions_history() -> List[Dict[str, Any]]:
    """Lấy danh sách các voucher đã xóa từ config/anne/promotions_history.json."""
    return _normalize_list_of_dicts(read_json(get_config_path("promotions_history.json"), default=[]))


def save_promotions_history(history_promos: List[Dict[str, Any]]) -> bool:
    """Lưu lịch sử voucher đã xóa vào config/anne/promotions_history.json."""
    return write_json(get_config_path("promotions_history.json"), history_promos)


def get_promotions(include_deleted: bool = True, active_only: bool = False) -> List[Dict[str, Any]]:
    """
    Lấy danh sách khuyến mãi:
    - Mặc định active_only: Chỉ lấy voucher đang bật và chưa xóa trong promotions.json.
    - include_deleted: Gộp cả danh sách trong promotions.json và promotions_history.json cho Admin.
    """
    promos = _normalize_list_of_dicts(read_json(get_config_path("promotions.json"), default=[]))
    if active_only:
        return [p for p in promos if isinstance(p, dict) and p.get("isActive") is not False and p.get("status") != "deleted" and not p.get("isDeleted")]
    
    if include_deleted:
        history = get_promotions_history()
        return promos + [h for h in history if isinstance(h, dict)]

    return promos


def get_promotion_by_code(code: str, active_only: bool = False) -> Optional[Dict[str, Any]]:
    if not code:
        return None
    promotions = get_promotions(include_deleted=not active_only, active_only=active_only)
    clean_code = str(code).strip().upper()
    for p in promotions:
        if isinstance(p, dict) and (str(p.get("code") or "").strip().upper() == clean_code):
            return p
    return None


def get_promotion_by_id(promo_id: str) -> Optional[Dict[str, Any]]:
    for p in get_promotions(include_deleted=True):
        if p.get("id") == promo_id:
            return p
    return None


def save_promotions(promotions: List[Dict[str, Any]]) -> bool:
    return write_json(get_config_path("promotions.json"), promotions)


def create_or_update_promotion(
    promo_data: Dict[str, Any],
    promo_id: Optional[str] = None
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    code = (promo_data.get("code") or "").strip().upper()
    title = (promo_data.get("title") or "").strip()
    if not code:
        return False, None, "Vui lòng nhập mã khuyến mãi (Code)"
    if not title:
        return False, None, "Vui lòng nhập tiêu đề khuyến mãi"

    promotions = read_json(get_config_path("promotions.json"), default=[])
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    is_active = bool(promo_data.get("isActive", True))
    status = promo_data.get("status") or ("active" if is_active else "inactive")

    if promo_id:
        for i, p in enumerate(promotions):
            if p.get("id") == promo_id or p.get("code") == promo_id.upper():
                promotions[i]["code"] = code
                promotions[i]["title"] = title
                promotions[i]["discountType"] = promo_data.get("discountType", "percentage")
                promotions[i]["discountValue"] = int(promo_data.get("discountValue") or 10)
                promotions[i]["maxDiscountAmount"] = int(promo_data.get("maxDiscountAmount") or 100000)
                promotions[i]["minOrderAmount"] = int(promo_data.get("minOrderAmount") or 0)
                promotions[i]["startDate"] = promo_data.get("startDate") or p.get("startDate", "2026-01-01T00:00:00Z")
                promotions[i]["endDate"] = promo_data.get("endDate") or p.get("endDate", "2026-12-31T23:59:59Z")
                promotions[i]["usageLimit"] = int(promo_data.get("usageLimit") or 500)
                promotions[i]["topBarMessage"] = promo_data.get("topBarMessage", "")
                promotions[i]["heroBannerUrl"] = promo_data.get("heroBannerUrl", "")
                promotions[i]["isActive"] = is_active
                promotions[i]["status"] = status
                promotions[i]["isDeleted"] = False
                promotions[i]["deletedAt"] = None
                promotions[i]["updatedAt"] = now_iso
                save_promotions(promotions)
                return True, promotions[i], None
        return False, None, f"Không tìm thấy voucher '{promo_id}'"
    else:
        # Check duplicate code in both active and history
        all_existing = get_promotions(include_deleted=True)
        if any(p.get("code", "").upper() == code for p in all_existing):
            return False, None, f"Mã khuyến mãi '{code}' đã tồn tại"

        new_id = promo_data.get("id") or f"promo_{code.lower()}_{int(time.time()) % 100000}"
        new_promo = {
            "id": new_id,
            "title": title,
            "code": code,
            "discountType": promo_data.get("discountType", "percentage"),
            "discountValue": int(promo_data.get("discountValue") or 10),
            "maxDiscountAmount": int(promo_data.get("maxDiscountAmount") or 100000),
            "minOrderAmount": int(promo_data.get("minOrderAmount") or 0),
            "startDate": promo_data.get("startDate") or "2026-01-01T00:00:00Z",
            "endDate": promo_data.get("endDate") or "2026-12-31T23:59:59Z",
            "usageLimit": int(promo_data.get("usageLimit") or 500),
            "usedCount": 0,
            "topBarMessage": promo_data.get("topBarMessage", ""),
            "heroBannerUrl": promo_data.get("heroBannerUrl", ""),
            "status": status,
            "isActive": is_active,
            "isDeleted": False,
            "createdAt": now_iso,
            "updatedAt": now_iso
        }
        promotions.insert(0, new_promo)
        save_promotions(promotions)
        return True, new_promo, None


def toggle_promotion_active(promo_id_or_code: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    promotions = read_json(get_config_path("promotions.json"), default=[])
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    clean_target = promo_id_or_code.strip().upper()
    for i, p in enumerate(promotions):
        if p.get("id") == promo_id_or_code or (p.get("code") or "").upper() == clean_target:
            new_active = not p.get("isActive", True)
            promotions[i]["isActive"] = new_active
            promotions[i]["status"] = "active" if new_active else "inactive"
            promotions[i]["updatedAt"] = now_iso
            save_promotions(promotions)
            return True, promotions[i], None
    return False, None, f"Không tìm thấy voucher '{promo_id_or_code}' trong danh sách hoạt động"


def delete_promotion(promo_id_or_code: str) -> Tuple[bool, Optional[str]]:
    """
    Xóa mềm (Soft Delete) Voucher và chuyển sang promotions_history.json:
    - Xóa khỏi promotions.json
    - Thêm vào promotions_history.json với status='deleted', isDeleted=True, deletedAt=now_iso
    """
    promotions = read_json(get_config_path("promotions.json"), default=[])
    history = get_promotions_history()
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    clean_target = promo_id_or_code.strip().upper()

    target_idx = -1
    for i, p in enumerate(promotions):
        if p.get("id") == promo_id_or_code or (p.get("code") or "").upper() == clean_target:
            target_idx = i
            break

    if target_idx == -1:
        return False, f"Không tìm thấy voucher '{promo_id_or_code}' cần xóa"

    deleted_item = promotions.pop(target_idx)
    deleted_item["status"] = "deleted"
    deleted_item["isDeleted"] = True
    deleted_item["isActive"] = False
    deleted_item["deletedAt"] = now_iso
    deleted_item["updatedAt"] = now_iso

    history.insert(0, deleted_item)
    save_promotions(promotions)
    save_promotions_history(history)
    return True, None


def restore_promotion(promo_id_or_code: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Khôi phục voucher từ promotions_history.json về lại promotions.json:
    - Xóa khỏi promotions_history.json
    - Thêm vào promotions.json với status='active', isDeleted=False, isActive=True, deletedAt=None
    """
    history = get_promotions_history()
    promotions = read_json(get_config_path("promotions.json"), default=[])
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    clean_target = promo_id_or_code.strip().upper()

    target_idx = -1
    for i, p in enumerate(history):
        if p.get("id") == promo_id_or_code or (p.get("code") or "").upper() == clean_target:
            target_idx = i
            break

    if target_idx == -1:
        return False, None, f"Không tìm thấy voucher '{promo_id_or_code}' trong lịch sử đã xóa"

    restored_item = history.pop(target_idx)
    restored_item["status"] = "active"
    restored_item["isDeleted"] = False
    restored_item["isActive"] = True
    restored_item["deletedAt"] = None
    restored_item["updatedAt"] = now_iso

    promotions.insert(0, restored_item)
    save_promotions(promotions)
    save_promotions_history(history)
    return True, restored_item, None



# 6. Biên Dịch Đa Ngôn Ngữ (Translations i18n) - Hỗ trợ cache RAM theo mtime file
@functools.lru_cache(maxsize=32)
def _get_cached_translations() -> Dict[str, Any]:
    return read_json_cached(get_config_path("translations.json"), default={})


def get_translations(use_cache: bool = True) -> Dict[str, Any]:
    if use_cache:
        return read_json_cached(get_config_path("translations.json"), default={})
    return read_json(get_config_path("translations.json"), default={})


def save_translations(translations: Dict[str, Any]) -> bool:
    filepath = get_config_path("translations.json")
    success = write_json(filepath, translations)
    invalidate_file_cache(filepath)
    _get_cached_translations.cache_clear()
    return success


# 7. Báo Cáo Hao Hụt (Wastage Reports)
def get_wastage_reports() -> List[Dict[str, Any]]:
    return read_json(get_config_path("wastage_reports.json"), default=[])


def save_wastage_reports(reports: List[Dict[str, Any]]) -> bool:
    return write_json(get_config_path("wastage_reports.json"), reports)


def add_wastage_report(report: Dict[str, Any]) -> bool:
    reports = get_wastage_reports()
    reports.insert(0, report)
    return save_wastage_reports(reports)


# 8. Khách Hàng CRM (Customers CRM)
def get_customers() -> List[Dict[str, Any]]:
    cust_file = get_config_path("customers.json")
    if os.path.exists(cust_file):
        used_path = cust_file
        data = read_json(cust_file, default=[])
    else:
        used_path = get_config_path("customers_crm.json")
        data = read_json(used_path, default=[])
    normalized = _normalize_list_of_dicts(data)
    print(f"[DATA_SERVICE] get_customers() | Path: {used_path} | Found {len(normalized)} customers", flush=True)
    return normalized


def get_customer_by_phone(phone: str) -> Optional[Dict[str, Any]]:
    if not phone:
        return None
    customers = get_customers()
    clean_phone = str(phone).strip().lower()
    for c in customers:
        if isinstance(c, dict):
            c_phone = str(c.get("phone") or "").strip().lower()
            if c_phone == clean_phone:
                return c
    return None


def save_customers(customers: List[Dict[str, Any]]) -> bool:
    success = write_json(get_config_path("customers.json"), customers)
    # Đồng bộ sang customers_crm.json cho tương thích ngược
    write_json(get_config_path("customers_crm.json"), customers)
    return success


# ==========================================
# PHÂN MẢNH ĐƠN HÀNG THEO THÁNG (MONTHLY ORDERS)
# ==========================================

def get_monthly_order_filename(year_month: Optional[str] = None) -> str:
    """
    Sinh tên file đơn hàng theo định dạng: orders_YYYY_MM.json
    Mặc định lấy tháng hiện tại nếu không truyền vào (VD: 'orders_2026_08.json').
    """
    if not year_month:
        year_month = datetime.now().strftime("%Y_%m")
    else:
        # Chuẩn hóa nếu truyền vào '2026-08' hoặc '2026_08'
        year_month = year_month.replace("-", "_")
    return f"orders_{year_month}.json"


def get_orders_file_path(year_month: Optional[str] = None) -> str:
    filename = get_monthly_order_filename(year_month)
    os.makedirs(ORDERS_DIR, exist_ok=True)
    return os.path.join(ORDERS_DIR, filename)


def read_orders_by_month(year_month: Optional[str] = None) -> List[Dict[str, Any]]:
    """Đọc toàn bộ đơn hàng trong 1 tháng xác định."""
    filepath = get_orders_file_path(year_month)
    return _normalize_list_of_dicts(read_json(filepath, default=[]))


def write_orders_by_month(orders: List[Dict[str, Any]], year_month: Optional[str] = None) -> bool:
    """Ghi danh sách đơn hàng vào đúng file tháng tương ứng."""
    filepath = get_orders_file_path(year_month)
    return write_json(filepath, orders)


def extract_year_month_from_order(order: Dict[str, Any]) -> str:
    """Trích xuất YYYY_MM từ order ID hoặc createdAt."""
    created_at = order.get("createdAt")
    if created_at and len(created_at) >= 7:
        return created_at[:7].replace("-", "_")

    order_id = order.get("id") or ""
    # Nếu order_id có dạng 'ord_20260822_001'
    if order_id.startswith("ord_") and len(order_id) >= 10:
        raw_ym = order_id[4:10]  # '202608'
        if raw_ym.isdigit() and len(raw_ym) == 6:
            return f"{raw_ym[:4]}_{raw_ym[4:]}"

    return datetime.now().strftime("%Y_%m")


def get_order_by_id(order_id: str, year_month: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Tìm đơn hàng theo ID.
    Nếu biết year_month sẽ tìm thẳng trong file tháng đó.
    Nếu không truyền, tự suy luận từ order_id hoặc quét các tháng gần nhất.
    """
    if not year_month and order_id.startswith("ord_") and len(order_id) >= 10:
        raw_ym = order_id[4:10]
        if raw_ym.isdigit() and len(raw_ym) == 6:
            year_month = f"{raw_ym[:4]}_{raw_ym[4:]}"

    # Tìm trong tháng cụ thể
    if year_month:
        orders = read_orders_by_month(year_month)
        for o in orders:
            if o.get("id") == order_id or o.get("orderCode") == order_id:
                return o

    # Nếu không tìm thấy, quét qua các file đơn hàng trong thư mục orders
    if os.path.exists(ORDERS_DIR):
        files = sorted(os.listdir(ORDERS_DIR), reverse=True)
        for f in files:
            if f.startswith("orders_") and f.endswith(".json"):
                month_key = f[7:-5]
                orders = read_json(os.path.join(ORDERS_DIR, f), default=[])
                for o in orders:
                    if o.get("id") == order_id or o.get("orderCode") == order_id:
                        return o
    return None


def save_order(order: Dict[str, Any]) -> bool:
    """
    Lưu đơn hàng mới vào đúng file phân mảnh theo tháng.
    """
    year_month = extract_year_month_from_order(order)
    orders = read_orders_by_month(year_month)
    
    # Kiểm tra xem đơn đã tồn tại chưa để cập nhật hoặc thêm mới
    order_id = order.get("id")
    for i, existing in enumerate(orders):
        if existing.get("id") == order_id:
            orders[i] = order
            return write_orders_by_month(orders, year_month)

    orders.insert(0, order)
    return write_orders_by_month(orders, year_month)


def update_order_status(
    order_id: str,
    new_status: str,
    year_month: Optional[str] = None,
    **extra_fields: Any
) -> Optional[Dict[str, Any]]:
    """
    Cập nhật trạng thái và các trường mở rộng của đơn hàng.
    """
    order = get_order_by_id(order_id, year_month=year_month)
    if not order:
        return None

    order["status"] = new_status
    for key, value in extra_fields.items():
        if isinstance(value, dict) and isinstance(order.get(key), dict):
            order[key].update(value)
        else:
            order[key] = value

    ym = year_month or extract_year_month_from_order(order)
    orders = read_orders_by_month(ym)
    for i, o in enumerate(orders):
        if o.get("id") == order_id:
            orders[i] = order
            write_orders_by_month(orders, ym)
            return order
    return order


def delete_order(order_id: str, year_month: Optional[str] = None) -> bool:
    """
    Xóa đơn hàng theo ID (dùng cho dọn dẹp dữ liệu kiểm thử hoặc hủy đơn).
    """
    order = get_order_by_id(order_id, year_month=year_month)
    if not order:
        return False

    ym = year_month or extract_year_month_from_order(order)
    orders = read_orders_by_month(ym)
    new_orders = [o for o in orders if o.get("id") != order_id and o.get("orderCode") != order_id]
    return write_orders_by_month(new_orders, ym)


# ==========================================
# QUẢN LÝ ĐƠN HÀNG THEO THƯ MỤC KHÁCH HÀNG (USER ORDERS REPOSITORY)
# Cấu trúc: config/anne/users/{user_id}/orders.json
# ==========================================

def clean_user_identifier(identifier: str) -> str:
    """Chuẩn hóa mã định danh người dùng / số điện thoại / email thành tên thư mục an toàn."""
    if not identifier:
        return "guest"
    cleaned = identifier.strip().lower()
    # Loại bỏ các ký tự không hợp lệ trong đường dẫn file
    for ch in ['/', '\\', ':', '*', '?', '"', '<', '>', '|', ' ']:
        cleaned = cleaned.replace(ch, '_')
    return cleaned


def get_user_folder_path(user_identifier: str) -> str:
    """Trả về đường dẫn thư mục cá nhân của khách hàng: config/anne/users/{user_id}/"""
    clean_id = clean_user_identifier(user_identifier)
    user_dir = os.path.join(USERS_DIR, clean_id)
    if not os.path.exists(user_dir):
        os.makedirs(user_dir, exist_ok=True)
    return user_dir


def get_user_orders_file_path(user_identifier: str) -> str:
    """Trả về đường dẫn file orders.json trong thư mục riêng của khách: config/anne/users/{user_id}/orders.json"""
    user_dir = get_user_folder_path(user_identifier)
    return os.path.join(user_dir, "orders.json")


def get_user_orders(user_identifier: str) -> List[Dict[str, Any]]:
    """Đọc toàn bộ danh sách đơn hàng đã mua của khách hàng."""
    filepath = get_user_orders_file_path(user_identifier)
    return _normalize_list_of_dicts(read_json(filepath, default=[]))


def save_user_orders(user_identifier: str, orders: List[Dict[str, Any]]) -> bool:
    """Ghi danh sách đơn hàng vào thư mục cá nhân của khách."""
    filepath = get_user_orders_file_path(user_identifier)
    return write_json(filepath, orders)


def extract_user_identifier_from_order(order: Dict[str, Any]) -> str:
    """Xác định mã định danh duy nhất của khách hàng từ thông tin đơn hàng."""
    sender = order.get("sender") or {}
    phone = (sender.get("phone") or "").strip()
    if phone:
        return phone

    email = (sender.get("email") or "").strip()
    if email:
        return email

    customer_id = (order.get("customerId") or order.get("userId") or "").strip()
    if customer_id:
        return customer_id

    # Fallback từ lịch sử tạo
    history = order.get("history") or []
    if history and isinstance(history, list):
        for h in history:
            updated_by = h.get("updatedBy")
            if updated_by and updated_by != "system":
                return updated_by

    return "guest"


def sync_order_to_user_folder(order: Dict[str, Any]) -> bool:
    """
    Đồng bộ đơn hàng vào thư mục riêng của khách hàng (config/anne/users/{user_id}/orders.json):
    - Nếu đơn đã tồn tại -> cập nhật trạng thái mới nhất.
    - Nếu đơn mới -> chèn lên đầu danh sách.
    - Đồng thời lưu thông tin profile tóm tắt nếu có.
    """
    user_id = extract_user_identifier_from_order(order)
    if not user_id or user_id == "guest":
        return False

    user_orders = get_user_orders(user_id)
    order_id = order.get("id") or order.get("orderCode")

    # Kiểm tra xem đơn đã có trong sổ đơn cá nhân chưa
    existing_idx = next((i for i, o in enumerate(user_orders) if (o.get("id") == order_id or o.get("orderCode") == order_id)), -1)
    if existing_idx != -1:
        user_orders[existing_idx] = order
    else:
        user_orders.insert(0, order)

    save_user_orders(user_id, user_orders)

    # Lưu/cập nhật thông tin profile của khách vào config/anne/users/{user_id}/profile.json
    sender = order.get("sender") or {}
    if sender.get("name") or sender.get("phone"):
        profile_path = os.path.join(get_user_folder_path(user_id), "profile.json")
        current_profile = read_json(profile_path, default={})
        current_profile.update({
            "id": user_id,
            "name": sender.get("name") or current_profile.get("name", "Khách Hàng"),
            "phone": sender.get("phone") or current_profile.get("phone", user_id),
            "email": sender.get("email") or current_profile.get("email", ""),
            "lastOrderAt": order.get("createdAt") or datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "totalOrders": len(user_orders)
        })
        write_json(profile_path, current_profile)

    return True


def get_all_orders_across_all_months() -> List[Dict[str, Any]]:
    """Đọc toàn bộ đơn hàng trên toàn hệ thống (quét qua mọi file orders_YYYY_MM.json)."""
    all_orders = []
    if os.path.exists(ORDERS_DIR):
        files = sorted(os.listdir(ORDERS_DIR), reverse=True)
        for f in files:
            if f.startswith("orders_") and f.endswith(".json"):
                month_orders = _normalize_list_of_dicts(read_json(os.path.join(ORDERS_DIR, f), default=[]))
                all_orders.extend(month_orders)
    return all_orders


def migrate_existing_orders_to_users() -> int:
    """Quét toàn bộ đơn hàng hiện có và tự động phân loại vào thư mục từng khách hàng."""
    all_orders = get_all_orders_across_all_months()
    synced_count = 0
    for ord_item in all_orders:
        if sync_order_to_user_folder(ord_item):
            synced_count += 1
    return synced_count


# ==========================================
# THÔNG TIN DOANH NGHIỆP & LIÊN HỆ (infoCompany.json)
# ==========================================

DEFAULT_COMPANY_INFO: Dict[str, Any] = {
    "companyName": "NỞ HOA THẢ BÌNH",
    "brandSlogan": "Hoa Tươi Thiết Kế & Cắm Hoa Thả Bình Nghệ Thuật",
    "address": "183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP. Hồ Chí Minh",
    "phone": "0976.491.322",
    "hotline": "0976.491.322",
    "email": "cskh@nohoathabinh.vn",
    "workingHours": "Thứ 2 - Chủ Nhật: 7:00 - 21:00",
    "taxCode": "0318999888",
    "website": "https://nohoathabinh.vn",
    "facebook": "https://facebook.com/nohoathabinh",
    "instagram": "https://instagram.com/nohoathabinh",
    "zalo": "https://zalo.me/0976491322",
    "mapUrl": "https://maps.google.com/?q=183/37+Đường+3+Tháng+2,+Phường+11,+Quận+10,+TP.+Hồ+Chí+Minh",
    "mapEmbedUrl": "https://maps.google.com/maps?q=183%2F37%20%C4%90%C6%B0%E1%BB%9Dng%203%20Th%C3%A1ng%202%2C%20Ph%C6%B0%E1%BB%9Dng%2011%2C%20Qu%E1%BA%ADn%2010%2C%20Th%C3%A0nh%20ph%E1%BB%91%20H%E1%BB%93%20Ch%C3%AD%20Minh&t=&z=16&ie=UTF8&iwloc=&output=embed",
    "updatedAt": "2026-08-26T12:00:00Z"
}


def get_company_info(use_cache: bool = False) -> Dict[str, Any]:
    """
    Đọc thông tin doanh nghiệp từ file config infoCompany.json.
    Tự động khởi tạo dữ liệu mặc định nếu file chưa tồn tại.
    """
    filepath = get_config_path("infoCompany.json")
    if not os.path.exists(filepath):
        write_json(filepath, DEFAULT_COMPANY_INFO)
        return dict(DEFAULT_COMPANY_INFO)

    data = read_json(filepath, default={})
    if not isinstance(data, dict) or not data:
        data = dict(DEFAULT_COMPANY_INFO)
        write_json(filepath, data)

    # Đảm bảo có đầy đủ các trường thiết yếu
    for k, v in DEFAULT_COMPANY_INFO.items():
        if k not in data or data[k] is None:
            data[k] = v

    return data


def save_company_info(info_dict: Dict[str, Any]) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Lưu cấu hình thông tin doanh nghiệp vào file infoCompany.json.
    """
    if not isinstance(info_dict, dict):
        return False, None, "Dữ liệu cấu hình doanh nghiệp không hợp lệ"

    current = get_company_info(use_cache=False)
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # Cập nhật các trường
    company_name = (info_dict.get("companyName") or current.get("companyName", "NỞ HOA THẢ BÌNH")).strip()
    if not company_name:
        return False, None, "Vui lòng nhập tên công ty / thương hiệu"

    updated = {
        "companyName": company_name,
        "brandSlogan": (info_dict.get("brandSlogan") or current.get("brandSlogan", "")).strip(),
        "address": (info_dict.get("address") or current.get("address", "")).strip(),
        "phone": (info_dict.get("phone") or current.get("phone", "")).strip(),
        "hotline": (info_dict.get("hotline") or current.get("hotline", "")).strip(),
        "email": (info_dict.get("email") or current.get("email", "")).strip(),
        "workingHours": (info_dict.get("workingHours") or current.get("workingHours", "")).strip(),
        "taxCode": (info_dict.get("taxCode") or current.get("taxCode", "")).strip(),
        "website": (info_dict.get("website") or current.get("website", "")).strip(),
        "facebook": (info_dict.get("facebook") or current.get("facebook", "")).strip(),
        "instagram": (info_dict.get("instagram") or current.get("instagram", "")).strip(),
        "zalo": (info_dict.get("zalo") or current.get("zalo", "")).strip(),
        "mapUrl": (info_dict.get("mapUrl") or current.get("mapUrl", "")).strip(),
        "mapEmbedUrl": (info_dict.get("mapEmbedUrl") or current.get("mapEmbedUrl", "")).strip(),
        "updatedAt": now_iso
    }

    filepath = get_config_path("infoCompany.json")
    success = write_json(filepath, updated)
    if success:
        return True, updated, None
    return False, None, "Không thể ghi file cấu hình infoCompany.json"




