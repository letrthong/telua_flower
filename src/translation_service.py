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
    translations_by_lang: Dict[str, str]
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Cập nhật hoặc thêm mới 1 khóa biên dịch cho cả 5 ngôn ngữ.
    """
    if not key or not isinstance(translations_by_lang, dict):
        return False, None, "Khóa hoặc giá trị dịch không hợp lệ"

    clean_key = key.strip()
    data = get_translations(use_cache=False)
    if "translations" not in data:
        data["translations"] = {}

    current_key_dict = data["translations"].get(clean_key, {})
    for lang in SUPPORTED_LANGUAGES:
        if lang in translations_by_lang:
            current_key_dict[lang] = translations_by_lang[lang].strip()

    data["translations"][clean_key] = current_key_dict
    save_translations(data)
    return True, data["translations"][clean_key], None


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
                data["translations"][k] = {}
            for lang in SUPPORTED_LANGUAGES:
                if lang in v:
                    data["translations"][k][lang] = str(v[lang]).strip()

    save_translations(data)
    return True, data, None
