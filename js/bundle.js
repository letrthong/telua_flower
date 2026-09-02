/**
 * TELUA FLOWER CONNECT - CONSOLIDATED BUNDLE JS
 * Bundled from modular components for high performance and single network request.
 */
(function() {
'use strict';


// ==========================================================================
// MODULE: utils.js
// ==========================================================================
// Các tiện ích (Utils): Lazy Loading hình ảnh, Thông báo Toast, Bản đồ showroom, Sao chép clipboard

// Base URL chuẩn hóa cho RESTful API Telua Flower Connect v1 (tương tự Lu Quan /api/hotelconnect/v1)
const API_BASE = "/api/flower/v1";

/**
 * Chuẩn hóa chuỗi tiếng Việt: loại bỏ dấu thanh, dấu mũ, chuyển đ/Đ -> d để tìm kiếm không dấu
 */
function removeVietnameseTones(str) {
    if (!str) return '';
    return str
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .trim();
}

/**
 * Chuẩn hóa và lấy đường dẫn URL ảnh hoa tươi (hỗ trợ RESTful API, đường dẫn tĩnh, CDN và fallback)
 */
function resolveImageUrl(imagePath, fallback = 'https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500') {
    if (!imagePath) return fallback;
    const str = String(imagePath).trim();
    if (!str) return fallback;
    if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:image')) {
        return str;
    }
    // Nếu là đường dẫn /api/ hoặc /images/ đã có sẵn
    if (str.startsWith('/api/')) {
        return str;
    }
    if (str.startsWith('/flower/images/')) {
        const fname = str.replace('/flower/images/', '');
        return `${API_BASE}/images/${fname}`;
    }
    if (str.startsWith('/images/')) {
        const fname = str.replace('/images/', '');
        return `${API_BASE}/images/${fname}`;
    }
    if (!str.startsWith('/')) {
        return `${API_BASE}/images/${str}`;
    }
    return str;
}

// Tối ưu hóa Lazy Loading cho hình ảnh toàn trang
function initLazyLoadingImages() {
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    lazyImages.forEach(img => {
        const markLoaded = () => {
            img.classList.add('loaded');
            if (img.parentElement && img.parentElement.classList.contains('img-skeleton')) {
                img.parentElement.classList.remove('img-skeleton');
            }
        };

        if (img.complete && img.naturalWidth > 0) {
            markLoaded();
        } else {
            img.addEventListener('load', markLoaded, { once: true });
            img.addEventListener('error', () => {
                markLoaded();
                handleImageErrorFallback(img);
            }, { once: true });
        }
    });
}

/**
 * Fallback xử lý ảnh lỗi trực tiếp từ Client (chuyển sang GitHub CDN hoặc Unsplash 0ms mà không làm đơ máy chủ)
 */
function handleImageErrorFallback(imgEl) {
    if (!imgEl) return;
    imgEl.classList.add('loaded');
    if (imgEl.parentElement && imgEl.parentElement.classList.contains('img-skeleton')) {
        imgEl.parentElement.classList.remove('img-skeleton');
    }
    const currentSrc = imgEl.src || "";
    const cleanName = currentSrc.split("/").pop().split("?")[0];

    // Tầng 1: Thử nạp từ GitHub CDN
    if (!imgEl.dataset.cdnTried && cleanName && !currentSrc.includes("githubusercontent")) {
        imgEl.dataset.cdnTried = "1";
        imgEl.src = `https://raw.githubusercontent.com/letrthong/telua_public_image/main/anne/images/${cleanName}`;
        return;
    }

    // Tầng 2: Fallback ảnh Unsplash chuẩn
    if (!imgEl.dataset.fallbackTried) {
        imgEl.dataset.fallbackTried = "1";
        // Nếu là ảnh add-on (sản phẩm kèm theo), dùng placeholder trung tính thay vì ảnh hoa
        if (imgEl.closest && imgEl.closest("#addonsList")) {
            imgEl.src = "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=200";
        } else {
            imgEl.src = "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500";
        }
    }
}

if (typeof window !== "undefined") {
    window.handleImageErrorFallback = handleImageErrorFallback;
}

// Hiển thị thông báo Toast ở góc trái dưới màn hình (Tự động đóng sau 5 giây)
function showToast(message, type = 'success', duration = 5000) {
    if (typeof document === 'undefined' || !message) return;

    // Tìm hoặc tạo container toast ở góc trái dưới màn hình
    let container = document.getElementById('toastContainerBottomLeft');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainerBottomLeft';
        container.className = 'fixed bottom-6 left-6 z-[99999] flex flex-col space-y-3 max-w-sm pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto transform -translate-x-full opacity-0 transition-all duration-300 ease-out flex items-center justify-between p-4 rounded-xl shadow-2xl border text-sm font-medium backdrop-blur-md';

    let iconHtml = '<i class="fa-solid fa-circle-check text-emerald-500 text-lg mr-3 flex-shrink-0"></i>';
    let colorClasses = 'bg-white/95 text-gray-800 border-emerald-200 shadow-emerald-500/10';

    if (type === 'error') {
        iconHtml = '<i class="fa-solid fa-circle-xmark text-red-500 text-lg mr-3 flex-shrink-0"></i>';
        colorClasses = 'bg-white/95 text-gray-800 border-red-200 shadow-red-500/10';
    } else if (type === 'warning') {
        iconHtml = '<i class="fa-solid fa-triangle-exclamation text-amber-500 text-lg mr-3 flex-shrink-0"></i>';
        colorClasses = 'bg-white/95 text-gray-800 border-amber-200 shadow-amber-500/10';
    } else if (type === 'info') {
        iconHtml = '<i class="fa-solid fa-circle-info text-blue-500 text-lg mr-3 flex-shrink-0"></i>';
        colorClasses = 'bg-white/95 text-gray-800 border-blue-200 shadow-blue-500/10';
    }

    toast.className += ` ${colorClasses}`;
    toast.innerHTML = `
        <div class="flex items-center mr-3">
            ${iconHtml}
            <span class="leading-snug">${message}</span>
        </div>
        <button type="button" class="text-gray-400 hover:text-gray-600 transition ml-2 p-1 text-base leading-none focus:outline-none">&times;</button>
    `;

    const closeBtn = toast.querySelector('button');
    let isRemoved = false;
    const removeToast = () => {
        if (isRemoved) return;
        isRemoved = true;
        toast.classList.remove('translate-x-0', 'opacity-100');
        toast.classList.add('-translate-x-full', 'opacity-0');
        setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 300);
    };

    if (closeBtn) closeBtn.onclick = removeToast;

    container.appendChild(toast);

    // Kích hoạt animation trượt vào góc trái dưới mượt mà
    requestAnimationFrame(() => {
        toast.classList.remove('-translate-x-full', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
    });

    // Tự động đóng sau `duration` (mặc định 5 giây)
    setTimeout(() => {
        removeToast();
    }, duration);
}

/**
 * Hộp thoại Xác nhận tùy biến cao cấp (Custom Confirmation Dialog)
 * Trả về Promise<boolean>: resolve(true) nếu bấm Xác Nhận, resolve(false) nếu bấm Hủy Bỏ
 */
function showConfirmDialog({
    title = "Xác nhận hành động",
    message = "Bạn có chắc chắn muốn thực hiện thao tác này?",
    detail = "",
    confirmText = "Xác nhận",
    cancelText = "Hủy bỏ",
    type = "warning", // "warning", "danger", "success", "info"
    icon = ""
} = {}) {
    return new Promise((resolve) => {
        if (typeof document === "undefined") return resolve(false);

        // Xóa modal cũ nếu còn
        const oldModal = document.getElementById("customConfirmModalContainer");
        if (oldModal && oldModal.parentElement) oldModal.parentElement.removeChild(oldModal);

        let iconClass = icon;
        let iconBg = "bg-amber-50 text-amber-600 border border-amber-200";
        let confirmBtnBg = "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/30";

        if (type === "danger") {
            if (!iconClass) iconClass = "fa-solid fa-trash-can";
            iconBg = "bg-red-50 text-red-600 border border-red-200";
            confirmBtnBg = "bg-red-600 hover:bg-red-700 text-white shadow-red-600/30";
        } else if (type === "success") {
            if (!iconClass) iconClass = "fa-solid fa-eye";
            iconBg = "bg-emerald-50 text-emerald-600 border border-emerald-200";
            confirmBtnBg = "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30";
        } else if (type === "info") {
            if (!iconClass) iconClass = "fa-solid fa-circle-info";
            iconBg = "bg-blue-50 text-blue-600 border border-blue-200";
            confirmBtnBg = "bg-primary hover:bg-primaryHover text-white shadow-primary/30";
        } else {
            // Default warning (Ẩn danh mục, ẩn mẫu hoa)
            if (!iconClass) iconClass = "fa-solid fa-eye-slash";
            iconBg = "bg-amber-50 text-amber-600 border border-amber-200";
            confirmBtnBg = "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/30";
        }

        const container = document.createElement("div");
        container.id = "customConfirmModalContainer";
        container.className = "fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs opacity-0 transition-opacity duration-200";

        container.innerHTML = `
            <div class="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-md w-full p-6 sm:p-7 transform scale-95 opacity-0 transition-all duration-200 ease-out flex flex-col">
                <div class="flex items-start space-x-4 mb-4">
                    <div class="w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="text-base sm:text-lg font-bold text-gray-900 leading-tight">${title}</h3>
                        <p class="text-xs sm:text-sm text-gray-600 mt-1.5 leading-relaxed font-medium">${message}</p>
                    </div>
                </div>

                ${detail ? `
                    <div class="bg-gray-50 rounded-2xl p-3.5 border border-gray-200/70 mb-5 text-xs text-gray-600 leading-relaxed">
                        <i class="fa-solid fa-circle-info mr-1 text-gray-400"></i> ${detail}
                    </div>
                ` : '<div class="mb-3"></div>'}

                <div class="flex items-center justify-end space-x-3 pt-2 border-t border-gray-100">
                    <button type="button" id="customConfirmCancelBtn" class="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs sm:text-sm transition duration-150 focus:outline-none cursor-pointer">
                        ${cancelText}
                    </button>
                    <button type="button" id="customConfirmOkBtn" class="flex-1 sm:flex-none px-5 py-2.5 rounded-xl ${confirmBtnBg} font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition duration-150 transform active:scale-95 focus:outline-none cursor-pointer">
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        const card = container.querySelector("div");
        const cancelBtn = container.querySelector("#customConfirmCancelBtn");
        const okBtn = container.querySelector("#customConfirmOkBtn");

        let isClosed = false;
        const closeDialog = (result) => {
            if (isClosed) return;
            isClosed = true;
            document.removeEventListener("keydown", handleKeyDown);
            container.classList.remove("opacity-100");
            container.classList.add("opacity-0");
            if (card) {
                card.classList.remove("scale-100", "opacity-100");
                card.classList.add("scale-95", "opacity-0");
            }
            setTimeout(() => {
                if (container.parentElement) container.parentElement.removeChild(container);
                resolve(result);
            }, 200);
        };

        cancelBtn.onclick = () => closeDialog(false);
        okBtn.onclick = () => closeDialog(true);

        container.onclick = (e) => {
            if (e.target === container) closeDialog(false);
        };

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                document.removeEventListener("keydown", handleKeyDown);
                closeDialog(false);
            } else if (e.key === "Enter") {
                document.removeEventListener("keydown", handleKeyDown);
                closeDialog(true);
            }
        };
        document.addEventListener("keydown", handleKeyDown, { once: true });

        // Animation hiển thị
        requestAnimationFrame(() => {
            container.classList.remove("opacity-0");
            container.classList.add("opacity-100");
            if (card) {
                card.classList.remove("scale-95", "opacity-0");
                card.classList.add("scale-100", "opacity-100");
            }
            okBtn.focus();
        });
    });
}

/**
 * Khóa màn hình với lớp phủ mờ (Screen Lock Overlay) khi cập nhật dữ liệu
 */
function showScreenLock(message = "Đang cập nhật cấu hình & đồng bộ hệ thống...") {
    if (typeof document === "undefined") return;
    let overlay = document.getElementById("globalScreenLockOverlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "globalScreenLockOverlay";
        overlay.className = "fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs transition-opacity duration-200 opacity-0 pointer-events-auto select-none";
        overlay.innerHTML = `
            <div class="bg-white/95 rounded-2xl p-6 shadow-2xl flex flex-col items-center max-w-xs text-center border border-pink-100 transform scale-95 transition-all duration-200" id="globalScreenLockCard">
                <div class="w-12 h-12 rounded-full bg-pink-50 text-primary flex items-center justify-center text-xl mb-3 shadow-inner">
                    <i class="fa-solid fa-circle-notch fa-spin"></i>
                </div>
                <div id="globalScreenLockText" class="font-bold text-gray-800 text-sm leading-snug">
                    ${message}
                </div>
                <div class="text-[11px] text-gray-400 mt-1.5 flex items-center justify-center">
                    <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping mr-1.5"></span> Đang đồng bộ dữ liệu...
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    } else {
        const textEl = document.getElementById("globalScreenLockText");
        if (textEl) textEl.textContent = message;
    }

    requestAnimationFrame(() => {
        overlay.classList.remove("opacity-0", "pointer-events-none");
        overlay.classList.add("opacity-100", "pointer-events-auto");
        const card = document.getElementById("globalScreenLockCard");
        if (card) {
            card.classList.remove("scale-95");
            card.classList.add("scale-100");
        }
    });
}

function hideScreenLock() {
    const overlay = document.getElementById("globalScreenLockOverlay");
    if (!overlay) return;
    overlay.classList.remove("opacity-100");
    overlay.classList.add("opacity-0", "pointer-events-none");
    const card = document.getElementById("globalScreenLockCard");
    if (card) {
        card.classList.remove("scale-100");
        card.classList.add("scale-95");
    }
    setTimeout(() => {
        if (overlay && overlay.parentElement) {
            overlay.parentElement.removeChild(overlay);
        }
    }, 250);
}

let storefrontBranches = [];
let currentSelectedBranch = null;

// Tải và hiển thị danh sách chuỗi cửa hàng động
async function loadAndRenderStorefrontBranches() {
    const navContainer = document.getElementById("storeBranchNav");
    if (!navContainer) return;

    try {
        const res = await fetch(`${API_BASE}/branches`);
        const json = await res.json();

        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            storefrontBranches = json.data.filter((b) => b.isActive !== false);
        } else {
            // Fallback nếu API chưa trả về
            storefrontBranches = [
                {
                    id: "branch_q10",
                    code: "CN_Q10",
                    name: "Nở Hoa Thả Bình - Showroom Quận 10 (Flagship)",
                    address: "183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP. Hồ Chí Minh",
                    phone: "0976.491.322",
                    openHours: "07:00 - 21:00 (Thứ 2 - Chủ Nhật)",
                    amenities: "Đậu xe ô tô/xe máy miễn phí • Cắm hoa nghệ thuật tại chỗ • Phòng lạnh bảo quản hoa",
                    lat: 10.7725,
                    lng: 106.6698
                },
                {
                    id: "branch_q1",
                    code: "CN_Q1",
                    name: "Nở Hoa Thả Bình - Showroom Bến Nghé Quận 1",
                    address: "Số 2 Hải Triều, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
                    phone: "0976.491.323",
                    openHours: "08:00 - 21:30 (Thứ 2 - Chủ Nhật)",
                    amenities: "Giao hoa hỏa tốc văn phòng Bitexco • Gói quà cao cấp",
                    lat: 10.7715,
                    lng: 106.7042
                },
                {
                    id: "branch_thao_dien",
                    code: "CN_Q2",
                    name: "Nở Hoa Thả Bình - Showroom Thảo Điền",
                    address: "68 Xuân Thủy, Phường Thảo Điền, TP. Thủ Đức, TP. Hồ Chí Minh",
                    phone: "0976.491.324",
                    openHours: "07:30 - 21:00 (Thứ 2 - Chủ Nhật)",
                    amenities: "Không gian workshop cắm hoa • Hoa nhập khẩu cao cấp Hà Lan & Ecuador",
                    lat: 10.8035,
                    lng: 106.7328
                }
            ];
        }

        renderStorefrontBranchButtons();
        if (storefrontBranches.length > 0) {
            selectShowroomBranch(storefrontBranches[0].id);
        }
    } catch (e) {
        console.warn("Lỗi tải chuỗi showroom:", e);
    }
}

function renderStorefrontBranchButtons() {
    const navContainer = document.getElementById("storeBranchNav");
    if (!navContainer) return;

    let html = "";
    storefrontBranches.forEach((b, idx) => {
        const isSelected = currentSelectedBranch && currentSelectedBranch.id === b.id;
        const btnClass = isSelected
            ? "px-4 py-2 bg-primary text-white font-bold text-xs sm:text-sm rounded-full shadow-md shadow-pink-200 border border-primary transition flex items-center"
            : "px-4 py-2 bg-white text-gray-700 hover:text-primary hover:bg-pink-50 font-bold text-xs sm:text-sm rounded-full shadow-xs border border-gray-200 transition flex items-center";

        html += `
            <button onclick="selectShowroomBranch('${b.id}')" class="${btnClass}">
                <i class="fa-solid fa-store mr-1.5 ${isSelected ? 'text-white' : 'text-primary'}"></i>
                <span>${b.name.replace("Nở Hoa Thả Bình - ", "")}</span>
            </button>
        `;
    });

    navContainer.innerHTML = html;
}

function selectShowroomBranch(branchId) {
    const b = storefrontBranches.find((item) => item.id === branchId) || storefrontBranches[0];
    if (!b) return;

    currentSelectedBranch = b;
    renderStorefrontBranchButtons();

    // Cập nhật thẻ thông tin
    const nameEl = document.getElementById("storeNameVal");
    const addrEl = document.getElementById("storeAddressVal");
    const hoursEl = document.getElementById("storeHoursVal");
    const hotlineLink = document.getElementById("storeHotlineLink");
    const amenitiesEl = document.getElementById("storeAmenitiesVal");
    const mapIframe = document.getElementById("storeMapIframe");
    const directionsLink = document.getElementById("storeDirectionsLink");
    const largerMapLink = document.getElementById("storeLargerMapLink");

    if (nameEl) nameEl.textContent = b.name;
    if (addrEl) addrEl.textContent = b.address;
    if (hoursEl) hoursEl.textContent = b.openHours || "07:30 - 21:00 (Thứ 2 - Chủ Nhật)";
    if (hotlineLink) {
        hotlineLink.textContent = b.phone || "0976.491.322";
        hotlineLink.href = `tel:${(b.phone || "").replace(/\./g, "")}`;
    }
    if (amenitiesEl) amenitiesEl.textContent = b.amenities || "Đậu xe ô tô/xe máy miễn phí, cắm hoa nghệ thuật theo yêu cầu";

    // Cập nhật iframe Google Maps và Link chỉ đường
    const query = encodeURIComponent(b.address);
    if (mapIframe) {
        mapIframe.src = `https://maps.google.com/maps?q=${query}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
    }
    if (directionsLink) {
        directionsLink.href = `https://www.google.com/maps/dir/?api=1&destination=${query}`;
    }
    if (largerMapLink) {
        largerMapLink.href = `https://maps.google.com/?q=${query}`;
    }
}

// Điều hướng tới bản đồ showroom
function openStoreMap(e) {
    if (e) e.preventDefault();
    const storeSection = document.getElementById('tim-cua-hang');
    const storeCard = document.getElementById('storeInfoCard');

    if (storeSection) {
        storeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Hiệu ứng highlight thẻ thông tin showroom
        if (storeCard) {
            storeCard.classList.add('ring-4', 'ring-primary', 'shadow-2xl', 'scale-[1.01]');
            setTimeout(() => {
                storeCard.classList.remove('ring-4', 'ring-primary', 'shadow-2xl', 'scale-[1.01]');
            }, 2000);
        }
    }
}

// Sao chép địa chỉ showroom vào clipboard
function copyStoreAddress() {
    const addressText = currentSelectedBranch 
        ? currentSelectedBranch.address 
        : (document.getElementById("storeAddressVal") ? document.getElementById("storeAddressVal").textContent : "183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP. Hồ Chí Minh");
        
    const copiedMsg = "Đã sao chép địa chỉ showroom vào clipboard!";

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(addressText).then(() => {
            showToast(copiedMsg);
        }).catch(() => {
            showToast(addressText);
        });
    } else {
        showToast(addressText);
    }
}

// Tự động khởi chạy khi DOM sẵn sàng
if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
        loadAndRenderStorefrontBranches();
    });
}

// Global binding
if (typeof window !== "undefined") {
    window.API_BASE = API_BASE;
    window.showToast = showToast;
    window.showConfirmDialog = showConfirmDialog;
    window.showScreenLock = showScreenLock;
    window.hideScreenLock = hideScreenLock;
    window.openStoreMap = openStoreMap;
    window.copyStoreAddress = copyStoreAddress;
    window.selectShowroomBranch = selectShowroomBranch;
    window.resolveImageUrl = resolveImageUrl;
    window.loadAndRenderStorefrontBranches = loadAndRenderStorefrontBranches;
    window.removeVietnameseTones = removeVietnameseTones;
}


// ==========================================================================
// MODULE: i18n.js
// ==========================================================================
// Quản lý chuyển đổi ngôn ngữ và Web Cache (localStorage) kết hợp RESTful API ETag

const langLabels = {
    vi: "🇻🇳 Tiếng Việt",
    en: "🇬🇧 English",
    ja: "🇯🇵 日本語",
    ko: "🇰🇷 한국어",
    zh: "🇨🇳 中文"
};

const langShortCodes = {
    vi: "VI",
    en: "EN",
    ja: "JA",
    ko: "KO",
    zh: "ZH"
};

const TRANSLATIONS_STORAGE_KEY = 'telua_translations_cache_v2';
const TRANSLATIONS_ETAG_KEY = 'telua_translations_etag_v2';

let currentLang = 'vi';
let translations = { vi: {}, en: {}, ja: {}, ko: {}, zh: {} };

/**
 * Chuyển đổi dữ liệu ma trận từ Backend API sang định dạng theo từng mã ngôn ngữ
 */
function transformRawTranslations(rawTranslations) {
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
async function fetchAndSyncTranslations() {
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

function setLanguage(lang) {
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


// ==========================================================================
// MODULE: products.js
// ==========================================================================
// Dịch vụ nạp dữ liệu sản phẩm & danh mục động từ Backend API (đọc trực tiếp từ config/anne/products.json)

let cachedProducts = [];
let cachedCategories = [];

/**
 * Lấy toàn bộ danh sách sản phẩm động từ Backend (đọc từ config/anne/products.json)
 * @param {boolean} activeOnly - Chỉ lấy sản phẩm đang bật bán
 */
async function getProducts(activeOnly = true) {
    try {
        const url = activeOnly ? `${API_BASE}/products?active=true&_t=${Date.now()}` : `${API_BASE}/products?_t=${Date.now()}`;
        const res = await fetch(url);
        if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                cachedProducts = json.data;
                if (typeof window !== 'undefined') window.allStorefrontProducts = cachedProducts;
                return cachedProducts;
            }
        }
    } catch (e) {
        console.warn("Lỗi nạp sản phẩm từ API:", e);
    }
    return cachedProducts;
}

const productDetailMemoryCache = new Map();
const MAX_PRODUCT_CACHE_SIZE = 120; // Giới hạn tối đa 120 sản phẩm trong RAM client chống tràn bộ nhớ

/**
 * Xóa cache chi tiết sản phẩm trong RAM (cho một sản phẩm hoặc toàn bộ)
 */
function clearProductDetailCache(productId = null) {
    if (productId) {
        productDetailMemoryCache.delete(productId);
    } else {
        productDetailMemoryCache.clear();
    }
}

/**
 * Lấy chi tiết một sản phẩm theo ID (đọc từ config/anne/products/{id}.json có In-Memory RAM Cache giới hạn)
 * @param {string} productId - Mã định danh sản phẩm
 * @param {string} [lang] - Ngôn ngữ cần lấy (vi, en, ja, ko, zh)
 */
async function getProductById(productId, lang = null) {
    if (!productId) return null;
    const currentLang = lang || ((typeof window !== 'undefined' && window.currentLang) ? window.currentLang : 'vi');
    const cacheKey = `${productId}_${currentLang}`;
    
    if (productDetailMemoryCache.has(cacheKey)) {
        return productDetailMemoryCache.get(cacheKey);
    }
    try {
        const url = `${API_BASE}/products/${productId}?lang=${encodeURIComponent(currentLang)}`;
        const res = await fetch(url);
        if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
                // Giới hạn kích thước cache RAM: Tự động loại bỏ phần tử cũ nhất (FIFO/LRU) khi vượt ngưỡng
                if (productDetailMemoryCache.size >= MAX_PRODUCT_CACHE_SIZE) {
                    const oldestKey = productDetailMemoryCache.keys().next().value;
                    if (oldestKey) productDetailMemoryCache.delete(oldestKey);
                }
                productDetailMemoryCache.set(cacheKey, json.data);
                return json.data;
            }
        }
    } catch (e) {
        console.warn("Lỗi nạp chi tiết sản phẩm:", e);
    }
    return cachedProducts.find(p => p && p.id === productId) || null;
}

/**
 * Lấy danh sách danh mục động từ Backend (đọc từ config/anne/categories.json)
 * @param {boolean} activeOnly - Chỉ lấy danh mục đang hoạt động
 */
async function getCategories(activeOnly = true) {
    try {
        const url = activeOnly ? `${API_BASE}/categories?active=true&_t=${Date.now()}` : `${API_BASE}/categories?_t=${Date.now()}`;
        const res = await fetch(url);
        if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                cachedCategories = json.data;
                if (typeof window !== 'undefined') window.activeStorefrontCategories = cachedCategories;
                return cachedCategories;
            }
        }
    } catch (e) {
        console.warn("Lỗi nạp danh mục từ API:", e);
    }
    return cachedCategories;
}

// Global browser support
if (typeof window !== 'undefined') {
    window.getProducts = getProducts;
    window.getProductById = getProductById;
    window.getCategories = getCategories;
}


// ==========================================================================
// MODULE: checkout.js
// ==========================================================================
/**
 * Phân hệ Quản Lý Giỏ Hàng & Đặt Hàng Thông Minh (TASK 03 - Checkout & Ordering Experience)
 * Hỗ trợ hẹn giờ 30 ngày, khung giờ giao 2H, viết thiệp, in ruy-băng, gửi ẩn danh & tính phí ship.
 */

const CART_STORAGE_KEY = "telua_cart_items_v2";

/**
 * Lấy danh sách sản phẩm trong giỏ hàng từ Web Storage
 */
function getCartItems() {
    if (typeof localStorage === "undefined") return [];
    try {
        const data = localStorage.getItem(CART_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

/**
 * Lưu giỏ hàng vào Web Storage
 */
function saveCartItems(items) {
    if (typeof localStorage !== "undefined") {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }
    updateCartBadge();
}

/**
 * Thêm sản phẩm vào giỏ hàng
 */
function addToCart(productId, name, priceNumber, image, category = "bo_hoa", quantity = 1) {
    let items = getCartItems();
    const existingIndex = items.findIndex((i) => i.productId === productId);

    if (existingIndex > -1) {
        items[existingIndex].quantity += quantity;
    } else {
        items.push({
            productId: productId || `prod_${Date.now()}`,
            name: name || "Sản phẩm hoa tươi",
            price: parseInt(priceNumber, 10) || 420000,
            image: image || "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=400",
            category: category,
            quantity: quantity
        });
    }

    saveCartItems(items);

    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[lang]) ? trans[lang] : {};
    const toastTemplate = dict.toast_added_cart_item || 'Đã thêm "{name}" vào giỏ hàng!';
    const toastMsg = toastTemplate.replace("{name}", name || "");

    if (typeof showToast === "function") {
        showToast(toastMsg);
    } else {
        const toast = document.getElementById("toast");
        if (toast) {
            const span = toast.querySelector("span");
            if (span) span.textContent = toastMsg;
            toast.classList.remove("translate-y-20", "opacity-0");
            setTimeout(() => toast.classList.add("translate-y-20", "opacity-0"), 2500);
        }
    }
}

/**
 * Xóa một sản phẩm khỏi giỏ hàng
 */
function removeFromCart(productId) {
    let items = getCartItems();
    items = items.filter((i) => i.productId !== productId);
    saveCartItems(items);
    renderCartDrawer();
}

/**
 * Cập nhật số lượng sản phẩm
 */
function updateCartQuantity(productId, delta) {
    let items = getCartItems();
    const item = items.find((i) => i.productId === productId);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
            items = items.filter((i) => i.productId !== productId);
        }
    }
    saveCartItems(items);
    renderCartDrawer();
}

/**
 * Tính tổng tiền hàng trong giỏ
 */
function calculateSubtotal(items) {
    return (items || getCartItems()).reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/**
 * Định dạng số tiền sang định dạng VND đẹp mắt
 */
function formatVND(amount) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

/**
 * Cập nhật số lượng huy hiệu trên Header
 */
function updateCartBadge() {
    const items = getCartItems();
    const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const badge = document.getElementById("cartCount");
    if (badge) {
        badge.textContent = totalCount;
        if (totalCount > 0) {
            badge.classList.remove("hidden");
        }
    }
}

/**
 * Mở / Đóng Drawer Giỏ hàng bên phải màn hình
 */
function toggleCartDrawer(show = null) {
    const drawer = document.getElementById("cartDrawer");
    const overlay = document.getElementById("cartOverlay");
    if (!drawer || !overlay) return;

    const isHidden = drawer.classList.contains("translate-x-full");
    const shouldOpen = show !== null ? show : isHidden;

    if (shouldOpen) {
        renderCartDrawer();
        overlay.classList.remove("hidden");
        setTimeout(() => {
            drawer.classList.remove("translate-x-full");
        }, 10);
    } else {
        drawer.classList.add("translate-x-full");
        setTimeout(() => {
            overlay.classList.add("hidden");
        }, 300);
    }
}

/**
 * Render danh sách sản phẩm trong Cart Drawer
 */
function renderCartDrawer() {
    const container = document.getElementById("cartDrawerItems");
    const subtotalEl = document.getElementById("cartDrawerSubtotal");
    const checkoutBtn = document.getElementById("btnDrawerCheckout");
    const items = getCartItems();

    if (!container) return;

    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[lang]) ? trans[lang] : {};

    // Cập nhật lại toàn bộ nhãn tĩnh trong Cart Drawer
    const drawer = document.getElementById("cartDrawer");
    if (drawer) {
        drawer.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) el.innerHTML = dict[key];
        });
    }

    if (items.length === 0) {
        const emptyTitle = dict.cart_empty_title || "Giỏ hàng của bạn đang trống";
        const emptyDesc = dict.cart_empty_desc || "Hãy chọn những đóa hoa tươi đẹp nhất nhé!";
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                <i class="fa-solid fa-basket-shopping text-5xl mb-4 text-pink-200"></i>
                <p class="font-medium text-sm text-gray-500" data-i18n="cart_empty_title">${emptyTitle}</p>
                <p class="text-xs text-gray-400 mt-1" data-i18n="cart_empty_desc">${emptyDesc}</p>
            </div>
        `;
        if (subtotalEl) subtotalEl.textContent = "0₫";
        if (checkoutBtn) checkoutBtn.disabled = true;
        return;
    }

    if (checkoutBtn) checkoutBtn.disabled = false;
    const subtotal = calculateSubtotal(items);
    if (subtotalEl) subtotalEl.textContent = formatVND(subtotal);

    let html = "";
    items.forEach((item) => {
        const itemDisplayName = (typeof window !== "undefined" && typeof window.getProductName === "function")
            ? window.getProductName(item)
            : (item.name || "Hoa tươi");
        html += `
            <div class="flex items-center gap-3 p-3 bg-pink-50/40 rounded-xl border border-pink-100">
                <img src="${item.image}" alt="${itemDisplayName}" class="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-white shadow-sm">
                <div class="flex-1 min-w-0">
                    <h4 class="text-xs font-bold text-gray-800 truncate">${itemDisplayName}</h4>
                    <p class="text-xs font-bold text-primary mt-0.5">${formatVND(item.price)}</p>
                    <div class="flex items-center gap-2 mt-2">
                        <button onclick="updateCartQuantity('${item.productId}', -1)" class="w-6 h-6 rounded-full bg-white text-gray-600 border border-gray-200 flex items-center justify-center text-xs hover:bg-pink-50">-</button>
                        <span class="text-xs font-bold w-6 text-center">${item.quantity}</span>
                        <button onclick="updateCartQuantity('${item.productId}', 1)" class="w-6 h-6 rounded-full bg-white text-gray-600 border border-gray-200 flex items-center justify-center text-xs hover:bg-pink-50">+</button>
                    </div>
                </div>
                <button onclick="removeFromCart('${item.productId}')" class="text-gray-400 hover:text-red-500 p-1 text-sm transition">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ==========================================
// QUẢN LÝ MODAL CHECKOUT & ĐẶT HOA 30 NGÀY
// ==========================================

let currentAppliedVoucher = null;

/**
 * Mở Modal Đặt Hàng Thông Minh (Checkout Modal)
 *
 * Chính sách đăng nhập: Khách KHÔNG bắt buộc đăng nhập khi vào giỏ hàng.
 * Chỉ khi nhấp nút "Thanh toán" (Checkout) và chưa đăng nhập, hệ thống
 * sẽ mở modal đăng nhập trước. Sau khi đăng nhập thành công, tự động
 * quay lại mở modal checkout (giữ nguyên giỏ hàng & thông tin đã nhập).
 */
function openCheckoutModal() {
    toggleCartDrawer(false);

    // Kiểm tra đăng nhập: nếu chưa đăng nhập -> yêu cầu đăng nhập trước
    if (typeof isLoggedIn === "function" && !isLoggedIn()) {
        // Lưu intent để sau khi đăng nhập sẽ quay lại mở checkout
        if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem("telua_pending_checkout", "1");
        }
        if (typeof openAuthModal === "function") {
            openAuthModal("login");
        } else {
            alert("Vui lòng đăng nhập để thanh toán!");
        }
        return;
    }

    // Đã đăng nhập -> mở modal checkout bình thường
    openCheckoutModalAfterAuth();
}

/**
 * Mở Modal Checkout (chỉ gọi sau khi đã xác thực đăng nhập)
 */
function openCheckoutModalAfterAuth() {
    const modal = document.getElementById("checkoutModal");
    if (!modal) return;

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[lang]) ? trans[lang] : {};

    // Cập nhật nhãn & placeholder đa ngôn ngữ trong modal
    modal.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.innerHTML = dict[key];
    });
    modal.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key]) el.setAttribute('placeholder', dict[key]);
    });

    // 1. Khởi tạo danh sách ngày (30 ngày từ hôm nay)
    initDeliveryDatePicker();

    // 2. Tự động điền thông tin nếu đã đăng nhập
    if (typeof getCurrentUser === "function") {
        const user = getCurrentUser();
        if (user) {
            const senderNameInput = document.getElementById("checkoutSenderName");
            const senderPhoneInput = document.getElementById("checkoutSenderPhone");
            const senderEmailInput = document.getElementById("checkoutSenderEmail");
            if (senderNameInput && !senderNameInput.value) senderNameInput.value = user.fullName || "";
            if (senderPhoneInput && !senderPhoneInput.value) senderPhoneInput.value = user.phone || "";
            if (senderEmailInput && !senderEmailInput.value) senderEmailInput.value = user.email || "";
        }
    }

    // 3. Cập nhật bảng tổng kết tài chính
    updateOrderSummary();

    // 4. Khởi tạo phương thức nhận hàng (mặc định delivery)
    onFulfillmentTypeChange();
}

/**
 * Xử lý khi khách đổi phương thức nhận hàng (Giao hàng / Nhận tại cửa hàng)
 */
function onFulfillmentTypeChange() {
    const selected = document.querySelector("input[name='fulfillmentType']:checked");
    const isPickup = selected && selected.value === "pickup";

    const pickupSection = document.getElementById("pickupBranchSection");
    const addressInput = document.getElementById("checkoutRecipientAddress");
    const deliveryNotesInput = document.getElementById("checkoutDeliveryNotes");

    if (pickupSection) pickupSection.classList.toggle("hidden", !isPickup);

    // Khi pickup: không cần địa chỉ giao & ghi chú giao
    if (addressInput) addressInput.required = !isPickup;
    if (deliveryNotesInput) deliveryNotesInput.disabled = isPickup;

    if (isPickup) {
        loadPickupBranches();
    }

    // Cập nhật lại phí ship (pickup = miễn phí ship)
    updateOrderSummary();
}

/**
 * Tải danh sách cửa hàng để khách chọn nơi nhận hoa (pickup)
 */
async function loadPickupBranches() {
    const select = document.getElementById("checkoutPickupBranch");
    if (!select) return;

    select.innerHTML = `<option value="">Đang tải danh sách cửa hàng...</option>`;

    try {
        const res = await fetch(`${API_BASE}/branches`);
        const json = await res.json();

        let branches = [];
        if (json.success && Array.isArray(json.data)) {
            branches = json.data;
        } else if (Array.isArray(json)) {
            branches = json;
        }

        const activeBranches = branches.filter(b => b && b.isActive !== false);

        if (activeBranches.length === 0) {
            select.innerHTML = `<option value="">Không có cửa hàng khả dụng</option>`;
            return;
        }

        select.innerHTML = `<option value="">-- Chọn cửa hàng nhận hoa --</option>` +
            activeBranches.map(b => `
                <option value="${b.id}">${b.name || b.id}${b.address ? " • " + b.address : ""}</option>
            `).join("");
    } catch (e) {
        select.innerHTML = `<option value="">Lỗi tải cửa hàng: ${e.message}</option>`;
    }
}

/**
 * Đóng Modal Đặt Hàng
 */
function closeCheckoutModal() {
    const modal = document.getElementById("checkoutModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

/**
 * Khởi tạo ô chọn ngày giao hoa (Tối đa 30 ngày)
 */
function initDeliveryDatePicker() {
    const dateSelect = document.getElementById("checkoutDeliveryDate");
    if (!dateSelect) return;

    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[lang]) ? trans[lang] : {};

    const todayWord = dict.checkout_date_today || "Hôm nay";
    const tomorrowWord = dict.checkout_date_tomorrow || "Ngày mai";

    dateSelect.innerHTML = "";
    const today = new Date();

    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(today.getDate() + i);

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const valStr = `${yyyy}-${mm}-${dd}`;

        let label = `${dd}/${mm}/${yyyy}`;
        if (i === 0) label = `${todayWord} (${dd}/${mm})`;
        else if (i === 1) label = `${tomorrowWord} (${dd}/${mm})`;

        const opt = document.createElement("option");
        opt.value = valStr;
        opt.textContent = label;
        dateSelect.appendChild(opt);
    }

    // Nạp danh sách khung giờ cho ngày đầu tiên
    onDeliveryDateChange();
}

/**
 * Khi đổi ngày giao -> nạp khung giờ tương ứng từ Backend
 */
async function onDeliveryDateChange() {
    const dateSelect = document.getElementById("checkoutDeliveryDate");
    const slotSelect = document.getElementById("checkoutTimeSlot");
    if (!dateSelect || !slotSelect) return;

    const selectedDate = dateSelect.value;
    slotSelect.innerHTML = `<option value="">Đang tải khung giờ...</option>`;

    try {
        const res = await fetch(`${API_BASE}/delivery/slots?date=${selectedDate}`);
        const json = await res.json();
        if (json.success && json.data && json.data.slots) {
            slotSelect.innerHTML = "";
            json.data.slots.forEach((slot) => {
                const opt = document.createElement("option");
                opt.value = slot.name;
                opt.textContent = slot.name + (slot.available ? " (Còn chỗ)" : " (Đã kín chỗ)");
                if (!slot.available) opt.disabled = true;
                slotSelect.appendChild(opt);
            });
        }
    } catch (e) {
        slotSelect.innerHTML = `
            <option value="08:00 - 10:00">08:00 - 10:00 (Sáng sớm)</option>
            <option value="10:00 - 12:00">10:00 - 12:00 (Trưa)</option>
            <option value="13:00 - 15:00">13:00 - 15:00 (Đầu chiều)</option>
            <option value="15:00 - 17:00">15:00 - 17:00 (Xế chiều)</option>
            <option value="17:00 - 19:00">17:00 - 19:00 (Tan tầm)</option>
            <option value="19:00 - 21:00">19:00 - 21:00 (Tối)</option>
        `;
    }
}

/**
 * Toggle giao hỏa tốc 2H
 */
function toggleExpress2H() {
    updateOrderSummary();
}

/**
 * Áp dụng mã Voucher
 */
async function handleApplyVoucher() {
    const input = document.getElementById("checkoutVoucherInput");
    const msgBox = document.getElementById("checkoutVoucherMsg");
    if (!input) return;

    const code = input.value.trim().toUpperCase();
    if (!code) return;

    const subtotal = calculateSubtotal(getCartItems());

    // Kiểm tra nhanh mã voucher phổ biến hoặc gọi API
    if (code === "PHUNU15") {
        if (subtotal < 400000) {
            if (msgBox) {
                msgBox.textContent = "Mã PHUNU15 chỉ áp dụng cho đơn từ 400.000₫";
                msgBox.className = "text-xs text-red-500 mt-1 block";
            }
            return;
        }
        currentAppliedVoucher = {
            code: "PHUNU15",
            type: "percentage",
            value: 15,
            max: 150000
        };
        if (msgBox) {
            msgBox.textContent = "Áp dụng mã PHUNU15 thành công: Giảm 15%!";
            msgBox.className = "text-xs text-green-600 font-bold mt-1 block";
        }
    } else if (code === "FREESHIP") {
        currentAppliedVoucher = {
            code: "FREESHIP",
            type: "fixed",
            value: 35000,
            max: 35000
        };
        if (msgBox) {
            msgBox.textContent = "Áp dụng mã FREESHIP thành công: Giảm 35.000₫ phí giao!";
            msgBox.className = "text-xs text-green-600 font-bold mt-1 block";
        }
    } else if (code === "ANNE10") {
        currentAppliedVoucher = {
            code: "ANNE10",
            type: "percentage",
            value: 10,
            max: 100000
        };
        if (msgBox) {
            msgBox.textContent = "Áp dụng mã ANNE10 thành công: Giảm 10%!";
            msgBox.className = "text-xs text-green-600 font-bold mt-1 block";
        }
    } else {
        if (msgBox) {
            msgBox.textContent = "Mã khuyến mãi không tồn tại hoặc đã hết hạn";
            msgBox.className = "text-xs text-red-500 mt-1 block";
        }
        return;
    }

    updateOrderSummary();
}

/**
 * Cập nhật bảng tổng kết chi phí
 */
function updateOrderSummary() {
    const items = getCartItems();
    const subtotal = calculateSubtotal(items);

    const isExpressCheckbox = document.getElementById("checkoutIsExpress2H");
    const isExpress = isExpressCheckbox ? isExpressCheckbox.checked : false;

    // Pickup (nhận tại cửa hàng) -> miễn phí vận chuyển
    const fulfillmentSelected = document.querySelector("input[name='fulfillmentType']:checked");
    const isPickup = fulfillmentSelected && fulfillmentSelected.value === "pickup";

    let shippingFee = 0;
    if (isPickup) {
        shippingFee = 0;
    } else if (isExpress) {
        shippingFee = 50000;
    } else if (subtotal < 500000 && subtotal > 0) {
        shippingFee = 35000;
    } else {
        shippingFee = 0; // Freeship từ 500K
    }

    let discount = 0;
    if (currentAppliedVoucher) {
        if (currentAppliedVoucher.type === "percentage") {
            discount = Math.min(Math.round((subtotal * currentAppliedVoucher.value) / 100), currentAppliedVoucher.max);
        } else {
            discount = Math.min(currentAppliedVoucher.value, currentAppliedVoucher.max);
        }
    }

    const finalTotal = Math.max(0, subtotal + shippingFee - discount);

    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[lang]) ? trans[lang] : {};

    const subtotalEl = document.getElementById("summarySubtotal");
    const shippingEl = document.getElementById("summaryShipping");
    const discountEl = document.getElementById("summaryDiscount");
    const totalEl = document.getElementById("summaryTotal");

    const freeShippingText = dict.checkout_lbl_free_shipping || "Miễn phí";

    if (subtotalEl) subtotalEl.textContent = formatVND(subtotal);
    if (shippingEl) shippingEl.textContent = shippingFee === 0 ? freeShippingText : formatVND(shippingFee);
    if (discountEl) discountEl.textContent = discount > 0 ? `-${formatVND(discount)}` : "0₫";
    if (totalEl) totalEl.textContent = formatVND(finalTotal);
}

/**
 * Xử lý Gửi Đơn Hàng đến Backend API (POST /api/orders)
 */
async function handleCheckoutSubmit(event) {
    if (event) event.preventDefault();

    const items = getCartItems();
    if (items.length === 0) {
        alert("Giỏ hàng của bạn đang trống. Vui lòng chọn sản phẩm!");
        return;
    }

    const senderName = document.getElementById("checkoutSenderName")?.value.trim();
    const senderPhone = document.getElementById("checkoutSenderPhone")?.value.trim();
    const senderEmail = document.getElementById("checkoutSenderEmail")?.value.trim() || "";
    const isAnonymous = document.getElementById("checkoutIsAnonymous")?.checked || false;

    const recipientName = document.getElementById("checkoutRecipientName")?.value.trim();
    const recipientPhone = document.getElementById("checkoutRecipientPhone")?.value.trim();
    const recipientAddress = document.getElementById("checkoutRecipientAddress")?.value.trim();
    const deliveryNotes = document.getElementById("checkoutDeliveryNotes")?.value.trim() || "";

    const deliveryDate = document.getElementById("checkoutDeliveryDate")?.value;
    const timeSlot = document.getElementById("checkoutTimeSlot")?.value;
    const isExpress2H = document.getElementById("checkoutIsExpress2H")?.checked || false;

    const cardMessage = document.getElementById("checkoutCardMessage")?.value.trim() || "";
    const ribbonBanner = document.getElementById("checkoutRibbonBanner")?.value.trim() || "";
    const paymentMethod = document.querySelector("input[name='paymentMethod']:checked")?.value || "vietqr";

    // Phương thức nhận hàng (delivery / pickup)
    const fulfillmentSelected = document.querySelector("input[name='fulfillmentType']:checked");
    const fulfillmentType = fulfillmentSelected ? fulfillmentSelected.value : "delivery";
    const pickupBranchId = document.getElementById("checkoutPickupBranch")?.value || "";

    const submitBtn = document.getElementById("btnSubmitOrder");
    const errorBox = document.getElementById("checkoutErrorMsg");

    // Validation theo phương thức nhận hàng
    if (!senderPhone || !recipientName || !recipientPhone) {
        if (errorBox) {
            errorBox.textContent = "Vui lòng điền đầy đủ số điện thoại người gửi và thông tin người nhận";
            errorBox.classList.remove("hidden");
        }
        return;
    }

    if (fulfillmentType === "pickup") {
        if (!pickupBranchId) {
            if (errorBox) {
                errorBox.textContent = "Vui lòng chọn cửa hàng nhận hoa";
                errorBox.classList.remove("hidden");
            }
            return;
        }
    } else if (!recipientAddress) {
        if (errorBox) {
            errorBox.textContent = "Vui lòng nhập địa chỉ giao hoa";
            errorBox.classList.remove("hidden");
        }
        return;
    }

    if (errorBox) errorBox.classList.add("hidden");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Đang tạo đơn hàng...`;
    }

    const payload = {
        sender: {
            name: senderName,
            phone: senderPhone,
            email: senderEmail,
            isAnonymous: isAnonymous
        },
        recipient: {
            name: recipientName,
            phone: recipientPhone,
            address: recipientAddress,
            deliveryNotes: deliveryNotes
        },
        delivery: {
            deliveryDate: deliveryDate,
            timeSlot: isExpress2H ? "Giao Hỏa Tốc 2H" : timeSlot,
            isExpress2H: isExpress2H,
            fulfillmentType: fulfillmentType
        },
        fulfillmentType: fulfillmentType,
        branchId: fulfillmentType === "pickup" ? pickupBranchId : "",
        customization: {
            cardMessage: cardMessage,
            ribbonBanner: ribbonBanner
        },
        items: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity
        })),
        voucherCode: currentAppliedVoucher ? currentAppliedVoucher.code : "",
        paymentMethod: paymentMethod
    };

    try {
        let authHeaders = { "Content-Type": "application/json" };
        if (typeof getAuthToken === "function") {
            const token = getAuthToken();
            if (token) authHeaders["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(`${API_BASE}/orders`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(payload)
        });

        const resData = await res.json();

        if (res.ok && resData.success) {
            const newOrder = resData.data;
            // Xóa giỏ hàng sau khi đặt thành công
            saveCartItems([]);
            closeCheckoutModal();

            // Hiển thị thông báo & mở cổng thanh toán VietQR
            if (typeof openPaymentModal === "function") {
                openPaymentModal(newOrder);
            } else {
                alert(`🎉 Đặt hàng thành công! Mã đơn: ${newOrder.orderCode}. Tổng tiền: ${formatVND(newOrder.totalAmount)}`);
                window.location.reload();
            }
        } else {
            if (errorBox) {
                errorBox.textContent = resData.message || "Đặt hàng không thành công. Vui lòng thử lại!";
                errorBox.classList.remove("hidden");
            }
        }
    } catch (err) {
        if (errorBox) {
            errorBox.textContent = "Lỗi kết nối máy chủ: " + err.message;
            errorBox.classList.remove("hidden");
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `Hoàn Tất Đặt Hoa <i class="fa-solid fa-arrow-right ml-2"></i>`;
        }
    }
}

// Global Browser Binding
if (typeof window !== "undefined") {
    window.TeluaCart = {
        getCartItems,
        saveCartItems,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        calculateSubtotal,
        formatVND,
        updateCartBadge,
        toggleCartDrawer,
        openCheckoutModal,
        openCheckoutModalAfterAuth,
        closeCheckoutModal,
        onDeliveryDateChange,
        toggleExpress2H,
        handleApplyVoucher,
        updateOrderSummary,
        handleCheckoutSubmit
    };

    window.addToCart = addToCart;
    window.removeFromCart = removeFromCart;
    window.updateCartQuantity = updateCartQuantity;
    window.toggleCart = () => toggleCartDrawer();
    window.toggleCartDrawer = toggleCartDrawer;
    window.openCheckoutModal = openCheckoutModal;
    window.openCheckoutModalAfterAuth = openCheckoutModalAfterAuth;
    window.closeCheckoutModal = closeCheckoutModal;
    window.onDeliveryDateChange = onDeliveryDateChange;
    window.toggleExpress2H = toggleExpress2H;
    window.handleApplyVoucher = handleApplyVoucher;
    window.updateOrderSummary = updateOrderSummary;
    window.handleCheckoutSubmit = handleCheckoutSubmit;
    window.onFulfillmentTypeChange = onFulfillmentTypeChange;
    window.loadPickupBranches = loadPickupBranches;

    document.addEventListener("DOMContentLoaded", () => {
        updateCartBadge();
    });
}


// ==========================================================================
// MODULE: auth.js
// ==========================================================================
/**
 * Hệ thống Quản lý Xác thực & Phân quyền Client (Authentication & Route Guard)
 * Hỗ trợ lưu trữ JWT Token, tự động điều hướng theo Role và chặn truy cập trái phép.
 */

const AUTH_TOKEN_KEY = "telua_auth_token";
const AUTH_USER_KEY = "telua_auth_user";

const ROLE_REDIRECT_MATRIX = {
    super_admin: "/portal/admin",
    branch_manager: "/portal/branch-manager",
    florist: "/portal/staff",
    sales_consultant: "/portal/sales",
    customer: "/"
};

/**
 * Lưu Token và thông tin User vào localStorage
 */
function saveAuthToken(token, user) {
    if (typeof localStorage !== "undefined") {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        if (user) {
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        }
    }
}

/**
 * Lấy JWT Token từ localStorage
 */
function getAuthToken() {
    if (typeof localStorage !== "undefined") {
        return localStorage.getItem(AUTH_TOKEN_KEY);
    }
    return null;
}

/**
 * Lấy thông tin user hiện tại
 */
function getCurrentUser() {
    if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(AUTH_USER_KEY);
        if (raw) {
            try {
                return JSON.parse(raw);
            } catch (e) {
                return null;
            }
        }
    }
    return null;
}

/**
 * Xóa thông tin đăng nhập
 */
function clearAuth() {
    if (typeof localStorage !== "undefined") {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
    }
}

/**
 * Kiểm tra xem người dùng đã đăng nhập chưa
 */
function isLoggedIn() {
    const token = getAuthToken();
    if (!token) return false;
    const payload = decodeJWTPayload(token);
    if (!payload) return false;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
        clearAuth();
        return false;
    }
    return true;
}

/**
 * Giải mã Payload từ JWT Token mà không cần thư viện nặng
 */
function decodeJWTPayload(token) {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    try {
        let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const pad = base64.length % 4;
        if (pad) {
            base64 += "=".repeat(4 - pad);
        }
        const jsonStr = decodeURIComponent(
            atob(base64)
                .split("")
                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
        return JSON.parse(jsonStr);
    } catch (e) {
        return null;
    }
}

/**
 * Gửi yêu cầu Đăng nhập đến Backend API
 */
async function login(identifier, password) {
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ identifier, password })
        });

        const resData = await response.json();
        if (response.ok && resData.success) {
            const { token, user, redirectUrl } = resData.data;
            saveAuthToken(token, user);
            return {
                success: true,
                redirectUrl: redirectUrl || "/",
                user
            };
        } else {
            return {
                success: false,
                message: resData.message || "Đăng nhập thất bại"
            };
        }
    } catch (err) {
        return {
            success: false,
            message: "Lỗi kết nối máy chủ: " + err.message
        };
    }
}

/**
 * Gửi yêu cầu Đăng ký tài khoản Khách hàng
 */
async function register(phone, fullName, password, email = "") {
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ phone, fullName, password, email })
        });

        const resData = await response.json();
        if (response.ok && resData.success) {
            const { token, user, redirectUrl } = resData.data;
            saveAuthToken(token, user);
            return {
                success: true,
                redirectUrl: redirectUrl || "/",
                user
            };
        } else {
            return {
                success: false,
                message: resData.message || "Đăng ký thất bại"
            };
        }
    } catch (err) {
        return {
            success: false,
            message: "Lỗi kết nối máy chủ: " + err.message
        };
    }
}

/**
 * Đăng xuất người dùng
 */
async function logout() {
    try {
        await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
    } catch (e) {
        // bỏ qua lỗi network khi logout
    }
    clearAuth();
    if (typeof updateAuthUI === "function") {
        updateAuthUI();
    }
    if (typeof window !== "undefined") {
        if (window.location.pathname.startsWith("/portal/")) {
            window.location.href = "/";
        } else {
            window.location.reload();
        }
    }
}

/**
 * Helper gửi request kèm Header Authorization Bearer
 */
async function fetchWithAuth(url, options = {}) {
    const token = getAuthToken();
    const headers = {
        ...(options.headers || {}),
        "Content-Type": "application/json"
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        clearAuth();
        if (typeof window !== "undefined" && !window.location.pathname.includes("login")) {
            window.location.href = "/";
        }
    }
    return response;
}

/**
 * Route Guard kiểm tra quyền truy cập trang nội bộ
 */
function checkRoutePermission(allowedRoles = []) {
    if (!isLoggedIn()) {
        alert("Vui lòng đăng nhập để truy cập trang này!");
        if (typeof window !== "undefined") {
            window.location.href = "/";
        }
        return false;
    }

    const token = getAuthToken();
    const payload = decodeJWTPayload(token);
    if (!payload || (allowedRoles.length > 0 && !allowedRoles.includes(payload.role))) {
        alert("Bạn không có quyền truy cập vào phân hệ này!");
        if (typeof window !== "undefined") {
            window.location.href = payload ? (payload.redirectUrl || "/") : "/";
        }
        return false;
    }

    return true;
}

// ==========================================
// QUẢN LÝ GIAO DIỆN MODAL ĐĂNG NHẬP (UI MODAL)
// ==========================================

function openAuthModal(tab = "login") {
    const modal = document.getElementById("authModal");
    if (!modal) return;
    modal.style.display = "flex";
    modal.classList.remove("hidden");
    
    const pwInput = document.getElementById("loginPassword");
    if (pwInput) pwInput.value = "";
    
    const regPwInput = document.getElementById("regPassword");
    if (regPwInput) regPwInput.value = "";
    
    switchAuthTab(tab);
}

function closeAuthModal() {
    const modal = document.getElementById("authModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

function switchAuthTab(tab = "login") {
    const loginTabBtn = document.getElementById("tabLoginBtn");
    const registerTabBtn = document.getElementById("tabRegisterBtn");
    const loginForm = document.getElementById("loginFormContainer");
    const registerForm = document.getElementById("registerFormContainer");
    const loginError = document.getElementById("loginError");
    const registerError = document.getElementById("registerError");

    if (loginError) loginError.classList.add("hidden");
    if (registerError) registerError.classList.add("hidden");

    if (tab === "login") {
        if (loginTabBtn) {
            loginTabBtn.className = "flex-1 py-3 text-sm font-bold text-primary border-b-2 border-primary transition";
        }
        if (registerTabBtn) {
            registerTabBtn.className = "flex-1 py-3 text-sm font-semibold text-gray-500 hover:text-gray-700 border-b-2 border-transparent transition";
        }
        if (loginForm) loginForm.classList.remove("hidden");
        if (registerForm) registerForm.classList.add("hidden");
    } else {
        if (loginTabBtn) {
            loginTabBtn.className = "flex-1 py-3 text-sm font-semibold text-gray-500 hover:text-gray-700 border-b-2 border-transparent transition";
        }
        if (registerTabBtn) {
            registerTabBtn.className = "flex-1 py-3 text-sm font-bold text-primary border-b-2 border-primary transition";
        }
        if (loginForm) loginForm.classList.add("hidden");
        if (registerForm) registerForm.classList.remove("hidden");
    }
}

function fillDemoAccount(identifier, password = "123456") {
    switchAuthTab("login");
    const idInput = document.getElementById("loginIdentifier");
    const pwInput = document.getElementById("loginPassword");
    const errorBox = document.getElementById("loginError");
    if (errorBox) errorBox.classList.add("hidden");

    if (idInput) idInput.value = identifier;
    if (pwInput) pwInput.value = password;

    // Tự động kích hoạt submit
    const submitBtn = document.getElementById("btnLoginSubmit");
    if (submitBtn) {
        submitBtn.click();
    }
}

async function handleLoginSubmit(event) {
    if (event) event.preventDefault();
    const idInput = document.getElementById("loginIdentifier");
    const pwInput = document.getElementById("loginPassword");
    const errorBox = document.getElementById("loginError");
    const submitBtn = document.getElementById("btnLoginSubmit");

    if (!idInput || !pwInput) return;

    const identifier = idInput.value.trim();
    const password = pwInput.value;

    if (!identifier) {
        if (errorBox) {
            errorBox.textContent = "Vui lòng nhập Số điện thoại hoặc Email đăng nhập!";
            errorBox.classList.remove("hidden");
        }
        idInput.focus();
        return;
    }

    if (!password) {
        if (errorBox) {
            errorBox.textContent = "Vui lòng nhập mật khẩu vào để đăng nhập!";
            errorBox.classList.remove("hidden");
        }
        pwInput.focus();
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Đang xác thực...`;
    }
    if (errorBox) errorBox.classList.add("hidden");

    const result = await login(identifier, password);

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Đăng Nhập <i class="fa-solid fa-arrow-right ml-2"></i>`;
    }

    if (result.success) {
        closeAuthModal();
        updateAuthUI();

        // Nếu trước đó user đang cố thanh toán (nhấp nút Checkout) thì quay lại mở checkout
        let pendingCheckout = false;
        if (typeof sessionStorage !== "undefined") {
            pendingCheckout = sessionStorage.getItem("telua_pending_checkout") === "1";
            sessionStorage.removeItem("telua_pending_checkout");
        }
        if (pendingCheckout && typeof openCheckoutModalAfterAuth === "function") {
            openCheckoutModalAfterAuth();
            return;
        }

        // Không tự động chuyển hướng / bật CMS, giữ admin ở trang chủ và chỉ hiển thị khi click
        if (typeof showToast === "function") {
            showToast(`Chào mừng ${result.user.fullName || "bạn"} (${result.user.role}) đã đăng nhập thành công!`);
        } else {
            alert(`Đăng nhập thành công! Chào ${result.user.fullName || ""}`);
        }
    } else {
        if (errorBox) {
            errorBox.textContent = result.message || "Đăng nhập không thành công";
            errorBox.classList.remove("hidden");
        }
    }
}

async function handleRegisterSubmit(event) {
    if (event) event.preventDefault();
    const nameInput = document.getElementById("regFullName");
    const phoneInput = document.getElementById("regPhone");
    const emailInput = document.getElementById("regEmail");
    const pwInput = document.getElementById("regPassword");
    const errorBox = document.getElementById("registerError");
    const submitBtn = document.getElementById("btnRegisterSubmit");

    if (!nameInput || !phoneInput || !pwInput) return;

    const fullName = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const email = emailInput ? emailInput.value.trim() : "";
    const password = pwInput.value;

    if (!fullName || !phone || !password) {
        if (errorBox) {
            errorBox.textContent = "Vui lòng điền họ tên, số điện thoại và mật khẩu";
            errorBox.classList.remove("hidden");
        }
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Đang tạo tài khoản...`;
    }
    if (errorBox) errorBox.classList.add("hidden");

    const result = await register(phone, fullName, password, email);

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Đăng Ký Tài Khoản <i class="fa-solid fa-gift ml-2"></i>`;
    }

    if (result.success) {
        closeAuthModal();
        updateAuthUI();
        if (typeof showToast === "function") {
            showToast(`Đăng ký thành công! Tặng bạn 50 điểm tích lũy chào mừng 🎉`);
        } else {
            alert(`Đăng ký thành công! Chào mừng ${result.user.fullName}`);
        }
    } else {
        if (errorBox) {
            errorBox.textContent = result.message || "Đăng ký không thành công";
            errorBox.classList.remove("hidden");
        }
    }
}

function togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input || !icon) return;
    if (input.type === "password") {
        input.type = "text";
        icon.className = "fa-solid fa-eye-slash text-gray-400 hover:text-gray-600";
    } else {
        input.type = "password";
        icon.className = "fa-solid fa-eye text-gray-400 hover:text-gray-600";
    }
}

function toggleUserDropdown(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById("userDropdownMenu");
    if (dropdown) {
        dropdown.classList.toggle("hidden");
    }
}

function updateAuthUI() {
    const userContainer = document.getElementById("accountBtn");
    const mobileUserContainer = document.getElementById("mobileAccountBtn");
    const user = getCurrentUser();

    const roleNameMap = {
        super_admin: "👑 Tổng Quản Trị",
        branch_manager: "🏬 Quản Lý Chi Nhánh",
        florist: "🌸 Thợ Cắm Hoa",
        sales_consultant: "💼 Tư Vấn Viên",
        customer: "✨ Khách Hàng Thân Thiết"
    };

    if (user && isLoggedIn()) {
        const displayName = user.fullName || user.phone || "Thành viên";
        const roleName = roleNameMap[user.role] || "Thành viên";
        const isAdminOrManager = user.role === "super_admin" || user.role === "branch_manager";
        const isFlorist = user.role === "florist";
        const isSales = user.role === "sales_consultant";

        const isInternalRole = isAdminOrManager || isFlorist || isSales;
        const orderDashboardBtn = isInternalRole ? `
                    <button onclick="openOrderDashboardModal()" class="w-full flex items-center px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition rounded-xl border border-emerald-200">
                        <i class="fa-solid fa-chart-line mr-2 text-emerald-600"></i> Bảng Điều Khiển Đơn Hàng
                    </button>
        ` : '';

        let portalActionBtn = "";
        if (isAdminOrManager) {
            portalActionBtn = `
                <div class="p-2 space-y-1.5 border-b border-gray-100">
                    <button onclick="openAdminPortalModal()" class="w-full flex items-center px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-primary to-accent hover:opacity-95 transition rounded-xl shadow-xs">
                        <i class="fa-solid fa-gauge-high mr-2"></i> Quản Trị Hệ Thống (CMS)
                    </button>
                    ${orderDashboardBtn}
                    ${user.role === 'super_admin' ? `
                    <button onclick="openSystemConfigModal('company')" class="w-full flex items-center px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50/80 hover:bg-blue-100 transition rounded-xl border border-blue-200">
                        <i class="fa-solid fa-sliders mr-2 text-blue-600"></i> Cấu Hình Hệ Thống
                    </button>
                    ` : ''}
                </div>
            `;
        } else if (isFlorist) {
            portalActionBtn = `
                <div class="p-1.5 border-b border-gray-100 space-y-1.5">
                    <button onclick="openStaffPortalModal()" class="w-full flex items-center px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-400 hover:opacity-95 transition rounded-lg shadow-sm">
                        <i class="fa-solid fa-scissors mr-2"></i> Cổng Thợ Cắm Hoa
                    </button>
                    ${orderDashboardBtn}
                </div>
            `;
        } else if (isSales) {
            portalActionBtn = `
                <div class="p-1.5 border-b border-gray-100 space-y-1.5">
                    <button onclick="openStaffPortalModal()" class="w-full flex items-center px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-400 hover:opacity-95 transition rounded-lg shadow-sm">
                        <i class="fa-solid fa-headset mr-2"></i> Tiếp Nhận Đơn Hàng
                    </button>
                    ${orderDashboardBtn}
                </div>
            `;
        } else {
            // Customer (Khách hàng thân thiết)
            portalActionBtn = `
                <div class="p-1.5 border-b border-gray-100 space-y-1.5">
                    <button onclick="openCustomerPortalModal()" class="w-full flex items-center px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-primary to-accent hover:opacity-95 transition rounded-xl shadow-xs">
                        <i class="fa-solid fa-box-open mr-2"></i> Đơn Hàng Của Tôi
                    </button>
                    <div class="px-3 py-2 text-xs text-gray-700 flex justify-between items-center bg-pink-50/50 rounded-lg">
                        <span>Điểm tích lũy:</span>
                        <span class="font-bold text-accent">50 điểm ⭐</span>
                    </div>
                </div>
            `;
        }

        const userHtml = `
            <div class="relative">
                <button onclick="toggleUserDropdown(event)" class="flex flex-col md:flex-row items-center text-gray-700 hover:text-primary transition group focus:outline-none">
                    <div class="w-8 h-8 rounded-full bg-pink-100 text-primary border border-pink-200 flex items-center justify-center font-bold text-xs md:mr-2 shadow-sm group-hover:scale-105 transition">
                        ${displayName.charAt(0).toUpperCase()}
                    </div>
                    <div class="hidden md:flex flex-col text-left">
                        <span class="text-xs font-bold text-gray-800 line-clamp-1">${displayName}</span>
                        <span class="text-[10px] text-primary font-semibold">${roleName}</span>
                    </div>
                    <i class="fa-solid fa-chevron-down text-[9px] text-gray-400 ml-1.5 hidden md:block"></i>
                </button>

                <!-- Dropdown Menu -->
                <div id="userDropdownMenu" class="hidden absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 animate-fadeIn">
                    <div class="px-4 py-2.5 border-b border-gray-100 bg-pink-50/50">
                        <p class="text-xs text-gray-500 font-medium">Đang đăng nhập với vai trò:</p>
                        <p class="text-xs font-bold text-primary mt-0.5">${roleName}</p>
                        <p class="text-[11px] text-gray-600 truncate mt-0.5">${user.phone || user.email || ""}</p>
                    </div>
                    
                    ${portalActionBtn}

                    <button onclick="logout()" class="w-full text-left flex items-center px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition">
                        <i class="fa-solid fa-right-from-bracket mr-2"></i> Đăng Xuất
                    </button>
                </div>
            </div>
        `;

        if (userContainer) userContainer.innerHTML = userHtml;
        if (mobileUserContainer) {
            mobileUserContainer.innerHTML = `
                <div class="bg-gradient-to-br from-pink-50/80 to-rose-50/60 p-3.5 rounded-xl border border-pink-100 space-y-3 shadow-2xs">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                            ${displayName.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-bold text-gray-900 truncate">${displayName}</div>
                            <div class="text-[11px] font-semibold text-primary">${roleName}</div>
                            <div class="text-[10px] text-gray-500 truncate">${user.phone || user.email || ""}</div>
                        </div>
                    </div>

                    ${isAdminOrManager ? `
                        <div class="space-y-2">
                            <button onclick="openAdminPortalModal(); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-primary to-accent hover:opacity-95 transition rounded-xl shadow-xs">
                                <i class="fa-solid fa-gauge-high mr-2"></i> Quản Trị Hệ Thống (CMS)
                            </button>
                            <button onclick="openOrderDashboardModal(); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition rounded-xl border border-emerald-200">
                                <i class="fa-solid fa-chart-line mr-2 text-emerald-600"></i> Bảng Điều Khiển Đơn Hàng
                            </button>
                            ${user.role === 'super_admin' ? `
                            <button onclick="openSystemConfigModal('company'); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition rounded-xl border border-blue-200">
                                <i class="fa-solid fa-sliders mr-2 text-blue-600"></i> Cấu Hình Hệ Thống
                            </button>
                            ` : ''}
                        </div>
                    ` : isFlorist ? `
                        <div class="space-y-2">
                            <button onclick="openStaffPortalModal(); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-400 hover:opacity-95 transition rounded-lg shadow-xs">
                                <i class="fa-solid fa-scissors mr-2"></i> Cổng Thợ Cắm Hoa
                            </button>
                            <button onclick="openOrderDashboardModal(); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition rounded-lg border border-emerald-200">
                                <i class="fa-solid fa-chart-line mr-2 text-emerald-600"></i> Bảng Điều Khiển Đơn Hàng
                            </button>
                        </div>
                    ` : isSales ? `
                        <div class="space-y-2">
                            <button onclick="openStaffPortalModal(); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-400 hover:opacity-95 transition rounded-lg shadow-xs">
                                <i class="fa-solid fa-headset mr-2"></i> Tiếp Nhận Đơn Hàng
                            </button>
                            <button onclick="openOrderDashboardModal(); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition rounded-lg border border-emerald-200">
                                <i class="fa-solid fa-chart-line mr-2 text-emerald-600"></i> Bảng Điều Khiển Đơn Hàng
                            </button>
                        </div>
                    ` : `
                        <button onclick="openCustomerPortalModal(); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-primary to-accent hover:opacity-95 transition rounded-xl shadow-xs">
                            <i class="fa-solid fa-box-open mr-2"></i> Đơn Hàng Của Tôi
                        </button>
                        <div class="flex items-center justify-between px-3 py-1.5 bg-white/80 rounded-lg border border-pink-100 text-xs">
                            <span class="text-gray-600 font-medium">Điểm tích lũy:</span>
                            <span class="font-bold text-accent">50 ⭐</span>
                        </div>
                    `}

                    <button onclick="logout()" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 bg-white border border-red-100 rounded-lg transition shadow-2xs">
                        <i class="fa-solid fa-right-from-bracket mr-2"></i> Đăng Xuất
                    </button>
                </div>
            `;
        }
    } else {
        const guestHtml = `
            <div onclick="openAuthModal('login')" class="flex flex-col items-center text-gray-600 hover:text-primary cursor-pointer transition">
                <i class="fa-regular fa-user text-xl mb-1"></i>
                <span class="text-xs font-semibold" data-i18n="account">Tài khoản</span>
            </div>
        `;
        if (userContainer) userContainer.innerHTML = guestHtml;
        if (mobileUserContainer) {
            mobileUserContainer.innerHTML = `
                <button onclick="openAuthModal('login'); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-pink-50 to-rose-50 hover:from-pink-100 hover:to-rose-100 border border-pink-200 text-sm font-bold text-primary shadow-xs transition group">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 rounded-full bg-white text-primary flex items-center justify-center shadow-xs border border-pink-200 group-hover:scale-105 transition">
                            <i class="fa-regular fa-user text-sm"></i>
                        </div>
                        <div class="text-left">
                            <div class="text-xs font-bold text-gray-800" data-i18n="account">Đăng nhập / Đăng ký</div>
                            <div class="text-[10px] font-medium text-gray-500">Tích điểm & Ưu đãi thành viên</div>
                        </div>
                    </div>
                    <i class="fa-solid fa-arrow-right text-xs text-primary group-hover:translate-x-1 transition transform"></i>
                </button>
            `;
        }
    }
}

// Đóng dropdown khi click ra ngoài
if (typeof window !== "undefined") {
    window.addEventListener("click", (e) => {
        const dropdown = document.getElementById("userDropdownMenu");
        if (dropdown && !dropdown.classList.contains("hidden")) {
            const btn = dropdown.previousElementSibling;
            if (btn && !btn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add("hidden");
            }
        }
    });

    document.addEventListener("DOMContentLoaded", () => {
        updateAuthUI();
    });
}

// Xuất các hàm ra phạm vi toàn cục (Window Global)
if (typeof window !== "undefined") {
    window.TeluaAuth = {
        saveAuthToken,
        getAuthToken,
        getCurrentUser,
        clearAuth,
        isLoggedIn,
        decodeJWTPayload,
        login,
        register,
        logout,
        fetchWithAuth,
        checkRoutePermission,
        openAuthModal,
        closeAuthModal,
        switchAuthTab,
        fillDemoAccount,
        handleLoginSubmit,
        handleRegisterSubmit,
        togglePasswordVisibility,
        toggleUserDropdown,
        updateAuthUI
    };

    window.openAuthModal = openAuthModal;
    window.closeAuthModal = closeAuthModal;
    window.switchAuthTab = switchAuthTab;
    window.fillDemoAccount = fillDemoAccount;
    window.handleLoginSubmit = handleLoginSubmit;
    window.handleRegisterSubmit = handleRegisterSubmit;
    window.togglePasswordVisibility = togglePasswordVisibility;
    window.toggleUserDropdown = toggleUserDropdown;
    window.logout = logout;
    window.getCurrentUser = getCurrentUser;
    window.getAuthToken = getAuthToken;
    window.isLoggedIn = isLoggedIn;
    window.saveAuthToken = saveAuthToken;
    window.clearAuth = clearAuth;
    window.updateAuthUI = updateAuthUI;
}


// ==========================================================================
// MODULE: customer_portal.js
// ==========================================================================
/**
 * Phân hệ Dashboard Khách Hàng (Customer Portal - Đơn Hàng Của Tôi)
 * Hiển thị lịch sử đơn hàng đã mua, trạng thái đơn & tổng chi tiêu.
 * Dữ liệu lấy từ API: GET /api/user/orders (yêu cầu JWT role: customer)
 */

// Bản đồ trạng thái đơn hàng -> nhãn & màu hiển thị
const ORDER_STATUS_META = {
    pending:        { label: "Chờ xác nhận",   color: "bg-amber-100 text-amber-700 border-amber-200",   icon: "fa-clock" },
    confirmed:      { label: "Đã xác nhận",    color: "bg-blue-100 text-blue-700 border-blue-200",       icon: "fa-check" },
    arranging:      { label: "Đang cắm hoa",   color: "bg-purple-100 text-purple-700 border-purple-200", icon: "fa-scissors" },
    shipping:       { label: "Đang vận chuyển", color: "bg-cyan-100 text-cyan-700 border-cyan-200",      icon: "fa-truck" },
    delivered:      { label: "Giao thành công", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    ready_for_pickup: { label: "Sẵn sàng nhận", color: "bg-teal-100 text-teal-700 border-teal-200",      icon: "fa-store" },
    completed:      { label: "Hoàn thành",     color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    cancelled:      { label: "Đã hủy",         color: "bg-red-100 text-red-700 border-red-200",          icon: "fa-ban" },
    returned:       { label: "Trả hàng",       color: "bg-orange-100 text-orange-700 border-orange-200", icon: "fa-rotate-left" }
};

const PAYMENT_STATUS_META = {
    unpaid:   { label: "Chưa thanh toán", color: "bg-gray-100 text-gray-600 border-gray-200",   icon: "fa-credit-card" },
    paid:     { label: "Đã thanh toán",   color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    refunded: { label: "Đã hoàn tiền",    color: "bg-blue-100 text-blue-700 border-blue-200",   icon: "fa-rotate-left" },
    failed:   { label: "Thanh toán lỗi",  color: "bg-red-100 text-red-700 border-red-200",      icon: "fa-circle-xmark" }
};

function formatVND(amount) {
    const n = Number(amount) || 0;
    return n.toLocaleString("vi-VN") + "₫";
}

function formatDate(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getStatusMeta(status, map) {
    return map[status] || { label: status || "Không xác định", color: "bg-gray-100 text-gray-600 border-gray-200", icon: "fa-circle-question" };
}

/**
 * Mở Dashboard Đơn Hàng Của Tôi (chỉ dành cho khách hàng đã đăng nhập)
 */
function openCustomerPortalModal() {
    const user = (typeof getCurrentUser === "function")
        ? getCurrentUser()
        : ((typeof window !== "undefined" && typeof window.getCurrentUser === "function") ? window.getCurrentUser() : null);

    if (!user) {
        if (typeof openAuthModal === "function") openAuthModal("login");
        else if (typeof window !== "undefined" && typeof window.openAuthModal === "function") window.openAuthModal("login");
        return;
    }

    const modal = document.getElementById("customerPortalModal");
    if (!modal) return;

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    loadCustomerOrders();
}

function closeCustomerPortalModal() {
    const modal = document.getElementById("customerPortalModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

/**
 * Tải danh sách đơn hàng của khách hàng đang đăng nhập
 */
async function loadCustomerOrders() {
    const listEl = document.getElementById("customerOrdersList");
    const emptyEl = document.getElementById("customerOrdersEmpty");
    if (!listEl) return;

    // Reset UI
    listEl.innerHTML = `
        <div class="text-center py-12">
            <i class="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i>
            <p class="text-sm text-gray-500 mt-3">Đang tải đơn hàng...</p>
        </div>
    `;
    if (emptyEl) emptyEl.classList.add("hidden");

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/user/orders`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
            throw new Error(json.message || "Không tải được đơn hàng");
        }

        const orders = Array.isArray(json.data) ? json.data : [];
        renderCustomerOrders(orders);
    } catch (e) {
        listEl.innerHTML = `
            <div class="text-center py-12 bg-white rounded-xl border border-red-100">
                <i class="fa-solid fa-triangle-exclamation text-3xl text-red-400 mb-3"></i>
                <p class="text-sm font-semibold text-gray-700">Không thể tải đơn hàng</p>
                <p class="text-xs text-gray-400 mt-1">${e.message}</p>
                <button onclick="loadCustomerOrders()" class="mt-4 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition">
                    <i class="fa-solid fa-rotate-right mr-1"></i> Thử lại
                </button>
            </div>
        `;
    }
}

function renderCustomerOrders(orders) {
    const listEl = document.getElementById("customerOrdersList");
    const emptyEl = document.getElementById("customerOrdersEmpty");
    if (!listEl) return;

    // Cập nhật thẻ tóm tắt
    const totalOrders = orders.length;
    const activeOrders = orders.filter(o => ["pending", "confirmed", "arranging", "shipping", "ready_for_pickup"].includes(o.status)).length;
    const deliveredOrders = orders.filter(o => ["delivered", "completed"].includes(o.status)).length;
    const totalSpent = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || Number(o.financials?.totalAmount) || 0), 0);

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    setText("custTotalOrders", String(totalOrders));
    setText("custActiveOrders", String(activeOrders));
    setText("custDeliveredOrders", String(deliveredOrders));
    setText("custTotalSpent", formatVND(totalSpent));

    if (orders.length === 0) {
        listEl.innerHTML = "";
        if (emptyEl) emptyEl.classList.remove("hidden");
        return;
    }
    if (emptyEl) emptyEl.classList.add("hidden");

    listEl.innerHTML = orders.map(order => {
        const statusMeta = getStatusMeta(order.status, ORDER_STATUS_META);
        const payMeta = getStatusMeta(order.payment?.status, PAYMENT_STATUS_META);
        const total = Number(order.totalAmount) || Number(order.financials?.totalAmount) || 0;
        const items = Array.isArray(order.items) ? order.items : [];
        const itemSummary = items.slice(0, 2).map(it => `${it.productName || it.name || "Sản phẩm"} x${it.quantity || 1}`).join(", ")
            + (items.length > 2 ? ` +${items.length - 2} món khác` : "");

        return `
            <div class="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-3">
                        <span class="font-mono text-xs font-bold text-gray-700">${order.orderCode || order.id || ""}</span>
                        <span class="text-[11px] text-gray-400">${formatDate(order.createdAt || order.orderDate)}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold ${statusMeta.color}">
                            <i class="fa-solid ${statusMeta.icon}"></i> ${statusMeta.label}
                        </span>
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold ${payMeta.color}">
                            <i class="fa-solid ${payMeta.icon}"></i> ${payMeta.label}
                        </span>
                    </div>
                </div>
                <div class="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div class="min-w-0">
                        <p class="text-xs text-gray-600 truncate">${itemSummary || "Không có sản phẩm"}</p>
                        <p class="text-[11px] text-gray-400 mt-1">
                            <i class="fa-solid fa-location-dot mr-1"></i>${order.recipient?.name || ""}${order.recipient?.address ? " • " + order.recipient.address : ""}
                        </p>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <p class="text-sm font-bold text-gray-800">${formatVND(total)}</p>
                        <p class="text-[10px] text-gray-400">${order.payment?.method === "vietqr" ? "VietQR" : (order.payment?.method || "Thanh toán")}</p>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

// Global binding
if (typeof window !== "undefined") {
    window.openCustomerPortalModal = openCustomerPortalModal;
    window.closeCustomerPortalModal = closeCustomerPortalModal;
    window.loadCustomerOrders = loadCustomerOrders;
}


// ==========================================================================
// MODULE: staff_portal.js
// ==========================================================================
/**
 * Phân hệ Cổng Nhân Viên Chi Nhánh (Staff Portal - Sales & Florist)
 * - sales_consultant: Tiếp nhận & xem đơn hàng của chi nhánh.
 * - florist: Xem đơn cần cắm & cập nhật trạng thái cắm hoa.
 * Dữ liệu lấy từ API: GET /api/branch/<branch_id>/orders (phân quyền chi nhánh).
 */

const STAFF_ORDER_STATUS_META = {
    pending:        { label: "Chờ xác nhận",   color: "bg-amber-100 text-amber-700 border-amber-200",   icon: "fa-clock" },
    confirmed:      { label: "Đã xác nhận",    color: "bg-blue-100 text-blue-700 border-blue-200",       icon: "fa-check" },
    arranging:      { label: "Đang cắm hoa",   color: "bg-purple-100 text-purple-700 border-purple-200", icon: "fa-scissors" },
    shipping:       { label: "Đang vận chuyển", color: "bg-cyan-100 text-cyan-700 border-cyan-200",      icon: "fa-truck" },
    delivered:      { label: "Giao thành công", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    ready_for_pickup: { label: "Sẵn sàng nhận", color: "bg-teal-100 text-teal-700 border-teal-200",      icon: "fa-store" },
    completed:      { label: "Hoàn thành",     color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    cancelled:      { label: "Đã hủy",         color: "bg-red-100 text-red-700 border-red-200",          icon: "fa-ban" },
    returned:       { label: "Trả hàng",       color: "bg-orange-100 text-orange-700 border-orange-200", icon: "fa-rotate-left" }
};

const STAFF_PAYMENT_STATUS_META = {
    unpaid:   { label: "Chưa thanh toán", color: "bg-gray-100 text-gray-600 border-gray-200",   icon: "fa-credit-card" },
    paid:     { label: "Đã thanh toán",   color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    refunded: { label: "Đã hoàn tiền",    color: "bg-blue-100 text-blue-700 border-blue-200",   icon: "fa-rotate-left" },
    failed:   { label: "Thanh toán lỗi",  color: "bg-red-100 text-red-700 border-red-200",      icon: "fa-circle-xmark" }
};

function staffFormatVND(amount) {
    const n = Number(amount) || 0;
    return n.toLocaleString("vi-VN") + "₫";
}

function staffFormatDate(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function staffGetStatusMeta(status, map) {
    return map[status] || { label: status || "Không xác định", color: "bg-gray-100 text-gray-600 border-gray-200", icon: "fa-circle-question" };
}

/**
 * Mở Cổng Nhân Viên Chi Nhánh (Sales / Florist)
 */
function openStaffPortalModal() {
    const user = (typeof getCurrentUser === "function")
        ? getCurrentUser()
        : ((typeof window !== "undefined" && typeof window.getCurrentUser === "function") ? window.getCurrentUser() : null);

    if (!user || !["sales_consultant", "florist"].includes(user.role)) {
        alert("Vui lòng đăng nhập bằng tài khoản Nhân viên chi nhánh để truy cập!");
        if (typeof openAuthModal === "function") openAuthModal("login");
        else if (typeof window !== "undefined" && typeof window.openAuthModal === "function") window.openAuthModal("login");
        return;
    }

    const modal = document.getElementById("staffPortalModal");
    if (!modal) return;

    // Cập nhật tiêu đề theo vai trò
    const titleEl = document.getElementById("staffPortalTitle");
    const subtitleEl = document.getElementById("staffPortalSubtitle");
    if (titleEl) {
        titleEl.textContent = user.role === "florist" ? "Đơn Hàng Cần Cắm" : "Tiếp Nhận Đơn Hàng";
    }
    if (subtitleEl) {
        subtitleEl.textContent = user.role === "florist"
            ? "Danh sách đơn hoa cần cắm trong ca"
            : "Danh sách đơn mới & đang xử lý của chi nhánh";
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    loadStaffOrders();
}

function closeStaffPortalModal() {
    const modal = document.getElementById("staffPortalModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

/**
 * Tải danh sách đơn hàng của chi nhánh (phân quyền tự động theo user.branchId)
 */
async function loadStaffOrders() {
    const user = (typeof getCurrentUser === "function") ? getCurrentUser() : null;
    const listEl = document.getElementById("staffOrdersList");
    const emptyEl = document.getElementById("staffOrdersEmpty");
    if (!listEl || !user) return;

    const branchId = user.branchId;
    if (!branchId) {
        listEl.innerHTML = `<div class="text-center py-12 text-gray-400">Tài khoản chưa gắn chi nhánh</div>`;
        return;
    }

    const statusEl = document.getElementById("staffFilterStatus");
    const searchEl = document.getElementById("staffSearchInput");
    const status = statusEl ? statusEl.value : "all";
    const search = searchEl ? searchEl.value.trim() : "";

    listEl.innerHTML = `
        <div class="text-center py-12">
            <i class="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i>
            <p class="text-sm text-gray-500 mt-3">Đang tải đơn hàng...</p>
        </div>
    `;
    if (emptyEl) emptyEl.classList.add("hidden");

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/branch/${branchId}/orders`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
            throw new Error(json.message || "Không tải được đơn hàng");
        }

        let orders = Array.isArray(json.data) ? json.data : [];

        // Lọc theo trạng thái
        if (status && status !== "all") {
            orders = orders.filter(o => o.status === status);
        }

        // Lọc theo từ khóa
        if (search) {
            const s = search.toLowerCase();
            orders = orders.filter(o => {
                const code = (o.orderCode || o.id || "").toLowerCase();
                const senderPhone = (o.sender?.phone || "").toLowerCase();
                const senderName = (o.sender?.name || "").toLowerCase();
                const recipientName = (o.recipient?.name || "").toLowerCase();
                return code.includes(s) || senderPhone.includes(s) || senderName.includes(s) || recipientName.includes(s);
            });
        }

        renderStaffOrders(orders, user.role);
    } catch (e) {
        listEl.innerHTML = `
            <div class="text-center py-12 bg-white rounded-xl border border-red-100">
                <i class="fa-solid fa-triangle-exclamation text-3xl text-red-400 mb-3"></i>
                <p class="text-sm font-semibold text-gray-700">Không thể tải đơn hàng</p>
                <p class="text-xs text-gray-400 mt-1">${e.message}</p>
                <button onclick="loadStaffOrders()" class="mt-4 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition">
                    <i class="fa-solid fa-rotate-right mr-1"></i> Thử lại
                </button>
            </div>
        `;
    }
}

function renderStaffOrders(orders, role) {
    const listEl = document.getElementById("staffOrdersList");
    const emptyEl = document.getElementById("staffOrdersEmpty");
    if (!listEl) return;

    // Cập nhật thẻ tóm tắt
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    setText("staffTotalOrders", String(orders.length));
    setText("staffPendingOrders", String(orders.filter(o => ["pending", "confirmed"].includes(o.status)).length));
    setText("staffArrangingOrders", String(orders.filter(o => o.status === "arranging").length));
    setText("staffShippingOrders", String(orders.filter(o => o.status === "shipping").length));

    if (orders.length === 0) {
        listEl.innerHTML = "";
        if (emptyEl) emptyEl.classList.remove("hidden");
        return;
    }
    if (emptyEl) emptyEl.classList.add("hidden");

    const isFlorist = role === "florist";

    listEl.innerHTML = orders.map(order => {
        const statusMeta = staffGetStatusMeta(order.status, STAFF_ORDER_STATUS_META);
        const payMeta = staffGetStatusMeta(order.payment?.status, STAFF_PAYMENT_STATUS_META);
        const total = Number(order.totalAmount) || Number(order.financials?.totalAmount) || 0;
        const items = Array.isArray(order.items) ? order.items : [];
        const itemSummary = items.slice(0, 2).map(it => `${it.productName || it.name || "Sản phẩm"} x${it.quantity || 1}`).join(", ")
            + (items.length > 2 ? ` +${items.length - 2} món khác` : "");

        // Nút hành động theo vai trò
        let actionBtn = "";
        if (isFlorist) {
            if (order.status === "confirmed") {
                actionBtn = `<button onclick="updateStaffOrderStatus('${order.id}', 'arranging')" class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded-lg transition">
                    <i class="fa-solid fa-scissors mr-1"></i> Bắt đầu cắm
                </button>`;
            } else if (order.status === "arranging") {
                actionBtn = `<button onclick="updateStaffOrderStatus('${order.id}', 'shipping')" class="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-bold rounded-lg transition">
                    <i class="fa-solid fa-truck mr-1"></i> Đã cắm xong
                </button>`;
            }
        } else {
            // Sales consultant
            if (order.status === "pending") {
                actionBtn = `<button onclick="updateStaffOrderStatus('${order.id}', 'confirmed')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition">
                    <i class="fa-solid fa-check mr-1"></i> Xác nhận
                </button>`;
            }
        }

        return `
            <div class="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-3">
                        <span class="font-mono text-xs font-bold text-gray-700">${order.orderCode || order.id || ""}</span>
                        <span class="text-[11px] text-gray-400">${staffFormatDate(order.createdAt || order.orderDate)}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold ${statusMeta.color}">
                            <i class="fa-solid ${statusMeta.icon}"></i> ${statusMeta.label}
                        </span>
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold ${payMeta.color}">
                            <i class="fa-solid ${payMeta.icon}"></i> ${payMeta.label}
                        </span>
                    </div>
                </div>
                <div class="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div class="min-w-0 flex-1">
                        <p class="text-xs text-gray-600 truncate">${itemSummary || "Không có sản phẩm"}</p>
                        <p class="text-[11px] text-gray-400 mt-1">
                            <i class="fa-solid fa-user mr-1"></i>${order.recipient?.name || ""} • ${order.recipient?.phone || ""}
                        </p>
                        <p class="text-[11px] text-gray-400 mt-0.5">
                            <i class="fa-solid fa-location-dot mr-1"></i>${order.recipient?.address || "Nhận tại cửa hàng"}
                        </p>
                        ${order.delivery?.fulfillmentType === "pickup" ? `<p class="text-[10px] text-teal-600 font-bold mt-0.5"><i class="fa-solid fa-store mr-1"></i>Nhận tại cửa hàng</p>` : ""}
                    </div>
                    <div class="text-right flex-shrink-0 flex flex-col items-end gap-2">
                        <p class="text-sm font-bold text-gray-800">${staffFormatVND(total)}</p>
                        ${actionBtn}
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

/**
 * Cập nhật trạng thái đơn hàng (dùng cho sales xác nhận, florist cắm hoa)
 */
async function updateStaffOrderStatus(orderId, newStatus) {
    if (!orderId || !newStatus) return;
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    try {
        const res = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        const json = await res.json();

        if (json.success) {
            if (typeof showToast === "function") showToast("Đã cập nhật trạng thái đơn hàng!", 'success');
            loadStaffOrders();
        } else {
            if (typeof showToast === "function") showToast(json.message || "Lỗi cập nhật trạng thái", 'error');
            else alert(json.message || "Lỗi cập nhật trạng thái");
        }
    } catch (e) {
        if (typeof showToast === "function") showToast("Lỗi kết nối: " + e.message, 'error');
        else alert("Lỗi kết nối: " + e.message);
    }
}

// Global binding
if (typeof window !== "undefined") {
    window.openStaffPortalModal = openStaffPortalModal;
    window.closeStaffPortalModal = closeStaffPortalModal;
    window.loadStaffOrders = loadStaffOrders;
    window.updateStaffOrderStatus = updateStaffOrderStatus;
}


// ==========================================================================
// MODULE: order_dashboard.js
// ==========================================================================
/**
 * Phân hệ Bảng Điều Khiển Đơn Hàng (Order Dashboard - Nội bộ)
 * Dành cho các vai trò nội bộ: super_admin, branch_manager, florist, sales_consultant.
 * Hiển thị tổng quan đơn hàng (thẻ thống kê) + danh sách đơn read-only, tương tự Dashboard khách hàng.
 * Phạm vi dữ liệu:
 *   - super_admin       : Toàn chuỗi (tất cả chi nhánh)
 *   - branch_manager    : Đơn của chi nhánh mình (backend tự ép theo branchId)
 *   - florist / sales   : Đơn của chi nhánh mình (truyền branchId để giới hạn)
 * Nguồn dữ liệu: GET /api/flower/v1/admin/orders?timeframe=all[&branchId=...]
 */

const DASH_ORDER_STATUS_META = {
    pending:          { label: "Chờ xác nhận",    color: "bg-amber-100 text-amber-700 border-amber-200",     icon: "fa-clock" },
    confirmed:        { label: "Đã xác nhận",     color: "bg-blue-100 text-blue-700 border-blue-200",        icon: "fa-check" },
    arranging:        { label: "Đang cắm hoa",    color: "bg-purple-100 text-purple-700 border-purple-200",  icon: "fa-scissors" },
    shipping:         { label: "Đang vận chuyển", color: "bg-cyan-100 text-cyan-700 border-cyan-200",        icon: "fa-truck" },
    delivered:        { label: "Giao thành công", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    ready_for_pickup: { label: "Sẵn sàng nhận",   color: "bg-teal-100 text-teal-700 border-teal-200",        icon: "fa-store" },
    completed:        { label: "Hoàn thành",      color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    cancelled:        { label: "Đã hủy",          color: "bg-red-100 text-red-700 border-red-200",           icon: "fa-ban" },
    returned:         { label: "Trả hàng",        color: "bg-orange-100 text-orange-700 border-orange-200",  icon: "fa-rotate-left" }
};

const DASH_PAYMENT_STATUS_META = {
    unpaid:   { label: "Chưa thanh toán", color: "bg-gray-100 text-gray-600 border-gray-200",       icon: "fa-credit-card" },
    paid:     { label: "Đã thanh toán",   color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    refunded: { label: "Đã hoàn tiền",    color: "bg-blue-100 text-blue-700 border-blue-200",        icon: "fa-rotate-left" },
    failed:   { label: "Thanh toán lỗi",  color: "bg-red-100 text-red-700 border-red-200",           icon: "fa-circle-xmark" }
};

const INTERNAL_ROLES = ["super_admin", "branch_manager", "florist", "sales_consultant"];

function dashFormatVND(amount) {
    const n = Number(amount) || 0;
    return n.toLocaleString("vi-VN") + "₫";
}

function dashFormatDate(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function dashGetStatusMeta(status, map) {
    return map[status] || { label: status || "Không xác định", color: "bg-gray-100 text-gray-600 border-gray-200", icon: "fa-circle-question" };
}

function dashGetCurrentUser() {
    if (typeof getCurrentUser === "function") return getCurrentUser();
    if (typeof window !== "undefined" && typeof window.getCurrentUser === "function") return window.getCurrentUser();
    return null;
}

/**
 * Mở Bảng Điều Khiển Đơn Hàng (chỉ dành cho vai trò nội bộ đã đăng nhập)
 */
function openOrderDashboardModal() {
    const user = dashGetCurrentUser();
    if (!user) {
        if (typeof openAuthModal === "function") openAuthModal("login");
        else if (typeof window !== "undefined" && typeof window.openAuthModal === "function") window.openAuthModal("login");
        return;
    }
    if (!INTERNAL_ROLES.includes(user.role)) {
        alert("Bạn không có quyền truy cập Bảng Điều Khiển Đơn Hàng.");
        return;
    }

    const modal = document.getElementById("orderDashboardModal");
    if (!modal) return;

    // Cập nhật phụ đề phạm vi dữ liệu
    const subtitle = document.getElementById("orderDashboardScope");
    if (subtitle) {
        subtitle.textContent = user.role === "super_admin"
            ? "Phạm vi: Toàn chuỗi cửa hàng"
            : `Phạm vi: Chi nhánh ${user.branchName || user.branchId || "của bạn"}`;
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    loadDashboardOrders();
}

function closeOrderDashboardModal() {
    const modal = document.getElementById("orderDashboardModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

/**
 * Tải danh sách đơn hàng theo phạm vi phân quyền của vai trò hiện tại
 */
async function loadDashboardOrders() {
    const listEl = document.getElementById("orderDashboardList");
    const emptyEl = document.getElementById("orderDashboardEmpty");
    if (!listEl) return;

    listEl.innerHTML = `
        <div class="text-center py-12">
            <i class="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i>
            <p class="text-sm text-gray-500 mt-3">Đang tải đơn hàng...</p>
        </div>
    `;
    if (emptyEl) emptyEl.classList.add("hidden");

    const user = dashGetCurrentUser() || {};
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    let url = `${API_BASE}/admin/orders?timeframe=all`;
    // Florist/Sales: giới hạn theo chi nhánh của họ (branch_manager backend tự ép, super_admin xem toàn chuỗi)
    if (user.role !== "super_admin" && user.branchId) {
        url += `&branchId=${encodeURIComponent(user.branchId)}`;
    }

    try {
        const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
        const json = await res.json();
        if (!res.ok || !json.success) {
            throw new Error(json.message || "Không tải được đơn hàng");
        }
        // /admin/orders trả về { data: { orders: [...] } }
        const data = json.data || {};
        const orders = Array.isArray(data.orders) ? data.orders : (Array.isArray(data) ? data : []);
        renderDashboardOrders(orders);
    } catch (e) {
        listEl.innerHTML = `
            <div class="text-center py-12 bg-white rounded-xl border border-red-100">
                <i class="fa-solid fa-triangle-exclamation text-3xl text-red-400 mb-3"></i>
                <p class="text-sm font-semibold text-gray-700">Không thể tải đơn hàng</p>
                <p class="text-xs text-gray-400 mt-1">${e.message}</p>
                <button onclick="loadDashboardOrders()" class="mt-4 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition">
                    <i class="fa-solid fa-rotate-right mr-1"></i> Thử lại
                </button>
            </div>
        `;
    }
}

function renderDashboardOrders(orders) {
    const listEl = document.getElementById("orderDashboardList");
    const emptyEl = document.getElementById("orderDashboardEmpty");
    if (!listEl) return;

    const getTotal = (o) => Number(o.totalAmount) || Number(o.financials?.totalAmount) || 0;
    const activeStatuses = ["pending", "confirmed", "arranging", "shipping", "ready_for_pickup"];
    const doneStatuses = ["delivered", "completed"];

    const totalOrders = orders.length;
    const activeOrders = orders.filter(o => activeStatuses.includes(o.status)).length;
    const completedOrders = orders.filter(o => doneStatuses.includes(o.status)).length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.status === "cancelled" ? 0 : getTotal(o)), 0);

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    setText("dashTotalOrders", String(totalOrders));
    setText("dashActiveOrders", String(activeOrders));
    setText("dashCompletedOrders", String(completedOrders));
    setText("dashTotalRevenue", dashFormatVND(totalRevenue));

    if (orders.length === 0) {
        listEl.innerHTML = "";
        if (emptyEl) emptyEl.classList.remove("hidden");
        return;
    }
    if (emptyEl) emptyEl.classList.add("hidden");

    listEl.innerHTML = orders.map(order => {
        const statusMeta = dashGetStatusMeta(order.status, DASH_ORDER_STATUS_META);
        const payMeta = dashGetStatusMeta(order.payment?.status, DASH_PAYMENT_STATUS_META);
        const total = getTotal(order);
        const items = Array.isArray(order.items) ? order.items : [];
        const itemSummary = items.slice(0, 2).map(it => `${it.productName || it.name || "Sản phẩm"} x${it.quantity || 1}`).join(", ")
            + (items.length > 2 ? ` +${items.length - 2} món khác` : "");
        const customerName = order.recipient?.name || order.sender?.name || "Khách lẻ";
        const branchLabel = order.assignedBranchId || order.branchId || "";

        return `
            <div class="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-3">
                        <span class="font-mono text-xs font-bold text-gray-700">${order.orderCode || order.id || ""}</span>
                        <span class="text-[11px] text-gray-400">${dashFormatDate(order.createdAt || order.orderDate)}</span>
                        ${branchLabel ? `<span class="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"><i class="fa-solid fa-store mr-1"></i>${branchLabel}</span>` : ""}
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold ${statusMeta.color}">
                            <i class="fa-solid ${statusMeta.icon}"></i> ${statusMeta.label}
                        </span>
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold ${payMeta.color}">
                            <i class="fa-solid ${payMeta.icon}"></i> ${payMeta.label}
                        </span>
                    </div>
                </div>
                <div class="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div class="min-w-0">
                        <p class="text-xs font-semibold text-gray-700 truncate"><i class="fa-solid fa-user mr-1 text-gray-400"></i>${customerName}</p>
                        <p class="text-xs text-gray-600 truncate mt-1">${itemSummary || "Không có sản phẩm"}</p>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <p class="text-sm font-bold text-gray-800">${dashFormatVND(total)}</p>
                        <p class="text-[10px] text-gray-400">${order.payment?.method === "vietqr" ? "VietQR" : (order.payment?.method || "Thanh toán")}</p>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

// Global binding (bundle chạy trong IIFE, gán ra window để HTML inline onclick gọi được)
if (typeof window !== "undefined") {
    window.openOrderDashboardModal = openOrderDashboardModal;
    window.closeOrderDashboardModal = closeOrderDashboardModal;
    window.loadDashboardOrders = loadDashboardOrders;
}


// ==========================================================================
// MODULE: portal_admin.js
// ==========================================================================
function lockScreen(msg) {
    if (typeof showScreenLock === 'function') showScreenLock(msg);
    else if (typeof window !== 'undefined' && typeof window.showScreenLock === 'function') window.showScreenLock(msg);
}

function unlockScreen() {
    if (typeof hideScreenLock === 'function') hideScreenLock();
    else if (typeof window !== 'undefined' && typeof window.hideScreenLock === 'function') window.hideScreenLock();
}

function notifyUser(message, type = 'success', duration = 5000) {
    if (typeof showToast === 'function') {
        showToast(message, type, duration);
    } else if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        window.showToast(message, type, duration);
    } else {
        alert(message);
    }
}

/**
 * Phân hệ Quản Trị Hệ Thống (TASK 07 - Admin Portal, Product CMS & Price Governance)
 */

const PRICE_LEVEL_CONFIG = {
    price_lvl_01: { name: "LV_01: Phổ Thông (Standard)", min: 300000, max: 550000 },
    price_lvl_02: { name: "LV_02: Cao Cấp (Premium)", min: 600000, max: 950000 },
    price_lvl_03: { name: "LV_03: Sang Trọng (Luxury)", min: 1000000, max: 2500000 },
    price_lvl_04: { name: "LV_04: Độc Bản VIP (Exclusive)", min: 2600000, max: 15000000 }
};

let allAdminCategories = [];
let allAdminProducts = [];
let allAdminPromotions = [];
let allAdminAddons = [];
let allAdminTranslations = {};
let allAdminUsers = [];
let allAdminBranches = [];

document.addEventListener("DOMContentLoaded", () => {
    loadAdminCompanyInfo();
    const path = (window.location.pathname || "").toLowerCase();
    const hash = (window.location.hash || "").toLowerCase();
    if (path.includes("/portal/admin") || path.includes("/portal/manager") || hash === "#admin") {
        const user = typeof getCurrentUser === "function" ? getCurrentUser() : null;
        if (user && (user.role === "super_admin" || user.role === "branch_manager")) {
            setTimeout(() => openAdminPortalModal(), 100);
        } else {
            if (typeof openAuthModal === "function") {
                setTimeout(() => openAuthModal("login"), 100);
            }
        }
    }
});

if (typeof document !== "undefined" && document.readyState !== "loading") {
    loadAdminCompanyInfo();
}

function openAdminPortalModal(initialTab = null) {
    // Nếu yêu cầu tab cấu hình hệ thống, chuyển hướng trực tiếp sang modal Cấu Hình Hệ Thống
    if (initialTab === "company" || initialTab === "translations") {
        openSystemConfigModal(initialTab);
        return;
    }

    const dropdown = document.getElementById("userDropdownMenu");
    if (dropdown) dropdown.classList.add("hidden");

    const user = (typeof getCurrentUser === "function") 
        ? getCurrentUser() 
        : ((typeof window !== "undefined" && typeof window.getCurrentUser === "function") ? window.getCurrentUser() : null);

    if (!user || (user.role !== "super_admin" && user.role !== "branch_manager")) {
        alert("Vui lòng đăng nhập bằng tài khoản Super Admin hoặc Quản Lý Chi Nhánh để truy cập Cổng Quản Trị!");
        if (typeof openAuthModal === "function") openAuthModal("login");
        else if (typeof window !== "undefined" && typeof window.openAuthModal === "function") window.openAuthModal("login");
        return;
    }

    const modal = document.getElementById("adminPortalModal");
    if (!modal) return;

    const nameEl = document.getElementById("adminUserName");
    const roleEl = document.getElementById("adminUserRole");
    if (nameEl) nameEl.textContent = user.fullName || user.phone || "Quản trị viên";
    if (roleEl) roleEl.textContent = user.role;

    // Phân quyền hiển thị Tab Chuỗi Cửa Hàng
    const branchTabBtn = document.getElementById("tabBtnBranches");
    const optSuperAdmin = document.getElementById("optRoleSuperAdmin");
    const optBranchManager = document.getElementById("optRoleBranchManager");
    const filterBranchSelect = document.getElementById("filterUserBranch");

    if (user.role === "branch_manager") {
        if (branchTabBtn) branchTabBtn.classList.add("hidden");
        if (optSuperAdmin) optSuperAdmin.classList.add("hidden");
        if (optBranchManager) optBranchManager.classList.add("hidden");
        if (filterBranchSelect) {
            filterBranchSelect.value = user.branchId;
            filterBranchSelect.disabled = true;
        }
    } else {
        if (branchTabBtn) branchTabBtn.classList.remove("hidden");
        if (optSuperAdmin) optSuperAdmin.classList.remove("hidden");
        if (optBranchManager) optBranchManager.classList.remove("hidden");
        if (filterBranchSelect) filterBranchSelect.disabled = false;
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    loadAdminCategories();
    loadAdminProducts();
    loadAdminBranches();
    onPriceLevelChange();

    if (initialTab) {
        switchAdminTab(initialTab);
    }
}

function closeAdminPortalModal() {
    const modal = document.getElementById("adminPortalModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

// ==========================================
// MODAL CẤU HÌNH HỆ THỐNG (DOANH NGHIỆP & ĐA NGÔN NGỮ)
// ==========================================

function openSystemConfigModal(initialTab = "company") {
    const dropdown = document.getElementById("userDropdownMenu");
    if (dropdown) dropdown.classList.add("hidden");

    const user = (typeof getCurrentUser === "function") 
        ? getCurrentUser() 
        : ((typeof window !== "undefined" && typeof window.getCurrentUser === "function") ? window.getCurrentUser() : null);

    if (!user || user.role !== "super_admin") {
        alert("Chức năng Cấu Hình Hệ Thống chỉ dành cho Tổng Quản Trị Viên (Super Admin)!");
        if (!user && typeof openAuthModal === "function") openAuthModal("login");
        return;
    }

    const modal = document.getElementById("systemConfigModal");
    if (!modal) return;

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    switchSystemConfigTab(initialTab);
}

function closeSystemConfigModal() {
    const modal = document.getElementById("systemConfigModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

function switchSystemConfigTab(tabName) {
    if (tabName !== "company" && tabName !== "translations" && tabName !== "payment" && tabName !== "addonvis") tabName = "company";

    const btnCompany = document.getElementById("tabSysBtnCompany");
    const btnTranslations = document.getElementById("tabSysBtnTranslations");
    const btnPayment = document.getElementById("tabSysBtnPayment");
    const btnAddonVis = document.getElementById("tabSysBtnAddonVis");
    const contentCompany = document.getElementById("tabSysContentCompany");
    const contentTranslations = document.getElementById("tabSysContentTranslations");
    const contentPayment = document.getElementById("tabSysContentPayment");
    const contentAddonVis = document.getElementById("tabSysContentAddonVis");

    const activeCls = "py-3 font-bold text-xs sm:text-sm border-b-2 border-primary text-primary transition flex items-center flex-shrink-0";
    const idleCls = "py-3 font-bold text-xs sm:text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition flex items-center flex-shrink-0";

    // Ẩn toàn bộ, reset trạng thái nút
    if (btnCompany) btnCompany.className = idleCls;
    if (btnTranslations) btnTranslations.className = idleCls;
    if (btnPayment) btnPayment.className = idleCls;
    if (btnAddonVis) btnAddonVis.className = idleCls;
    if (contentCompany) contentCompany.classList.add("hidden");
    if (contentTranslations) contentTranslations.classList.add("hidden");
    if (contentPayment) contentPayment.classList.add("hidden");
    if (contentAddonVis) contentAddonVis.classList.add("hidden");

    if (tabName === "company") {
        if (btnCompany) btnCompany.className = activeCls;
        if (contentCompany) contentCompany.classList.remove("hidden");
        loadAdminCompanyInfo();
    } else if (tabName === "payment") {
        if (btnPayment) btnPayment.className = activeCls;
        if (contentPayment) contentPayment.classList.remove("hidden");
        loadAdminPaymentConfig();
    } else if (tabName === "addonvis") {
        if (btnAddonVis) btnAddonVis.className = activeCls;
        if (contentAddonVis) contentAddonVis.classList.remove("hidden");
        loadAdminAddonConfig();
    } else {
        if (btnTranslations) btnTranslations.className = activeCls;
        if (contentTranslations) contentTranslations.classList.remove("hidden");
        loadAdminTranslations();
    }
}

function checkAdminAccess() {
    if (typeof getCurrentUser !== "function" || typeof getAuthToken !== "function") return;
    const user = getCurrentUser();
    const nameEl = document.getElementById("adminUserName");
    const roleEl = document.getElementById("adminUserRole");
    if (nameEl && user) nameEl.textContent = user.fullName || "Quản trị viên";
    if (roleEl && user) roleEl.textContent = user.role;
}

function switchAdminTab(tabName) {
    // Nếu gọi tab cấu hình hệ thống, tự động mở System Config Dialog
    if (tabName === "company" || tabName === "translations") {
        closeAdminPortalModal();
        openSystemConfigModal(tabName);
        return;
    }

    // Chuẩn hóa tên tab (hỗ trợ alias 'users' -> 'staff')
    if (tabName === "users") tabName = "staff";

    const tabTitles = {
        orders: "Đơn Hàng",
        products: "Mẫu Hoa & Bảng Giá",
        categories: "Danh Mục Hoa",
        staff: "Nhân Sự Nội Bộ",
        customers: "Khách Hàng & CRM",
        branches: "Chuỗi Showroom",
        promotions: "Khuyến Mãi & Voucher",
        addons: "Sản Phẩm Kèm Theo"
    };

    console.group(`%c🖥️ [GUI_VIEW] Đang hiển thị Tab: "${tabTitles[tabName] || tabName}" (#tabContent${tabName.charAt(0).toUpperCase() + tabName.slice(1)})`, "color: #0288d1; font-weight: bold; font-size: 12px;");
    console.log("⏱️ Thời điểm:", new Date().toLocaleTimeString());
    console.log("📂 Tab Identifier:", tabName);

    const tabs = ["orders", "products", "categories", "staff", "customers", "branches", "promotions", "addons"];
    tabs.forEach((t) => {
        const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const content = document.getElementById(`tabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (btn && content) {
            if (t === tabName) {
                btn.className = "py-3 font-bold text-xs sm:text-sm border-b-2 border-primary text-primary transition flex items-center flex-shrink-0";
                content.classList.remove("hidden");
                console.log(`  👁️ [GUI Hiển Thị] Element #${content.id} -> visible (class 'hidden' removed)`);
                try {
                    btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                } catch (e) {}
            } else {
                btn.className = "py-3 font-bold text-xs sm:text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition flex items-center flex-shrink-0";
                content.classList.add("hidden");
            }
        }
    });

    console.log(`  🚀 Bắt đầu nạp/đồng bộ dữ liệu phân hệ: ${tabTitles[tabName] || tabName}`);
    if (tabName === "orders") loadAdminOrders();
    if (tabName === "categories") loadAdminCategories();
    if (tabName === "staff") loadAdminUsers();
    if (tabName === "customers") loadAdminCustomers();
    if (tabName === "branches") loadAdminBranches();
    if (tabName === "promotions") loadAdminPromotions();
    if (tabName === "addons") loadAdminAddons();

    console.groupEnd();
}

// ==========================================
// 0. QUẢN LÝ DANH MỤC HOA ĐỘNG (CATEGORIES CMS)
// ==========================================

async function loadAdminCategories() {
    const tbody = document.getElementById("categoriesTableBody");
    if (!tbody) return;

    // Chỉ hiển thị placeholder đang tải nếu bảng chưa có dữ liệu nào trước đó
    if (!allAdminCategories || allAdminCategories.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-400 font-medium"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải danh mục hoa từ hệ thống...</td></tr>`;
    }
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    try {
        const res = await fetch(`${API_BASE}/admin/categories`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();

        if (json.success && Array.isArray(json.data)) {
            allAdminCategories = json.data;
            renderCategoriesTable(allAdminCategories);
            populateCategoryDropdowns(allAdminCategories);
        } else if (!allAdminCategories || allAdminCategories.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold">${json.message || "Lỗi tải danh mục"}</td></tr>`;
        }
    } catch (e) {
        if (!allAdminCategories || allAdminCategories.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
        }
    }
}

function renderCategoriesTable(categories) {
    const tbody = document.getElementById("categoriesTableBody");
    if (!tbody) return;

    if (categories.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-12 text-center">
                    <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                        <div class="w-16 h-16 rounded-full bg-pink-50 text-pink-400 flex items-center justify-center text-2xl mb-3 shadow-inner">
                            <i class="fa-solid fa-layer-group"></i>
                        </div>
                        <p class="font-bold text-gray-700 text-sm">Chưa có danh mục nào</p>
                        <p class="text-xs text-gray-400 mt-1">Bấm nút "Thêm Danh Mục Mới" ở góc trên để tạo danh mục hoa tươi.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Luôn sắp xếp theo số thứ tự hiển thị (order) từ bé đến lớn (1, 2, 3...)
    const sortedCategories = [...categories].sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));

    let html = "";
    sortedCategories.forEach((cat) => {
        const isDeleted = cat.status === "deleted" || cat.isDeleted === true;
        const isActive = cat.isActive !== false && !isDeleted;

        let statusBadge = "";
        if (isDeleted) {
            statusBadge = `<span class="bg-red-100 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-200">🔴 Đã Xóa Mềm</span>`;
        } else if (isActive) {
            statusBadge = `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-200">🟢 Đang Bán (Active)</span>`;
        } else {
            statusBadge = `<span class="bg-gray-100 text-gray-500 text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-200">⚪ Đã Ẩn (Inactive)</span>`;
        }

        const fallbackImg = "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500";
        const catImg = cat.image || fallbackImg;
        const iconClass = cat.icon || "fa-solid fa-spa";
        const createdDate = cat.createdAt ? cat.createdAt.replace("T", " ").replace("Z", "") : "—";
        const updatedDate = cat.updatedAt ? cat.updatedAt.replace("T", " ").replace("Z", "") : createdDate;

        const rowBg = isDeleted ? "bg-red-50/20 opacity-75" : "hover:bg-pink-50/20";

        html += `
            <tr class="${rowBg} transition border-b border-gray-100">
                <td class="p-3">
                    <div class="flex items-center space-x-3">
                        <img src="${catImg}" alt="${cat.name}" class="w-10 h-10 object-cover rounded-xl border border-gray-200 shadow-2xs ${isDeleted ? 'grayscale' : ''}">
                        <div class="w-7 h-7 rounded-lg bg-pink-50 text-primary flex items-center justify-center text-xs">
                            <i class="${iconClass}"></i>
                        </div>
                    </div>
                </td>
                <td class="p-3">
                    <div class="font-bold text-gray-800 text-sm ${isDeleted ? 'line-through text-gray-400' : ''}">${cat.name}</div>
                    <div class="text-[10px] text-gray-400 font-mono flex items-center gap-1.5 flex-wrap">
                        <span>ID: <span class="text-primary font-semibold">${cat.id}</span></span>
                        ${cat.textId ? `<span class="bg-purple-50 text-purple-700 font-semibold px-1.5 py-0.2 rounded border border-purple-200">🌐 ${cat.textId}</span>` : ''}
                    </div>
                </td>
                <td class="p-3">
                    <span class="text-xs text-gray-500 line-clamp-1 max-w-[180px]">${cat.description || "—"}</span>
                </td>
                <td class="p-3">
                    <div class="flex items-center space-x-1.5">
                        <span class="w-6 h-6 rounded-full bg-pink-50 text-primary font-extrabold text-xs flex items-center justify-center border border-pink-200 shadow-2xs">
                            ${cat.order || 1}
                        </span>
                        <div class="flex flex-col space-y-0.5">
                            <button onclick="moveCategory('${cat.id}', 'up')" title="Đẩy danh mục lên trước" class="w-4 h-3.5 bg-gray-100 hover:bg-primary hover:text-white text-gray-600 rounded text-[9px] flex items-center justify-center transition">
                                <i class="fa-solid fa-chevron-up"></i>
                            </button>
                            <button onclick="moveCategory('${cat.id}', 'down')" title="Đẩy danh mục xuống sau" class="w-4 h-3.5 bg-gray-100 hover:bg-primary hover:text-white text-gray-600 rounded text-[9px] flex items-center justify-center transition">
                                <i class="fa-solid fa-chevron-down"></i>
                            </button>
                        </div>
                    </div>
                </td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3 text-[11px] text-gray-500 font-mono leading-tight">
                    <div><span class="text-gray-400">Tạo:</span> ${createdDate}</div>
                    <div><span class="text-gray-400">Sửa:</span> ${updatedDate}</div>
                </td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center space-x-1.5">
                        ${!isDeleted ? `
                            <button onclick="editCategory('${cat.id}')" title="Chỉnh sửa danh mục" class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="toggleCategory('${cat.id}', '${cat.name.replace(/'/g, "\\'")}', ${isActive})" title="${isActive ? 'Ẩn khỏi web' : 'Hiện trên web'}" class="px-2.5 py-1 ${isActive ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' : 'bg-green-50 hover:bg-green-100 text-green-700'} rounded-lg text-xs font-bold transition">
                                <i class="fa-solid ${isActive ? 'fa-eye-slash' : 'fa-eye'} mr-1"></i> ${isActive ? 'Ẩn' : 'Hiện'}
                            </button>
                            <button onclick="deleteCategory('${cat.id}', '${cat.name}')" title="Xóa mềm danh mục (vẫn lưu trong json)" class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-trash"></i> Xóa
                            </button>
                        ` : `
                            <button onclick="restoreCategory('${cat.id}', '${cat.name}')" title="Khôi phục lại danh mục này" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-rotate-left mr-1"></i> Khôi Phục
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

let editingCategoryI18n = { en: {}, ja: {}, ko: {}, zh: {} };
let currentCatEditingLang = 'vi';

function switchCategoryLangTab(lang) {
    if (currentCatEditingLang !== 'vi') {
        saveCurrentCatI18nDraft();
    }
    currentCatEditingLang = lang;

    const langTabs = document.querySelectorAll(".cat-lang-tab");
    langTabs.forEach(tab => {
        tab.classList.remove("bg-white", "text-primary", "shadow-xs");
        tab.classList.add("text-gray-600", "hover:text-gray-900");
    });
    const activeTab = document.getElementById(`catLangTab_${lang}`);
    if (activeTab) {
        activeTab.classList.add("bg-white", "text-primary", "shadow-xs");
        activeTab.classList.remove("text-gray-600", "hover:text-gray-900");
    }

    const viContainer = document.getElementById("catFields_vi");
    const i18nContainer = document.getElementById("catFields_i18n");
    const langLabels = document.querySelectorAll(".catCurrentLangLabel");

    const langNameMap = {
        en: "English",
        ja: "日本語",
        ko: "한국어",
        zh: "中文"
    };

    if (lang === 'vi') {
        if (viContainer) viContainer.classList.remove("hidden");
        if (i18nContainer) i18nContainer.classList.add("hidden");
    } else {
        if (viContainer) viContainer.classList.add("hidden");
        if (i18nContainer) i18nContainer.classList.remove("hidden");

        langLabels.forEach(lbl => lbl.textContent = langNameMap[lang] || lang);

        const lData = editingCategoryI18n[lang] || {};
        const nameInp = document.getElementById("catI18nName");
        const descInp = document.getElementById("catI18nDescription");

        if (nameInp) nameInp.value = lData.name || "";
        if (descInp) descInp.value = lData.description || "";
    }
}

function saveCurrentCatI18nDraft() {
    const l = currentCatEditingLang;
    if (l === 'vi') return;
    if (!editingCategoryI18n[l]) editingCategoryI18n[l] = {};

    const nameInp = document.getElementById("catI18nName");
    const descInp = document.getElementById("catI18nDescription");

    if (nameInp) editingCategoryI18n[l].name = nameInp.value.trim();
    if (descInp) editingCategoryI18n[l].description = descInp.value.trim();
}

function onCategoryDescTextIdChange() {
    const select = document.getElementById("catDescTextId");
    const container = document.getElementById("catDescTextIdCustomContainer");
    const customInput = document.getElementById("catDescTextIdCustom");
    if (!select || !container) return;

    if (select.value === "__custom__") {
        container.classList.remove("hidden");
        if (customInput) customInput.focus();
    } else {
        container.classList.add("hidden");
        if (customInput) customInput.value = "";
    }
}

function openCategoryModal(isEdit = false) {
    const modal = document.getElementById("categoryModal");
    const title = document.getElementById("categoryModalTitle");
    const form = document.getElementById("categoryForm");
    const errBox = document.getElementById("categoryModalError");

    if (!modal) return;
    if (errBox) errBox.classList.add("hidden");

    if (!isEdit && form) {
        form.reset();
        document.getElementById("editCategoryId").value = "";
        document.getElementById("catIdInput").disabled = false;
        if (document.getElementById("catTextId")) document.getElementById("catTextId").value = "";
        const customContainer = document.getElementById("catTextIdCustomContainer");
        if (customContainer) customContainer.classList.add("hidden");
        if (document.getElementById("catTextIdCustom")) document.getElementById("catTextIdCustom").value = "";

        if (document.getElementById("catDescTextId")) document.getElementById("catDescTextId").value = "";
        const descCustomContainer = document.getElementById("catDescTextIdCustomContainer");
        if (descCustomContainer) descCustomContainer.classList.add("hidden");
        if (document.getElementById("catDescTextIdCustom")) document.getElementById("catDescTextIdCustom").value = "";

        document.getElementById("catOrder").value = allAdminCategories.length + 1;
        document.getElementById("catIsActive").checked = true;
        editingCategoryI18n = { en: {}, ja: {}, ko: {}, zh: {} };
        if (title) title.textContent = "Thêm Danh Mục Hoa Mới";
    }

    switchCategoryLangTab('vi');
    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

function onCategoryTextIdChange() {
    const select = document.getElementById("catTextId");
    const container = document.getElementById("catTextIdCustomContainer");
    const customInput = document.getElementById("catTextIdCustom");
    if (!select || !container) return;

    if (select.value === "__custom__") {
        container.classList.remove("hidden");
        if (customInput) customInput.focus();
    } else {
        container.classList.add("hidden");
        if (customInput) customInput.value = "";
    }
}

function closeCategoryModal() {
    const modal = document.getElementById("categoryModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

function editCategory(catId) {
    const cat = allAdminCategories.find((c) => c.id === catId);
    if (!cat) return;

    document.getElementById("editCategoryId").value = cat.id;
    const idInput = document.getElementById("catIdInput");
    if (idInput) {
        idInput.value = cat.id;
        idInput.disabled = true; // Không cho sửa ID khi update
    }
    document.getElementById("catName").value = cat.name || "";
    
    // Tên Text ID
    const textIdSelect = document.getElementById("catTextId");
    const customContainer = document.getElementById("catTextIdCustomContainer");
    const customInput = document.getElementById("catTextIdCustom");
    const targetTextId = cat.textId || "";

    if (textIdSelect) {
        const exists = Array.from(textIdSelect.options).some(opt => opt.value === targetTextId);
        if (exists) {
            textIdSelect.value = targetTextId;
            if (customContainer) customContainer.classList.add("hidden");
            if (customInput) customInput.value = "";
        } else if (targetTextId) {
            textIdSelect.value = "__custom__";
            if (customContainer) customContainer.classList.remove("hidden");
            if (customInput) customInput.value = targetTextId;
        } else {
            textIdSelect.value = "";
            if (customContainer) customContainer.classList.add("hidden");
            if (customInput) customInput.value = "";
        }
    }

    // Mô tả Text ID
    const descTextIdSelect = document.getElementById("catDescTextId");
    const descCustomContainer = document.getElementById("catDescTextIdCustomContainer");
    const descCustomInput = document.getElementById("catDescTextIdCustom");
    const targetDescTextId = cat.descTextId || cat.descriptionTextId || "";

    if (descTextIdSelect) {
        const exists = Array.from(descTextIdSelect.options).some(opt => opt.value === targetDescTextId);
        if (exists) {
            descTextIdSelect.value = targetDescTextId;
            if (descCustomContainer) descCustomContainer.classList.add("hidden");
            if (descCustomInput) descCustomInput.value = "";
        } else if (targetDescTextId) {
            descTextIdSelect.value = "__custom__";
            if (descCustomContainer) descCustomContainer.classList.remove("hidden");
            if (descCustomInput) descCustomInput.value = targetDescTextId;
        } else {
            descTextIdSelect.value = "";
            if (descCustomContainer) descCustomContainer.classList.add("hidden");
            if (descCustomInput) descCustomInput.value = "";
        }
    }

    document.getElementById("catImage").value = cat.image || "";
    document.getElementById("catIcon").value = cat.icon || "fa-solid fa-spa";
    document.getElementById("catOrder").value = cat.order || 1;
    document.getElementById("catDescription").value = cat.description || "";
    document.getElementById("catIsActive").checked = cat.isActive !== false;

    // Load category i18n
    editingCategoryI18n = {
        en: cat.i18n?.en ? { ...cat.i18n.en } : {},
        ja: cat.i18n?.ja ? { ...cat.i18n.ja } : {},
        ko: cat.i18n?.ko ? { ...cat.i18n.ko } : {},
        zh: cat.i18n?.zh ? { ...cat.i18n.zh } : {}
    };

    const title = document.getElementById("categoryModalTitle");
    if (title) title.textContent = `Chỉnh Sửa Danh Mục: ${cat.name}`;

    openCategoryModal(true);
}

async function handleCategorySubmit(event) {
    if (event) event.preventDefault();

    if (currentCatEditingLang !== 'vi') {
        saveCurrentCatI18nDraft();
    }

    const editId = document.getElementById("editCategoryId").value;
    const catId = (document.getElementById("catIdInput").value || "").trim().toLowerCase().replace(/\s+/g, "_");
    const name = document.getElementById("catName").value.trim();
    
    const textIdSelect = document.getElementById("catTextId");
    let textId = (textIdSelect?.value || "").trim();
    if (textId === "__custom__") {
        textId = (document.getElementById("catTextIdCustom")?.value || "").trim();
    }

    const descTextIdSelect = document.getElementById("catDescTextId");
    let descTextId = (descTextIdSelect?.value || "").trim();
    if (descTextId === "__custom__") {
        descTextId = (document.getElementById("catDescTextIdCustom")?.value || "").trim();
    }

    const image = document.getElementById("catImage").value.trim();
    const icon = document.getElementById("catIcon").value.trim() || "fa-solid fa-spa";
    const order = parseInt(document.getElementById("catOrder").value, 10) || 1;
    const description = document.getElementById("catDescription").value.trim();
    const isActive = document.getElementById("catIsActive").checked;

    if (!name) {
        alert("Vui lòng nhập tên danh mục!");
        return;
    }

    const cleanCatI18n = {};
    ['en', 'ja', 'ko', 'zh'].forEach(l => {
        if (editingCategoryI18n[l] && (editingCategoryI18n[l].name || editingCategoryI18n[l].description)) {
            cleanCatI18n[l] = {
                name: editingCategoryI18n[l].name || "",
                description: editingCategoryI18n[l].description || ""
            };
        }
    });

    const payload = {
        id: editId || catId,
        name,
        textId: textId || undefined,
        descTextId: descTextId || undefined,
        image,
        icon,
        order,
        description,
        i18n: Object.keys(cleanCatI18n).length > 0 ? cleanCatI18n : undefined,
        isActive,
        status: isActive ? "active" : "inactive"
    };

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const isEdit = !!editId;
    const url = isEdit ? `${API_BASE}/admin/categories/${editId}` : `${API_BASE}/admin/categories`;
    const method = isEdit ? "PUT" : "POST";
    const errBox = document.getElementById("categoryModalError");

    lockScreen(isEdit ? `Đang lưu cấu hình danh mục "${name}"...` : `Đang tạo mới danh mục "${name}"...`);
    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (res.ok && json.success) {
            closeCategoryModal();
            await loadAdminCategories();
            if (typeof renderStorefrontCategories === "function") renderStorefrontCategories();
            if (typeof renderAllProducts === "function") renderAllProducts();
            notifyUser(isEdit ? `Đã cập nhật danh mục "${name}" thành công!` : `Đã tạo danh mục mới "${name}" thành công!`, 'success');
        } else {
            const msg = json.message || "Lỗi lưu danh mục";
            if (errBox) {
                errBox.textContent = "❌ " + msg;
                errBox.classList.remove("hidden");
            }
            notifyUser(`Không thể lưu danh mục: ${msg}`, 'error');
        }
    } catch (e) {
        if (errBox) {
            errBox.textContent = "❌ Lỗi kết nối: " + e.message;
            errBox.classList.remove("hidden");
        }
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

async function toggleCategory(catId, catName, currentActive) {
    const targetCat = allAdminCategories.find(c => c.id === catId);
    const displayName = catName || (targetCat ? targetCat.name : catId);
    const isCurrentlyActive = currentActive !== undefined ? currentActive : (targetCat ? targetCat.isActive !== false : true);
    const actionText = isCurrentlyActive ? "Ẩn đi" : "Bật hiển thị";
    const detailText = isCurrentlyActive 
        ? `Khi ẩn, danh mục "${displayName}" và các sản phẩm thuộc danh mục này sẽ tạm thời không hiển thị trên website khách hàng.`
        : `Khi bật, danh mục "${displayName}" và các mẫu hoa liên quan sẽ được mở bán và hiển thị công khai trên website.`;

    const isConfirmed = await (typeof showConfirmDialog === 'function' ? showConfirmDialog : window.showConfirmDialog)({
        title: isCurrentlyActive ? "Xác nhận Ẩn Danh Mục" : "Xác nhận Mở Danh Mục",
        message: `Bạn có chắc chắn muốn ${actionText.toLowerCase()} danh mục "${displayName}" không?`,
        detail: detailText,
        confirmText: isCurrentlyActive ? "Ẩn danh mục" : "Bật hiển thị",
        cancelText: "Hủy bỏ",
        type: isCurrentlyActive ? "warning" : "success",
        icon: isCurrentlyActive ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"
    });
    if (!isConfirmed) return;

    lockScreen(`Đang ${actionText.toLowerCase()} danh mục "${displayName}"...`);
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/categories/${catId}/toggle`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminCategories();
            if (typeof renderStorefrontCategories === "function") renderStorefrontCategories();
            if (typeof renderAllProducts === "function") renderAllProducts();
            notifyUser(`Đã ${actionText.toLowerCase()} danh mục "${displayName}" thành công!`, 'success');
        } else {
            notifyUser(`Lỗi cập nhật trạng thái: ${json.message || "Không xác định"}`, 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

async function deleteCategory(catId, catName) {
    const isConfirmed = await (typeof showConfirmDialog === 'function' ? showConfirmDialog : window.showConfirmDialog)({
        title: "Xác nhận Xóa Danh Mục",
        message: `Bạn có chắc chắn muốn xóa danh mục "${catName}" (ID: ${catId}) không?`,
        detail: "Dữ liệu sẽ được đánh dấu 'Đã xóa mềm' (Soft Deleted) và vẫn được lưu trữ an toàn để có thể khôi phục lại khi cần.",
        confirmText: "Xóa danh mục",
        cancelText: "Hủy bỏ",
        type: "danger",
        icon: "fa-solid fa-trash"
    });
    if (!isConfirmed) return;

    lockScreen(`Đang xóa danh mục "${catName}"...`);
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/categories/${catId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminCategories();
            notifyUser("Đã chuyển danh mục sang trạng thái Đã Xóa thành công!", 'success');
        } else {
            notifyUser("Không thể xóa danh mục: " + (json.message || ""), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

async function restoreCategory(catId, catName) {
    lockScreen(`Đang khôi phục danh mục "${catName || catId}"...`);
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/categories/${catId}/restore`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminCategories();
            notifyUser(`Đã khôi phục danh mục "${catName || catId}" thành công!`, 'success');
        } else {
            notifyUser("Lỗi khôi phục danh mục: " + (json.message || ""), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

async function moveCategory(catId, direction) {
    lockScreen("Đang cập nhật vị trí thứ tự danh mục...");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/categories/${catId}/move`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ direction })
        });
        
        const contentType = res.headers.get("content-type") || "";
        let json;
        if (contentType.includes("application/json")) {
            json = await res.json();
        } else {
            const rawText = await res.text();
            throw new Error(`Máy chủ không phản hồi định dạng JSON (${res.status} ${res.statusText}). Vui lòng đảm bảo backend Flask đang chạy trên cổng 5000.`);
        }

        if (json.success) {
            await loadAdminCategories();
            if (typeof renderStorefrontCategories === "function") {
                renderStorefrontCategories();
            }
            if (typeof renderAllProducts === "function") {
                renderAllProducts();
            }
            notifyUser("Đã thay đổi thứ tự danh mục thành công!", 'success');
        } else {
            notifyUser(`Không thể di chuyển thứ tự: ${json.message || "Lỗi không xác định"}`, 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}



function populateCategoryDropdowns(categories) {
    if (!Array.isArray(categories)) return;

    // Luôn sắp xếp theo số thứ tự hiển thị (order) từ bé đến lớn
    const sortedCategories = [...categories].sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));

    // 1. Dropdown lọc danh mục ở trang Admin Sản Phẩm
    const filterSelect = document.getElementById("filterProductCategory");
    if (filterSelect) {
        const currentVal = filterSelect.value;
        let opts = `<option value="">Tất cả danh mục</option>`;
        sortedCategories.forEach((c) => {
            opts += `<option value="${c.id}">${c.name} (${c.id})</option>`;
        });
        filterSelect.innerHTML = opts;
        if (currentVal) filterSelect.value = currentVal;
    }

    // 2. Dropdown chọn danh mục trong Modal Thêm/Sửa Mẫu Hoa
    const prodCatSelect = document.getElementById("prodCategory");
    if (prodCatSelect) {
        const currentVal = prodCatSelect.value;
        let opts = "";
        sortedCategories.forEach((c) => {
            opts += `<option value="${c.id}">${c.name}</option>`;
        });
        prodCatSelect.innerHTML = opts;
        if (currentVal) prodCatSelect.value = currentVal;
    }
}


// ==========================================
// 1. QUẢN LÝ NHÂN SỰ NỘI BỘ (STAFF & RBAC)
// ==========================================

const ROLE_DISPLAY_MAP = {
    super_admin: { label: "👑 Tổng Quản Trị", badge: "bg-purple-100 text-purple-800" },
    branch_manager: { label: "🏬 Quản Lý Chi Nhánh", badge: "bg-blue-100 text-blue-800" },
    florist: { label: "🌸 Thợ Cắm Hoa", badge: "bg-pink-100 text-pink-800" },
    sales_consultant: { label: "💼 Tư Vấn Viên", badge: "bg-amber-100 text-amber-800" }
};

const BRANCH_NAME_MAP = {
    branch_q10: "Showroom Q10",
    branch_q1: "Showroom Bến Nghé Q1",
    branch_thao_dien: "Showroom Thảo Điền",
    all: "Toàn bộ hệ thống (HQ)"
};

function populateBranchDropdowns(branches) {
    if (!Array.isArray(branches)) return;

    // 1. Cập nhật dynamic map tên chi nhánh cho bảng nhân sự
    branches.forEach((b) => {
        if (b.id) {
            BRANCH_NAME_MAP[b.id] = b.name || b.code || b.id;
        }
    });

    // 2. Dropdown lọc chi nhánh ở Tab Nhân Sự (filterUserBranch)
    const filterSelect = document.getElementById("filterUserBranch");
    if (filterSelect) {
        const currentVal = filterSelect.value || "all";
        let opts = `<option value="all">Tất cả chi nhánh</option>`;
        branches.filter((b) => b.isActive !== false).forEach((b) => {
            opts += `<option value="${b.id}">${b.name}</option>`;
        });
        filterSelect.innerHTML = opts;
        if (currentVal) filterSelect.value = currentVal;
    }

    // 3. Dropdown chọn chi nhánh trong Modal Thêm/Sửa Nhân Sự (staffBranch)
    const staffBranchSelect = document.getElementById("staffBranch");
    if (staffBranchSelect) {
        const currentVal = staffBranchSelect.value;
        let opts = "";
        branches.filter((b) => b.isActive !== false).forEach((b) => {
            opts += `<option value="${b.id}">${b.name} (${b.code || b.id})</option>`;
        });
        opts += `<option value="all" id="optBranchAll">Toàn bộ hệ thống (HQ - Toàn quyền)</option>`;
        staffBranchSelect.innerHTML = opts;
        if (currentVal) staffBranchSelect.value = currentVal;
    }
}

async function loadAdminUsers() {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    // Đảm bảo dữ liệu chi nhánh đã được tải từ backend và đồng bộ vào dropdowns
    if (!allAdminBranches || allAdminBranches.length === 0) {
        try {
            const bRes = await fetch(`${API_BASE}/admin/branches`, { headers: { "Authorization": `Bearer ${token}` } });
            const bJson = await bRes.json();
            if (bJson.success && Array.isArray(bJson.data)) {
                allAdminBranches = bJson.data;
                populateBranchDropdowns(allAdminBranches);
            }
        } catch (err) {
            console.warn("Không thể tải danh sách chi nhánh:", err);
        }
    }

    const filterSelect = document.getElementById("filterUserBranch");
    const branch = filterSelect ? filterSelect.value : "all";
    const tbody = document.getElementById("usersTableBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-400">Đang tải danh sách nhân sự nội bộ...</td></tr>`;

    try {
        let url = `${API_BASE}/admin/users`;
        if (branch && branch !== "all") url += `?branchId=${branch}`;
        const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
        const json = await res.json();

        if (json.success && Array.isArray(json.data)) {
            // Lọc chỉ lấy nhân viên nội bộ (loại bỏ khách hàng role='customer')
            allAdminUsers = json.data.filter((u) => u.role !== "customer");
            renderUsersTable(allAdminUsers);
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold">${json.message || "Lỗi tải nhân sự"}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById("usersTableBody");
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400 font-medium">Chưa có nhân sự nội bộ nào trong danh sách.</td></tr>`;
        return;
    }

    const currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : {};

    let html = "";
    users.forEach((u) => {
        const roleInfo = ROLE_DISPLAY_MAP[u.role] || { label: u.role, badge: "bg-gray-100 text-gray-800" };
        const branchName = BRANCH_NAME_MAP[u.branchId] || (u.branchId ? u.branchId : "—");
        const activeBadge = u.isActive !== false
            ? `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">🟢 Đang Hoạt Động</span>`
            : `<span class="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">⚪ Đã Tạm Khóa</span>`;

        const isSelf = u.id === currentUser.userId || u.id === currentUser.id;

        html += `
            <tr class="hover:bg-gray-50/80 transition">
                <td class="p-3">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-full bg-pink-100 text-primary border border-pink-200 flex items-center justify-center font-bold text-xs">
                            ${(u.fullName || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <span class="font-bold text-gray-800 block">${u.fullName}</span>
                            <span class="text-[10px] text-gray-400 font-mono">${u.id}</span>
                        </div>
                    </div>
                </td>
                <td class="p-3">
                    <div class="font-medium text-gray-800">${u.phone || "—"}</div>
                    <div class="text-[11px] text-gray-500">${u.email || "—"}</div>
                </td>
                <td class="p-3">
                    <span class="text-[11px] font-bold px-2.5 py-1 rounded-lg ${roleInfo.badge}">${roleInfo.label}</span>
                </td>
                <td class="p-3 font-semibold text-gray-700">
                    <i class="fa-solid fa-location-dot text-primary mr-1 text-xs"></i> ${branchName}
                </td>
                <td class="p-3">${activeBadge}</td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center space-x-2">
                        <button onclick="editUser('${u.id}')" title="Chỉnh sửa thông tin & Mật khẩu" class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition">
                            <i class="fa-solid fa-pen-to-square"></i> Sửa
                        </button>
                        ${!isSelf ? `
                            <button onclick="deleteUser('${u.id}', '${u.fullName}')" title="Xóa nhân sự" class="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ==========================================
// 2. QUẢN LÝ KHÁCH HÀNG & CRM (CUSTOMERS)
// ==========================================

let allAdminCustomers = [];

const TIER_DISPLAY_MAP = {
    vip: { label: "👑 VIP Kim Cương", badge: "bg-purple-100 text-purple-800 border border-purple-200" },
    diamond: { label: "💎 Kim Cương", badge: "bg-cyan-100 text-cyan-800 border border-cyan-200" },
    gold: { label: "🥇 Vàng (Gold)", badge: "bg-amber-100 text-amber-800 border border-amber-200" },
    silver: { label: "🥈 Bạc (Silver)", badge: "bg-slate-100 text-slate-800 border border-slate-200" },
    standard: { label: "🥉 Tiêu Chuẩn", badge: "bg-gray-100 text-gray-700 border border-gray-200" }
};

async function loadAdminCustomers() {
    const searchInput = document.getElementById("searchCustomerInput");
    const tierSelect = document.getElementById("filterCustomerTier");
    const search = searchInput ? searchInput.value.trim() : "";
    const tier = tierSelect ? tierSelect.value : "all";
    const tbody = document.getElementById("customersTableBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-400">Đang tải danh sách khách hàng CRM...</td></tr>`;
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    try {
        let url = `${API_BASE}/admin/customers?`;
        if (search) url += `search=${encodeURIComponent(search)}&`;
        if (tier && tier !== "all") url += `tier=${encodeURIComponent(tier)}&`;

        const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
        const json = await res.json();

        if (json.success && Array.isArray(json.data)) {
            allAdminCustomers = json.data;
            renderCustomersTable(allAdminCustomers);
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold">${json.message || "Lỗi tải khách hàng"}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
    }
}

function renderCustomersTable(customers) {
    const tbody = document.getElementById("customersTableBody");
    if (!tbody) return;

    if (customers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="p-12 text-center">
                    <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                        <div class="w-16 h-16 rounded-full bg-amber-50 text-amber-400 flex items-center justify-center text-2xl mb-3 shadow-inner">
                            <i class="fa-solid fa-crown"></i>
                        </div>
                        <p class="font-bold text-gray-700 text-sm">Không tìm thấy khách hàng nào</p>
                        <p class="text-xs text-gray-400 mt-1">Dữ liệu khách hàng thân thiết CRM sẽ tự động hiển thị tại đây.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = "";
    customers.forEach((c) => {
        const tierKey = (c.tier || "standard").toLowerCase();
        const tierInfo = TIER_DISPLAY_MAP[tierKey] || TIER_DISPLAY_MAP.standard;
        const totalSpent = (c.totalSpent || 0).toLocaleString() + "₫";
        const points = (c.loyaltyPoints || 0).toLocaleString();
        const orderCount = c.orderCount || 0;
        const regDate = c.createdAt ? c.createdAt.split("T")[0] : "—";

        html += `
            <tr class="hover:bg-amber-50/20 transition">
                <td class="p-3">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center font-bold text-xs">
                            ${(c.fullName || "K").charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <span class="font-bold text-gray-800 block">${c.fullName}</span>
                            <span class="text-[10px] text-gray-400 font-mono">ID: ${c.id || "—"}</span>
                        </div>
                    </div>
                </td>
                <td class="p-3">
                    <div class="font-bold text-primary text-xs"><i class="fa-solid fa-phone mr-1"></i> ${c.phone || "—"}</div>
                    <div class="text-[11px] text-gray-500">${c.email || "—"}</div>
                </td>
                <td class="p-3">
                    <span class="text-[10px] font-bold px-2.5 py-1 rounded-lg ${tierInfo.badge}">${tierInfo.label}</span>
                </td>
                <td class="p-3">
                    <div class="font-extrabold text-amber-600 text-xs"><i class="fa-solid fa-star text-amber-400 mr-1"></i> ${points} điểm</div>
                </td>
                <td class="p-3">
                    <div class="font-bold text-gray-800 text-xs">${totalSpent}</div>
                    <div class="text-[10px] text-gray-500">${orderCount} đơn hàng</div>
                </td>
                <td class="p-3 text-[11px] text-gray-500">
                    ${regDate}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function openUserModal(isEdit = false) {
    const modal = document.getElementById("userModal");
    const title = document.getElementById("userModalTitle");
    const form = document.getElementById("userForm");
    const errBox = document.getElementById("userModalError");
    const pwdHint = document.getElementById("staffPwdHint");
    const user = typeof getCurrentUser === "function" ? getCurrentUser() : {};

    if (!modal) return;
    if (errBox) errBox.classList.add("hidden");

    // Luôn đảm bảo dropdown chọn chi nhánh được cập nhật các chi nhánh mới nhất
    if (allAdminBranches && allAdminBranches.length > 0) {
        populateBranchDropdowns(allAdminBranches);
    }

    if (!isEdit && form) {
        form.reset();
        document.getElementById("editUserId").value = "";
        if (title) title.textContent = "Thêm Nhân Sự Mới Vào Hệ Thống";
        if (pwdHint) pwdHint.textContent = "(ít nhất 6 ký tự)";
        document.getElementById("staffPassword").required = true;

        if (user.role === "branch_manager") {
            document.getElementById("staffBranch").value = user.branchId;
            document.getElementById("staffBranch").disabled = true;
        } else {
            document.getElementById("staffBranch").disabled = false;
        }
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

function closeUserModal() {
    const modal = document.getElementById("userModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

function editUser(userId) {
    const u = allAdminUsers.find((user) => user.id === userId);
    if (!u) return;

    document.getElementById("editUserId").value = u.id;
    document.getElementById("staffFullName").value = u.fullName || "";
    document.getElementById("staffPhone").value = u.phone || "";
    document.getElementById("staffEmail").value = u.email || "";
    document.getElementById("staffRole").value = u.role || "florist";
    document.getElementById("staffBranch").value = u.branchId || "branch_q10";
    document.getElementById("staffPassword").value = "";
    document.getElementById("staffPassword").required = false;
    document.getElementById("staffIsActive").checked = u.isActive !== false;

    const pwdHint = document.getElementById("staffPwdHint");
    if (pwdHint) pwdHint.textContent = "(để trống nếu giữ nguyên mật khẩu cũ)";

    const title = document.getElementById("userModalTitle");
    if (title) title.textContent = `Chỉnh Sửa Nhân Sự: ${u.fullName}`;

    openUserModal(true);
}

async function handleUserSubmit(event) {
    if (event) event.preventDefault();

    const editId = document.getElementById("editUserId").value;
    const fullName = document.getElementById("staffFullName").value.trim();
    const phone = document.getElementById("staffPhone").value.trim();
    const email = document.getElementById("staffEmail").value.trim();
    const role = document.getElementById("staffRole").value;
    const branchSelect = document.getElementById("staffBranch");
    const branchId = branchSelect.value;
    const password = document.getElementById("staffPassword").value;
    const errBox = document.getElementById("userModalError");

    if (!isEdit && !password) {
        if (errBox) {
            errBox.textContent = "❌ Vui lòng nhập mật khẩu cho tài khoản nhân sự mới (tối thiểu 6 ký tự)";
            errBox.classList.remove("hidden");
        }
        notifyUser("Vui lòng nhập mật khẩu cho nhân sự mới!", 'error');
        document.getElementById("staffPassword")?.focus();
        return;
    }

    if (password && password.length < 6) {
        if (errBox) {
            errBox.textContent = "❌ Mật khẩu phải có độ dài tối thiểu 6 ký tự";
            errBox.classList.remove("hidden");
        }
        notifyUser("Mật khẩu phải có tối thiểu 6 ký tự!", 'error');
        document.getElementById("staffPassword")?.focus();
        return;
    }

    const payload = { fullName, phone, email, role, branchId, isActive };
    if (password) payload.password = password;

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const isEdit = !!editId;
    const url = isEdit ? `${API_BASE}/admin/users/${editId}` : `${API_BASE}/admin/users`;
    const method = isEdit ? "PUT" : "POST";

    lockScreen(isEdit ? `Đang cập nhật nhân sự "${fullName}"...` : `Đang tạo tài khoản nhân sự "${fullName}"...`);
    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (res.ok && json.success) {
            closeUserModal();
            await loadAdminUsers();
            notifyUser(isEdit ? "Cập nhật nhân sự thành công!" : "🎉 Thêm nhân sự mới thành công!", 'success');
        } else {
            if (errBox) {
                errBox.textContent = json.message || "Lỗi lưu thông tin nhân sự";
                errBox.classList.remove("hidden");
            }
            notifyUser(json.message || "Lỗi lưu thông tin nhân sự", 'error');
        }
    } catch (e) {
        if (errBox) {
            errBox.textContent = "Lỗi kết nối: " + e.message;
            errBox.classList.remove("hidden");
        }
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

async function deleteUser(userId, fullName) {
    const isConfirmed = await (typeof showConfirmDialog === 'function' ? showConfirmDialog : window.showConfirmDialog)({
        title: "Xác nhận Xóa Nhân Sự",
        message: `Bạn có chắc chắn muốn xóa tài khoản nhân sự "${fullName}" khỏi hệ thống không?`,
        detail: "Tài khoản này sẽ bị vô hiệu hóa quyền truy cập vào Cổng Quản Trị.",
        confirmText: "Xóa tài khoản",
        cancelText: "Hủy bỏ",
        type: "danger",
        icon: "fa-solid fa-user-xmark"
    });
    if (!isConfirmed) return;

    lockScreen(`Đang xóa tài khoản nhân sự "${fullName}"...`);
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const json = await res.json();
        if (res.ok && json.success) {
            await loadAdminUsers();
            notifyUser("Đã xóa tài khoản nhân sự thành công!", 'success');
        } else {
            notifyUser("Lỗi: " + (json.message || "Không thể xóa nhân sự"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

// ==========================================
// QUẢN LÝ CHUỖI CỬA HÀNG (BRANCHES MANAGEMENT)
// ==========================================

async function loadAdminBranches() {
    const tbody = document.getElementById("branchesTableBody");
    if (tbody && (!allAdminBranches || allAdminBranches.length === 0)) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-400 font-medium"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải danh sách chuỗi cửa hàng...</td></tr>`;
    }
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    try {
        const res = await fetch(`${API_BASE}/admin/branches`, { headers: { "Authorization": `Bearer ${token}` } });
        const json = await res.json();

        if (json.success && Array.isArray(json.data)) {
            allAdminBranches = json.data;
            if (tbody) renderBranchesTable(allAdminBranches);
            populateBranchDropdowns(allAdminBranches);
            if (allAdminUsers && allAdminUsers.length > 0) {
                renderUsersTable(allAdminUsers);
            }
        } else if (tbody && (!allAdminBranches || allAdminBranches.length === 0)) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold">${json.message || "Lỗi tải chi nhánh"}</td></tr>`;
        }
    } catch (e) {
        if (tbody && (!allAdminBranches || allAdminBranches.length === 0)) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
        }
    }
}

function renderBranchesTable(branches) {
    const tbody = document.getElementById("branchesTableBody");
    if (!tbody) return;

    if (branches.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-12 text-center">
                    <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                        <div class="w-16 h-16 rounded-full bg-emerald-50 text-emerald-400 flex items-center justify-center text-2xl mb-3 shadow-inner">
                            <i class="fa-solid fa-store"></i>
                        </div>
                        <p class="font-bold text-gray-700 text-sm">Chưa có chi nhánh showroom nào</p>
                        <p class="text-xs text-gray-400 mt-1">Bấm nút "Mở Thêm Chi Nhánh Mới" để mở rộng mạng lưới showroom.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : {};
    const isSuperAdmin = currentUser.role === "super_admin";

    let html = "";
    branches.forEach((b) => {
        const activeBadge = b.isActive !== false
            ? `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">🟢 Hoạt Động</span>`
            : `<span class="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">⚪ Tạm Đóng Cửa</span>`;

        html += `
            <tr class="hover:bg-gray-50/80 transition">
                <td class="p-3">
                    <span class="font-bold text-xs bg-pink-50 text-primary border border-pink-200 px-2 py-1 rounded-md">${b.code || b.id}</span>
                </td>
                <td class="p-3">
                    <span class="font-bold text-gray-800 text-sm block">${b.name}</span>
                    <span class="text-[11px] text-gray-500">${b.openHours || "07:30 - 21:00"}</span>
                </td>
                <td class="p-3">
                    <div class="font-medium text-gray-700 text-xs">${b.address}</div>
                    <div class="text-[11px] text-primary font-bold"><i class="fa-solid fa-phone mr-1"></i> ${b.phone || "—"}</div>
                </td>
                <td class="p-3 font-mono text-[11px] text-gray-600">
                    ${b.lat}, ${b.lng}
                </td>
                <td class="p-3 font-bold text-accent text-xs">
                    ${b.deliveryRadiusKm || 10} km
                </td>
                <td class="p-3">${activeBadge}</td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center space-x-2">
                        ${isSuperAdmin ? `
                            <button onclick="editBranch('${b.id}')" class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-pen-to-square"></i> Sửa
                            </button>
                            <button onclick="toggleBranch('${b.id}')" class="px-2.5 py-1 ${b.isActive !== false ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'} rounded-lg text-xs font-bold transition">
                                ${b.isActive !== false ? '⚪ Đóng' : '🟢 Mở'}
                            </button>
                        ` : `
                            <span class="text-xs text-gray-400 font-semibold">Chỉ xem</span>
                        `}
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function openBranchModal(isEdit = false) {
    const modal = document.getElementById("branchModal");
    const title = document.getElementById("branchModalTitle");
    const form = document.getElementById("branchForm");
    const errBox = document.getElementById("branchModalError");

    if (!modal) return;
    if (errBox) errBox.classList.add("hidden");

    if (!isEdit && form) {
        form.reset();
        document.getElementById("editBranchId").value = "";
        document.getElementById("branchRadius").value = 10;
        document.getElementById("branchOpenHours").value = "07:30 - 21:00";
        document.getElementById("branchLat").value = 10.7769;
        document.getElementById("branchLng").value = 106.7009;
        if (title) title.textContent = "Mở Thêm Chi Nhánh Showroom Mới";
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

function closeBranchModal() {
    const modal = document.getElementById("branchModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

function editBranch(branchId) {
    const b = allAdminBranches.find((branch) => branch.id === branchId);
    if (!b) return;

    document.getElementById("editBranchId").value = b.id;
    document.getElementById("branchName").value = b.name || "";
    document.getElementById("branchCode").value = b.code || "";
    document.getElementById("branchAddress").value = b.address || "";
    document.getElementById("branchPhone").value = b.phone || "";
    document.getElementById("branchOpenHours").value = b.openHours || "07:30 - 21:00";
    document.getElementById("branchLat").value = b.lat || 10.7769;
    document.getElementById("branchLng").value = b.lng || 106.7009;
    document.getElementById("branchRadius").value = b.deliveryRadiusKm || 10;
    document.getElementById("branchAmenities").value = b.amenities || "";
    document.getElementById("branchIsActive").checked = b.isActive !== false;

    const title = document.getElementById("branchModalTitle");
    if (title) title.textContent = `Chỉnh Sửa Chi Nhánh: ${b.name}`;

    openBranchModal(true);
}

async function handleBranchSubmit(event) {
    if (event) event.preventDefault();

    const editId = document.getElementById("editBranchId").value;
    const name = document.getElementById("branchName").value.trim();
    const code = document.getElementById("branchCode").value.trim().toUpperCase();
    const address = document.getElementById("branchAddress").value.trim();
    const phone = document.getElementById("branchPhone").value.trim();
    const openHours = document.getElementById("branchOpenHours").value.trim();
    const lat = parseFloat(document.getElementById("branchLat").value);
    const lng = parseFloat(document.getElementById("branchLng").value);
    const deliveryRadiusKm = parseInt(document.getElementById("branchRadius").value, 10) || 10;
    const amenities = document.getElementById("branchAmenities").value.trim();
    const isActive = document.getElementById("branchIsActive").checked;

    const payload = { name, code, address, phone, openHours, lat, lng, deliveryRadiusKm, amenities, isActive };

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const isEdit = !!editId;
    const url = isEdit ? `${API_BASE}/admin/branches/${editId}` : `${API_BASE}/admin/branches`;
    const method = isEdit ? "PUT" : "POST";
    const errBox = document.getElementById("branchModalError");

    lockScreen(isEdit ? `Đang lưu chi nhánh "${name}"...` : `Đang mở thêm chi nhánh "${name}"...`);
    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (res.ok && json.success) {
            closeBranchModal();
            await loadAdminBranches();
            notifyUser(isEdit ? `Cập nhật chi nhánh "${name}" thành công!` : `Mở chi nhánh mới "${name}" thành công!`, 'success');
        } else {
            const msg = json.message || "Lỗi lưu thông tin chi nhánh";
            if (errBox) {
                errBox.textContent = "❌ " + msg;
                errBox.classList.remove("hidden");
            }
            notifyUser(`Lỗi lưu chi nhánh: ${msg}`, 'error');
        }
    } catch (e) {
        if (errBox) {
            errBox.textContent = "❌ Lỗi kết nối: " + e.message;
            errBox.classList.remove("hidden");
        }
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

async function toggleBranch(branchId) {
    lockScreen("Đang cập nhật trạng thái chi nhánh...");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/branches/${branchId}/toggle`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const json = await res.json();
        if (res.ok && json.success) {
            await loadAdminBranches();
            notifyUser("Đã cập nhật trạng thái chi nhánh thành công!", 'success');
        } else {
            notifyUser("Lỗi: " + (json.message || "Không thể cập nhật trạng thái chi nhánh"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

// ==========================================
// QUẢN LÝ SẢN PHẨM & PRICE GOVERNANCE
// ==========================================

async function loadAdminProducts() {
    const searchInput = document.getElementById("searchProductInput");
    const categorySelect = document.getElementById("filterProductCategory");
    const statusSelect = document.getElementById("filterProductStatus");
    const search = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const category = categorySelect ? categorySelect.value : "";
    const status = statusSelect ? statusSelect.value : "";
    const tbody = document.getElementById("productsTableBody");
    if (!tbody) return;

    if (!allAdminProducts || allAdminProducts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-gray-400 font-medium"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải danh mục hoa tươi...</td></tr>`;
    }

    try {
        let url = `${API_BASE}/products`;
        if (category) url += `?category=${encodeURIComponent(category)}`;
        const res = await fetch(url);
        const json = await res.json();

        if (json.success && json.data) {
            allAdminProducts = json.data;
            let displayProducts = allAdminProducts;
            if (status === "active") {
                displayProducts = displayProducts.filter(p => p && p.isActive !== false);
            } else if (status === "inactive") {
                displayProducts = displayProducts.filter(p => p && p.isActive === false);
            }
            if (search) {
                const normSearch = typeof removeVietnameseTones === 'function' ? removeVietnameseTones(search) : search;
                displayProducts = displayProducts.filter(p => {
                    if (!p) return false;
                    const name = (p.name || "").toLowerCase();
                    const id = (p.id || "").toLowerCase();
                    const comp = (p.flowerComposition || "").toLowerCase();
                    const desc = (p.description || "").toLowerCase();

                    const normName = typeof removeVietnameseTones === 'function' ? removeVietnameseTones(name) : name;
                    const normComp = typeof removeVietnameseTones === 'function' ? removeVietnameseTones(comp) : comp;
                    const normDesc = typeof removeVietnameseTones === 'function' ? removeVietnameseTones(desc) : desc;

                    return normName.includes(normSearch) || id.includes(search) || normComp.includes(normSearch) || normDesc.includes(normSearch);
                });
            }
            renderProductsTable(displayProducts);
        }
    } catch (e) {
        if (!allAdminProducts || allAdminProducts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-red-500 font-bold">Lỗi tải sản phẩm: ${e.message}</td></tr>`;
        }
    }
}

function renderProductsTable(products) {
    const tbody = document.getElementById("productsTableBody");
    if (!tbody) return;

    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="p-12 text-center">
                    <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                        <div class="w-16 h-16 rounded-full bg-pink-50 text-pink-400 flex items-center justify-center text-2xl mb-3 shadow-inner">
                            <i class="fa-solid fa-spa"></i>
                        </div>
                        <p class="font-bold text-gray-700 text-sm">Không có mẫu hoa nào trong danh mục này</p>
                        <p class="text-xs text-gray-400 mt-1">Bấm nút "Thêm Mẫu Hoa Mới" ở góc trên để bổ sung vào Catalogue.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = "";
    products.forEach((p) => {
        const lvlCode = (p.priceLevelId || "").replace("price_lvl_", "LV_").toUpperCase();
        const activeBadge = p.isActive !== false
            ? `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">🟢 Đang Bán</span>`
            : `<span class="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full">⚪ Đã Ẩn</span>`;

        const stockQ10 = p.stockByBranch?.branch_q10 ?? 0;
        const stockQ1 = p.stockByBranch?.branch_q1 ?? 0;
        const stockTD = p.stockByBranch?.branch_thao_dien ?? 0;

        html += `
            <tr class="hover:bg-pink-50/30 transition">
                <td class="p-4">
                    <img src="${p.image}" alt="${p.name}" class="w-12 h-12 object-cover rounded-lg border border-gray-200 shadow-2xs">
                </td>
                <td class="p-4">
                    <div class="font-bold text-gray-900">${p.name}</div>
                    <div class="text-[10px] text-gray-400">ID: ${p.id}</div>
                </td>
                <td class="p-4 uppercase font-bold text-gray-600">${p.category}</td>
                <td class="p-4">
                    <span class="bg-pink-100 text-primary font-extrabold text-[10px] px-2 py-0.5 rounded-md">${lvlCode}</span>
                </td>
                <td class="p-4 font-bold text-primary text-sm">${p.salePrice || (p.priceNumber?.toLocaleString() + '₫')}</td>
                <td class="p-4 text-[11px] font-semibold text-gray-600">
                    Q10: <b class="text-gray-900">${stockQ10}</b> • Q1: <b class="text-gray-900">${stockQ1}</b> • TD: <b class="text-gray-900">${stockTD}</b>
                </td>
                <td class="p-4">${activeBadge}</td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center space-x-2">
                        <button onclick="editProduct('${p.id}')" title="Chỉnh sửa mẫu hoa" class="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition">
                            <i class="fa-solid fa-pen-to-square text-xs"></i>
                        </button>
                        <button onclick="toggleProduct('${p.id}', '${(p.name || '').replace(/'/g, "\\'")}', ${p.isActive !== false})" title="${p.isActive !== false ? 'Ẩn mẫu hoa' : 'Hiện mẫu hoa'}" class="w-7 h-7 rounded-lg ${p.isActive !== false ? 'bg-yellow-50 hover:bg-yellow-100 text-yellow-600' : 'bg-green-50 hover:bg-green-100 text-green-600'} flex items-center justify-center transition">
                            <i class="fa-solid ${p.isActive !== false ? 'fa-eye-slash' : 'fa-eye'} text-xs"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function onPriceLevelChange() {
    const lvlSelect = document.getElementById("prodPriceLevel");
    const hint = document.getElementById("priceRangeHint");
    if (!lvlSelect || !hint) return;

    const lvl = PRICE_LEVEL_CONFIG[lvlSelect.value];
    if (lvl) {
        hint.textContent = `Khung giá: ${lvl.min.toLocaleString()}₫ - ${lvl.max.toLocaleString()}₫`;
    }
    validateLivePrice();
}

function validateLivePrice() {
    const lvlSelect = document.getElementById("prodPriceLevel");
    const priceInput = document.getElementById("prodPriceNumber");
    const warn = document.getElementById("livePriceWarning");
    if (!lvlSelect || !priceInput || !warn) return true;

    const val = parseInt(priceInput.value, 10);
    const lvl = PRICE_LEVEL_CONFIG[lvlSelect.value];
    if (!lvl || isNaN(val)) {
        warn.classList.add("hidden");
        return true;
    }

    if (val < lvl.min) {
        warn.textContent = `⚠️ Giá bán (${val.toLocaleString()}₫) thấp hơn giá sàn (${lvl.min.toLocaleString()}₫)!`;
        warn.classList.remove("hidden");
        return false;
    } else if (val > lvl.max) {
        warn.textContent = `⚠️ Giá bán (${val.toLocaleString()}₫) vượt quá giá trần (${lvl.max.toLocaleString()}₫)!`;
        warn.classList.remove("hidden");
        return false;
    } else {
        warn.classList.add("hidden");
        return true;
    }
}

/**
 * Tự động nén và chuyển đổi tệp ảnh sang chuỗi Base64 (Data URI)
 */
function compressAndConvertToBase64(file, maxWidth = 800, maxHeight = 800, quality = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith("image/")) {
            return reject(new Error("Tệp được chọn không phải là hình ảnh"));
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Tính toán tỷ lệ co giãn ảnh
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                // Xuất ra Base64 Data URI
                const base64DataUri = canvas.toDataURL("image/jpeg", quality);
                resolve(base64DataUri);
            };
            img.onerror = () => reject(new Error("Lỗi tải hình ảnh để chuyển đổi Base64"));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("Lỗi đọc tệp từ thiết bị"));
        reader.readAsDataURL(file);
    });
}

let currentProductEditLang = "vi";
let editingProductI18n = {};

function switchProductLangTab(lang) {
    saveCurrentProdI18nDraft();
    currentProductEditLang = lang;

    const langs = ["vi", "en", "ja", "ko", "zh"];
    langs.forEach(l => {
        const tabBtn = document.getElementById(`prodLangTab_${l}`);
        if (tabBtn) {
            if (l === lang) {
                tabBtn.className = "px-3 py-1.5 rounded-lg font-bold bg-white text-primary shadow-2xs border border-pink-200 whitespace-nowrap cursor-pointer";
            } else {
                tabBtn.className = "px-3 py-1.5 rounded-lg font-medium text-gray-600 hover:text-primary hover:bg-white transition whitespace-nowrap cursor-pointer";
            }
        }
    });

    const viBox = document.getElementById("prodFields_vi");
    const i18nBox = document.getElementById("prodFields_i18n");

    if (lang === "vi") {
        if (viBox) viBox.classList.remove("hidden");
        if (i18nBox) i18nBox.classList.add("hidden");
    } else {
        if (viBox) viBox.classList.add("hidden");
        if (i18nBox) i18nBox.classList.remove("hidden");

        const langLabels = {
            en: { name: "English (🇬🇧)", short: "English" },
            ja: { name: "日本語 (🇯🇵)", short: "Tiếng Nhật" },
            ko: { name: "한국어 (🇰🇷)", short: "Tiếng Hàn" },
            zh: { name: "中文 (🇨🇳)", short: "Tiếng Trung" }
        };
        const langInfo = langLabels[lang] || { name: lang, short: lang };

        const nameLabel = document.getElementById("prodI18nLangName");
        if (nameLabel) nameLabel.textContent = langInfo.name;

        document.querySelectorAll(".prodCurrentLangLabel").forEach(el => {
            el.textContent = langInfo.short;
        });

        // Điền dữ liệu từ editingProductI18n[lang]
        const lData = editingProductI18n[lang] || {};
        const nameInp = document.getElementById("prodI18nName");
        const compInp = document.getElementById("prodI18nComposition");
        const descInp = document.getElementById("prodI18nDescription");
        const careInp = document.getElementById("prodI18nCareTips");

        if (nameInp) nameInp.value = lData.name || "";
        if (compInp) compInp.value = lData.flowerComposition || "";
        if (descInp) descInp.value = lData.description || "";
        if (careInp) careInp.value = lData.careTips || "";
    }
}

function saveCurrentProdI18nDraft() {
    if (currentProductEditLang === "vi") return;
    const l = currentProductEditLang;
    if (!editingProductI18n[l]) editingProductI18n[l] = {};

    const nameInp = document.getElementById("prodI18nName");
    const compInp = document.getElementById("prodI18nComposition");
    const descInp = document.getElementById("prodI18nDescription");
    const careInp = document.getElementById("prodI18nCareTips");

    if (nameInp) editingProductI18n[l].name = nameInp.value.trim();
    if (compInp) editingProductI18n[l].flowerComposition = compInp.value.trim();
    if (descInp) editingProductI18n[l].description = descInp.value.trim();
    if (careInp) editingProductI18n[l].careTips = careInp.value.trim();
}

/**
 * Xử lý khi người dùng chọn tải ảnh từ máy tính/điện thoại
 */
async function handleImageFileUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    const previewImg = document.getElementById("prodImagePreview");
    const inputStr = document.getElementById("prodImage");
    const statusLabel = document.getElementById("imageStatusLabel");
    const sizeInfo = document.getElementById("imageSizeInfo");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    if (statusLabel) {
        statusLabel.textContent = "⏳ Đang tải ảnh lên máy chủ...";
        statusLabel.className = "text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block";
    }

    try {
        // 1. Tải trực tiếp file ảnh lên API /admin/upload-image
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`${API_BASE}/admin/upload-image`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`
            },
            body: formData
        });

        const json = await res.json();
        if (res.ok && json.success && json.data?.url) {
            const uploadedUrl = json.data.url;
            if (inputStr) inputStr.value = uploadedUrl;
            if (previewImg) previewImg.src = uploadedUrl;

            if (statusLabel) {
                statusLabel.textContent = "🟢 Đã Lưu Vào Thư Mục Tĩnh";
                statusLabel.className = "text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md inline-block";
            }
            if (sizeInfo) {
                sizeInfo.textContent = `URL: ${uploadedUrl} (${(file.size / 1024).toFixed(1)} KB)`;
            }
            notifyUser(`Tải ảnh "${file.name}" lên thành công!`, "success");
        } else {
            // Fallback: Nén Base64 (phía backend sẽ tự động chuyển sang file vật lý khi submit)
            const base64String = await compressAndConvertToBase64(file, 800, 800, 0.82);
            if (inputStr) inputStr.value = base64String;
            if (previewImg) previewImg.src = base64String;
            if (statusLabel) {
                statusLabel.textContent = "🟡 Ảnh Base64 Tạm";
                statusLabel.className = "text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block";
            }
        }
    } catch (err) {
        // Fallback nén Base64
        try {
            const base64String = await compressAndConvertToBase64(file, 800, 800, 0.82);
            if (inputStr) inputStr.value = base64String;
            if (previewImg) previewImg.src = base64String;
            if (statusLabel) {
                statusLabel.textContent = "🟡 Ảnh Base64 Tạm";
                statusLabel.className = "text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block";
            }
        } catch (e2) {
            alert("Lỗi xử lý ảnh: " + err.message);
        }
    }
}

let editingProductGallery = [];

function renderEditingProductGallery() {
    const container = document.getElementById("prodGalleryThumbnailsContainer");
    const countBadge = document.getElementById("prodGalleryCountBadge");
    if (!container) return;

    if (countBadge) {
        countBadge.textContent = `${editingProductGallery.length} ảnh`;
    }

    if (!editingProductGallery || editingProductGallery.length === 0) {
        container.innerHTML = `<span class="text-xs text-gray-400 italic">Chưa có ảnh phụ nào trong bộ sưu tập.</span>`;
        return;
    }

    let html = "";
    editingProductGallery.forEach((imgUrl, idx) => {
        const isBase64 = imgUrl.startsWith("data:image");
        const typeBadge = isBase64 ? "B64" : "URL";
        html += `
            <div class="relative group w-20 h-20 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0 shadow-2xs">
                <img src="${imgUrl}" alt="Gallery ${idx + 1}" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=200'">
                <span class="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-mono px-1 rounded">#${idx + 1} ${typeBadge}</span>
                <button type="button" onclick="removeProductGalleryImage(${idx})" title="Xóa ảnh này" class="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] shadow transition cursor-pointer">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
}

function addProductGalleryImage(url) {
    const cleanUrl = (url || "").trim();
    if (!cleanUrl) return;
    editingProductGallery.push(cleanUrl);
    renderEditingProductGallery();
}

function addProductGalleryImageFromInput() {
    const inp = document.getElementById("prodGalleryNewInput");
    if (!inp) return;
    const url = inp.value.trim();
    if (!url) {
        alert("Vui lòng nhập đường dẫn URL ảnh!");
        return;
    }
    addProductGalleryImage(url);
    inp.value = "";
}

function removeProductGalleryImage(index) {
    if (index >= 0 && index < editingProductGallery.length) {
        editingProductGallery.splice(index, 1);
        renderEditingProductGallery();
    }
}

async function handleGalleryFileUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen(`Đang tải ảnh phụ lên máy chủ: ${file.name}...`);
    try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`${API_BASE}/admin/upload-image`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData
        });

        const json = await res.json();
        if (res.ok && json.success && json.data?.url) {
            addProductGalleryImage(json.data.url);
            notifyUser(`Đã thêm ảnh "${file.name}" vào Gallery!`, "success");
        } else {
            const base64String = await compressAndConvertToBase64(file, 800, 800, 0.82);
            addProductGalleryImage(base64String);
            notifyUser(`Đã thêm ảnh "${file.name}" vào Gallery!`, "success");
        }
    } catch (err) {
        try {
            const base64String = await compressAndConvertToBase64(file, 800, 800, 0.82);
            addProductGalleryImage(base64String);
            notifyUser(`Đã thêm ảnh "${file.name}" vào Gallery!`, "success");
        } catch (e2) {
            alert("Lỗi xử lý ảnh gallery: " + err.message);
        }
    } finally {
        unlockScreen();
        if (event.target) event.target.value = "";
    }
}


function openProductModal(isEdit = false) {
    const modal = document.getElementById("productModal");
    const title = document.getElementById("productModalTitle");
    const form = document.getElementById("productForm");
    const errBox = document.getElementById("productModalError");
    const previewImg = document.getElementById("prodImagePreview");
    const statusLabel = document.getElementById("imageStatusLabel");
    const sizeInfo = document.getElementById("imageSizeInfo");
    const fileInput = document.getElementById("prodImageFileInput");

    if (!modal) return;

    editingProductI18n = {};
    editingProductGallery = [];
    switchProductLangTab("vi");
    renderEditingProductGallery();

    if (errBox) errBox.classList.add("hidden");
    if (fileInput) fileInput.value = "";

    // Nạp danh sách Text ID vào các SelectBox của Mẫu Hoa
    populateProductTextIdDropdowns(allAdminTranslations);

    if (!isEdit && form) {
        form.reset();
        document.getElementById("editProductId").value = "";
        const defaultImg = "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500";
        document.getElementById("prodImage").value = defaultImg;
        if (previewImg) previewImg.src = defaultImg;
        if (statusLabel) {
            statusLabel.textContent = "Ảnh mặc định";
            statusLabel.className = "text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md inline-block";
        }
        if (sizeInfo) sizeInfo.textContent = "Upload file để chuyển sang Base64";
        if (title) title.textContent = "Thêm Mẫu Hoa Mới Vào Catalogue";

        // Reset các Text ID SelectBoxes
        ["name", "comp", "desc"].forEach(f => {
            const prefix = f === "name" ? "prodName" : (f === "comp" ? "prodComp" : "prodDesc");
            const sel = document.getElementById(`${prefix}TextId`);
            const customBox = document.getElementById(`${prefix}TextIdCustomContainer`);
            const customInp = document.getElementById(`${prefix}TextIdCustom`);
            if (sel) sel.value = "";
            if (customBox) customBox.classList.add("hidden");
            if (customInp) customInp.value = "";
        });
    }

    if (allAdminCategories && allAdminCategories.length > 0) {
        populateCategoryDropdowns(allAdminCategories);
    } else if (typeof window !== "undefined" && window.default_categories) {
        populateCategoryDropdowns(window.default_categories);
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");
    onPriceLevelChange();
}

function populateProductTextIdDropdowns(transDict) {
    const keys = Object.keys(transDict || {}).sort();
    
    const fillDropdown = (selectId, prefixFilter, defaultLabel) => {
        const select = document.getElementById(selectId);
        if (!select) return;

        const currentVal = select.value;
        const matchingKeys = keys.filter(k => k.startsWith(prefixFilter));
        const otherKeys = keys.filter(k => !k.startsWith(prefixFilter));

        let html = `<option value="">${defaultLabel}</option>`;
        
        if (matchingKeys.length > 0) {
            html += `<optgroup label="⭐ Khóa Đề Xuất (${prefixFilter}*)">`;
            matchingKeys.forEach(k => {
                const viText = (transDict[k]?.vi || "").slice(0, 30);
                html += `<option value="${k}">${k} — "${viText}"</option>`;
            });
            html += `</optgroup>`;
        }

        if (otherKeys.length > 0) {
            html += `<optgroup label="🔤 Toàn Bộ Text ID Khác">`;
            otherKeys.forEach(k => {
                const viText = (transDict[k]?.vi || "").slice(0, 30);
                html += `<option value="${k}">${k} — "${viText}"</option>`;
            });
            html += `</optgroup>`;
        }

        html += `<option value="__custom__">➕ Nhập mã Text ID tùy chỉnh khác...</option>`;
        select.innerHTML = html;
        if (currentVal) select.value = currentVal;
    };

    fillDropdown("prodNameTextId", "prod_name_", "-- Mặc định (Theo tên tiếng Việt) --");
    fillDropdown("prodCompTextId", "prod_comp_", "-- Mặc định (Theo text thành phần) --");
    fillDropdown("prodDescTextId", "prod_desc_", "-- Mặc định (Theo text mô tả) --");
}

function onProductTextIdChange(field) {
    const prefix = field === "name" ? "prodName" : (field === "comp" ? "prodComp" : "prodDesc");
    const select = document.getElementById(`${prefix}TextId`);
    const container = document.getElementById(`${prefix}TextIdCustomContainer`);
    const customInput = document.getElementById(`${prefix}TextIdCustom`);
    if (!select || !container) return;

    if (select.value === "__custom__") {
        container.classList.remove("hidden");
        if (customInput) customInput.focus();
    } else {
        container.classList.add("hidden");
        if (customInput) customInput.value = "";
    }
}

function closeProductModal() {
    const modal = document.getElementById("productModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

async function editProduct(productId) {
    let prod = allAdminProducts.find((p) => p.id === productId);
    if (!prod) return;

    openProductModal(true);
    const title = document.getElementById("productModalTitle");
    if (title) title.textContent = `Đang tải chi tiết: ${prod.name}...`;

    // Tải chi tiết đầy đủ từ API /api/products/<productId> (Lazy load)
    try {
        const res = await fetch(`${API_BASE}/products/${productId}`);
        if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
                prod = json.data;
            }
        }
    } catch (e) {
        console.warn("Dùng dữ liệu tóm tắt cục bộ do không thể tải chi tiết:", e);
    }

    document.getElementById("editProductId").value = prod.id;
    document.getElementById("prodName").value = prod.name || "";
    document.getElementById("prodCategory").value = prod.category || "bo_hoa";
    document.getElementById("prodPriceLevel").value = prod.priceLevelId || "price_lvl_01";
    document.getElementById("prodPriceNumber").value = prod.priceNumber || 420000;
    
    // Gán dữ liệu Text ID vào 3 SelectBox của Mẫu Hoa
    const setFieldTextId = (selectId, containerId, customId, targetKey) => {
        const select = document.getElementById(selectId);
        const container = document.getElementById(containerId);
        const customInput = document.getElementById(customId);
        if (!select) return;

        if (!targetKey) {
            select.value = "";
            if (container) container.classList.add("hidden");
            if (customInput) customInput.value = "";
            return;
        }

        const exists = Array.from(select.options).some(opt => opt.value === targetKey);
        if (exists) {
            select.value = targetKey;
            if (container) container.classList.add("hidden");
            if (customInput) customInput.value = "";
        } else {
            select.value = "__custom__";
            if (container) container.classList.remove("hidden");
            if (customInput) customInput.value = targetKey;
        }
    };

    setFieldTextId("prodNameTextId", "prodNameTextIdCustomContainer", "prodNameTextIdCustom", prod.nameTextId || prod.textId || "");
    setFieldTextId("prodCompTextId", "prodCompTextIdCustomContainer", "prodCompTextIdCustom", prod.compTextId || prod.compositionTextId || "");
    setFieldTextId("prodDescTextId", "prodDescTextIdCustomContainer", "prodDescTextIdCustom", prod.descTextId || prod.descriptionTextId || "");

    const prodImg = prod.image || "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500";
    document.getElementById("prodImage").value = prodImg;

    const previewImg = document.getElementById("prodImagePreview");
    const statusLabel = document.getElementById("imageStatusLabel");
    const sizeInfo = document.getElementById("imageSizeInfo");
    if (previewImg) previewImg.src = prodImg;
    if (statusLabel) {
        const isBase64 = prodImg.startsWith("data:image");
        statusLabel.textContent = isBase64 ? "🟢 Ảnh Base64" : "🌐 Link Ảnh Web";
        statusLabel.className = `text-[10px] font-bold ${isBase64 ? 'text-purple-600 bg-purple-50' : 'text-blue-600 bg-blue-50'} px-2 py-0.5 rounded-md inline-block`;
    }
    if (sizeInfo) {
        sizeInfo.textContent = prodImg.startsWith("data:image") ? `Base64 (${(prodImg.length / 1024).toFixed(1)} KB)` : "Đường dẫn URL trực tiếp";
    }

    // Load gallery
    editingProductGallery = Array.isArray(prod.gallery) ? [...prod.gallery] : [];
    renderEditingProductGallery();

    document.getElementById("prodFlowerComposition").value = prod.flowerComposition || "";
    document.getElementById("prodBadge").value = prod.badge || "";
    document.getElementById("prodDimension").value = prod.dimension || "";
    document.getElementById("prodDescription").value = prod.description || "";
    document.getElementById("prodCareTips").value = prod.careTips || "";

    document.getElementById("prodStockQ10").value = prod.stockByBranch?.branch_q10 ?? 10;
    document.getElementById("prodStockQ1").value = prod.stockByBranch?.branch_q1 ?? 5;
    document.getElementById("prodStockTD").value = prod.stockByBranch?.branch_thao_dien ?? 5;

    if (title) title.textContent = `Chỉnh Sửa Mẫu Hoa: ${prod.name}`;
    editingProductI18n = JSON.parse(JSON.stringify(prod.i18n || {}));
    switchProductLangTab("vi");
}

async function handleProductSubmit(event) {
    if (event) event.preventDefault();

    if (!validateLivePrice()) {
        alert("Giá bán không hợp lệ theo khung phân tầng! Vui lòng điều chỉnh lại.");
        return;
    }

    saveCurrentProdI18nDraft();

    const editId = document.getElementById("editProductId").value;
    const name = document.getElementById("prodName").value.trim();
    const category = document.getElementById("prodCategory").value;
    const priceLevelId = document.getElementById("prodPriceLevel").value;
    const priceNumber = parseInt(document.getElementById("prodPriceNumber").value, 10);
    const image = document.getElementById("prodImage").value.trim();
    const badge = document.getElementById("prodBadge") ? document.getElementById("prodBadge").value.trim() : "";
    const flowerComposition = document.getElementById("prodFlowerComposition") ? document.getElementById("prodFlowerComposition").value.trim() : "";
    const dimension = document.getElementById("prodDimension") ? document.getElementById("prodDimension").value.trim() : "";
    const description = document.getElementById("prodDescription") ? document.getElementById("prodDescription").value.trim() : "";
    const careTips = document.getElementById("prodCareTips") ? document.getElementById("prodCareTips").value.trim() : "";

    const getFinalProductTextId = (selectId, customId) => {
        const sel = document.getElementById(selectId);
        if (!sel) return undefined;
        if (sel.value === "__custom__") {
            const customVal = (document.getElementById(customId)?.value || "").trim().toLowerCase().replace(/\s+/g, "_");
            return customVal || undefined;
        }
        return sel.value ? sel.value.trim() : undefined;
    };

    const nameTextId = getFinalProductTextId("prodNameTextId", "prodNameTextIdCustom");
    const compTextId = getFinalProductTextId("prodCompTextId", "prodCompTextIdCustom");
    const descTextId = getFinalProductTextId("prodDescTextId", "prodDescTextIdCustom");

    const stockQ10 = parseInt(document.getElementById("prodStockQ10").value, 10) || 0;
    const stockQ1 = parseInt(document.getElementById("prodStockQ1").value, 10) || 0;
    const stockTD = parseInt(document.getElementById("prodStockTD").value, 10) || 0;

    const payload = {
        name,
        nameTextId,
        category,
        priceLevelId,
        priceNumber,
        image,
        gallery: editingProductGallery,
        badge,
        flowerComposition,
        compTextId,
        dimension,
        description,
        descTextId,
        careTips,
        i18n: editingProductI18n,
        stockByBranch: {
            branch_q10: stockQ10,
            branch_q1: stockQ1,
            branch_thao_dien: stockTD
        }
    };

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const method = editId ? "PUT" : "POST";
    const url = editId ? `${API_BASE}/admin/products/${editId}` : `${API_BASE}/admin/products`;

    const errBox = document.getElementById("productModalError");

    lockScreen(editId ? `Đang lưu cấu hình mẫu hoa "${name}"...` : `Đang tạo mẫu hoa mới "${name}"...`);
    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (res.ok && json.success) {
            closeProductModal();
            await loadAdminProducts();
            if (typeof window !== 'undefined' && typeof window.renderAllProducts === 'function') {
                window.renderAllProducts();
            }
            notifyUser(editId ? `Đã cập nhật mẫu hoa "${name}" thành công!` : `Đã thêm mẫu hoa mới "${name}" thành công!`, 'success');
        } else {
            const msg = json.message || "Lỗi lưu sản phẩm";
            if (errBox) {
                errBox.textContent = "❌ " + msg;
                errBox.classList.remove("hidden");
            }
            notifyUser(`Không thể lưu sản phẩm: ${msg}`, 'error');
        }
    } catch (e) {
        if (errBox) {
            errBox.textContent = "❌ Lỗi kết nối máy chủ: " + e.message;
            errBox.classList.remove("hidden");
        }
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

async function toggleProduct(productId, productName, currentActive) {
    const targetProd = (allAdminProducts || []).find(p => p.id === productId);
    const displayName = productName || (targetProd ? targetProd.name : productId);
    const isCurrentlyActive = currentActive !== undefined ? currentActive : (targetProd ? targetProd.isActive !== false : true);
    const actionText = isCurrentlyActive ? "Ẩn đi" : "Bật hiển thị";
    const detailText = isCurrentlyActive 
        ? `Khi ẩn, mẫu hoa "${displayName}" sẽ tạm thời không hiển thị trên website khách hàng.`
        : `Khi bật, mẫu hoa "${displayName}" sẽ được mở bán và hiển thị công khai trên website.`;

    const isConfirmed = await (typeof showConfirmDialog === 'function' ? showConfirmDialog : window.showConfirmDialog)({
        title: isCurrentlyActive ? "Xác nhận Ẩn Mẫu Hoa" : "Xác nhận Mở Bán Mẫu Hoa",
        message: `Bạn có chắc chắn muốn ${actionText.toLowerCase()} mẫu hoa "${displayName}" không?`,
        detail: detailText,
        confirmText: isCurrentlyActive ? "Ẩn mẫu hoa" : "Bật mở bán",
        cancelText: "Hủy bỏ",
        type: isCurrentlyActive ? "warning" : "success",
        icon: isCurrentlyActive ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"
    });
    if (!isConfirmed) return;

    lockScreen(`Đang ${actionText.toLowerCase()} mẫu hoa "${displayName}"...`);
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/products/${productId}/toggle`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (res.ok && json.success) {
            await loadAdminProducts();
            if (typeof window !== 'undefined' && typeof window.renderAllProducts === 'function') {
                window.renderAllProducts();
            }
            notifyUser(`Đã ${actionText.toLowerCase()} mẫu hoa "${displayName}" thành công!`, 'success');
        } else {
            notifyUser("Lỗi đổi trạng thái: " + (json.message || "Không thể đổi trạng thái"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

// ==========================================
// QUẢN LÝ KHUYẾN MÃI & VOUCHER (PROMOTIONS - Timestamps & Soft Delete)
// ==========================================

async function loadAdminPromotions() {
    const tbody = document.getElementById("promotionsTableBody");
    if (!tbody) return;

    if (!allAdminPromotions || allAdminPromotions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-gray-400 font-medium"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải dữ liệu voucher...</td></tr>`;
    }

    try {
        const res = await fetch(`${API_BASE}/promotions`);
        const json = await res.json();
        if (json.success && json.data) {
            allAdminPromotions = json.data;
            renderPromotionsTable(allAdminPromotions);
        } else if (!allAdminPromotions || allAdminPromotions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-red-500 font-bold">${json.message || "Không thể tải danh sách khuyến mãi"}</td></tr>`;
        }
    } catch (e) {
        if (!allAdminPromotions || allAdminPromotions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
        }
    }
}

function renderPromotionsTable(promotions) {
    const tbody = document.getElementById("promotionsTableBody");
    if (!tbody) return;

    if (!Array.isArray(promotions) || promotions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="p-12 text-center">
                    <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                        <div class="w-16 h-16 rounded-full bg-purple-50 text-purple-400 flex items-center justify-center text-2xl mb-3 shadow-inner">
                            <i class="fa-solid fa-ticket-simple"></i>
                        </div>
                        <p class="font-bold text-gray-700 text-sm">Chưa có voucher khuyến mãi nào</p>
                        <p class="text-xs text-gray-400 mt-1">Bấm nút "Thêm Voucher Mới" để phát hành mã giảm giá cho khách hàng.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = "";
    promotions.forEach((p) => {
        const isDeleted = p.status === "deleted" || p.isDeleted === true;
        const isActive = !isDeleted && p.isActive !== false;

        let statusBadge = "";
        if (isDeleted) {
            statusBadge = `<span class="bg-red-100 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-200">🔴 Đã Xóa Mềm</span>`;
        } else if (isActive) {
            statusBadge = `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-200">🟢 Đang Áp Dụng</span>`;
        } else {
            statusBadge = `<span class="bg-gray-100 text-gray-500 text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-200">⚪ Tạm Dừng</span>`;
        }

        const discountStr = p.discountType === "percentage" 
            ? `<span class="font-extrabold text-primary text-sm">${p.discountValue}%</span>`
            : `<span class="font-extrabold text-primary text-sm">${(p.discountValue || 0).toLocaleString()}₫</span>`;

        const minOrder = (p.minOrderAmount || 0).toLocaleString() + "₫";
        const maxDiscount = (p.maxDiscountAmount || 0).toLocaleString() + "₫";

        const start = p.startDate ? p.startDate.split("T")[0] : "—";
        const end = p.endDate ? p.endDate.split("T")[0] : "—";

        const createdDate = p.createdAt ? p.createdAt.replace("T", " ").replace("Z", "") : "—";
        const updatedDate = p.updatedAt ? p.updatedAt.replace("T", " ").replace("Z", "") : createdDate;
        const deletedDate = p.deletedAt ? p.deletedAt.replace("T", " ").replace("Z", "") : null;

        const rowBg = isDeleted ? "bg-red-50/20 opacity-75" : "hover:bg-pink-50/20";

        html += `
            <tr class="${rowBg} transition border-b border-gray-100">
                <td class="p-3">
                    <div class="flex items-center space-x-2">
                        <span class="bg-pink-100 text-primary font-mono font-extrabold text-xs px-2.5 py-1 rounded-lg border border-pink-200 ${isDeleted ? 'line-through text-gray-400' : ''}">${p.code}</span>
                    </div>
                    <div class="font-bold text-gray-800 text-xs mt-1 ${isDeleted ? 'line-through text-gray-400' : ''}">${p.title}</div>
                    ${p.topBarMessage ? `<div class="text-[10px] text-amber-600 truncate max-w-[200px]" title="${p.topBarMessage}">📢 ${p.topBarMessage}</div>` : ''}
                </td>
                <td class="p-3">${discountStr}</td>
                <td class="p-3 text-[11px] text-gray-600">
                    <div>Đơn tối thiểu: <b>${minOrder}</b></div>
                    <div>Giảm tối đa: <b>${maxDiscount}</b></div>
                </td>
                <td class="p-3 text-[11px]">
                    <span class="font-bold text-gray-800">${p.usedCount || 0}</span> / <span class="text-gray-500">${p.usageLimit || 500}</span>
                </td>
                <td class="p-3 text-[11px] text-gray-500 font-mono">
                    <div>${start}</div>
                    <div>➔ ${end}</div>
                </td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3 text-[10px] text-gray-500 font-mono leading-tight">
                    <div><span class="text-gray-400">Tạo:</span> ${createdDate}</div>
                    <div><span class="text-gray-400">Sửa:</span> ${updatedDate}</div>
                    ${deletedDate ? `<div class="text-red-500 font-bold"><span>Xóa:</span> ${deletedDate}</div>` : ''}
                </td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center space-x-1.5">
                        ${!isDeleted ? `
                            <button onclick="editPromo('${p.id}')" title="Chỉnh sửa voucher" class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="togglePromo('${p.id}')" title="${isActive ? 'Tạm dừng voucher' : 'Kích hoạt voucher'}" class="px-2.5 py-1 ${isActive ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' : 'bg-green-50 hover:bg-green-100 text-green-700'} rounded-lg text-xs font-bold transition">
                                <i class="fa-solid ${isActive ? 'fa-pause' : 'fa-play'} mr-1"></i> ${isActive ? 'Dừng' : 'Bật'}
                            </button>
                            <button onclick="deletePromo('${p.id}', '${p.code}')" title="Xóa mềm voucher (vẫn lưu trong json)" class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        ` : `
                            <button onclick="restorePromo('${p.id}', '${p.code}')" title="Khôi phục voucher đã xóa mềm" class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center">
                                <i class="fa-solid fa-rotate-left mr-1"></i> Khôi Phục
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function openPromoModal(isEdit = false) {
    const modal = document.getElementById("promoModal");
    const title = document.getElementById("promoModalTitle");
    const err = document.getElementById("promoModalError");
    if (!modal) return;

    if (err) {
        err.textContent = "";
        err.classList.add("hidden");
    }

    if (!isEdit) {
        title.textContent = "Thêm Voucher Khuyến Mãi Mới";
        document.getElementById("editPromoId").value = "";
        document.getElementById("promoCode").value = "";
        document.getElementById("promoCode").disabled = false;
        document.getElementById("promoTitle").value = "";
        document.getElementById("promoDiscountType").value = "percentage";
        document.getElementById("promoDiscountValue").value = "15";
        document.getElementById("promoMinOrder").value = "300000";
        document.getElementById("promoMaxDiscount").value = "150000";
        document.getElementById("promoStartDate").value = "2026-01-01";
        document.getElementById("promoEndDate").value = "2026-12-31";
        document.getElementById("promoUsageLimit").value = "500";
        document.getElementById("promoTopBarMessage").value = "";
        document.getElementById("promoIsActive").checked = true;
    } else {
        title.textContent = "Chỉnh Sửa Voucher Khuyến Mãi";
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

function closePromoModal() {
    const modal = document.getElementById("promoModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

function editPromo(promoId) {
    const promo = (allAdminPromotions || []).find((p) => p.id === promoId);
    if (!promo) return alert("Không tìm thấy dữ liệu voucher");

    openPromoModal(true);

    document.getElementById("editPromoId").value = promo.id;
    document.getElementById("promoCode").value = promo.code || "";
    document.getElementById("promoCode").disabled = true; // Không cho sửa code chính
    document.getElementById("promoTitle").value = promo.title || "";
    document.getElementById("promoDiscountType").value = promo.discountType || "percentage";
    document.getElementById("promoDiscountValue").value = promo.discountValue || 10;
    document.getElementById("promoMinOrder").value = promo.minOrderAmount || 0;
    document.getElementById("promoMaxDiscount").value = promo.maxDiscountAmount || 100000;
    document.getElementById("promoStartDate").value = promo.startDate ? promo.startDate.split("T")[0] : "2026-01-01";
    document.getElementById("promoEndDate").value = promo.endDate ? promo.endDate.split("T")[0] : "2026-12-31";
    document.getElementById("promoUsageLimit").value = promo.usageLimit || 500;
    document.getElementById("promoTopBarMessage").value = promo.topBarMessage || "";
    document.getElementById("promoIsActive").checked = promo.isActive !== false;
}

async function handlePromoSubmit(event) {
    event.preventDefault();
    const btn = document.getElementById("btnSavePromo");
    const err = document.getElementById("promoModalError");
    const editId = document.getElementById("editPromoId").value.trim();
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    const payload = {
        code: document.getElementById("promoCode").value.trim().toUpperCase(),
        title: document.getElementById("promoTitle").value.trim(),
        discountType: document.getElementById("promoDiscountType").value,
        discountValue: parseInt(document.getElementById("promoDiscountValue").value, 10) || 10,
        minOrderAmount: parseInt(document.getElementById("promoMinOrder").value, 10) || 0,
        maxDiscountAmount: parseInt(document.getElementById("promoMaxDiscount").value, 10) || 100000,
        startDate: (document.getElementById("promoStartDate").value || "2026-01-01") + "T00:00:00Z",
        endDate: (document.getElementById("promoEndDate").value || "2026-12-31") + "T23:59:59Z",
        usageLimit: parseInt(document.getElementById("promoUsageLimit").value, 10) || 500,
        topBarMessage: document.getElementById("promoTopBarMessage").value.trim(),
        isActive: document.getElementById("promoIsActive").checked
    };

    if (btn) btn.disabled = true;
    lockScreen(editId ? "Đang cập nhật voucher..." : "Đang tạo voucher mới...");
    try {
        const url = editId ? `${API_BASE}/admin/promotions/${editId}` : `${API_BASE}/admin/promotions`;
        const method = editId ? "PUT" : "POST";

        const res = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (json.success) {
            closePromoModal();
            await loadAdminPromotions();
            notifyUser(editId ? "Đã cập nhật voucher thành công!" : "Đã tạo voucher mới thành công!", 'success');
        } else {
            const msg = json.message || "Lỗi lưu voucher";
            if (err) {
                err.textContent = "❌ " + msg;
                err.classList.remove("hidden");
            }
            notifyUser(`Lỗi lưu voucher: ${msg}`, 'error');
        }
    } catch (e) {
        if (err) {
            err.textContent = "❌ Lỗi kết nối: " + e.message;
            err.classList.remove("hidden");
        }
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
        unlockScreen();
    }
}

async function togglePromo(promoId) {
    lockScreen("Đang cập nhật trạng thái...");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/promotions/${promoId}/toggle`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminPromotions();
            notifyUser("Đã cập nhật trạng thái voucher khuyến mãi thành công!", 'success');
        } else {
            notifyUser("Lỗi: " + (json.message || "Lỗi cập nhật trạng thái voucher"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

async function deletePromo(promoId, promoCode) {
    const isConfirmed = await (typeof showConfirmDialog === 'function' ? showConfirmDialog : window.showConfirmDialog)({
        title: "Xác nhận Xóa Voucher",
        message: `Bạn có chắc chắn muốn xóa voucher khuyến mãi "${promoCode}" không?`,
        detail: "Dữ liệu voucher sẽ được chuyển sang trạng thái 'Đã xóa mềm' (Soft Deleted) và lưu trong hệ thống.",
        confirmText: "Xóa voucher",
        cancelText: "Hủy bỏ",
        type: "danger",
        icon: "fa-solid fa-trash"
    });
    if (!isConfirmed) return;

    lockScreen("Đang xóa voucher...");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/promotions/${promoId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminPromotions();
            notifyUser("Đã chuyển voucher sang trạng thái Đã Xóa thành công!", 'success');
        } else {
            notifyUser("Không thể xóa voucher: " + (json.message || ""), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

async function restorePromo(promoId, promoCode) {
    lockScreen("Đang khôi phục voucher...");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/promotions/${promoId}/restore`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminPromotions();
            notifyUser(`Đã khôi phục voucher "${promoCode || promoId}" thành công!`, 'success');
        } else {
            notifyUser(json.message || "Lỗi khôi phục voucher", 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

// ==========================================
// QUẢN LÝ SẢN PHẨM KÈM THEO (ADD-ONS CMS)
// ==========================================
async function loadAdminAddons() {
    const tbody = document.getElementById("addonsTableBody");
    if (!tbody) return;

    if (!allAdminAddons || allAdminAddons.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-400 font-medium"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải dữ liệu sản phẩm kèm theo...</td></tr>`;
    }

    try {
        const token = typeof getAuthToken === "function" ? getAuthToken() : "";
        const res = await fetch(`${API_BASE}/admin/addons`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success && json.data) {
            allAdminAddons = json.data;
            renderAddonsTable(allAdminAddons);
        } else if (!allAdminAddons || allAdminAddons.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-red-500 font-bold">${json.message || "Không thể tải danh sách sản phẩm kèm theo"}</td></tr>`;
        }
    } catch (e) {
        if (!allAdminAddons || allAdminAddons.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
        }
    }
}

function renderAddonsTable(addons) {
    const tbody = document.getElementById("addonsTableBody");
    if (!tbody) return;

    if (!Array.isArray(addons) || addons.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-12 text-center">
                    <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                        <div class="w-16 h-16 rounded-full bg-pink-50 text-pink-400 flex items-center justify-center text-2xl mb-3 shadow-inner">
                            <i class="fa-solid fa-gift"></i>
                        </div>
                        <p class="font-bold text-gray-700 text-sm">Chưa có sản phẩm kèm theo nào</p>
                        <p class="text-xs text-gray-400 mt-1">Bấm nút "Thêm Sản Phẩm Kèm Theo" để tạo add-on cho khách hàng.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = "";
    addons.forEach((a) => {
        const isDeleted = a.status === "deleted" || a.isDeleted === true;
        const isActive = !isDeleted && a.isActive !== false;

        let statusBadge = "";
        if (isDeleted) {
            statusBadge = `<span class="bg-red-100 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-200">🔴 Đã Xóa Mềm</span>`;
        } else if (isActive) {
            statusBadge = `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-200">🟢 Đang Hiển Thị</span>`;
        } else {
            statusBadge = `<span class="bg-gray-100 text-gray-500 text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-200">⚪ Đã Ẩn</span>`;
        }

        const priceStr = (a.price || 0).toLocaleString("vi-VN") + "₫";
        const createdDate = a.createdAt ? a.createdAt.replace("T", " ").replace("Z", "") : "—";
        const rowBg = isDeleted ? "bg-red-50/20 opacity-75" : "hover:bg-pink-50/20";

        html += `
            <tr class="${rowBg} transition border-b border-gray-100">
                <td class="p-3">
                    <div class="flex items-center space-x-2.5">
                        <img src="${a.image || ''}" alt="${a.name || ''}" onerror="this.style.display='none'" class="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0">
                        <div>
                            <div class="font-bold text-gray-800 text-xs ${isDeleted ? 'line-through text-gray-400' : ''}">${a.nameVi || a.name || ''}</div>
                            <div class="text-[10px] text-gray-400 font-mono">${a.id}</div>
                        </div>
                    </div>
                </td>
                <td class="p-3 text-[11px] text-gray-600 capitalize">${a.category || '—'}</td>
                <td class="p-3 font-extrabold text-primary text-sm">${priceStr}</td>
                <td class="p-3 text-[11px] text-gray-600">${a.sortOrder || 0}</td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3 text-[10px] text-gray-500 font-mono">${createdDate}</td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center space-x-1.5">
                        ${!isDeleted ? `
                            <button onclick="editAddon('${a.id}')" title="Chỉnh sửa add-on" class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="toggleAddon('${a.id}')" title="${isActive ? 'Ẩn add-on' : 'Hiển thị add-on'}" class="px-2.5 py-1 ${isActive ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' : 'bg-green-50 hover:bg-green-100 text-green-700'} rounded-lg text-xs font-bold transition">
                                <i class="fa-solid ${isActive ? 'fa-eye-slash' : 'fa-eye'} mr-1"></i> ${isActive ? 'Ẩn' : 'Hiện'}
                            </button>
                            <button onclick="deleteAddon('${a.id}', '${(a.nameVi || a.name || '').replace(/'/g, "\\'")}')" title="Xóa mềm add-on" class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        ` : `
                            <button onclick="restoreAddon('${a.id}')" title="Khôi phục add-on đã xóa mềm" class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center">
                                <i class="fa-solid fa-rotate-left mr-1"></i> Khôi Phục
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function openAddonModal(isEdit = false) {
    const modal = document.getElementById("addonModal");
    const title = document.getElementById("addonModalTitle");
    const err = document.getElementById("addonModalError");
    if (!modal) return;

    if (err) {
        err.textContent = "";
        err.classList.add("hidden");
    }

    if (!isEdit) {
        title.textContent = "Thêm Sản Phẩm Kèm Theo Mới";
        document.getElementById("editAddonId").value = "";
        document.getElementById("addonName").value = "";
        document.getElementById("addonNameVi").value = "";
        document.getElementById("addonCategory").value = "gift";
        document.getElementById("addonPrice").value = "";
        document.getElementById("addonImage").value = "";
        document.getElementById("addonDescription").value = "";
        document.getElementById("addonSortOrder").value = "1";
        document.getElementById("addonIsActive").checked = true;
        const prevNew = document.getElementById("addonImagePreview");
        if (prevNew) prevNew.src = "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=200";
        const statusNew = document.getElementById("addonImageStatusLabel");
        if (statusNew) {
            statusNew.textContent = "URL Web";
            statusNew.className = "text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md";
        }
        const sizeNew = document.getElementById("addonImageSizeInfo");
        if (sizeNew) sizeNew.textContent = "";
    } else {
        title.textContent = "Chỉnh Sửa Sản Phẩm Kèm Theo";
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

function closeAddonModal() {
    const modal = document.getElementById("addonModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

function editAddon(addonId) {
    const addon = (allAdminAddons || []).find((a) => a.id === addonId);
    if (!addon) return alert("Không tìm thấy dữ liệu add-on");

    openAddonModal(true);

    document.getElementById("editAddonId").value = addon.id;
    document.getElementById("addonName").value = addon.name || "";
    document.getElementById("addonNameVi").value = addon.nameVi || "";
    document.getElementById("addonCategory").value = addon.category || "gift";
    document.getElementById("addonPrice").value = addon.price || "";
    document.getElementById("addonImage").value = addon.image || "";
    document.getElementById("addonDescription").value = addon.description || "";
    document.getElementById("addonSortOrder").value = addon.sortOrder || 1;
    document.getElementById("addonIsActive").checked = addon.isActive !== false;
    const prevEdit = document.getElementById("addonImagePreview");
    if (prevEdit) prevEdit.src = addon.image || "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=200";
    const statusEdit = document.getElementById("addonImageStatusLabel");
    if (statusEdit) {
        statusEdit.textContent = addon.image ? "URL Web" : "Chưa có ảnh";
        statusEdit.className = "text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md";
    }
    const sizeEdit = document.getElementById("addonImageSizeInfo");
    if (sizeEdit) sizeEdit.textContent = "";
}

async function handleAddonSubmit(event) {
    event.preventDefault();
    const btn = document.getElementById("btnSaveAddon");
    const err = document.getElementById("addonModalError");
    const editId = document.getElementById("editAddonId").value.trim();
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    const payload = {
        name: document.getElementById("addonName").value.trim(),
        nameVi: document.getElementById("addonNameVi").value.trim(),
        category: document.getElementById("addonCategory").value,
        price: parseInt(document.getElementById("addonPrice").value, 10) || 0,
        image: document.getElementById("addonImage").value.trim(),
        description: document.getElementById("addonDescription").value.trim(),
        sortOrder: parseInt(document.getElementById("addonSortOrder").value, 10) || 1,
        isActive: document.getElementById("addonIsActive").checked
    };

    if (btn) btn.disabled = true;
    lockScreen(editId ? "Đang cập nhật add-on..." : "Đang tạo add-on mới...");
    try {
        const url = editId ? `${API_BASE}/admin/addons/${editId}` : `${API_BASE}/admin/addons`;
        const method = editId ? "PUT" : "POST";

        const res = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (json.success) {
            closeAddonModal();
            await loadAdminAddons();
            notifyUser(editId ? "Đã cập nhật add-on thành công!" : "Đã tạo add-on mới thành công!", 'success');
        } else {
            const msg = json.message || "Lỗi lưu add-on";
            if (err) {
                err.textContent = "❌ " + msg;
                err.classList.remove("hidden");
            }
            notifyUser(`Lỗi lưu add-on: ${msg}`, 'error');
        }
    } catch (e) {
        if (err) {
            err.textContent = "❌ Lỗi kết nối: " + e.message;
            err.classList.remove("hidden");
        }
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
        unlockScreen();
    }
}

/**
 * Tải ảnh Add-On lên máy chủ (lưu vào thư mục ảnh giống sản phẩm hoa).
 * Dự phòng: nén Base64 khi không gọi được API upload.
 */
async function handleAddonImageFileUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    const previewImg = document.getElementById("addonImagePreview");
    const inputStr = document.getElementById("addonImage");
    const statusLabel = document.getElementById("addonImageStatusLabel");
    const sizeInfo = document.getElementById("addonImageSizeInfo");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    if (statusLabel) {
        statusLabel.textContent = "⏳ Đang tải ảnh lên máy chủ...";
        statusLabel.className = "text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block";
    }

    try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("prefix", "addon");

        const res = await fetch(`${API_BASE}/admin/upload-image`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData
        });

        const json = await res.json();
        if (res.ok && json.success && json.data?.url) {
            const uploadedUrl = json.data.url;
            if (inputStr) inputStr.value = uploadedUrl;
            if (previewImg) previewImg.src = uploadedUrl;
            if (statusLabel) {
                statusLabel.textContent = "🟢 Đã Lưu Vào Thư Mục Tĩnh";
                statusLabel.className = "text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md inline-block";
            }
            if (sizeInfo) sizeInfo.textContent = `URL: ${uploadedUrl} (${(file.size / 1024).toFixed(1)} KB)`;
            notifyUser(`Tải ảnh "${file.name}" lên thành công!`, "success");
        } else {
            const base64String = await compressAndConvertToBase64(file, 800, 800, 0.82);
            if (inputStr) inputStr.value = base64String;
            if (previewImg) previewImg.src = base64String;
            if (statusLabel) {
                statusLabel.textContent = "🟡 Ảnh Base64 Tạm";
                statusLabel.className = "text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block";
            }
        }
    } catch (err) {
        try {
            const base64String = await compressAndConvertToBase64(file, 800, 800, 0.82);
            if (inputStr) inputStr.value = base64String;
            if (previewImg) previewImg.src = base64String;
            if (statusLabel) {
                statusLabel.textContent = "🟡 Ảnh Base64 Tạm";
                statusLabel.className = "text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block";
            }
        } catch (e2) {
            alert("Lỗi xử lý ảnh: " + err.message);
        }
    }
}

async function toggleAddon(addonId) {
    lockScreen("Đang cập nhật trạng thái...");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/addons/${addonId}/toggle`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminAddons();
            notifyUser("Đã cập nhật trạng thái hiển thị add-on thành công!", 'success');
        } else {
            notifyUser("Lỗi: " + (json.message || "Lỗi cập nhật trạng thái add-on"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

async function deleteAddon(addonId, addonName) {
    const isConfirmed = await (typeof showConfirmDialog === 'function' ? showConfirmDialog : window.showConfirmDialog)({
        title: "Xác nhận Xóa Add-On",
        message: `Bạn có chắc chắn muốn xóa sản phẩm kèm theo "${addonName}" không?`,
        detail: "Dữ liệu add-on sẽ được chuyển sang trạng thái 'Đã xóa mềm' (Soft Deleted) và lưu trong hệ thống.",
        confirmText: "Xóa add-on",
        cancelText: "Hủy bỏ",
        type: "danger",
        icon: "fa-solid fa-trash"
    });
    if (!isConfirmed) return;

    lockScreen("Đang xóa add-on...");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/addons/${addonId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminAddons();
            notifyUser("Đã chuyển add-on sang trạng thái Đã Xóa thành công!", 'success');
        } else {
            notifyUser("Không thể xóa add-on: " + (json.message || ""), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

async function restoreAddon(addonId) {
    lockScreen("Đang khôi phục add-on...");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/addons/${addonId}/restore`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminAddons();
            notifyUser(`Đã khôi phục add-on thành công!`, 'success');
        } else {
            notifyUser(json.message || "Lỗi khôi phục add-on", 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

// ==========================================
// BIÊN DỊCH ĐA NGÔN NGỮ ĐỘNG (Single Key Selector & Matrix View)
// ==========================================

let currentSelectedTransKey = "";
let currentFilteredTransKeys = [];

async function loadAdminTranslations() {
    const badge = document.getElementById("transStatusBadge");
    if (badge) {
        badge.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1 text-[8px]"></i> Đang tải từ điển...`;
        badge.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200";
    }

    try {
        const res = await fetch(`${API_BASE}/translations?_t=${Date.now()}`);
        const json = await res.json();
        if (json.success && json.data) {
            allAdminTranslations = json.data.translations || {};
            
            // Khởi tạo danh sách dropdown và bảng
            populateTranslationKeyDropdown(allAdminTranslations);
            renderTranslationsTable(allAdminTranslations);
            
            if (badge) {
                const count = Object.keys(allAdminTranslations).length;
                badge.innerHTML = `<i class="fa-solid fa-circle-check mr-1 text-[8px] text-green-500"></i> ${count} khóa • Sẵn sàng`;
                badge.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200";
            }
        }
    } catch (e) {
        console.error("Lỗi tải từ điển:", e);
        const tbody = document.getElementById("translationsTableBody");
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold">Lỗi tải từ điển: ${e.message}</td></tr>`;
        if (badge) {
            badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1 text-[8px] text-red-500"></i> Lỗi kết nối`;
            badge.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200";
        }
    }
}

function populateTranslationKeyDropdown(transObj, filterQuery = "") {
    const select = document.getElementById("selectTranslationKey");
    if (!select) return;

    const allKeys = Object.keys(transObj || {}).sort();
    const q = (filterQuery || "").trim().toLowerCase();
    
    currentFilteredTransKeys = q ? allKeys.filter(k => k.toLowerCase().includes(q)) : allKeys;

    let html = "";
    if (currentFilteredTransKeys.length === 0) {
        html = `<option value="">(Không tìm thấy Text ID nào khớp với "${filterQuery}")</option>`;
    } else {
        currentFilteredTransKeys.forEach((key, idx) => {
            const row = transObj[key] || {};
            const viPreview = (row.vi || "").slice(0, 35) + ((row.vi || "").length > 35 ? "..." : "");
            html += `<option value="${key}">[${idx + 1}/${currentFilteredTransKeys.length}] ${key} — "${viPreview || 'Chưa dịch'}"</option>`;
        });
    }
    select.innerHTML = html;

    // Cập nhật key đang chọn
    if (currentFilteredTransKeys.length > 0) {
        if (!currentSelectedTransKey || !currentFilteredTransKeys.includes(currentSelectedTransKey)) {
            currentSelectedTransKey = currentFilteredTransKeys[0];
        }
        select.value = currentSelectedTransKey;
        loadSingleKeyIntoEditor(currentSelectedTransKey);
    } else {
        currentSelectedTransKey = "";
        clearSingleKeyEditor();
    }
    updateTransKeyCounter();
}

function onSelectTranslationKeyChange(key) {
    if (!key) return;
    currentSelectedTransKey = key;
    loadSingleKeyIntoEditor(key);
    updateTransKeyCounter();
    console.log(`🔤 [TRANSLATION_GUI] Đang chỉnh sửa Text ID: "${key}"`);
}

function onFilterTransKeyDropdown(query) {
    populateTranslationKeyDropdown(allAdminTranslations, query);
}

function navigateTransKey(direction) {
    if (!currentFilteredTransKeys || currentFilteredTransKeys.length === 0) return;
    let idx = currentFilteredTransKeys.indexOf(currentSelectedTransKey);
    if (idx === -1) idx = 0;
    
    idx += direction;
    if (idx < 0) idx = currentFilteredTransKeys.length - 1;
    if (idx >= currentFilteredTransKeys.length) idx = 0;

    const nextKey = currentFilteredTransKeys[idx];
    const select = document.getElementById("selectTranslationKey");
    if (select) select.value = nextKey;
    onSelectTranslationKeyChange(nextKey);
}

function updateTransKeyCounter() {
    const counter = document.getElementById("transKeyCounter");
    if (!counter) return;
    if (!currentFilteredTransKeys || currentFilteredTransKeys.length === 0) {
        counter.textContent = "0 / 0 khóa";
        return;
    }
    const idx = currentFilteredTransKeys.indexOf(currentSelectedTransKey);
    counter.textContent = `${idx >= 0 ? idx + 1 : 1} / ${currentFilteredTransKeys.length} khóa`;
}

function loadSingleKeyIntoEditor(key) {
    const badge = document.getElementById("currentEditingKeyBadge");
    if (badge) badge.textContent = key || "—";

    const data = (allAdminTranslations && allAdminTranslations[key]) || {};
    const keyType = data.type || "system";

    const typeBadge = document.getElementById("currentEditingKeyTypeBadge");
    const btnDelete = document.getElementById("btnDeleteCurrentTransKey");

    if (typeBadge) {
        if (keyType === "user") {
            typeBadge.textContent = "👤 user";
            typeBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono bg-purple-50 text-purple-700 border-purple-200";
        } else {
            typeBadge.textContent = "🔒 system";
            typeBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono bg-gray-100 text-gray-600 border-gray-200";
        }
    }

    if (btnDelete) {
        if (keyType === "user") {
            btnDelete.classList.remove("hidden");
            btnDelete.classList.add("flex");
        } else {
            btnDelete.classList.add("hidden");
            btnDelete.classList.remove("flex");
        }
    }

    const setVal = (lang, val) => {
        const el = document.getElementById(`singleTransInput_${lang}`);
        if (el) el.value = val || "";
    };

    setVal("vi", data.vi || "");
    setVal("en", data.en || "");
    setVal("ja", data.ja || "");
    setVal("ko", data.ko || "");
    setVal("zh", data.zh || "");
}

function clearSingleKeyEditor() {
    const badge = document.getElementById("currentEditingKeyBadge");
    if (badge) badge.textContent = "—";
    const typeBadge = document.getElementById("currentEditingKeyTypeBadge");
    if (typeBadge) {
        typeBadge.textContent = "—";
        typeBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono";
    }
    const btnDelete = document.getElementById("btnDeleteCurrentTransKey");
    if (btnDelete) {
        btnDelete.classList.add("hidden");
        btnDelete.classList.remove("flex");
    }
    ["vi", "en", "ja", "ko", "zh"].forEach(lang => {
        const el = document.getElementById(`singleTransInput_${lang}`);
        if (el) el.value = "";
    });
}

function syncSingleKeyInputToDictionary() {
    if (!currentSelectedTransKey) return;
    if (!allAdminTranslations[currentSelectedTransKey]) {
        allAdminTranslations[currentSelectedTransKey] = {};
    }
    const getVal = (lang) => {
        const el = document.getElementById(`singleTransInput_${lang}`);
        return el ? el.value : "";
    };

    const existingType = allAdminTranslations[currentSelectedTransKey]?.type || "system";

    allAdminTranslations[currentSelectedTransKey] = {
        type: existingType,
        vi: getVal("vi"),
        en: getVal("en"),
        ja: getVal("ja"),
        ko: getVal("ko"),
        zh: getVal("zh")
    };
}

async function saveCurrentSingleTranslationKey() {
    if (!currentSelectedTransKey) {
        notifyUser("Vui lòng chọn một Text ID để lưu!", "warning");
        return;
    }
    syncSingleKeyInputToDictionary();

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen(`Đang lưu bản dịch Text ID "${currentSelectedTransKey}"...`);
    try {
        const res = await fetch(`${API_BASE}/admin/translations`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify(allAdminTranslations)
        });

        const json = await res.json();
        if (res.ok && json.success) {
            notifyUser(`Đã lưu bản dịch cho Text ID "${currentSelectedTransKey}" thành công!`, 'success');
            const q = document.getElementById("filterTransKeyInput") ? document.getElementById("filterTransKeyInput").value : "";
            populateTranslationKeyDropdown(allAdminTranslations, q);
            renderTranslationsTable(allAdminTranslations);
        } else {
            notifyUser("Lỗi lưu bản dịch: " + (json.message || "Không xác định"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

function openAddNewTranslationKeyModal() {
    const modal = document.getElementById("addTranslationKeyModal");
    const input = document.getElementById("newTransKeyInput");
    const errBox = document.getElementById("addTransKeyError");
    if (!modal) return;
    if (errBox) errBox.classList.add("hidden");
    if (input) {
        input.value = "";
        setTimeout(() => input.focus(), 100);
    }
    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

function closeAddNewTranslationKeyModal() {
    const modal = document.getElementById("addTranslationKeyModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

async function handleAddNewTranslationKeySubmit(event) {
    if (event) event.preventDefault();
    const input = document.getElementById("newTransKeyInput");
    const errBox = document.getElementById("addTransKeyError");
    const rawKey = (input ? input.value : "").trim().toLowerCase().replace(/\s+/g, "_");

    if (!rawKey) {
        if (errBox) {
            errBox.textContent = "Vui lòng nhập mã Text ID!";
            errBox.classList.remove("hidden");
        }
        return;
    }

    if (!/^[a-z0-9_]+$/.test(rawKey)) {
        if (errBox) {
            errBox.textContent = "Mã Text ID chỉ gồm chữ cái thường, số và dấu gạch dưới!";
            errBox.classList.remove("hidden");
        }
        return;
    }

    if (allAdminTranslations && allAdminTranslations[rawKey]) {
        if (errBox) {
            errBox.textContent = `Mã Text ID "${rawKey}" đã tồn tại trong từ điển!`;
            errBox.classList.remove("hidden");
        }
        return;
    }

    // Tự động gán type là 'user' và khởi tạo giá trị 5 ngôn ngữ bằng chính rawKey
    allAdminTranslations[rawKey] = {
        type: "user",
        vi: rawKey,
        en: rawKey,
        ja: rawKey,
        ko: rawKey,
        zh: rawKey
    };

    closeAddNewTranslationKeyModal();
    lockScreen(`Đang khởi tạo Text ID "${rawKey}"...`);

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/translations`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify(allAdminTranslations)
        });

        const json = await res.json();
        if (res.ok && json.success) {
            notifyUser(`Đã thêm Text ID "${rawKey}" thành công! Hãy nhập nội dung dịch cho các ngôn ngữ.`, 'success');
            currentSelectedTransKey = rawKey;
            populateTranslationKeyDropdown(allAdminTranslations);
            const select = document.getElementById("selectTranslationKey");
            if (select) select.value = rawKey;
            onSelectTranslationKeyChange(rawKey);
            renderTranslationsTable(allAdminTranslations);
        } else {
            notifyUser("Lỗi thêm khóa bản dịch: " + (json.message || "Không xác định"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

async function deleteCurrentTranslationKey() {
    if (!currentSelectedTransKey) return;
    const currentData = allAdminTranslations[currentSelectedTransKey] || {};
    const keyType = currentData.type || "system";

    if (keyType === "system") {
        notifyUser(`Khóa "${currentSelectedTransKey}" là khóa Hệ Thống, không thể xóa!`, 'error');
        return;
    }

    const confirmFn = typeof showConfirmDialog === "function" ? showConfirmDialog : (window.showConfirmDialog || confirm);
    const confirmed = await confirmFn({
        title: "Xác nhận Xóa Text ID",
        message: `Bạn có chắc chắn muốn xóa vĩnh viễn khóa bản dịch "${currentSelectedTransKey}" không?`,
        detail: "Khóa này thuộc loại User và sẽ bị xóa khỏi toàn bộ từ điển 5 ngôn ngữ.",
        confirmText: "Xóa Khóa",
        cancelText: "Hủy bỏ",
        type: "danger",
        icon: "fa-solid fa-trash"
    });
    if (!confirmed) return;

    lockScreen(`Đang xóa khóa bản dịch "${currentSelectedTransKey}"...`);
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/translations/${currentSelectedTransKey}`, {
            method: "DELETE",
            headers: {
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            }
        });

        const json = await res.json();
        if (res.ok && json.success) {
            delete allAdminTranslations[currentSelectedTransKey];
            notifyUser(`Đã xóa khóa "${currentSelectedTransKey}" thành công!`, 'success');
            currentSelectedTransKey = "";
            populateTranslationKeyDropdown(allAdminTranslations);
            renderTranslationsTable(allAdminTranslations);
        } else {
            notifyUser("Lỗi xóa khóa bản dịch: " + (json.message || "Không xác định"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

function renderTranslationsTable(transObj) {
    const tbody = document.getElementById("translationsTableBody");
    if (!tbody) return;

    let html = "";
    Object.keys(transObj).forEach((k) => {
        const row = transObj[k] || {};
        html += `
            <tr class="hover:bg-gray-50/60 transition translation-row" data-key="${k}">
                <td class="p-3 font-bold text-gray-700 text-[11px] font-mono">${k}</td>
                <td class="p-2"><input type="text" value="${(row.vi || '').replace(/"/g, '&quot;')}" class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-primary i18n-input" data-key="${k}" data-lang="vi"></td>
                <td class="p-2"><input type="text" value="${(row.en || '').replace(/"/g, '&quot;')}" class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-primary i18n-input" data-key="${k}" data-lang="en"></td>
                <td class="p-2"><input type="text" value="${(row.ja || '').replace(/"/g, '&quot;')}" class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-primary i18n-input" data-key="${k}" data-lang="ja"></td>
                <td class="p-2"><input type="text" value="${(row.ko || '').replace(/"/g, '&quot;')}" class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-primary i18n-input" data-key="${k}" data-lang="ko"></td>
                <td class="p-2"><input type="text" value="${(row.zh || '').replace(/"/g, '&quot;')}" class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-primary i18n-input" data-key="${k}" data-lang="zh"></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function filterTranslations() {
    const input = document.getElementById("searchTranslationKey");
    const query = (input ? input.value : "").trim().toLowerCase();
    const rows = document.querySelectorAll(".translation-row");

    rows.forEach((r) => {
        const key = r.getAttribute("data-key") || "";
        if (key.toLowerCase().includes(query)) {
            r.classList.remove("hidden");
        } else {
            r.classList.add("hidden");
        }
    });
}

function switchTransViewMode(mode) {
    const singleView = document.getElementById("transSingleKeyView");
    const tableView = document.getElementById("transFullTableView");
    const btnSingle = document.getElementById("btnTransViewSingle");
    const btnTable = document.getElementById("btnTransViewTable");

    if (mode === "single") {
        if (singleView) singleView.classList.remove("hidden");
        if (tableView) tableView.classList.add("hidden");
        if (btnSingle) {
            btnSingle.className = "px-3 py-1.5 font-bold rounded-lg bg-white text-primary shadow-xs transition flex items-center gap-1";
        }
        if (btnTable) {
            btnTable.className = "px-3 py-1.5 font-bold rounded-lg text-gray-600 hover:text-gray-900 transition flex items-center gap-1";
        }
    } else {
        if (singleView) singleView.classList.add("hidden");
        if (tableView) tableView.classList.remove("hidden");
        if (btnSingle) {
            btnSingle.className = "px-3 py-1.5 font-bold rounded-lg text-gray-600 hover:text-gray-900 transition flex items-center gap-1";
        }
        if (btnTable) {
            btnTable.className = "px-3 py-1.5 font-bold rounded-lg bg-white text-primary shadow-xs transition flex items-center gap-1";
        }
    }
}

async function saveAllTranslations() {
    syncSingleKeyInputToDictionary();

    const inputs = document.querySelectorAll(".i18n-input");
    inputs.forEach((inp) => {
        const key = inp.getAttribute("data-key");
        const lang = inp.getAttribute("data-lang");
        const val = inp.value;

        if (!allAdminTranslations[key]) allAdminTranslations[key] = {};
        allAdminTranslations[key][lang] = val;
    });

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen("Đang lưu toàn bộ từ điển đa ngôn ngữ (5 ngôn ngữ)...");
    try {
        const res = await fetch(`${API_BASE}/admin/translations`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify(allAdminTranslations)
        });

        const json = await res.json();
        if (res.ok && json.success) {
            notifyUser("Đã lưu toàn bộ bản dịch 5 ngôn ngữ thành công!", 'success');
            const q = document.getElementById("filterTransKeyInput") ? document.getElementById("filterTransKeyInput").value : "";
            populateTranslationKeyDropdown(allAdminTranslations, q);
            renderTranslationsTable(allAdminTranslations);
        } else {
            notifyUser("Lỗi lưu bản dịch: " + (json.message || "Không xác định"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

// ==========================================
// CẤU HÌNH THÔNG TIN DOANH NGHIỆP (infoCompany.json)
// ==========================================

const DEFAULT_STATIC_COMPANY_INFO = {
    companyName: "NỞ HOA THẢ BÌNH",
    brandSlogan: "Hoa Tươi Thiết Kế & Cắm Hoa Thả Bình Nghệ Thuật",
    address: "183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP. Hồ Chí Minh",
    phone: "0976.491.322",
    hotline: "0976.491.322",
    email: "cskh@nohoathabinh.vn",
    workingHours: "Thứ 2 - Chủ Nhật: 7:00 - 21:00",
    taxCode: "0318999888",
    website: "https://nohoathabinh.vn",
    facebook: "https://facebook.com/nohoathabinh",
    instagram: "https://instagram.com/nohoathabinh",
    zalo: "https://zalo.me/0976491322",
    mapUrl: "https://maps.google.com/?q=183/37+Đường+3+Tháng+2,+Phường+11,+Quận+10,+TP.+Hồ+Chí+Minh",
    mapEmbedUrl: "https://maps.google.com/maps?q=183%2F37%20%C4%90%C6%B0%E1%BB%9Dng%203%20Th%C3%A1ng%202%2C%20Ph%C6%B0%E1%BB%9Dng%2011%2C%20Qu%E1%BA%ADn%2010%2C%20Th%C3%A0nh%20ph%E1%BB%91%20H%E1%BB%93%20Ch%C3%AD%20Minh&t=&z=16&ie=UTF8&iwloc=&output=embed"
};

let adminCompanyInfo = { ...DEFAULT_STATIC_COMPANY_INFO };

// ==========================================
// CẤU HÌNH PHƯƠNG THỨC THANH TOÁN (paymentConfig.json)
// ==========================================

let adminPaymentConfig = { methods: {} };

async function loadAdminPaymentConfig() {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const listEl = document.getElementById("paymentMethodsList");
    const badge = document.getElementById("paymentConfigStatus");
    if (!listEl) return;

    listEl.innerHTML = `
        <div class="text-center py-10 text-gray-400 text-xs">
            <i class="fa-solid fa-circle-notch fa-spin text-lg mb-2"></i>
            <p>Đang tải cấu hình thanh toán...</p>
        </div>`;

    try {
        const res = await fetch(`${API_BASE}/admin/payment-config?_t=${Date.now()}`, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.data) {
            throw new Error(json.message || "Không tải được cấu hình");
        }
        adminPaymentConfig = json.data;
        renderPaymentMethods(adminPaymentConfig);
        if (badge) {
            badge.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200";
            badge.innerHTML = `<i class="fa-solid fa-circle-check mr-1 text-[8px] text-emerald-500"></i> Đã nạp • ${new Date().toLocaleTimeString()}`;
        }
    } catch (e) {
        listEl.innerHTML = `
            <div class="text-center py-8 bg-white rounded-xl border border-red-100">
                <i class="fa-solid fa-triangle-exclamation text-xl text-red-400 mb-2"></i>
                <p class="text-xs font-semibold text-gray-700">Không thể tải cấu hình thanh toán</p>
                <p class="text-[11px] text-gray-400 mt-1">${e.message}</p>
            </div>`;
        if (badge) {
            badge.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200";
            badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1 text-[8px] text-red-500"></i> Lỗi tải`;
        }
    }
}

function renderPaymentMethods(config) {
    const listEl = document.getElementById("paymentMethodsList");
    if (!listEl) return;
    const methods = (config && config.methods) || {};
    const keys = Object.keys(methods);
    if (keys.length === 0) {
        listEl.innerHTML = `<p class="text-center text-xs text-gray-400 py-8">Chưa có phương thức thanh toán nào.</p>`;
        return;
    }

    const iconMap = { online: "fa-qrcode", cash: "fa-money-bill-wave" };
    listEl.innerHTML = keys.map((key) => {
        const m = methods[key] || {};
        const enabled = !!m.enabled;
        const icon = iconMap[key] || "fa-credit-card";
        return `
            <div class="bg-white rounded-2xl border ${enabled ? "border-emerald-200" : "border-gray-200"} shadow-2xs p-4 flex items-start justify-between gap-4 transition">
                <div class="flex items-start gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-xl ${enabled ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"} flex items-center justify-center text-lg flex-shrink-0">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h5 class="text-sm font-bold text-gray-800">${m.label || key}</h5>
                            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">${m.code || key}</span>
                        </div>
                        <p class="text-[11px] text-gray-500 mt-1 leading-relaxed">${m.description || ""}</p>
                    </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                    <input type="checkbox" class="sr-only peer payment-method-toggle" data-method-key="${key}" ${enabled ? "checked" : ""} onchange="onPaymentMethodToggle()">
                    <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
            </div>`;
    }).join("");
}

function onPaymentMethodToggle() {
    // Đồng bộ trạng thái checkbox vào state cục bộ (chưa lưu tới khi bấm Lưu Cấu Hình)
    const toggles = document.querySelectorAll(".payment-method-toggle");
    toggles.forEach((el) => {
        const key = el.getAttribute("data-method-key");
        if (key && adminPaymentConfig.methods && adminPaymentConfig.methods[key]) {
            adminPaymentConfig.methods[key].enabled = el.checked;
        }
    });
}

async function savePaymentConfig() {
    onPaymentMethodToggle();
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    const methods = adminPaymentConfig.methods || {};
    const anyEnabled = Object.values(methods).some((m) => m && m.enabled);
    if (!anyEnabled) {
        notifyUser("Phải bật ít nhất một phương thức thanh toán!", "warning");
        return;
    }

    const payload = { methods: {} };
    Object.keys(methods).forEach((key) => {
        payload.methods[key] = { enabled: !!methods[key].enabled };
    });

    try {
        const res = await fetch(`${API_BASE}/admin/payment-config`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
            throw new Error(json.message || "Không thể lưu cấu hình");
        }
        adminPaymentConfig = json.data;
        renderPaymentMethods(adminPaymentConfig);
        notifyUser("Đã lưu cấu hình phương thức thanh toán thành công!", "success");
    } catch (e) {
        notifyUser("Lỗi lưu cấu hình thanh toán: " + e.message, "error");
    }
}

// ==========================================
// CẤU HÌNH HIỂN THỊ SẢN PHẨM KÈM THEO (ADD-ON)
// ==========================================
let adminAddonConfig = { showAddons: true };

async function loadAdminAddonConfig() {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const statusEl = document.getElementById("addonConfigStatus");
    if (statusEl) {
        statusEl.textContent = "Đang tải…";
        statusEl.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500";
    }
    try {
        const res = await fetch(`${API_BASE}/admin/addon-config`, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Không thể tải cấu hình");
        adminAddonConfig = json.data || { showAddons: true };
    } catch (e) {
        adminAddonConfig = { showAddons: true };
        console.warn("[ADDON-CONFIG] load lỗi:", e.message);
    }
    renderAddonConfig(adminAddonConfig);
}

function renderAddonConfig(config) {
    const toggle = document.getElementById("addonVisToggle");
    const labelEl = document.getElementById("addonVisLabel");
    const descEl = document.getElementById("addonVisDescription");
    const statusEl = document.getElementById("addonConfigStatus");
    const enabled = !!(config && config.showAddons);

    if (toggle) toggle.checked = enabled;
    if (labelEl && config && config.label) labelEl.textContent = config.label;
    if (descEl && config && config.description) descEl.textContent = config.description;
    if (statusEl) {
        statusEl.textContent = enabled ? "Đang hiển thị" : "Đang ẩn";
        statusEl.className = enabled
            ? "text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700"
            : "text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600";
    }
}

async function saveAddonConfig() {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const toggle = document.getElementById("addonVisToggle");
    const payload = { showAddons: toggle ? !!toggle.checked : true };

    try {
        const res = await fetch(`${API_BASE}/admin/addon-config`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Không thể lưu cấu hình");
        adminAddonConfig = json.data;
        renderAddonConfig(adminAddonConfig);
        notifyUser(
            adminAddonConfig.showAddons
                ? "Đã BẬT hiển thị khu vực Sản Phẩm Kèm Theo trên giao diện khách hàng."
                : "Đã TẮT hiển thị khu vực Sản Phẩm Kèm Theo trên giao diện khách hàng.",
            "success"
        );
    } catch (e) {
        notifyUser("Lỗi lưu cấu hình add-on: " + e.message, "error");
    }
}

async function loadAdminCompanyInfo() {
    bindLiveCompanyInfoInputs();
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    let dataLoaded = false;
    let source = "unknown";

    const updateBadge = (text, type = "success") => {
        const badge = document.getElementById("companyInfoDebugStatus");
        if (!badge) return;
        const timeStr = new Date().toLocaleTimeString();
        if (type === "success") {
            badge.className = "inline-flex items-center text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 shadow-2xs";
            badge.innerHTML = `<i class="fa-solid fa-circle-check mr-1 text-[9px] text-green-500"></i> ${text} • ${timeStr}`;
        } else if (type === "warning") {
            badge.className = "inline-flex items-center text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 shadow-2xs";
            badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1 text-[9px] text-yellow-500"></i> ${text} • ${timeStr}`;
        } else {
            badge.className = "inline-flex items-center text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs";
            badge.innerHTML = `<i class="fa-solid fa-info-circle mr-1 text-[9px] text-blue-500"></i> ${text} • ${timeStr}`;
        }
    };

    console.group("%c[DEBUG_COMPANY_INFO] Bắt đầu nạp cấu hình doanh nghiệp", "color: #d81b60; font-weight: bold; font-size: 12px;");
    console.log("⏱️ Thời điểm:", new Date().toLocaleTimeString());
    console.log("🌐 API_BASE:", API_BASE);
    console.log("🔑 Auth Token hiện tại:", token ? `Đã có token (${token.slice(0, 15)}...)` : "Chưa có token (Anonymous)");

    // 1. Thử gọi API Admin
    try {
        const adminUrl = `${API_BASE}/admin/company-info?_t=${Date.now()}`;
        console.log("📡 [1/3] Đang gọi Admin API:", adminUrl);
        const res = await fetch(adminUrl, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        console.log("📥 Kết quả HTTP Admin API:", res.status, res.statusText);

        if (res.ok) {
            const json = await res.json();
            console.log("📦 Dữ liệu JSON Admin API:", json);
            if (json.success && json.data && typeof json.data === 'object') {
                adminCompanyInfo = { ...DEFAULT_STATIC_COMPANY_INFO, ...json.data };
                populateCompanyInfoForm(adminCompanyInfo);
                updateLiveCompanyPreview(adminCompanyInfo);
                dataLoaded = true;
                source = "Admin API (/admin/company-info)";
                updateBadge("Đã nạp từ Admin API", "success");
                console.log("✅ Nạp thành công từ Admin API:", adminCompanyInfo);
            }
        } else {
            console.warn("⚠️ Admin API trả về mã lỗi HTTP:", res.status);
        }
    } catch (e) {
        console.warn("⚠️ Lỗi kết nối /admin/company-info:", e.message);
    }

    // 2. Thử fallback qua Public API
    if (!dataLoaded) {
        try {
            const pubUrl = `${API_BASE}/company-info?_t=${Date.now()}`;
            console.log("📡 [2/3] Đang thử Public API:", pubUrl);
            const pubRes = await fetch(pubUrl);
            console.log("📥 Kết quả HTTP Public API:", pubRes.status, pubRes.statusText);

            if (pubRes.ok) {
                const pubJson = await pubRes.json();
                console.log("📦 Dữ liệu JSON Public API:", pubJson);
                if (pubJson.success && pubJson.data && typeof pubJson.data === 'object') {
                    adminCompanyInfo = { ...DEFAULT_STATIC_COMPANY_INFO, ...pubJson.data };
                    populateCompanyInfoForm(adminCompanyInfo);
                    updateLiveCompanyPreview(adminCompanyInfo);
                    dataLoaded = true;
                    source = "Public API (/company-info)";
                    updateBadge("Đã nạp từ Public API", "success");
                    console.log("✅ Nạp thành công từ Public API:", adminCompanyInfo);
                }
            } else {
                console.warn("⚠️ Public API trả về mã lỗi HTTP:", pubRes.status);
            }
        } catch (err) {
            console.warn("⚠️ Không kết nối được public API company-info:", err.message);
        }
    }

    // 3. Fallback mặc định an toàn nếu chưa load được
    if (!dataLoaded) {
        console.log("🛡️ [3/3] Áp dụng cấu hình tĩnh mặc định (DEFAULT_STATIC_COMPANY_INFO):", DEFAULT_STATIC_COMPANY_INFO);
        populateCompanyInfoForm(DEFAULT_STATIC_COMPANY_INFO);
        updateLiveCompanyPreview(DEFAULT_STATIC_COMPANY_INFO);
        source = "Cấu hình tĩnh (Static Fallback)";
        updateBadge("Nạp từ Cấu hình tĩnh", "warning");
    }

    console.log("🏁 Hoàn tất nạp thông tin doanh nghiệp! Nguồn dữ liệu:", source);
    console.groupEnd();
}

function populateCompanyInfoForm(data) {
    if (!data) return;
    const setValue = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = (val !== undefined && val !== null) ? val : "";
            console.log(`  📝 [Gán input] #${id} = "${el.value}"`);
        } else {
            console.warn(`  ❌ Không tìm thấy element DOM: #${id}`);
        }
    };

    console.log("📋 Bắt đầu điền dữ liệu vào form:", data.companyName);
    setValue("companyNameInput", data.companyName);
    setValue("companySloganInput", data.brandSlogan);
    setValue("companyTaxCodeInput", data.taxCode);
    setValue("companyWebsiteInput", data.website);
    setValue("companyAddressInput", data.address);
    setValue("companyHotlineInput", data.hotline || data.phone);
    setValue("companyPhoneInput", data.phone);
    setValue("companyEmailInput", data.email);
    setValue("companyHoursInput", data.workingHours);
    setValue("companyFacebookInput", data.facebook);
    setValue("companyInstagramInput", data.instagram);
    setValue("companyZaloInput", data.zalo);
    setValue("companyMapUrlInput", data.mapUrl);
    setValue("companyMapEmbedUrlInput", data.mapEmbedUrl);
}

function updateLiveCompanyPreview(data) {
    if (!data) return;
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || "—";
    };

    setText("previewCompanyName", data.companyName || "NỞ HOA THẢ BÌNH");
    setText("previewCompanySlogan", data.brandSlogan || "Hoa Tươi Thiết Kế & Cắm Hoa Thả Bình");
    setText("previewCompanyAddress", data.address || "183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP. Hồ Chí Minh");
    setText("previewCompanyHotline", data.hotline || data.phone || "0976.491.322");
    setText("previewCompanyEmail", data.email || "cskh@nohoathabinh.vn");
    setText("previewCompanyHours", data.workingHours || "Thứ 2 - Chủ Nhật: 7:00 - 21:00");
}

function bindLiveCompanyInfoInputs() {
    const inputs = [
        { id: "companyNameInput", target: "previewCompanyName", fallback: "NỞ HOA THẢ BÌNH" },
        { id: "companySloganInput", target: "previewCompanySlogan", fallback: "Hoa Tươi Thiết Kế & Cắm Hoa Thả Bình" },
        { id: "companyAddressInput", target: "previewCompanyAddress", fallback: "183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP. Hồ Chí Minh" },
        { id: "companyHotlineInput", target: "previewCompanyHotline", fallback: "0976.491.322" },
        { id: "companyEmailInput", target: "previewCompanyEmail", fallback: "cskh@nohoathabinh.vn" },
        { id: "companyHoursInput", target: "previewCompanyHours", fallback: "Thứ 2 - Chủ Nhật: 7:00 - 21:00" }
    ];

    inputs.forEach(item => {
        const el = document.getElementById(item.id);
        const targetEl = document.getElementById(item.target);
        if (el && targetEl && !el.dataset.liveBound) {
            el.dataset.liveBound = "true";
            el.addEventListener("input", () => {
                targetEl.textContent = el.value.trim() || item.fallback;
            });
        }
    });
}

async function handleCompanyInfoSubmit(event) {
    if (event) event.preventDefault();

    const getValue = (id) => (document.getElementById(id)?.value || "").trim();

    const payload = {
        companyName: getValue("companyNameInput") || "NỞ HOA THẢ BÌNH",
        brandSlogan: getValue("companySloganInput"),
        taxCode: getValue("companyTaxCodeInput"),
        website: getValue("companyWebsiteInput"),
        address: getValue("companyAddressInput"),
        hotline: getValue("companyHotlineInput") || "0976.491.322",
        phone: getValue("companyPhoneInput") || getValue("companyHotlineInput"),
        email: getValue("companyEmailInput") || "cskh@nohoathabinh.vn",
        workingHours: getValue("companyHoursInput") || "Thứ 2 - Chủ Nhật: 7:00 - 21:00",
        facebook: getValue("companyFacebookInput"),
        instagram: getValue("companyInstagramInput"),
        zalo: getValue("companyZaloInput"),
        mapUrl: getValue("companyMapUrlInput"),
        mapEmbedUrl: getValue("companyMapEmbedUrlInput")
    };

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen("Đang lưu cấu hình thông tin doanh nghiệp (infoCompany.json)...");
    try {
        const res = await fetch(`${API_BASE}/admin/company-info`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (res.ok && json.success) {
            adminCompanyInfo = json.data || payload;
            updateLiveCompanyPreview(adminCompanyInfo);
            
            // Cập nhật ngay lên giao diện bán hàng khách hàng nếu có hàm đồng bộ
            if (typeof window !== "undefined" && typeof window.applyStorefrontCompanyInfo === "function") {
                window.applyStorefrontCompanyInfo(adminCompanyInfo);
            }
            
            notifyUser("Đã cập nhật thông tin doanh nghiệp thành công!", 'success');
        } else {
            notifyUser("Lỗi lưu thông tin: " + (json.message || "Không xác định"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

// ==========================================
// QUẢN LÝ ĐƠN HÀNG (ORDERS MANAGEMENT)
// ==========================================

const ADMIN_ORDER_STATUS_META = {
    pending:        { label: "Chờ xác nhận",   color: "bg-amber-100 text-amber-700 border-amber-200",   icon: "fa-clock" },
    confirmed:      { label: "Đã xác nhận",    color: "bg-blue-100 text-blue-700 border-blue-200",       icon: "fa-check" },
    arranging:      { label: "Đang cắm hoa",   color: "bg-purple-100 text-purple-700 border-purple-200", icon: "fa-scissors" },
    shipping:       { label: "Đang vận chuyển", color: "bg-cyan-100 text-cyan-700 border-cyan-200",      icon: "fa-truck" },
    delivered:      { label: "Giao thành công", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    ready_for_pickup: { label: "Sẵn sàng nhận", color: "bg-teal-100 text-teal-700 border-teal-200",      icon: "fa-store" },
    completed:      { label: "Hoàn thành",     color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    cancelled:      { label: "Đã hủy",         color: "bg-red-100 text-red-700 border-red-200",          icon: "fa-ban" },
    returned:       { label: "Trả hàng",       color: "bg-orange-100 text-orange-700 border-orange-200", icon: "fa-rotate-left" }
};

const ADMIN_PAYMENT_STATUS_META = {
    unpaid:   { label: "Chưa thanh toán", color: "bg-gray-100 text-gray-600 border-gray-200",   icon: "fa-credit-card" },
    paid:     { label: "Đã thanh toán",   color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    refunded: { label: "Đã hoàn tiền",    color: "bg-blue-100 text-blue-700 border-blue-200",   icon: "fa-rotate-left" },
    failed:   { label: "Thanh toán lỗi",  color: "bg-red-100 text-red-700 border-red-200",      icon: "fa-circle-xmark" }
};

function adminFormatVND(amount) {
    const n = Number(amount) || 0;
    return n.toLocaleString("vi-VN") + "₫";
}

function adminFormatDate(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function adminGetStatusMeta(status, map) {
    return map[status] || { label: status || "Không xác định", color: "bg-gray-100 text-gray-600 border-gray-200", icon: "fa-circle-question" };
}

async function loadAdminOrders() {
    const tbody = document.getElementById("adminOrdersTableBody");
    if (!tbody) return;

    const timeframeEl = document.getElementById("filterOrderTimeframe");
    const statusEl = document.getElementById("filterOrderStatus");
    const paymentEl = document.getElementById("filterOrderPayment");
    const searchEl = document.getElementById("searchOrderInput");

    const timeframe = timeframeEl ? timeframeEl.value : "this_month";
    const status = statusEl ? statusEl.value : "all";
    const paymentStatus = paymentEl ? paymentEl.value : "all";
    const search = searchEl ? searchEl.value.trim() : "";

    tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-gray-400">Đang tải đơn hàng...</td></tr>`;
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    try {
        let url = `${API_BASE}/admin/orders?timeframe=${encodeURIComponent(timeframe)}&status=${encodeURIComponent(status)}&paymentStatus=${encodeURIComponent(paymentStatus)}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;

        const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
        const json = await res.json();

        if (json.success && json.data) {
            const orders = Array.isArray(json.data.orders) ? json.data.orders : [];
            renderAdminOrdersTable(orders);
        } else {
            tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-red-500 font-bold">${json.message || "Lỗi tải đơn hàng"}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
    }
}

function renderAdminOrdersTable(orders) {
    const tbody = document.getElementById("adminOrdersTableBody");
    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-gray-400">Không có đơn hàng nào phù hợp</td></tr>`;
        return;
    }

    tbody.innerHTML = orders.map(order => {
        const statusMeta = adminGetStatusMeta(order.status, ADMIN_ORDER_STATUS_META);
        const payMeta = adminGetStatusMeta(order.payment?.status, ADMIN_PAYMENT_STATUS_META);
        const total = Number(order.totalAmount) || Number(order.financials?.totalAmount) || 0;
        const sender = order.sender || {};
        const recipient = order.recipient || {};
        const branchId = order.branchId || order.assignedBranchId || "";
        const assignedTo = order.assignedTo || "—";

        return `
            <tr class="hover:bg-pink-50/30 transition">
                <td class="p-3">
                    <span class="font-mono text-[11px] font-bold text-gray-700">${order.orderCode || order.id || ""}</span>
                    <div class="text-[10px] text-gray-400">${adminFormatDate(order.createdAt || order.orderDate)}</div>
                </td>
                <td class="p-3">
                    <div class="text-xs font-bold text-gray-800">${sender.name || "—"}</div>
                    <div class="text-[10px] text-gray-400">${sender.phone || ""}</div>
                </td>
                <td class="p-3">
                    <div class="text-xs text-gray-700">${recipient.name || "—"}</div>
                    <div class="text-[10px] text-gray-400 truncate max-w-[140px]">${recipient.address || ""}</div>
                </td>
                <td class="p-3"><span class="text-[11px] font-semibold text-gray-600">${branchId}</span></td>
                <td class="p-3"><span class="text-[11px] text-gray-600">${assignedTo}</span></td>
                <td class="p-3 font-bold text-gray-800">${adminFormatVND(total)}</td>
                <td class="p-3">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${payMeta.color}">
                        <i class="fa-solid ${payMeta.icon}"></i> ${payMeta.label}
                    </span>
                </td>
                <td class="p-3">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusMeta.color}">
                        <i class="fa-solid ${statusMeta.icon}"></i> ${statusMeta.label}
                    </span>
                </td>
                <td class="p-3 text-center">
                    <select onchange="updateAdminOrderStatus('${order.id}', this.value)" class="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-semibold focus:outline-none focus:border-primary">
                        <option value="">Cập nhật...</option>
                        <option value="confirmed">✅ Xác nhận</option>
                        <option value="arranging">🌸 Đang cắm</option>
                        <option value="shipping">🚚 Vận chuyển</option>
                        <option value="delivered">🎉 Giao xong</option>
                        <option value="cancelled">❌ Hủy</option>
                    </select>
                </td>
            </tr>
        `;
    }).join("");
}

async function updateAdminOrderStatus(orderId, newStatus) {
    if (!orderId || !newStatus) return;
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    try {
        const res = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        const json = await res.json();

        if (json.success) {
            notifyUser("Đã cập nhật trạng thái đơn hàng!", 'success');
            loadAdminOrders();
        } else {
            notifyUser(json.message || "Lỗi cập nhật trạng thái", 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    }
}

// Global binding
if (typeof window !== "undefined") {
    window.openAdminPortalModal = openAdminPortalModal;
    window.closeAdminPortalModal = closeAdminPortalModal;
    window.switchAdminTab = switchAdminTab;
    window.openSystemConfigModal = openSystemConfigModal;
    window.closeSystemConfigModal = closeSystemConfigModal;
    window.switchSystemConfigTab = switchSystemConfigTab;
    window.loadAdminPaymentConfig = loadAdminPaymentConfig;
    window.onPaymentMethodToggle = onPaymentMethodToggle;
    window.savePaymentConfig = savePaymentConfig;
    window.loadAdminAddonConfig = loadAdminAddonConfig;
    window.saveAddonConfig = saveAddonConfig;
    window.loadAdminProducts = loadAdminProducts;
    window.openProductModal = openProductModal;
    window.closeProductModal = closeProductModal;
    window.editProduct = editProduct;
    window.handleProductSubmit = handleProductSubmit;
    window.handleImageFileUpload = handleImageFileUpload;
    window.compressAndConvertToBase64 = compressAndConvertToBase64;
    window.toggleProduct = toggleProduct;
    window.onPriceLevelChange = onPriceLevelChange;
    window.validateLivePrice = validateLivePrice;
    window.populateProductTextIdDropdowns = populateProductTextIdDropdowns;
    window.onProductTextIdChange = onProductTextIdChange;
    window.switchProductLangTab = switchProductLangTab;
    window.saveCurrentProdI18nDraft = saveCurrentProdI18nDraft;
    window.renderEditingProductGallery = renderEditingProductGallery;
    window.addProductGalleryImage = addProductGalleryImage;
    window.addProductGalleryImageFromInput = addProductGalleryImageFromInput;
    window.removeProductGalleryImage = removeProductGalleryImage;
    window.handleGalleryFileUpload = handleGalleryFileUpload;
    window.filterTranslations = filterTranslations;
    window.saveAllTranslations = saveAllTranslations;
    window.populateTranslationKeyDropdown = populateTranslationKeyDropdown;
    window.onSelectTranslationKeyChange = onSelectTranslationKeyChange;
    window.onFilterTransKeyDropdown = onFilterTransKeyDropdown;
    window.navigateTransKey = navigateTransKey;
    window.syncSingleKeyInputToDictionary = syncSingleKeyInputToDictionary;
    window.saveCurrentSingleTranslationKey = saveCurrentSingleTranslationKey;
    window.switchTransViewMode = switchTransViewMode;
    window.openAddNewTranslationKeyModal = openAddNewTranslationKeyModal;
    window.closeAddNewTranslationKeyModal = closeAddNewTranslationKeyModal;
    window.handleAddNewTranslationKeySubmit = handleAddNewTranslationKeySubmit;
    window.deleteCurrentTranslationKey = deleteCurrentTranslationKey;

    // Company Info
    window.loadAdminCompanyInfo = loadAdminCompanyInfo;
    window.handleCompanyInfoSubmit = handleCompanyInfoSubmit;

    // Promotions & Vouchers
    window.loadAdminPromotions = loadAdminPromotions;
    window.openPromoModal = openPromoModal;
    window.closePromoModal = closePromoModal;
    window.editPromo = editPromo;
    window.handlePromoSubmit = handlePromoSubmit;
    window.togglePromo = togglePromo;
    window.deletePromo = deletePromo;
    window.restorePromo = restorePromo;

    // Add-Ons (Sản Phẩm Kèm Theo)
    window.loadAdminAddons = loadAdminAddons;
    window.openAddonModal = openAddonModal;
    window.closeAddonModal = closeAddonModal;
    window.editAddon = editAddon;
    window.handleAddonSubmit = handleAddonSubmit;
    window.handleAddonImageFileUpload = handleAddonImageFileUpload;
    window.toggleAddon = toggleAddon;
    window.deleteAddon = deleteAddon;
    window.restoreAddon = restoreAddon;

    // Categories
    window.loadAdminCategories = loadAdminCategories;
    window.openCategoryModal = openCategoryModal;
    window.closeCategoryModal = closeCategoryModal;
    window.onCategoryTextIdChange = onCategoryTextIdChange;
    window.onCategoryDescTextIdChange = onCategoryDescTextIdChange;
    window.switchCategoryLangTab = switchCategoryLangTab;
    window.saveCurrentCatI18nDraft = saveCurrentCatI18nDraft;
    window.editCategory = editCategory;
    window.handleCategorySubmit = handleCategorySubmit;
    window.toggleCategory = toggleCategory;
    window.deleteCategory = deleteCategory;
    window.restoreCategory = restoreCategory;
    window.moveCategory = moveCategory;
    window.populateCategoryDropdowns = populateCategoryDropdowns;

    // Staff & Customers
    window.loadAdminUsers = loadAdminUsers;
    window.loadAdminStaff = loadAdminUsers;
    window.loadAdminCustomers = loadAdminCustomers;
    window.openUserModal = openUserModal;
    window.closeUserModal = closeUserModal;
    window.editUser = editUser;
    window.handleUserSubmit = handleUserSubmit;
    window.deleteUser = deleteUser;

    // Branches
    window.loadAdminBranches = loadAdminBranches;
    window.openBranchModal = openBranchModal;
    window.closeBranchModal = closeBranchModal;
    window.editBranch = editBranch;
    window.handleBranchSubmit = handleBranchSubmit;
    window.toggleBranch = toggleBranch;
    window.populateBranchDropdowns = populateBranchDropdowns;
    window.notifyUser = notifyUser;

    // Orders
    window.loadAdminOrders = loadAdminOrders;
    window.updateAdminOrderStatus = updateAdminOrderStatus;
}


// ==========================================================================
// MODULE: flower_app.js
// ==========================================================================
// Cache sản phẩm toàn cục cho Storefront
let allStorefrontProducts = [];
let activeStorefrontCategories = [];

// Gắn các hàm tiện ích vào window cho toàn bộ trang
if (typeof window !== 'undefined') {
    window.translations = translations;
    window.setLanguage = setLanguage;
    window.addToCart = addToCart;
    window.getProducts = getProducts;
    window.getProductById = getProductById;
    window.getCategories = getCategories;
}

/**
 * Lấy tên hiển thị sản phẩm theo ngôn ngữ hiện tại
 */
function getProductName(prod) {
    if (!prod) return "";
    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    
    // 1. Ưu tiên đọc từ khối i18n bên trong chính sản phẩm (Modular i18n Architecture)
    if (prod.i18n && prod.i18n[lang] && prod.i18n[lang].name) {
        return prod.i18n[lang].name;
    }

    // 2. Fallback đọc theo Text ID từ từ điển chung
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const textId = prod.nameTextId || prod.textId;
    if (textId && trans && trans[lang] && trans[lang][textId]) {
        return trans[lang][textId];
    }
    return prod.name || "";
}

/**
 * Lấy thành phần hoa theo ngôn ngữ hiện tại
 */
function getProductComposition(prod) {
    if (!prod) return "";
    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    
    // 1. Ưu tiên đọc từ khối i18n bên trong chính sản phẩm
    if (prod.i18n && prod.i18n[lang] && prod.i18n[lang].flowerComposition) {
        return prod.i18n[lang].flowerComposition;
    }

    // 2. Fallback đọc theo Text ID từ từ điển chung
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const textId = prod.compTextId || prod.compositionTextId;
    if (textId && trans && trans[lang] && trans[lang][textId]) {
        return trans[lang][textId];
    }
    return prod.flowerComposition || prod.composition || "";
}

/**
 * Lấy mô tả cảm xúc theo ngôn ngữ hiện tại
 */
function getProductDescription(prod) {
    if (!prod) return "";
    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    
    // 1. Ưu tiên đọc từ khối i18n bên trong chính sản phẩm
    if (prod.i18n && prod.i18n[lang] && prod.i18n[lang].description) {
        return prod.i18n[lang].description;
    }

    // 2. Fallback đọc theo Text ID từ từ điển chung
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const textId = prod.descTextId || prod.descriptionTextId;
    if (textId && trans && trans[lang] && trans[lang][textId]) {
        return trans[lang][textId];
    }
    return prod.description || "";
}

/**
 * Lấy hướng dẫn chăm sóc theo ngôn ngữ hiện tại
 */
function getProductCareTips(prod) {
    if (!prod) return "";
    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    if (prod.i18n && prod.i18n[lang] && prod.i18n[lang].careTips) {
        return prod.i18n[lang].careTips;
    }
    return prod.careTips || "";
}

/**
 * Lấy nhãn nổi bật (Badge) sản phẩm tự động dịch theo ngôn ngữ hiện tại
 */
function getProductBadge(prod) {
    if (!prod || !prod.badge) return "";
    const rawBadge = (prod.badge || "").trim();
    if (!rawBadge) return "";

    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[lang]) ? trans[lang] : {};

    const lower = rawBadge.toLowerCase();
    if (lower === "mới" || lower === "moi" || lower === "new") {
        return dict.badge_new || (lang === "en" ? "New" : (lang === "ja" ? "新着" : (lang === "ko" ? "신상품" : (lang === "zh" ? "新品" : "Mới"))));
    }
    if (lower === "bán chạy" || lower === "ban chay" || lower === "best seller") {
        return dict.badge_best_seller || (lang === "en" ? "Best Seller" : (lang === "ja" ? "人気" : (lang === "ko" ? "베스트" : (lang === "zh" ? "畅销" : "Bán chạy"))));
    }
    if (lower === "hot") {
        return dict.badge_hot || (lang === "en" ? "Hot" : (lang === "ja" ? "おすすめ" : (lang === "ko" ? "인기" : (lang === "zh" ? "热门" : "Hot"))));
    }
    if (lower === "mẫu mới" || lower === "mau moi" || lower === "new arrival") {
        return dict.badge_model_new || (lang === "en" ? "New Arrival" : (lang === "ja" ? "新着アイテム" : (lang === "ko" ? "신규 디자인" : (lang === "zh" ? "最新款式" : "Mẫu Mới"))));
    }
    if (lower.includes("độc bản") || lower.includes("vip") || lower.includes("exclusive")) {
        return dict.badge_vip || (lang === "en" ? "VIP Exclusive" : (lang === "ja" ? "VIP限定" : (lang === "ko" ? "VIP 독점" : (lang === "zh" ? "VIP尊享" : rawBadge))));
    }
    return rawBadge;
}

/**
 * 1. Hàm Render sản phẩm HTML (Tối ưu Lazy Loading & i18n)
 */
function renderProducts(products, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!Array.isArray(products) || products.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-8 text-center text-gray-400 text-sm">
                <i class="fa-solid fa-seedling text-2xl mb-2 text-pink-300"></i>
                <p>Danh mục này đang được cập nhật thêm các mẫu hoa mới.</p>
            </div>
        `;
        return;
    }

    let html = '';
    const lang = (typeof window !== 'undefined' && window.currentLang) ? window.currentLang : 'vi';
    const trans = (typeof window !== 'undefined' && window.translations) ? window.translations : translations;
    const btnText = (trans && trans[lang] && trans[lang].btn_add_to_cart) ? trans[lang].btn_add_to_cart : "Thêm giỏ hàng";

    products.forEach(product => {
        const origPrice = product.originalPrice || `${(product.priceNumber || 420000).toLocaleString()}₫`;
        const salePrice = product.salePrice || `${(product.priceNumber || 420000).toLocaleString()}₫`;
        const hasDiscount = origPrice !== salePrice;

        const displayBadge = getProductBadge(product);
        const badgeHtml = displayBadge
            ? `<span class="absolute top-2 left-2 bg-accent text-white text-xs font-bold px-2 py-1 rounded shadow-sm z-10">${displayBadge}</span>`
            : '';
        const priceHtml = hasDiscount
            ? `<span class="text-gray-400 line-through text-xs md:text-sm mr-2">${origPrice}</span>
               <span class="text-primary font-bold text-sm md:text-base">${salePrice}</span>`
            : `<span class="text-primary font-bold text-sm md:text-base">${salePrice}</span>`;

        const numericPrice = product.priceNumber || parseInt(salePrice.replace(/[^\d]/g, ''), 10) || 420000;
        const prodDisplayName = getProductName(product);
        const safeName = (prodDisplayName || product.name || "").replace(/'/g, "\\'");
        const prodId = product.id || `prod_${(product.name || 'hoa').toLowerCase().replace(/\s+/g, '_')}`;
        const prodImg = product.image || "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500";
        const nameTextId = product.nameTextId || product.textId || "";

        html += `
            <div class="product-card bg-white rounded-xl shadow-sm hover:shadow-xl transition duration-300 overflow-hidden flex flex-col group relative border border-gray-100">
                ${badgeHtml}
                <div onclick="openProductQuickDetail('${prodId}')" class="relative h-48 md:h-64 overflow-hidden cursor-pointer">
                    <img src="${prodImg}" alt="${prodDisplayName}" loading="lazy" decoding="async" onload="this.classList.add('loaded')" onerror="handleImageErrorFallback(this)" class="product-img w-full h-full object-cover group-hover:scale-105 transition duration-500">
                    
                    <!-- Nút Thêm vào giỏ hàng (Hiển thị khi hover) -->
                    <div class="absolute inset-0 bg-black/30 flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4" onclick="event.stopPropagation()">
                        <button onclick="addToCart('${prodId}', '${safeName}', ${numericPrice}, '${prodImg}')" class="bg-primary hover:bg-primaryHover text-white w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-md flex items-center justify-center">
                            <i class="fa-solid fa-cart-plus mr-1.5"></i> <span data-i18n="btn_add_to_cart">${btnText}</span>
                        </button>
                    </div>
                </div>
                <div class="p-4 flex flex-col flex-grow text-center">
                    <h3 onclick="openProductQuickDetail('${prodId}')" ${nameTextId ? `data-i18n="${nameTextId}"` : ''} class="font-bold text-gray-800 text-sm md:text-base mb-2 flex-grow hover:text-primary cursor-pointer line-clamp-2">${prodDisplayName}</h3>
                    <div class="mt-auto">
                        ${priceHtml}
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

let currentOpenDetailProductId = null;

/**
 * Đổ dữ liệu sản phẩm vào Modal Chi Tiết Nhanh
 */
function populateProductDetailModalContent(prod, currentAppLang, productId) {
    const modal = document.getElementById("productQuickDetailModal");
    const spinner = document.getElementById("detailLoadingSpinner");
    const body = document.getElementById("detailContentBody");
    if (!modal || !prod) return;

    const numericPrice = prod.priceNumber || parseInt((prod.salePrice || "420000").replace(/[^\d]/g, ''), 10) || 420000;
    const prodDisplayName = getProductName(prod);
    const prodCompText = getProductComposition(prod);
    const prodDescText = getProductDescription(prod);
    const prodCareTipsText = getProductCareTips(prod);
    const safeName = (prodDisplayName || prod.name || "").replace(/'/g, "\\'");
    const prodImg = prod.image || "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500";

    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[currentAppLang]) ? trans[currentAppLang] : {};

    // Cập nhật lại toàn bộ nhãn tĩnh đa ngôn ngữ trong modal
    modal.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            el.innerHTML = dict[key];
        }
    });

    // Điền thông tin vào modal
    const nameEl = document.getElementById("detailProdName");
    if (nameEl) {
        nameEl.textContent = prodDisplayName;
        if (prod.nameTextId) nameEl.setAttribute("data-i18n", prod.nameTextId);
        else nameEl.removeAttribute("data-i18n");
    }

    const badgeEl = document.getElementById("detailBadge");
    if (badgeEl) badgeEl.textContent = getProductBadge(prod) || dict.badge_model_new || dict.prod_badge_new || "Mẫu Mới";

    const salePriceEl = document.getElementById("detailSalePrice");
    if (salePriceEl) salePriceEl.textContent = prod.salePrice || `${numericPrice.toLocaleString()}₫`;

    const origPriceEl = document.getElementById("detailOrigPrice");
    if (origPriceEl) origPriceEl.textContent = prod.originalPrice && prod.originalPrice !== prod.salePrice ? prod.originalPrice : "";

    const catLabelEl = document.getElementById("detailCategoryLabel");
    if (catLabelEl) {
        const catObj = (activeStorefrontCategories || []).find(c => c && c.id === prod.category);
        catLabelEl.textContent = catObj ? getCategoryDisplayName(catObj).toUpperCase() : (prod.category ? prod.category.toUpperCase().replace("_", " ") : "HOA TƯƠI CAO CẤP");
    }

    const descEl = document.getElementById("detailDescription");
    if (descEl) {
        descEl.textContent = prodDescText || dict.prod_desc_fallback || "Mẫu hoa tươi thiết kế độc quyền tại Nở Hoa Thả Bình với sự kết hợp hài hòa giữa màu sắc và hương thơm.";
        if (prod.descTextId) descEl.setAttribute("data-i18n", prod.descTextId);
        else descEl.removeAttribute("data-i18n");
    }

    const compEl = document.getElementById("detailComposition");
    if (compEl) {
        compEl.textContent = prodCompText || dict.prod_comp_fallback || "Hoa tươi tự nhiên chọn lọc loại 1, giấy gói cao cấp chuẩn showroom.";
        if (prod.compTextId) compEl.setAttribute("data-i18n", prod.compTextId);
        else compEl.removeAttribute("data-i18n");
    }

    const dimEl = document.getElementById("detailDimension");
    if (dimEl) dimEl.textContent = prod.dimension || dict.prod_dim_standard || "Kích thước tiêu chuẩn";

    const careEl = document.getElementById("detailCareTips");
    if (careEl) careEl.textContent = prodCareTipsText || dict.prod_care_default || "Cắt vát gốc 45 độ, phun sương nhẹ cánh hoa và giữ nước sạch mỗi ngày.";

    const mainImgEl = document.getElementById("detailMainImg");
    if (mainImgEl) {
        if (mainImgEl.parentElement) mainImgEl.parentElement.classList.add('img-skeleton');
        mainImgEl.classList.remove('loaded');
        mainImgEl.src = prodImg;
        mainImgEl.alt = prodDisplayName;
    }

    // Gallery thumbnails (với Lazy loading và Skeleton preview)
    const galleryContainer = document.getElementById("detailGalleryThumbnails");
    if (galleryContainer) {
        const galleryList = Array.isArray(prod.gallery) && prod.gallery.length > 0 ? prod.gallery : [prodImg];
        let galHtml = '';
        galleryList.forEach(imgUrl => {
            galHtml += `
                <div onclick="const mImg=document.getElementById('detailMainImg'); if(mImg){mImg.parentElement?.classList.add('img-skeleton'); mImg.classList.remove('loaded'); mImg.src='${imgUrl}';}" class="w-12 h-12 rounded-lg overflow-hidden border-2 border-gray-200 cursor-pointer hover:border-primary flex-shrink-0 transition img-skeleton">
                    <img src="${imgUrl}" loading="lazy" decoding="async" onload="this.classList.add('loaded'); this.parentElement?.classList.remove('img-skeleton');" onerror="handleImageErrorFallback(this)" class="w-full h-full object-cover">
                </div>
            `;
        });
        galleryContainer.innerHTML = galHtml;
    }

    // Render Add-Ons (sản phẩm kèm theo) trong modal
    renderAddonsInModal(currentAppLang);

    // Gắn sự kiện nút Thêm Giỏ Hàng (kèm các add-on đã chọn)
    const btnAdd = document.getElementById("btnQuickAddToCart");
    if (btnAdd) {
        btnAdd.onclick = () => {
            if (typeof addToCart === "function") {
                addToCart(prod.id || productId, safeName, numericPrice, prodImg);
                // Thêm từng add-on đã chọn vào giỏ hàng
                const selected = getSelectedAddons();
                selected.forEach(addon => {
                    if (typeof addToCart === "function") {
                        addToCart(addon.id, getAddonName(addon, currentAppLang), addon.price, addon.image, "addon");
                    }
                });
                clearSelectedAddons();
            }
            closeProductQuickDetail();
        };
    }

    if (spinner) spinner.classList.add("hidden");
    if (body) body.classList.remove("hidden");
}

// ================= ADD-ONS (SẢN PHẨM KÈM THEO) =================
let cachedAddons = null;
let cachedAddonVisible = null; // null = chưa tải; true/false = cấu hình showAddons
let selectedAddons = new Map(); // addonId -> { addon, quantity }

/**
 * Kiểm tra cấu hình bật/tắt hiển thị khu vực add-on (config/anne/addonConfig.json).
 * Mặc định hiển thị nếu lỗi tải cấu hình.
 */
async function isAddonSectionEnabled(forceRefresh = false) {
    if (cachedAddonVisible !== null && !forceRefresh) return cachedAddonVisible;
    try {
        const res = await fetch(`${API_BASE}/addon-config`);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        const cfg = (data && data.data) ? data.data : data;
        cachedAddonVisible = cfg && typeof cfg.showAddons === "boolean" ? cfg.showAddons : true;
    } catch (err) {
        console.warn("[ADDONS] Lỗi tải addon-config, mặc định hiển thị:", err);
        cachedAddonVisible = true;
    }
    return cachedAddonVisible;
}

/**
 * Lấy danh sách add-ons đang hoạt động từ API (có cache)
 */
async function loadAddons(forceRefresh = false) {
    console.debug("[ADDONS] loadAddons() gọi, forceRefresh =", forceRefresh, "| cachedAddons =", cachedAddons);
    if (cachedAddons && !forceRefresh) {
        console.debug("[ADDONS] Dùng cache:", cachedAddons.length, "add-ons");
        return cachedAddons;
    }
    try {
        console.debug("[ADDONS] Fetch:", `${API_BASE}/addons`);
        const res = await fetch(`${API_BASE}/addons`);
        console.debug("[ADDONS] HTTP status:", res.status);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        // Endpoint trả về { success, data: [...] }
        cachedAddons = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : (data.addons || []));
        console.debug("[ADDONS] Đã parse:", cachedAddons.length, "add-ons");
        cachedAddons.forEach(a => console.debug("[ADDONS]   -", a.id, "| image:", a.image));
    } catch (err) {
        console.warn("[ADDONS] Lỗi tải add-ons:", err);
        cachedAddons = cachedAddons || [];
    }
    return cachedAddons;
}

/**
 * Lấy tên hiển thị add-on theo ngôn ngữ hiện tại
 */
function getAddonName(addon, lang) {
    if (!addon) return "";
    if (lang === "vi" && addon.nameVi) return addon.nameVi;
    return addon.name || addon.nameVi || "";
}

/**
 * Render danh sách add-ons vào #addonsList trong modal chi tiết sản phẩm
 */
async function renderAddonsInModal(currentAppLang) {
    const section = document.getElementById("addonsSection");
    const list = document.getElementById("addonsList");
    console.debug("[ADDONS] renderAddonsInModal() | section =", !!section, "| list =", !!list);
    if (!section || !list) return;

    // Kiểm tra cấu hình bật/tắt hiển thị add-on trước
    const enabled = await isAddonSectionEnabled();
    if (!enabled) {
        console.debug("[ADDONS] showAddons=false -> ẩn section theo cấu hình");
        section.classList.add("hidden");
        list.innerHTML = "";
        return;
    }

    const addons = await loadAddons();
    console.debug("[ADDONS] Số add-ons nhận được:", Array.isArray(addons) ? addons.length : "KHÔNG PHẢI MẢNG");
    if (!Array.isArray(addons) || addons.length === 0) {
        console.debug("[ADDONS] Không có add-ons -> ẩn section");
        section.classList.add("hidden");
        list.innerHTML = "";
        return;
    }

    section.classList.remove("hidden");
    let html = "";
    addons.forEach(addon => {
        const sel = selectedAddons.get(addon.id);
        const qty = sel ? sel.quantity : 0;
        const isSelected = qty > 0;
        const name = getAddonName(addon, currentAppLang);
        const price = (Number(addon.price) || 0).toLocaleString("vi-VN");
        const img = addon.image || "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=200";
        html += `
            <div data-addon-id="${addon.id}"
                 class="addon-card relative border-2 rounded-xl overflow-hidden cursor-pointer transition select-none flex-shrink-0 w-28 ${isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'}">
                <div class="relative" onclick="toggleAddonSelection('${addon.id}')">
                    <img src="${img}" alt="${name}" loading="lazy" decoding="async"
                         onload="this.classList.add('loaded')"
                         onerror="handleImageErrorFallback(this)"
                         class="w-full h-20 object-cover">
                    <div class="addon-check absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] ${isSelected ? 'bg-primary border-primary text-white' : 'bg-white border-gray-300 text-transparent'}">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </div>
                <div class="p-2">
                    <div class="text-[11px] font-bold text-gray-800 leading-tight line-clamp-2">${name}</div>
                    <div class="text-[11px] font-bold text-accent mt-0.5">${price}₫</div>
                    <div class="addon-qty-control mt-1.5 flex items-center justify-between ${isSelected ? '' : 'hidden'}">
                        <button type="button" onclick="event.stopPropagation(); changeAddonQty('${addon.id}', -1)" class="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center transition">−</button>
                        <span class="addon-qty text-xs font-bold text-gray-800">${qty}</span>
                        <button type="button" onclick="event.stopPropagation(); changeAddonQty('${addon.id}', 1)" class="w-6 h-6 rounded-full bg-primary hover:bg-primaryHover text-white font-bold text-sm flex items-center justify-center transition">+</button>
                    </div>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
    console.debug("[ADDONS] Đã render", addons.length, "thẻ add-on vào #addonsList");
    console.debug("[ADDONS] #addonsList innerHTML dài:", list.innerHTML.length, "ký tự");
    console.debug("[ADDONS] #addonsSection class:", section.className);

    // Cập nhật trạng thái bật/tắt nút prev/next theo độ tràn khung
    list.onscroll = updateAddonNavButtons;
    requestAnimationFrame(updateAddonNavButtons);
    setTimeout(updateAddonNavButtons, 120);
}

/**
 * Bật/tắt nút prev/next: chỉ bật khi danh sách add-on tràn khung (nhiều sản phẩm).
 */
function updateAddonNavButtons() {
    const list = document.getElementById("addonsList");
    const prevBtn = document.getElementById("addonPrevBtn");
    const nextBtn = document.getElementById("addonNextBtn");
    if (!list) return;
    const hasOverflow = list.scrollWidth > list.clientWidth + 4;
    const atStart = list.scrollLeft <= 2;
    const atEnd = list.scrollLeft + list.clientWidth >= list.scrollWidth - 2;
    if (prevBtn) prevBtn.disabled = !hasOverflow || atStart;
    if (nextBtn) nextBtn.disabled = !hasOverflow || atEnd;
}

/**
 * Cuộn ngang danh sách add-ons (prev/next)
 */
function scrollAddons(direction) {
    const list = document.getElementById("addonsList");
    if (!list) return;
    const cardWidth = 112 + 8; // w-28 (112px) + gap-2 (8px)
    list.scrollBy({ left: direction * cardWidth * 2, behavior: "smooth" });
    setTimeout(updateAddonNavButtons, 350);
}

/**
 * Chọn / bỏ chọn một add-on (bấm vào thẻ)
 */
function toggleAddonSelection(addonId) {
    const addon = (cachedAddons || []).find(a => a && a.id === addonId);
    if (!addon) return;
    if (selectedAddons.has(addonId)) {
        selectedAddons.delete(addonId);
    } else {
        selectedAddons.set(addonId, { addon, quantity: 1 });
    }
    updateAddonCardUI(addonId);
}

/**
 * Tăng / giảm số lượng add-on
 */
function changeAddonQty(addonId, delta) {
    const addon = (cachedAddons || []).find(a => a && a.id === addonId);
    if (!addon) return;
    const sel = selectedAddons.get(addonId);
    const newQty = (sel ? sel.quantity : 0) + delta;
    if (newQty <= 0) {
        selectedAddons.delete(addonId);
    } else {
        selectedAddons.set(addonId, { addon, quantity: newQty });
    }
    updateAddonCardUI(addonId);
}

/**
 * Cập nhật giao diện của một thẻ add-on theo trạng thái chọn hiện tại
 */
function updateAddonCardUI(addonId) {
    const card = document.querySelector(`[data-addon-id="${addonId}"]`);
    if (!card) return;
    const sel = selectedAddons.get(addonId);
    const isSelected = !!sel && sel.quantity > 0;
    const qty = sel ? sel.quantity : 0;

    card.classList.toggle("border-primary", isSelected);
    card.classList.toggle("bg-primary/5", isSelected);
    card.classList.toggle("border-gray-200", !isSelected);
    card.classList.toggle("hover:border-primary/50", !isSelected);

    const check = card.querySelector(".addon-check");
    if (check) {
        check.classList.toggle("bg-primary", isSelected);
        check.classList.toggle("border-primary", isSelected);
        check.classList.toggle("text-white", isSelected);
        check.classList.toggle("bg-white", !isSelected);
        check.classList.toggle("border-gray-300", !isSelected);
        check.classList.toggle("text-transparent", !isSelected);
    }

    const qtyControl = card.querySelector(".addon-qty-control");
    const qtyEl = card.querySelector(".addon-qty");
    if (qtyControl) qtyControl.classList.toggle("hidden", !isSelected);
    if (qtyEl) qtyEl.textContent = qty;
}

/**
 * Lấy danh sách add-ons đã chọn (mỗi add-on lặp theo số lượng)
 */
function getSelectedAddons() {
    const result = [];
    selectedAddons.forEach(({ addon, quantity }) => {
        for (let i = 0; i < quantity; i++) {
            result.push(addon);
        }
    });
    return result;
}

/**
 * Xóa toàn bộ add-ons đã chọn (sau khi thêm vào giỏ)
 */
function clearSelectedAddons() {
    selectedAddons.clear();
    const list = document.getElementById("addonsList");
    if (list) {
        list.querySelectorAll(".addon-card").forEach(card => {
            card.classList.remove("border-primary", "bg-primary/5");
            card.classList.add("border-gray-200", "hover:border-primary/50");
            const check = card.querySelector(".addon-check");
            if (check) {
                check.classList.remove("bg-primary", "border-primary", "text-white");
                check.classList.add("bg-white", "border-gray-300", "text-transparent");
            }
            const qtyControl = card.querySelector(".addon-qty-control");
            if (qtyControl) qtyControl.classList.add("hidden");
        });
    }
}

/**
 * Mở Modal Xem Chi Tiết Sản Phẩm (Mở tức thì 0ms qua Optimistic Cache + Lazy Load on-demand)
 */
async function openProductQuickDetail(productId) {
    currentOpenDetailProductId = productId;
    const modal = document.getElementById("productQuickDetailModal");
    const spinner = document.getElementById("detailLoadingSpinner");
    const body = document.getElementById("detailContentBody");
    if (!modal) return;

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    const currentAppLang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";

    // 1. Optimistic Render: Kiểm tra cache RAM có sẵn từ danh mục sản phẩm
    let cachedProd = null;
    if (Array.isArray(allStorefrontProducts) && allStorefrontProducts.length > 0) {
        cachedProd = allStorefrontProducts.find(p => p && (p.id === productId || p.name === productId));
    }

    if (cachedProd) {
        // Hiển thị ngay lập tức 0ms không để khách hàng phải chờ spinner
        populateProductDetailModalContent(cachedProd, currentAppLang, productId);
    } else {
        if (spinner) {
            spinner.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin text-primary text-3xl"></i>
                <span class="text-xs text-gray-400 font-medium">Đang tải chi tiết & album ảnh...</span>
            `;
            spinner.classList.remove("hidden");
        }
        if (body) body.classList.add("hidden");
    }

    // 2. Tải thêm chi tiết đầy đủ ngầm qua API (album gallery, thành phần chi tiết, tồn kho)
    try {
        const fullProd = await getProductById(productId, currentAppLang);
        if (fullProd && currentOpenDetailProductId === productId) {
            populateProductDetailModalContent(fullProd, currentAppLang, productId);
        }
    } catch (err) {
        console.warn("Lỗi đồng bộ chi tiết sản phẩm:", err);
    }
}

function closeProductQuickDetail() {
    const modal = document.getElementById("productQuickDetailModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

/**
 * Cuộn mượt mà tới section danh mục tương ứng
 * @param {string} categoryId - Mã danh mục (VD: 'gio_hoa', 'bo_hoa', 'ke_hoa', 'binh_hoa', 'lan_ho_diep', 'hoa_cuoi')
 */
function scrollToCategory(categoryId) {
    if (!categoryId) return;
    const targetId = categoryId.startsWith('cat-') ? categoryId : `cat-${categoryId}`;
    const sec = document.getElementById(targetId) || document.getElementById(categoryId);
    if (sec) {
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

if (typeof window !== 'undefined') {
    window.scrollToCategory = scrollToCategory;
    window.filterStorefrontCategory = scrollToCategory;
}

/**
 * Tự động đổ danh mục vào tất cả các thẻ select dropdown trên giao diện (Không hardcode)
 */
function populateCategoryDropdowns(categories) {
    if (!Array.isArray(categories)) return;
    const activeCats = categories.filter(c => c && c.isActive !== false && c.status !== 'inactive' && !c.isDeleted);
    activeCats.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));

    // 1. Dropdown bộ lọc sản phẩm trong Admin Portal
    const filterSelect = document.getElementById('filterProductCategory');
    if (filterSelect) {
        const currentVal = filterSelect.value;
        let optHtml = `<option value="">Tất cả danh mục (${activeCats.length})</option>`;
        activeCats.forEach(c => {
            optHtml += `<option value="${c.id}">${c.name}</option>`;
        });
        filterSelect.innerHTML = optHtml;
        if (currentVal) filterSelect.value = currentVal;
    }

    // 2. Dropdown chọn danh mục trong Form Tạo/Sửa Sản phẩm
    const formSelect = document.getElementById('prodCategory');
    if (formSelect) {
        const currentVal = formSelect.value;
        let optHtml = '<option value="">-- Chọn danh mục hoa --</option>';
        activeCats.forEach(c => {
            optHtml += `<option value="${c.id}">${c.name} (${c.id})</option>`;
        });
        formSelect.innerHTML = optHtml;
        if (currentVal) formSelect.value = currentVal;
    }
}

/**
 * Lấy tên hiển thị danh mục theo ngôn ngữ hiện tại:
 * - Nếu textId tồn tại và có bản dịch: trả về bản dịch theo ngôn ngữ hiện tại
 * - Nếu không có textId: fallback về cat.name (không bao giờ set cat.name khi có textId)
 */
function getCategoryDisplayName(cat) {
    if (!cat) return "";
    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    
    if (cat.textId && trans && trans[lang] && trans[lang][cat.textId]) {
        return trans[lang][cat.textId];
    }
    return cat.name || "";
}

/**
 * Lấy mô tả hiển thị danh mục theo ngôn ngữ hiện tại:
 * - Ưu tiên 1: cat.i18n?.[lang]?.description
 * - Ưu tiên 2: trans[lang][descTextId]
 * - Fallback: cat.description
 */
function getCategoryDescription(cat) {
    if (!cat) return "";
    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});

    if (cat.i18n && cat.i18n[lang] && cat.i18n[lang].description) {
        return cat.i18n[lang].description;
    }

    const descTextId = cat.descTextId || cat.descriptionTextId;
    if (descTextId && trans && trans[lang] && trans[lang][descTextId]) {
        return trans[lang][descTextId];
    }

    return cat.description || "";
}

/**
 * TỰ ĐỘNG TẠO TOÀN BỘ CÁC SECTION DANH MỤC & PRODUCT GRIDS TRÊN STOREFRONT
 * Thay thế hoàn toàn mã HTML tĩnh / hardcoded
 */
function renderDynamicStorefrontSections(categories, products) {
    const container = document.getElementById('dynamicCategorySections');
    if (!container || !Array.isArray(categories)) return;

    const activeCats = categories.filter(c => 
        c && 
        c.isActive !== false && 
        c.isActive !== 'false' && 
        c.status !== 'inactive' && 
        c.status !== 'deleted' && 
        !c.isDeleted
    );
    activeCats.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));

    const allProds = Array.isArray(products) ? products : [];
    let html = '';
    let promoBannerRendered = false;

    // Lấy từ điển đa ngôn ngữ cho Banner Khuyến Mãi
    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[lang]) ? trans[lang] : {};

    const promoTitle = dict.banner_promo_title || "Kệ Hoa Chúc Mừng & Khai Trương";
    const promoDesc = dict.banner_promo_desc || "Mang thịnh vượng, tài lộc đến đối tác và bạn bè";
    const promoBtn = dict.banner_promo_btn || "Khám Phá Kệ Hoa";

    activeCats.forEach((cat, index) => {
        const isEven = index % 2 === 0;
        const bgClass = cat.id === 'hoa_cuoi' 
            ? 'bg-pink-50/40 border-t border-pink-100' 
            : (isEven ? 'bg-white' : 'bg-gray-50');

        const catDisplayName = getCategoryDisplayName(cat);
        const catDesc = getCategoryDescription(cat);
        const descDataAttr = cat.descTextId ? `data-i18n="${cat.descTextId}"` : '';

        // Section Danh mục Động
        html += `
            <section id="cat-${cat.id}" class="py-12 md:py-16 ${bgClass} scroll-mt-20">
                <div class="container mx-auto max-w-7xl px-4">
                    <div class="text-center mb-8">
                        <h2 class="font-serif text-3xl md:text-4xl font-bold text-gray-900 inline-block relative pb-3" ${cat.textId ? `data-i18n="${cat.textId}"` : ''}>
                            ${catDisplayName}
                            <div class="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-primary rounded"></div>
                        </h2>
                        ${catDesc ? `<p class="text-gray-500 mt-3 text-sm md:text-base max-w-2xl mx-auto" ${descDataAttr}>${catDesc}</p>` : ''}
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6" id="dyn-grid-${cat.id}">
                        <!-- Products rendered dynamically -->
                    </div>
                </div>
            </section>
        `;

        // Chèn Promo Banner ở vị trí hài hòa duy nhất 1 lần (sau danh mục thứ 2 hoặc sau danh mục đầu tiên nếu chỉ có 1 danh mục)
        const shouldInsertBanner = !promoBannerRendered && (index === 1 || (index === 0 && activeCats.length === 1));
        if (shouldInsertBanner) {
            promoBannerRendered = true;
            html += `
                <section class="py-8 bg-white">
                    <div class="container mx-auto max-w-7xl px-4">
                        <div class="relative rounded-2xl overflow-hidden h-48 md:h-60 shadow-md group img-skeleton">
                            <img src="https://images.unsplash.com/photo-1561181286-d3fee7d55364?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
                                alt="Banner Hoa Chúc Mừng" loading="lazy" decoding="async" onload="this.classList.add('loaded'); this.parentElement.classList.remove('img-skeleton');"
                                class="w-full h-full object-cover group-hover:scale-105 transition duration-700">
                            <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <div class="text-center text-white p-4">
                                    <h3 class="font-serif text-2xl md:text-4xl font-bold mb-2 shadow-sm" data-i18n="banner_promo_title">${promoTitle}</h3>
                                    <p class="mb-4 text-sm md:text-base hidden md:block" data-i18n="banner_promo_desc">${promoDesc}</p>
                                    <a href="#cat-ke_hoa" onclick="scrollToCategory('ke_hoa'); return false;"
                                        class="bg-white text-gray-900 hover:bg-primary hover:text-white px-6 py-2 rounded-full font-bold text-sm transition inline-block shadow-md">
                                        <span data-i18n="banner_promo_btn">${promoBtn}</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            `;
        }
    });

    container.innerHTML = html;

    // Render sản phẩm vào từng Grid danh mục vừa tạo
    activeCats.forEach(cat => {
        const catProds = allProds.filter(p => p && p.category === cat.id && p.isActive !== false);
        renderProducts(catProds, `dyn-grid-${cat.id}`);
    });
}

/**
 * Hiển thị thông báo khi không thể tải danh sách sản phẩm
 */
function renderStorefrontLoadError(container) {
    if (!container) return;
    container.innerHTML = `
        <div class="py-12 text-center text-gray-500">
            <p class="text-sm font-medium" data-i18n="load_products_error">Không thể tải danh sách sản phẩm. Vui lòng kiểm tra lại kết nối mạng.</p>
            <button type="button" onclick="retryLoadStorefrontProducts()" class="mt-4 px-5 py-2 bg-primary hover:bg-primaryHover text-white text-xs font-bold rounded-full transition shadow-sm">
                Thử lại
            </button>
        </div>
    `;
}

/**
 * Thử lại nạp sản phẩm cho trang chủ
 */
async function retryLoadStorefrontProducts() {
    await renderAllProducts();
}

/**
 * Render toàn bộ danh mục sản phẩm từ API Backend vào từng Section
 * Tự động nạp êm đềm (silent/graceful loading), không hiển thị cảnh báo lỗi làm hoang mang người dùng
 */
async function renderAllProducts() {
    const container = document.getElementById('dynamicCategorySections');

    try {
        const [prods, cats] = await Promise.all([
            getProducts(true),
            getCategories(true)
        ]);

        if (Array.isArray(cats) && cats.length > 0) {
            activeStorefrontCategories = cats;
            populateCategoryDropdowns(cats);
        } else if (typeof window !== 'undefined' && window.default_categories) {
            activeStorefrontCategories = window.default_categories;
        }

        if (Array.isArray(prods) && prods.length > 0) {
            allStorefrontProducts = prods;
        } else if (typeof window !== 'undefined' && window.default_products) {
            allStorefrontProducts = window.default_products;
        }

        if (allStorefrontProducts && allStorefrontProducts.length > 0 && container) {
            renderDynamicStorefrontSections(activeStorefrontCategories, allStorefrontProducts);
        }
    } catch (e) {
        console.warn("Nạp dữ liệu sản phẩm:", e);
        if (typeof window !== 'undefined' && window.default_products && container) {
            allStorefrontProducts = window.default_products;
            renderDynamicStorefrontSections(activeStorefrontCategories, allStorefrontProducts);
        }
    }
}


/**
 * Chuẩn hóa chuỗi tiếng Việt: loại bỏ dấu thanh, dấu mũ, chuyển đ/Đ -> d để tìm kiếm không dấu
 */
function removeVietnameseTones(str) {
    if (!str) return '';
    return str
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .trim();
}

let _searchDebounceTimer = null;

/**
 * Ẩn/Hiện nút xóa tìm kiếm (dấu X) trên thanh tìm kiếm Desktop và Mobile
 */
function updateSearchClearButtonVisibility(query) {
    if (typeof document === 'undefined') return;
    const hasText = Boolean(query && query.toString().trim().length > 0);
    const deskClearBtn = document.getElementById('storefrontSearchClearBtn');
    const mobClearBtn = document.getElementById('storefrontSearchMobileClearBtn');

    if (deskClearBtn) {
        if (hasText) {
            deskClearBtn.classList.remove('hidden');
            deskClearBtn.classList.add('flex');
        } else {
            deskClearBtn.classList.add('hidden');
            deskClearBtn.classList.remove('flex');
        }
    }

    if (mobClearBtn) {
        if (hasText) {
            mobClearBtn.classList.remove('hidden');
            mobClearBtn.classList.add('flex');
        } else {
            mobClearBtn.classList.add('hidden');
            mobClearBtn.classList.remove('flex');
        }
    }
}

/**
 * Tìm kiếm có Debounce (trì hoãn ~120ms) giúp tối ưu hiệu năng và tránh giật lag UI khi gõ nhanh
 * Tự động scroll mượt mà xuống phần kết quả tìm kiếm giống như khi bấm tab danh mục hoa
 */
function debouncedSearchStorefrontProducts(query, updateUrl = true, delay = 120, autoScroll = true) {
    updateSearchClearButtonVisibility(query);
    if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = setTimeout(() => {
        searchStorefrontProducts(query, updateUrl, autoScroll);
    }, delay);
}

/**
 * Đóng tất cả bảng kết quả tìm kiếm trực tiếp (Desktop & Mobile)
 */
function closeLiveSearchResults() {
    if (typeof document === 'undefined') return;
    const desktopResults = document.getElementById('desktopLiveSearchResults');
    const mobileResults = document.getElementById('mobileLiveSearchResults');
    if (desktopResults) desktopResults.classList.add('hidden');
    if (mobileResults) mobileResults.classList.add('hidden');
}

/**
 * Render bảng kết quả tìm kiếm ngay dưới thanh tìm kiếm (Hỗ trợ cả PC Desktop & Mobile)
 */
function renderLiveSearchResults(matchedProds = [], rawQuery = '') {
    if (typeof document === 'undefined') return;
    const desktopResults = document.getElementById('desktopLiveSearchResults');
    const mobileResults = document.getElementById('mobileLiveSearchResults');

    const containers = [
        { el: desktopResults, isDesktop: true },
        { el: mobileResults, isDesktop: false }
    ];

    if (!rawQuery || !rawQuery.trim()) {
        containers.forEach(({ el }) => {
            if (el) {
                el.classList.add('hidden');
                el.innerHTML = '';
            }
        });
        return;
    }

    containers.forEach(({ el, isDesktop }) => {
        if (!el) return;

        if (matchedProds.length === 0) {
            el.innerHTML = `
                <div class="py-5 px-3 text-center">
                    <div class="w-10 h-10 bg-pink-50 text-pink-400 rounded-full flex items-center justify-center text-base mx-auto mb-2 shadow-inner">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </div>
                    <p class="text-xs font-bold text-gray-800">Không tìm thấy mẫu hoa nào khớp với "${rawQuery}"</p>
                    <p class="text-[11px] text-gray-500 mt-1">Gợi ý: <i>Hoa hồng, Lan hồ điệp, Tulip, Khai trương...</i></p>
                </div>
            `;
            el.classList.remove('hidden');
            return;
        }

        let itemsHtml = `
            <div class="flex items-center justify-between pb-2.5 mb-2.5 border-b border-gray-100 px-1">
                <span class="text-xs font-bold text-gray-600">
                    Tìm thấy <b class="text-primary font-bold">${matchedProds.length}</b> mẫu hoa
                </span>
                <button type="button" onclick="closeLiveSearchResults()" class="text-gray-400 hover:text-gray-600 p-1 text-xs font-bold flex items-center gap-1 cursor-pointer">
                    <i class="fa-solid fa-xmark"></i> Đóng
                </button>
            </div>
            <div class="space-y-2 max-h-[50vh] overflow-y-auto pr-1 divide-y divide-gray-50">
        `;

        matchedProds.forEach(prod => {
            const priceFmt = (prod.priceNumber || 0).toLocaleString('vi-VN') + '₫';
            const imgUrl = prod.image || 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=500&q=80';
            itemsHtml += `
                <div class="flex items-center gap-3 pt-2 first:pt-0 p-2 rounded-xl hover:bg-pink-50/60 transition cursor-pointer border border-transparent hover:border-pink-100 group"
                     onclick="openProductQuickDetail('${prod.id}'); closeLiveSearchResults();">
                    <img src="${imgUrl}" alt="${prod.name}" class="w-12 h-12 md:w-13 md:h-13 object-cover rounded-lg flex-shrink-0 shadow-xs group-hover:scale-105 transition">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-xs md:text-sm font-bold text-gray-800 truncate group-hover:text-primary transition">${prod.name}</h4>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span class="text-xs md:text-sm font-bold text-primary">${priceFmt}</span>
                            ${prod.badge ? `<span class="text-[9px] bg-pink-100 text-pink-700 px-1.5 py-0.2 rounded font-semibold">${getProductBadge(prod)}</span>` : ''}
                        </div>
                    </div>
                    <button type="button" onclick="event.stopPropagation(); addToCart('${prod.id}'); closeLiveSearchResults();" 
                            title="Thêm vào giỏ hàng"
                            class="w-8 h-8 bg-primary hover:bg-primaryHover text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 shadow-xs cursor-pointer hover:scale-110 transition">
                        <i class="fa-solid fa-bag-shopping text-xs"></i>
                    </button>
                </div>
            `;
        });

        itemsHtml += `
            </div>
            <div class="pt-2.5 mt-2.5 border-t border-gray-100 text-center">
                <button type="button" onclick="closeLiveSearchResults(); document.getElementById('search-results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });"
                        class="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1.5 cursor-pointer">
                    Xem toàn bộ kết quả dạng lưới bên dưới <i class="fa-solid fa-arrow-down text-xs"></i>
                </button>
            </div>
        `;

        el.innerHTML = itemsHtml;
        el.classList.remove('hidden');
    });
}

const renderMobileSearchResults = renderLiveSearchResults;

/**
 * Tìm kiếm sản phẩm theo tên / mô tả / thành phần trên Storefront
 * Hỗ trợ tìm kiếm cả tiếng Việt CÓ DẤU và KHÔNG DẤU (vd: 'hoa hong' -> khớp 'Hoa hồng')
 * Hỗ trợ đồng bộ Hash URL dạng: /#/search?q=tên_hoa
 * Hiển thị bảng kết quả trực tiếp ngay dưới thanh tìm kiếm trên cả PC (Desktop) và Mobile
 */
function searchStorefrontProducts(query, updateUrl = true, autoScroll = false) {
    const rawQuery = (query || '').trim();
    const q = rawQuery.toLowerCase();
    const normQ = removeVietnameseTones(rawQuery);
    const container = document.getElementById('dynamicCategorySections');
    if (!container) return;

    // Cập nhật trạng thái hiển thị nút xóa (dấu X)
    updateSearchClearButtonVisibility(query);

    // Đồng bộ giá trị 2 input desktop & mobile
    const desktopInput = document.getElementById('storefrontSearchInput');
    const mobileInput = document.getElementById('storefrontSearchMobileInput');
    if (desktopInput && desktopInput.value !== query) desktopInput.value = query;
    if (mobileInput && mobileInput.value !== query) mobileInput.value = query;

    // Cập nhật URL trình duyệt sang dạng Hash: /#/search?q=...
    if (updateUrl && typeof window !== 'undefined') {
        if (rawQuery) {
            const targetHash = `#/search?q=${encodeURIComponent(rawQuery)}`;
            if (window.location.hash !== targetHash) {
                window.location.hash = `/search?q=${encodeURIComponent(rawQuery)}`;
            }
        } else {
            if (window.location.hash.includes('search') || window.location.hash.includes('q=')) {
                window.history.pushState(null, '', window.location.pathname);
            }
        }
    }

    if (!q) {
        renderLiveSearchResults([], '');
        renderDynamicStorefrontSections(activeStorefrontCategories, allStorefrontProducts);
        return;
    }

    const matchedProds = allStorefrontProducts.filter(p => {
        if (!p || p.isActive === false) return false;
        const name = (p.name || '').toLowerCase();
        const id = (p.id || '').toLowerCase();
        const comp = (p.flowerComposition || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();

        const normName = removeVietnameseTones(name);
        const normComp = removeVietnameseTones(comp);
        const normDesc = removeVietnameseTones(desc);

        return normName.includes(normQ) || id.includes(q) || normComp.includes(normQ) || normDesc.includes(normQ);
    });

    // 1. Hiển thị bảng kết quả trực tiếp ngay bên dưới thanh tìm kiếm (cả PC và Mobile)
    renderLiveSearchResults(matchedProds, rawQuery);

    let html = `
        <section class="py-12 bg-white min-h-[50vh] scroll-mt-20" id="search-results-section">
            <div class="container mx-auto max-w-7xl px-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-gray-100 pb-4">
                    <div>
                        <h2 class="font-serif text-2xl md:text-3xl font-bold text-gray-900">
                            Kết quả tìm kiếm cho: <span class="text-primary font-sans italic">"${rawQuery}"</span>
                        </h2>
                        <p class="text-gray-500 text-xs sm:text-sm mt-1">Tìm thấy <b class="text-primary font-bold">${matchedProds.length}</b> mẫu hoa tươi phù hợp</p>
                    </div>
                    <button onclick="clearStorefrontSearch()" class="text-xs font-bold text-gray-600 hover:text-primary transition flex items-center gap-1.5 self-start sm:self-auto bg-gray-50 hover:bg-pink-50 px-4 py-2 rounded-full border border-gray-200 shadow-2xs cursor-pointer">
                        <i class="fa-solid fa-xmark text-sm"></i> Xóa tìm kiếm & Xem tất cả
                    </button>
                </div>
    `;

    if (matchedProds.length === 0) {
        html += `
                <div class="py-16 text-center">
                    <div class="w-20 h-20 bg-pink-50 text-pink-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </div>
                    <h3 class="text-lg font-bold text-gray-800 mb-1">Không tìm thấy mẫu hoa nào khớp với "${rawQuery}"</h3>
                    <p class="text-gray-500 text-xs sm:text-sm max-w-md mx-auto mb-6">Hãy thử tìm kiếm với các từ khóa phổ biến như: <i>Hoa hồng, Lan hồ điệp, Tulip, Khai trương, Bình cắm hoa...</i></p>
                    <button onclick="clearStorefrontSearch()" class="px-6 py-2.5 bg-primary hover:bg-primaryHover text-white text-xs sm:text-sm font-bold rounded-full shadow-md transition inline-flex items-center">
                        <i class="fa-solid fa-house mr-2"></i> Quay lại Tất Cả Danh Mục
                    </button>
                </div>
            </div>
        </section>
        `;
        container.innerHTML = html;
    } else {
        html += `
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6" id="search-results-grid">
                    <!-- Sẽ render sản phẩm tìm kiếm vào đây -->
                </div>
            </div>
        </section>
        `;
        container.innerHTML = html;
        renderProducts(matchedProds, 'search-results-grid');
    }

    // Trên Desktop (máy tính): Tự động cuộn mượt mà tới phần danh sách kết quả
    if (autoScroll && !isMobileView && typeof document !== 'undefined') {
        const searchSec = document.getElementById('search-results-section') || container;
        if (searchSec && typeof searchSec.scrollIntoView === 'function') {
            searchSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

/**
 * Xóa bộ lọc tìm kiếm và đưa Storefront về trang chủ
 */
function clearStorefrontSearch(updateUrl = true) {
    const desktopInput = document.getElementById('storefrontSearchInput');
    const mobileInput = document.getElementById('storefrontSearchMobileInput');
    if (desktopInput) desktopInput.value = '';
    if (mobileInput) mobileInput.value = '';

    updateSearchClearButtonVisibility('');
    renderMobileSearchResults([], '');

    if (updateUrl && typeof window !== 'undefined') {
        window.history.pushState(null, '', window.location.pathname);
    }

    renderDynamicStorefrontSections(activeStorefrontCategories, allStorefrontProducts);

    const container = document.getElementById('dynamicCategorySections');
    if (container && typeof container.scrollIntoView === 'function') {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * 2. Logic Menu Mobile
 */
function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuContent = document.getElementById('mobileMenuContent');

    if (mobileMenuBtn && mobileMenu && mobileMenuContent) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.remove('hidden');
            setTimeout(() => {
                mobileMenuContent.classList.remove('-translate-x-full');
            }, 10);
        });
    }

    if (typeof window !== 'undefined') {
        window.closeMenu = function() {
            if (mobileMenuContent) mobileMenuContent.classList.add('-translate-x-full');
            setTimeout(() => {
                if (mobileMenu) mobileMenu.classList.add('hidden');
            }, 300);
        };
    }

    if (closeMenuBtn) closeMenuBtn.addEventListener('click', window.closeMenu);
    if (mobileMenu) {
        mobileMenu.addEventListener('click', (e) => {
            if (e.target === mobileMenu && typeof window.closeMenu === 'function') window.closeMenu();
        });
    }
}

/**
 * Render danh mục nhanh trên Storefront & Navigation từ API /api/categories
 */
async function renderStorefrontCategories() {
    const container = document.getElementById('storefrontQuickCategories');
    const desktopDynamicNav = document.getElementById('dynamicNavItems');
    const mobileDynamicNav = document.getElementById('mobileDynamicNavItems');

    try {
        const catsList = await getCategories(true);
        if (!Array.isArray(catsList) || catsList.length === 0) return;

        const activeCats = catsList.filter(c => 
            c && 
            c.isActive !== false && 
            c.isActive !== 'false' && 
            c.status !== 'inactive' && 
            c.status !== 'deleted' && 
            !c.isDeleted
        );
        activeCats.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
        activeStorefrontCategories = activeCats;

        // 1. Quick Category Circles trên Storefront
        if (container) {
            let html = '';
            activeCats.forEach((cat) => {
                const fallbackImg = "https://images.unsplash.com/photo-1591886960571-74d43a9d4166?w=200";
                const img = cat.image || fallbackImg;
                const catDisplayName = getCategoryDisplayName(cat);
                html += `
                    <div onclick="scrollToCategory('${cat.id}')" class="flex flex-col items-center group cursor-pointer w-24 md:w-32 transition transform hover:-translate-y-1">
                        <div class="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-pink-100 group-hover:border-primary transition p-1 shadow-sm bg-white">
                            <img src="${img}" alt="${catDisplayName}" loading="lazy" decoding="async" onload="this.classList.add('loaded')" class="product-img w-full h-full object-cover rounded-full">
                        </div>
                        <span ${cat.textId ? `data-i18n="${cat.textId}"` : ''} class="mt-2.5 font-bold text-gray-800 group-hover:text-primary transition text-xs md:text-sm text-center line-clamp-1">${catDisplayName}</span>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        // 2. Desktop Header Navigation (Các Tab Danh Mục trên Header)
        if (desktopDynamicNav) {
            let navHtml = '';
            activeCats.forEach((cat) => {
                const catDisplayName = getCategoryDisplayName(cat);
                navHtml += `
                    <a href="#cat-${cat.id}" ${cat.textId ? `data-i18n="${cat.textId}"` : ''} onclick="scrollToCategory('${cat.id}'); return false;" class="hover:text-primary transition whitespace-nowrap text-sm font-bold text-gray-700 uppercase tracking-wide">${catDisplayName}</a>
                `;
            });
            desktopDynamicNav.innerHTML = navHtml;
        }

        // 3. Mobile Menu Navigation (Các Tab Danh Mục trên Mobile)
        if (mobileDynamicNav) {
            let mobHtml = '';
            activeCats.forEach((cat) => {
                const catDisplayName = getCategoryDisplayName(cat);
                mobHtml += `
                    <li><a href="#cat-${cat.id}" ${cat.textId ? `data-i18n="${cat.textId}"` : ''} onclick="scrollToCategory('${cat.id}'); if(typeof closeMenu==='function')closeMenu(); return false;" class="block">${catDisplayName}</a></li>
                `;
            });
            mobileDynamicNav.innerHTML = mobHtml;
        }

        // 4. Populate các select dropdowns
        populateCategoryDropdowns(catsList);
    } catch (e) {
        console.warn("Lỗi nạp danh mục:", e);
    }
}

/**
 * 3. Đồng bộ thông tin thương hiệu & liên hệ doanh nghiệp (infoCompany.json) lên Storefront
 */
function applyStorefrontCompanyInfo(info) {
    if (!info || typeof document === 'undefined') return;
    if (typeof window !== 'undefined') window.currentCompanyInfo = info;

    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    const setHref = (id, href) => {
        const el = document.getElementById(id);
        if (el && href) el.setAttribute('href', href);
    };

    if (info.address) {
        setText('footerAddress', info.address);
        setText('storeAddressVal', info.address);
    }

    if (info.phone || info.hotline) {
        const phone = info.hotline || info.phone;
        const cleanPhone = phone.replace(/[^\d+]/g, '');

        // 1. Cập nhật Hotline trên Top Header Bar
        setText('topHeaderHotlineVal', phone);
        setHref('topHeaderHotlineLink', `tel:${cleanPhone}`);

        // 2. Cập nhật Footer, Store Locator & Floating Buttons
        setText('footerPhone', phone);
        setHref('footerPhone', `tel:${cleanPhone}`);
        setText('storeHotlineLink', phone);
        setHref('storeHotlineLink', `tel:${cleanPhone}`);
        setHref('floatingHotlineLink', `tel:${cleanPhone}`);
        setText('floatingHotlineText', phone);
    }

    if (info.email) {
        setText('topHeaderEmailVal', info.email);
        setHref('topHeaderEmailLink', `mailto:${info.email}`);
        setText('footerEmail', info.email);
        setHref('footerEmail', `mailto:${info.email}`);
    }

    if (info.workingHours) {
        setText('footerHours', info.workingHours);
        setText('storeHoursVal', info.workingHours);
    }

    if (info.companyName) {
        const yr = new Date().getFullYear();
        setText('footerCopyright', `© ${yr} Bản quyền thuộc về ${info.companyName}.`);
    }

    if (info.zalo) {
        setHref('floatingZaloLink', info.zalo);
    }

    if (info.mapUrl) {
        setHref('storeDirectionsLink', info.mapUrl);
        setHref('storeLargerMapLink', info.mapUrl);
    }

    if (info.mapEmbedUrl) {
        const iframe = document.getElementById('storeMapIframe');
        if (iframe && info.mapEmbedUrl) {
            iframe.src = info.mapEmbedUrl;
        }
    }
}

async function loadStorefrontCompanyInfo() {
    try {
        const res = await fetch(`${API_BASE}/company-info?_t=${Date.now()}`);
        if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
                applyStorefrontCompanyInfo(json.data);
                return;
            }
        }
    } catch (e) {
        // Thử fallback trực tiếp từ file JSON tĩnh
    }

    try {
        const fallbackRes = await fetch(`config/anne/infoCompany.json?_t=${Date.now()}`);
        if (fallbackRes.ok) {
            const info = await fallbackRes.json();
            if (info) applyStorefrontCompanyInfo(info);
        }
    } catch (err) {
        console.log("Using static default company info.");
    }
}

function parseSearchQueryFromUrl() {
    if (typeof window === 'undefined') return null;
    
    // 1. Kiểm tra từ Hash (ví dụ: #/search?q=h%C3%B4ng hoặc #search?q=h%C3%B4ng hoặc #q=h%C3%B4ng)
    const hash = (window.location.hash || '').replace(/^#\/?/, '');
    if (hash) {
        if (hash.includes('?') || hash.startsWith('q=')) {
            const queryPart = hash.includes('?') ? hash.split('?')[1] : hash;
            const params = new URLSearchParams(queryPart);
            if (params.get('q')) return params.get('q');
        } else if (hash.startsWith('search/')) {
            const term = decodeURIComponent(hash.replace('search/', ''));
            if (term) return term;
        }
    }
    
    // 2. Kiểm tra từ Search Query String (?q=...)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('q')) return urlParams.get('q');
    
    return null;
}

// 4. Khởi chạy khi tải xong trang (DOM Content Loaded - Đảm bảo chỉ chạy duy nhất 1 lần để tránh rò rỉ listener)
let _hasInitApp = false;
async function initApp() {
    if (_hasInitApp) return;
    _hasInitApp = true;

    initMobileMenu();
    renderStorefrontCategories();
    await renderAllProducts();
    loadStorefrontCompanyInfo();
    
    // 1. Kiểm tra tham số tìm kiếm từ URL Hash (#/search?q=...) hoặc query khi vừa tải trang
    if (typeof window !== 'undefined') {
        const queryFromUrl = parseSearchQueryFromUrl();
        if (queryFromUrl) {
            const desktopInput = document.getElementById('storefrontSearchInput');
            const mobileInput = document.getElementById('storefrontSearchMobileInput');
            if (desktopInput) desktopInput.value = queryFromUrl;
            if (mobileInput) mobileInput.value = queryFromUrl;
            searchStorefrontProducts(queryFromUrl, false);
        }

        // Lắng nghe sự kiện đổi Hash và Back/Forward của trình duyệt
        const handleUrlChange = () => {
            const q = parseSearchQueryFromUrl();
            if (q) {
                searchStorefrontProducts(q, false);
            } else {
                clearStorefrontSearch(false);
            }
        };

        window.addEventListener('hashchange', handleUrlChange);
        window.addEventListener('popstate', handleUrlChange);
    }

    // Gắn sự kiện đóng modal bằng phím ESC và click ra ngoài backdrop
    if (typeof document !== 'undefined') {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                closeProductQuickDetail();
                closeLiveSearchResults();
            }
        });

        // Đóng bảng live search khi nhấp chuột ra ngoài
        document.addEventListener('click', (e) => {
            const deskInput = document.getElementById('storefrontSearchInput');
            const deskResults = document.getElementById('desktopLiveSearchResults');
            const mobInput = document.getElementById('storefrontSearchMobileInput');
            const mobResults = document.getElementById('mobileLiveSearchResults');

            if (deskResults && !deskResults.classList.contains('hidden')) {
                const isInsideDesk = (deskInput && deskInput.parentElement && deskInput.parentElement.contains(e.target));
                if (!isInsideDesk) {
                    deskResults.classList.add('hidden');
                }
            }

            if (mobResults && !mobResults.classList.contains('hidden')) {
                const isInsideMob = (mobInput && mobInput.parentElement && mobInput.parentElement.contains(e.target));
                if (!isInsideMob) {
                    mobResults.classList.add('hidden');
                }
            }
        });

        const detailModal = document.getElementById("productQuickDetailModal");
        if (detailModal) {
            detailModal.addEventListener('click', (e) => {
                if (e.target === detailModal) {
                    closeProductQuickDetail();
                }
            });
        }
    }

    // Tự động kiểm tra đăng nhập khi mở app
    if (typeof checkAuthStatus === 'function') {
        checkAuthStatus();
    }

    // 2. Đọc ngôn ngữ từ Cache
    let cachedLang = 'vi';
    try {
        if (typeof localStorage !== 'undefined') {
            cachedLang = localStorage.getItem('anne_flower_lang') || 'vi';
        }
    } catch (e) {
        cachedLang = 'vi';
    }

    // 3. Thiết lập ngôn ngữ
    if (typeof setLanguage === 'function') {
        setLanguage(cachedLang);
    }
}

if (typeof window !== 'undefined') {
    window.renderProducts = renderProducts;
    window.renderAllProducts = renderAllProducts;
    window.renderStorefrontLoadError = renderStorefrontLoadError;
    window.retryLoadStorefrontProducts = retryLoadStorefrontProducts;
    window.renderStorefrontCategories = renderStorefrontCategories;
    window.getCategoryDisplayName = getCategoryDisplayName;
    window.getCategoryDescription = getCategoryDescription;
    window.getProductName = getProductName;
    window.getProductBadge = getProductBadge;
    window.getProductComposition = getProductComposition;
    window.getProductDescription = getProductDescription;
    window.getProductCareTips = getProductCareTips;
    window.populateCategoryDropdowns = populateCategoryDropdowns;
    window.renderDynamicStorefrontSections = renderDynamicStorefrontSections;
    window.searchStorefrontProducts = searchStorefrontProducts;
    window.debouncedSearchStorefrontProducts = debouncedSearchStorefrontProducts;
    window.clearStorefrontSearch = clearStorefrontSearch;
    window.renderLiveSearchResults = renderLiveSearchResults;
    window.renderMobileSearchResults = renderMobileSearchResults;
    window.closeLiveSearchResults = closeLiveSearchResults;
    window.updateSearchClearButtonVisibility = updateSearchClearButtonVisibility;
    window.removeVietnameseTones = removeVietnameseTones;
    window.initMobileMenu = initMobileMenu;
    window.openProductQuickDetail = openProductQuickDetail;
    window.closeProductQuickDetail = closeProductQuickDetail;
    window.loadAddons = loadAddons;
    window.toggleAddonSelection = toggleAddonSelection;
    window.changeAddonQty = changeAddonQty;
    window.scrollAddons = scrollAddons;
    window.applyStorefrontCompanyInfo = applyStorefrontCompanyInfo;
    window.loadStorefrontCompanyInfo = loadStorefrontCompanyInfo;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
}


})();
