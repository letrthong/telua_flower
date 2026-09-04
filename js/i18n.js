// Quản lý chuyển đổi ngôn ngữ và Web Cache (localStorage) kết hợp RESTful API ETag
import { API_BASE } from './utils.js';

export const langLabels = {
    vi: "🇻🇳 Tiếng Việt",
    en: "🇬🇧 English",
    ja: "🇯🇵 日本語",
    ko: "🇰🇷 한국어",
    zh: "🇨🇳 中文"
};

export const langShortCodes = {
    vi: "VI",
    en: "EN",
    ja: "JA",
    ko: "KO",
    zh: "ZH"
};

const TRANSLATIONS_STORAGE_KEY = 'telua_translations_cache_v2';
const TRANSLATIONS_ETAG_KEY = 'telua_translations_etag_v2';

let currentLang = 'vi';
export let translations = { vi: {}, en: {}, ja: {}, ko: {}, zh: {} };

/**
 * Chuyển đổi dữ liệu ma trận từ Backend API sang định dạng theo từng mã ngôn ngữ
 */
export function transformRawTranslations(rawTranslations) {
    const result = { vi: {}, en: {}, ja: {}, ko: {}, zh: {} };
    if (!rawTranslations || typeof rawTranslations !== 'object') return result;

    for (const [key, val] of Object.entries(rawTranslations)) {
        if (!val || typeof val !== 'object') continue;
        ['vi', 'en', 'ja', 'ko', 'zh'].forEach(lang => {
            if (val[lang]) {
                result[lang][key] = val[lang];
            }
        });
    }
    return result;
}

// 1. Tải tức thì từ LocalStorage Cache (0ms - Instant Boot)
try {
    if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem(TRANSLATIONS_STORAGE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed === 'object' && Object.keys(parsed.vi || {}).length > 0) {
                translations = parsed;
            }
        }
    }
} catch (e) {
    console.warn("Lỗi đọc cache từ điển:", e);
}

/**
 * Đồng bộ từ điển đa ngôn ngữ từ API Backend có hỗ trợ HTTP ETag (304 Cache)
 */
export async function fetchAndSyncTranslations() {
    try {
        const headers = {};
        let storedEtag = null;
        if (typeof localStorage !== 'undefined') {
            storedEtag = localStorage.getItem(TRANSLATIONS_ETAG_KEY);
            if (storedEtag && Object.keys(translations.vi || {}).length > 0) {
                headers['If-None-Match'] = storedEtag;
            }
        }

        const res = await fetch(`${API_BASE}/translations?_t=${Date.now()}`, { headers });
        
        // Nếu 304 Not Modified -> Giữ nguyên cache
        if (res.status === 304) {
            return translations;
        }

        if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
                const raw = json.data.translations || json.data;
                const newTrans = transformRawTranslations(raw);
                translations = newTrans;
                if (typeof window !== 'undefined') window.translations = translations;

                const etag = res.headers.get('ETag');
                if (typeof localStorage !== 'undefined') {
                    try {
                        localStorage.setItem(TRANSLATIONS_STORAGE_KEY, JSON.stringify(translations));
                        if (etag) localStorage.setItem(TRANSLATIONS_ETAG_KEY, etag);
                    } catch (e) {
                        console.warn("Storage write error:", e);
                    }
                }

                // Cập nhật lại giao diện sau khi nạp từ điển mới
                const activeLang = (typeof window !== 'undefined' && window.currentLang) ? window.currentLang : currentLang;
                setLanguage(activeLang);
            }
        }
    } catch (err) {
        console.warn("Không thể kết nối API từ điển đa ngôn ngữ:", err);
    }
    return translations;
}

export function setLanguage(lang) {
    const trans = (typeof window !== 'undefined' && window.translations) ? window.translations : (typeof translations !== 'undefined' ? translations : {});
    if (!trans[lang]) lang = 'vi';
    currentLang = lang;
    if (typeof window !== 'undefined') window.currentLang = lang;

    // 1. Lưu vào Web Storage / Cache của trình duyệt
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('anne_flower_lang', lang);
        }
    } catch (e) {
        console.warn("Storage not accessible:", e);
    }

    // 2. Cập nhật thuộc tính lang cho thẻ html
    if (typeof document !== 'undefined') {
        document.documentElement.lang = lang;

        // 3. Cập nhật tiêu đề trang
        if (trans[lang] && trans[lang].site_title) {
            document.title = trans[lang].site_title;
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
            if (trans[lang] && trans[lang][key]) {
                el.innerHTML = trans[lang][key];
            }
        });

        // 7. Dịch placeholder của các ô input
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (trans[lang] && trans[lang][key]) {
                el.setAttribute('placeholder', trans[lang][key]);
            }
        });

        // 8. Đóng các dropdown ngôn ngữ nếu đang mở
        const langMenu = document.getElementById('langDropdownMenu');
        if (langMenu) langMenu.classList.add('hidden');
        const langMenuMobile = document.getElementById('langDropdownMenuMobile');
        if (langMenuMobile) langMenuMobile.classList.add('hidden');

        // 9. Giữ vững thông tin doanh nghiệp động (hotline, email, địa chỉ) sau khi đổi ngôn ngữ
        if (typeof window !== 'undefined' && typeof window.applyStorefrontCompanyInfo === 'function' && window.currentCompanyInfo) {
            window.applyStorefrontCompanyInfo(window.currentCompanyInfo);
        }

        // 10. Render lại danh mục & sản phẩm
        if (typeof window !== 'undefined' && typeof window.renderStorefrontCategories === 'function') {
            window.renderStorefrontCategories();
        }
        if (typeof window !== 'undefined' && typeof window.renderAllProducts === 'function') {
            window.renderAllProducts();
        }

        // 11. Render lại giỏ hàng và cập nhật đơn hàng
        if (typeof window !== 'undefined' && typeof window.renderCartDrawer === 'function') {
            window.renderCartDrawer();
        }
        if (typeof window !== 'undefined' && typeof window.updateOrderSummary === 'function') {
            window.updateOrderSummary();
        }

        // 12. Render lại Add-ons trong modal chi tiết nếu modal đang mở
        if (typeof window !== 'undefined' && typeof window.renderAddonsInModal === 'function') {
            const detailModal = document.getElementById('productQuickDetailModal');
            if (detailModal && !detailModal.classList.contains('hidden') && detailModal.style.display !== 'none') {
                window.renderAddonsInModal(lang);
            }
        }
    }
}

// Khởi chạy đồng bộ ngay khi load module
if (typeof window !== 'undefined') {
    window.currentLang = currentLang;
    window.translations = translations;
    window.langLabels = langLabels;
    window.langShortCodes = langShortCodes;
    window.setLanguage = setLanguage;
    window.fetchAndSyncTranslations = fetchAndSyncTranslations;
    window.transformRawTranslations = transformRawTranslations;

    // Tự động gọi API đồng bộ trong nền
    fetchAndSyncTranslations();
}
