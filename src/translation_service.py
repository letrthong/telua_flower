import os
import sys
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_service import (
    get_translations,
    save_translations
)

SUPPORTED_LANGUAGES = ["vi", "en", "ja", "ko", "zh"]


def get_all_translations(use_cache: bool = True) -> Dict[str, Any]:
    """Lấy toàn bộ từ điển 5 ngôn ngữ (mặc định dùng cache RAM theo mtime file)."""
    return get_translations(use_cache=use_cache)


def update_translation_key(
    key: str,
    translations_by_lang: Dict[str, str],
    key_type: Optional[str] = None
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Cập nhật hoặc thêm mới 1 khóa biên dịch cho cả 5 ngôn ngữ.
    Mặc định các khóa mới thêm từ GUI/API sẽ có key_type = "user".
    """
    if not key or not isinstance(translations_by_lang, dict):
        return False, None, "Khóa hoặc giá trị dịch không hợp lệ"

    clean_key = key.strip()
    data = get_translations(use_cache=False)
    if "translations" not in data:
        data["translations"] = {}

    is_new = clean_key not in data["translations"]
    current_key_dict = data["translations"].get(clean_key, {})

    # Xác định type: Nếu tạo mới thì mặc định là 'user', nếu cập nhật thì giữ nguyên type cũ (trừ khi truyền rõ)
    if key_type:
        current_key_dict["type"] = key_type
    elif is_new:
        current_key_dict["type"] = "user"
    elif "type" not in current_key_dict:
        current_key_dict["type"] = "system"

    for lang in SUPPORTED_LANGUAGES:
        if lang in translations_by_lang:
            current_key_dict[lang] = str(translations_by_lang[lang]).strip()

    data["translations"][clean_key] = current_key_dict
    save_translations(data)
    return True, data["translations"][clean_key], None


def delete_translation_key(key: str) -> Tuple[bool, Optional[str]]:
    """
    Xóa 1 khóa bản dịch tùy chỉnh (user).
    Tuyệt đối chặn xóa đối với khóa hệ thống (type: 'system').
    """
    if not key:
        return False, "Khóa bản dịch không hợp lệ"

    clean_key = key.strip()
    data = get_translations(use_cache=False)
    translations = data.get("translations", {})

    if clean_key not in translations:
        return False, f"Không tìm thấy khóa bản dịch '{clean_key}'"

    key_item = translations[clean_key]
    key_type = key_item.get("type", "system") if isinstance(key_item, dict) else "system"

    if key_type == "system":
        return False, f"Không thể xóa khóa bản dịch hệ thống '{clean_key}' (System Key Protected)"

    del translations[clean_key]
    data["translations"] = translations
    save_translations(data)
    return True, None


def batch_update_translations(
    new_translations_dict: Dict[str, Dict[str, str]]
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Cập nhật hàng loạt bảng ma trận từ điển 5 thứ tiếng.
    """
    if not isinstance(new_translations_dict, dict):
        return False, None, "Dữ liệu ma trận biên dịch không hợp lệ"

    data = get_translations(use_cache=False)
    if "translations" not in data:
        data["translations"] = {}

    for k, v in new_translations_dict.items():
        if isinstance(v, dict):
            if k not in data["translations"]:
                data["translations"][k] = {"type": v.get("type", "user")}
            for lang in SUPPORTED_LANGUAGES:
                if lang in v:
                    data["translations"][k][lang] = str(v[lang]).strip()

    save_translations(data)
    return True, data, None
