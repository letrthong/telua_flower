import json
import os
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

NEW_TRANSLATIONS = {
    "hero_badge": {
        "type": "system",
        "vi": "Tháng Yêu Thương",
        "en": "Month of Love",
        "ja": "愛と感謝の月",
        "ko": "사랑의 달",
        "zh": "爱的感恩月"
    },
    "nav_home": {
        "type": "system",
        "vi": "Trang Chủ",
        "en": "Home",
        "ja": "ホーム",
        "ko": "홈",
        "zh": "首页"
    },
    "account": {
        "type": "system",
        "vi": "Tài khoản",
        "en": "Account",
        "ja": "マイアカウント",
        "ko": "내 계정",
        "zh": "我的账户"
    },
    "cart": {
        "type": "system",
        "vi": "Giỏ hàng",
        "en": "Cart",
        "ja": "カート",
        "ko": "장바구니",
        "zh": "购物车"
    },
    "hero_cta": {
        "type": "system",
        "vi": "Khám Phá Ngay",
        "en": "Explore Now",
        "ja": "今すぐ見る",
        "ko": "지금 둘러보기",
        "zh": "立即探索"
    },
    "brand_name": {
        "type": "system",
        "vi": "NỞ HOA THẢ BÌNH",
        "en": "NỞ HOA THẢ BÌNH",
        "ja": "Nở Hoa Thả Bình",
        "ko": "Nở Hoa Thả Bình",
        "zh": "Nở Hoa Thả Bình"
    },
    "brand_slogan": {
        "type": "system",
        "vi": "Trao gửi yêu thương",
        "en": "Deliver Love & Elegance",
        "ja": "真心を込めて届ける花",
        "ko": "사랑과 감동을 전합니다",
        "zh": "传递真挚爱与温暖"
    },
    "select_language": {
        "type": "system",
        "vi": "Chọn ngôn ngữ",
        "en": "Select Language",
        "ja": "言語を選択",
        "ko": "언어 선택",
        "zh": "选择语言"
    },
    "nav_themes": {
        "type": "system",
        "vi": "Chủ Đề Hoa",
        "en": "Floral Themes",
        "ja": "テーマ別フラワー",
        "ko": "테마별 꽃",
        "zh": "鲜花主题"
    },
    "sub_birthday": {
        "type": "system",
        "vi": "Hoa Sinh Nhật",
        "en": "Birthday Flowers",
        "ja": "誕生日のお祝い花",
        "ko": "생일 축하 꽃",
        "zh": "生日祝福鲜花"
    },
    "sub_opening": {
        "type": "system",
        "vi": "Hoa Khai Trương",
        "en": "Grand Opening Flowers",
        "ja": "開店・開業祝い花",
        "ko": "개업 축하 꽃",
        "zh": "开业庆典花篮"
    },
    "sub_graduation": {
        "type": "system",
        "vi": "Hoa Tốt Nghiệp",
        "en": "Graduation Flowers",
        "ja": "卒業祝い花",
        "ko": "졸업 축하 꽃",
        "zh": "毕业典礼花束"
    },
    "sub_sympathy": {
        "type": "system",
        "vi": "Hoa Chia Buồn",
        "en": "Condolence Flowers",
        "ja": "お悔やみ・供花",
        "ko": "근조 & 추모 꽃",
        "zh": "悼念追思鲜花"
    },
    "nav_promotions": {
        "type": "system",
        "vi": "Khuyến Mãi",
        "en": "Promotions",
        "ja": "キャンペーン",
        "ko": "프로모션",
        "zh": "优惠活动"
    },
    "nav_store_locator": {
        "type": "system",
        "vi": "Tìm Cửa Hàng",
        "en": "Store Locator",
        "ja": "店舗案内",
        "ko": "매장 찾기",
        "zh": "门店导航"
    },
    "nav_store_locator_map": {
        "type": "system",
        "vi": "Tìm Cửa Hàng (Map)",
        "en": "Store Locator (Map)",
        "ja": "店舗マップ",
        "ko": "매장 위치 (지도)",
        "zh": "门店地图"
    },
    "nav_about": {
        "type": "system",
        "vi": "Về chúng tôi",
        "en": "About Us",
        "ja": "私たちについて",
        "ko": "브랜드 소개",
        "zh": "关于我们"
    },
    "nav_contact": {
        "type": "system",
        "vi": "Liên hệ",
        "en": "Contact",
        "ja": "お問い合わせ",
        "ko": "고객 문의",
        "zh": "联系我们"
    },
    "nav_news": {
        "type": "system",
        "vi": "Tin tức",
        "en": "News & Stories",
        "ja": "最新ニュース",
        "ko": "소식 & 스토리",
        "zh": "新闻资讯"
    },
    "feat_fresh_title": {
        "type": "system",
        "vi": "Hoa Tươi Mỗi Ngày",
        "en": "Daily Fresh Blooms",
        "ja": "毎日仕入れる新鮮な花",
        "ko": "매일 입고되는 싱싱한 꽃",
        "zh": "每日新鲜到店"
    },
    "feat_fresh_desc": {
        "type": "system",
        "vi": "Cam kết 100% hoa tươi nhập mới mỗi ngày, cắm theo mẫu.",
        "en": "100% fresh flowers curated daily from premium farms, crafted exactly as pictured.",
        "ja": "毎日厳選された新鮮な花のみを使用し、見本通り美しくアレンジします。",
        "ko": "매일 엄선 입고되는 100% 신선한 생화로 샘플과 동일하게 정성껏 제작합니다.",
        "zh": "100%精选每日直供高品质鲜花，保证实物与样图高度一致。"
    },
    "feat_payment_title": {
        "type": "system",
        "vi": "Thanh Toán Linh Hoạt",
        "en": "Flexible & Secure Payment",
        "ja": "安心・柔軟な決済",
        "ko": "안전하고 편리한 결제",
        "zh": "安全便捷支付"
    },
    "feat_payment_desc": {
        "type": "system",
        "vi": "Hỗ trợ đa dạng phương thức thanh toán an toàn, tiện lợi.",
        "en": "Multiple secure payment methods: VietQR, Credit Cards, MoMo, COD.",
        "ja": "VietQR、クレジットカード、MoMo、代金引換など多彩な決済に対応。",
        "ko": "VietQR 자동 결제, 신용카드, MoMo, 착불 등 다양한 결제 수단 지원.",
        "zh": "支持VietQR扫码、国际信用卡、MoMo钱包及货到付款等多元便捷支付方式。"
    },
    "search_placeholder": {
        "type": "system",
        "vi": "Tìm kiếm bó hoa, lẵng hoa, sự kiện...",
        "en": "Search for bouquets, vases, events...",
        "ja": "花束、アレンジメント、イベントを検索...",
        "ko": "꽃다발, 화병, 축하 꽃 검색...",
        "zh": "搜索花束、艺术花瓶、庆典活动..."
    },
    "search_placeholder_mobile": {
        "type": "system",
        "vi": "Tìm hoa tươi...",
        "en": "Search flowers...",
        "ja": "花を検索...",
        "ko": "꽃 검색...",
        "zh": "搜索鲜花..."
    },
    "mobile_menu_title": {
        "type": "system",
        "vi": "Danh mục",
        "en": "Categories",
        "ja": "カテゴリー",
        "ko": "카테고리",
        "zh": "商品分类"
    },
    "store_badge": {
        "type": "system",
        "vi": "Ghé Thăm Trực Tiếp",
        "en": "Visit In-Store",
        "ja": "ショールームご来店",
        "ko": "오프라인 쇼룸 방문",
        "zh": "线下实体门店"
    },
    "store_title": {
        "type": "system",
        "vi": "Hệ Thống Chuỗi Cửa Hàng Nở Hoa Thả Bình",
        "en": "Nở Hoa Thả Bình Showroom & Store Network",
        "ja": "Nở Hoa Thả Bình フラワーショールーム店舗一覧",
        "ko": "Nở Hoa Thả Bình 프리미엄 플라워 쇼룸 매장 안내",
        "zh": "Nở Hoa Thả Bình 实体花店与精品展厅网络"
    },
    "store_desc": {
        "type": "system",
        "vi": "Kính mời quý khách ghé thăm không gian hoa tươi và trải nghiệm trực tiếp các mẫu bình nghệ thuật độc bản tại chuỗi showroom của chúng tôi.",
        "en": "Experience our aromatic flower spaces and bespoke ceramic vase collections in person at our showrooms.",
        "ja": "心落ち着く花の空間と、厳選されたオリジナル陶器花瓶の数々をショールームでご体験ください。",
        "ko": "향기로운 생화 공간과 독창적인 도자기 화병 컬렉션을 가까운 쇼룸에서 직접 경험해보세요.",
        "zh": "诚邀亲临我们的精品花艺展厅，近距离鉴赏原创陶瓷花瓶与芬芳鲜花艺术。"
    },
    "store_type": {
        "type": "system",
        "vi": "Showroom Trực Thuộc",
        "en": "Official Showroom",
        "ja": "直営ショールーム",
        "ko": "직영 플라워 쇼룸",
        "zh": "官方直营展厅"
    },
    "store_lbl_address": {
        "type": "system",
        "vi": "Địa chỉ cửa hàng:",
        "en": "Store Address:",
        "ja": "店舗所在地:",
        "ko": "매장 주소:",
        "zh": "门店地址:"
    },
    "store_lbl_hours": {
        "type": "system",
        "vi": "Giờ mở cửa:",
        "en": "Opening Hours:",
        "ja": "営業時間:",
        "ko": "영업 시간:"
        ,"zh": "营业时间:"
    },
    "store_lbl_hotline": {
        "type": "system",
        "vi": "Hotline đặt hoa nhanh:",
        "en": "Order Hotline:",
        "ja": "お電話注文ホットライン:",
        "ko": "주문 상담 핫라인:",
        "zh": "订花服务热线:"
    },
    "store_lbl_amenities": {
        "type": "system",
        "vi": "Tiện ích phục vụ:",
        "en": "Amenities & Services:",
        "ja": "サービス＆設備:",
        "ko": "매장 편의 서비스:",
        "zh": "门店配套服务:"
    },
    "store_btn_directions": {
        "type": "system",
        "vi": "<i class=\"fa-solid fa-diamond-turn-right mr-2\"></i> Chỉ Đường Đến Shop",
        "en": "<i class=\"fa-solid fa-diamond-turn-right mr-2\"></i> Get Directions",
        "ja": "<i class=\"fa-solid fa-diamond-turn-right mr-2\"></i> ルート案内",
        "ko": "<i class=\"fa-solid fa-diamond-turn-right mr-2\"></i> 오시는 길 안내",
        "zh": "<i class=\"fa-solid fa-diamond-turn-right mr-2\"></i> 路线导航"
    },
    "store_btn_copy": {
        "type": "system",
        "vi": "<i class=\"fa-regular fa-copy mr-2\"></i> Sao Chép Địa Chỉ",
        "en": "<i class=\"fa-regular fa-copy mr-2\"></i> Copy Address",
        "ja": "<i class=\"fa-regular fa-copy mr-2\"></i> 住所をコピー",
        "ko": "<i class=\"fa-regular fa-copy mr-2\"></i> 주소 복사",
        "zh": "<i class=\"fa-regular fa-copy mr-2\"></i> 复制地址"
    },
    "store_map_title": {
        "type": "system",
        "vi": "Vị trí Showroom trên Google Maps",
        "en": "Showroom Location on Google Maps",
        "ja": "Googleマップで店舗位置を確認",
        "ko": "Google 지도 쇼룸 위치",
        "zh": "Google地图门店位置"
    },
    "store_view_larger_map": {
        "type": "system",
        "vi": "Xem bản đồ lớn",
        "en": "View Larger Map",
        "ja": "拡大地図を表示",
        "ko": "지도 크게 보기",
        "zh": "查看大地图"
    },
    "footer_intro": {
        "type": "system",
        "vi": "Tiệm hoa uy tín tại TP.HCM. Chúng tôi tự hào mang đến những sản phẩm hoa tươi chất lượng, thiết kế sáng tạo để bạn trao gửi yêu thương trọn vẹn nhất.",
        "en": "Premier flower boutique in HCMC. We take pride in offering top-quality, creatively crafted floral designs to help you deliver heartfelt emotions.",
        "ja": "ホーチミン市の上質なフラワーブティック。真心を込めた美しい花束で、大切な方へ特別な感動をお届けします。",
        "ko": "호치민시 최고의 프리미엄 플라워 부티크. 소중한 분께 따뜻한 감동과 사랑을 전할 수 있도록 정성을 다합니다.",
        "zh": "胡志明市高端鲜花定制品牌。我们倾注匠心为您呈现高品质原创花艺，传递每一份真挚的心意。"
    },
    "footer_contact_title": {
        "type": "system",
        "vi": "Thông Tin Liên Hệ",
        "en": "Contact Information",
        "ja": "店舗連絡先",
        "ko": "고객 문의 안내",
        "zh": "联系方式"
    },
    "footer_policy_title": {
        "type": "system",
        "vi": "Chính Sách & Hỗ Trợ",
        "en": "Policies & Support",
        "ja": "ご利用案内・ポリシー",
        "ko": "이용 안내 & 정책",
        "zh": "服务条款与政策"
    },
    "footer_link_about": {
        "type": "system",
        "vi": "Về Nở Hoa Thả Bình",
        "en": "About Nở Hoa Thả Bình",
        "ja": "Nở Hoa Thả Bìnhについて",
        "ko": "브랜드 스토리",
        "zh": "关于 Nở Hoa Thả Bình"
    },
    "footer_link_delivery": {
        "type": "system",
        "vi": "Chính sách giao hàng",
        "en": "Delivery Policy",
        "ja": "配送・配達ポリシー",
        "ko": "배송 정책 안내",
        "zh": "配送政策说明"
    },
    "footer_link_returns": {
        "type": "system",
        "vi": "Chính sách đổi trả",
        "en": "Return & Refund Policy",
        "ja": "返品・交換ポリシー",
        "ko": "교환 및 환불 정책",
        "zh": "退换货及售后保障"
    },
    "footer_link_faq": {
        "type": "system",
        "vi": "Câu hỏi thường gặp",
        "en": "FAQs",
        "ja": "よくあるご質問",
        "ko": "자주 묻는 질문 (FAQ)",
        "zh": "常见问题解答 (FAQ)"
    },
    "footer_link_privacy": {
        "type": "system",
        "vi": "Chính sách bảo mật",
        "en": "Privacy Policy",
        "ja": "プライバシーポリシー",
        "ko": "개인정보 처리방침",
        "zh": "隐私权保护政策"
    },
    "footer_newsletter_title": {
        "type": "system",
        "vi": "Đăng Ký Nhận Tin",
        "en": "Subscribe to Newsletter",
        "ja": "メルマガ会員登録",
        "ko": "뉴스레터 구독",
        "zh": "订阅最新资讯"
    },
    "footer_newsletter_desc": {
        "type": "system",
        "vi": "Nhận ngay ưu đãi 10% cho đơn hàng đầu tiên khi đăng ký email.",
        "en": "Get 10% off your first order when you subscribe with your email.",
        "ja": "メールアドレス登録で、初回ご注文が10%OFFになるクーポンを進呈。",
        "ko": "이메일 구독 시 첫 주문 10% 즉시 할인 쿠폰을 드립니다.",
        "zh": "立即订阅邮件通讯，首单尊享 10% 专属优惠礼遇。"
    },
    "newsletter_placeholder": {
        "type": "system",
        "vi": "Nhập email của bạn...",
        "en": "Enter your email address...",
        "ja": "メールアドレスを入力...",
        "ko": "이메일 주소를 입력하세요...",
        "zh": "请输入您的电子邮箱..."
    },
    "footer_newsletter_btn": {
        "type": "system",
        "vi": "Đăng Ký",
        "en": "Subscribe",
        "ja": "登録する",
        "ko": "구독하기",
        "zh": "立即订阅"
    },
    "footer_copyright": {
        "type": "system",
        "vi": "&copy; 2026 Bản quyền thuộc về Công ty TNHH Nở Hoa Thả Bình.",
        "en": "&copy; 2026 All rights reserved by Nở Hoa Thả Bình Co., Ltd.",
        "ja": "&copy; 2026 Nở Hoa Thả Bình Co., Ltd. All rights reserved.",
        "ko": "&copy; 2026 Nở Hoa Thả Bình Co., Ltd. All rights reserved.",
        "zh": "&copy; 2026 版权所有 Nở Hoa Thả Bình 有限责任公司。"
    }
}

target_file = os.path.abspath("config/anne/translations.json")
with open(target_file, "r", encoding="utf-8") as f:
    data = json.load(f)

existing = data.get("translations", {})

# Merge new translations
for k, val in NEW_TRANSLATIONS.items():
    existing[k] = val

data["translations"] = existing

with open(target_file, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"✅ Đã cập nhật thành công {len(NEW_TRANSLATIONS)} bản dịch mới vào {target_file}!")
