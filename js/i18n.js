// Quản lý chuyển đổi ngôn ngữ và Web Cache (localStorage)
let currentLang = 'vi';

function setLanguage(lang) {
    if (!translations[lang]) lang = 'vi';
    currentLang = lang;

    // 1. Lưu vào Web Storage / Cache của trình duyệt
    try {
        localStorage.setItem('anne_flower_lang', lang);
    } catch (e) {
        console.warn("Storage not accessible:", e);
    }

    // 2. Cập nhật thuộc tính lang cho thẻ html
    document.documentElement.lang = lang;

    // 3. Cập nhật tiêu đề trang
    if (translations[lang] && translations[lang].site_title) {
        document.title = translations[lang].site_title;
    }

    // 4. Đồng bộ giá trị của SelectBox Desktop & Mobile
    const selDesktop = document.getElementById('langSelectBoxDesktop');
    if (selDesktop) selDesktop.value = lang;

    const selMobile = document.getElementById('langSelectBoxMobile');
    if (selMobile) selMobile.value = lang;

    // 5. Cập nhật icon checkmark trong Mobile Menu
    ['vi', 'en', 'ja', 'ko', 'zh'].forEach(l => {
        const checkEl = document.querySelector(`.lang-check-${l}`);
        if (checkEl) {
            if (l === lang) checkEl.classList.remove('hidden');
            else checkEl.classList.add('hidden');
        }
    });

    // 6. Dịch toàn bộ các thẻ có thuộc tính data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            el.innerHTML = translations[lang][key];
        }
    });

    // 7. Dịch placeholder của các ô input
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[lang] && translations[lang][key]) {
            el.setAttribute('placeholder', translations[lang][key]);
        }
    });

    // 8. Đóng các dropdown ngôn ngữ nếu đang mở
    const langMenu = document.getElementById('langDropdownMenu');
    if (langMenu) langMenu.classList.add('hidden');
    const langMenuMobile = document.getElementById('langDropdownMenuMobile');
    if (langMenuMobile) langMenuMobile.classList.add('hidden');

    // 9. Render lại sản phẩm nếu các hàm render đã sẵn sàng
    if (typeof renderProducts === 'function' && typeof products_bo_hoa !== 'undefined') {
        renderProducts(products_bo_hoa, 'bo-hoa-grid');
        renderProducts(products_ke_hoa, 'ke-hoa-grid');
        renderProducts(products_binh_hoa, 'binh-hoa-grid');
    }
}
