import json
import os
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CART_TRANSLATIONS = {
    "btn_add_to_cart": {
        "type": "system",
        "vi": "Thêm giỏ hàng",
        "en": "Add to Cart",
        "ja": "カートに追加",
        "ko": "장바구니 담기",
        "zh": "加入购物车"
    },
    "modal_btn_add_to_cart": {
        "type": "system",
        "vi": "Thêm Vào Giỏ Hàng",
        "en": "Add to Cart",
        "ja": "カートに追加",
        "ko": "장바구니 담기",
        "zh": "加入购物车"
    },
    "toast_added_cart_item": {
        "type": "system",
        "vi": "Đã thêm \"{name}\" vào giỏ hàng!",
        "en": "Added \"{name}\" to your cart!",
        "ja": "「{name}」をカートに追加しました！",
        "ko": "「{name}」을(를) 장바구니에 담았습니다!",
        "zh": "已将“{name}”加入购物车！"
    },
    "toast_added_cart_simple": {
        "type": "system",
        "vi": "Đã thêm vào giỏ hàng!",
        "en": "Added to cart!",
        "ja": "カートに追加しました！",
        "ko": "장바구니에 추가되었습니다!",
        "zh": "已加入购物车！"
    },
    "cart_drawer_title": {
        "type": "system",
        "vi": "Giỏ Hàng Của Bạn",
        "en": "Your Shopping Cart",
        "ja": "ショッピングカート",
        "ko": "쇼핑 장바구니",
        "zh": "我的购物车"
    },
    "cart_subtotal_label": {
        "type": "system",
        "vi": "Tạm tính:",
        "en": "Subtotal:",
        "ja": "小計:",
        "ko": "소계:",
        "zh": "小计:"
    },
    "cart_btn_checkout": {
        "type": "system",
        "vi": "Tiến Hành Đặt Hàng",
        "en": "Proceed to Checkout",
        "ja": "ご注文手続きへ",
        "ko": "주문하기",
        "zh": "立即结算"
    },
    "cart_empty_title": {
        "type": "system",
        "vi": "Giỏ hàng của bạn đang trống",
        "en": "Your cart is empty",
        "ja": "カートに商品がありません",
        "ko": "장바구니가 비어 있습니다",
        "zh": "您的购物车是空的"
    },
    "cart_empty_desc": {
        "type": "system",
        "vi": "Hãy chọn những đóa hoa tươi đẹp nhất nhé!",
        "en": "Pick the most beautiful blooms for yourself or loved ones!",
        "ja": "お気に入りの美しいお花を選びましょう！",
        "ko": "소중한 분을 위한 아름다운 꽃을 골라보세요!",
        "zh": "快去挑选心仪的美丽鲜花吧！"
    }
}

target_file = os.path.abspath("config/anne/translations.json")
with open(target_file, "r", encoding="utf-8") as f:
    data = json.load(f)

existing = data.get("translations", {})
for k, val in CART_TRANSLATIONS.items():
    existing[k] = val

data["translations"] = existing

with open(target_file, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("✅ Đã bổ sung đầy đủ các từ khóa giỏ hàng đa ngôn ngữ thành công!")
