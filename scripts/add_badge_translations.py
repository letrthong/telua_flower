import json
import os
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BADGE_TRANSLATIONS = {
    "badge_new": {
        "type": "system",
        "vi": "Mới",
        "en": "New",
        "ja": "新着",
        "ko": "신상품",
        "zh": "新品"
    },
    "badge_best_seller": {
        "type": "system",
        "vi": "Bán chạy",
        "en": "Best Seller",
        "ja": "人気",
        "ko": "베스트",
        "zh": "畅销"
    },
    "badge_hot": {
        "type": "system",
        "vi": "Hot",
        "en": "Hot",
        "ja": "おすすめ",
        "ko": "인기",
        "zh": "热门"
    },
    "badge_model_new": {
        "type": "system",
        "vi": "Mẫu Mới",
        "en": "New Arrival",
        "ja": "新着アイテム",
        "ko": "신규 디자인",
        "zh": "最新款式"
    },
    "badge_vip": {
        "type": "system",
        "vi": "Độc Bản VIP",
        "en": "VIP Exclusive",
        "ja": "VIP限定",
        "ko": "VIP 독점",
        "zh": "VIP尊享"
    }
}

target_file = os.path.abspath("config/anne/translations.json")
with open(target_file, "r", encoding="utf-8") as f:
    data = json.load(f)

existing = data.get("translations", {})
for k, val in BADGE_TRANSLATIONS.items():
    existing[k] = val

data["translations"] = existing

with open(target_file, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("✅ Đã bổ sung các từ khóa dịch nhãn badge (Mới, Bán chạy, Hot, Độc Bản VIP) thành công!")
