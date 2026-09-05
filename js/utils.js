// Các tiện ích (Utils): Lazy Loading hình ảnh, Thông báo Toast, Bản đồ showroom, Sao chép clipboard

// Base URL chuẩn hóa cho RESTful API Telua Flower Connect v1 (tương tự Lu Quan /api/hotelconnect/v1)
export const API_BASE = "/api/flower/v1";

/**
 * Chuẩn hóa chuỗi tiếng Việt: loại bỏ dấu thanh, dấu mũ, chuyển đ/Đ -> d để tìm kiếm không dấu
 */
export function removeVietnameseTones(str) {
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
export function resolveImageUrl(imagePath, fallback = 'https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500') {
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
export function handleImageErrorFallback(imgEl) {
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
export function showToast(message, type = 'success', duration = 5000) {
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
export function showConfirmDialog({
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
export function showScreenLock(message = "Đang cập nhật cấu hình & đồng bộ hệ thống...") {
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

export function hideScreenLock() {
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

const SELECTED_BRANCH_ID_KEY = 'telua_selected_branch_id_v1';
const SELECTED_BRANCH_DATA_KEY = 'telua_selected_branch_data_v1';
const STOREFRONT_BRANCHES_CACHE_KEY = 'telua_storefront_branches_cache_v1';
const BRANCHES_ETAG_KEY = 'telua_branches_etag_v1';

let storefrontBranches = [];
let currentSelectedBranch = null;
let _isSyncingBranches = false;
let _lastBranchesSyncTime = 0;

// Khởi tạo tức thì chi nhánh từ cache LocalStorage (0ms Instant Boot)
try {
    if (typeof localStorage !== 'undefined') {
        const cachedRaw = localStorage.getItem(STOREFRONT_BRANCHES_CACHE_KEY);
        if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                storefrontBranches = parsed;
            }
        }
        const savedBranchData = localStorage.getItem(SELECTED_BRANCH_DATA_KEY);
        if (savedBranchData) {
            const parsedData = JSON.parse(savedBranchData);
            if (parsedData && parsedData.id) {
                currentSelectedBranch = parsedData;
            }
        }
    }
} catch (e) {
    console.warn("Lỗi đọc cache chi nhánh showroom:", e);
}

export function getCurrentSelectedBranch() {
    return currentSelectedBranch;
}

/**
 * Nạp lại danh sách chi nhánh (config/anne/branches.json) nếu có thay đổi từ máy chủ (dựa trên HTTP ETag / 304 Cache).
 * Kết hợp lưu vào localStorage để chỉ tải lại khi file thay đổi.
 */
export async function reloadBranchesIfChanged(forceRefresh = false) {
    if (_isSyncingBranches) return { changed: false, branches: storefrontBranches };
    _isSyncingBranches = true;

    let branchesChanged = false;
    let savedBranchId = null;
    let storedEtag = null;

    if (typeof localStorage !== 'undefined') {
        try {
            savedBranchId = localStorage.getItem(SELECTED_BRANCH_ID_KEY);
            storedEtag = localStorage.getItem(BRANCHES_ETAG_KEY);
        } catch (e) {}
    }

    try {
        const headers = {};
        if (storedEtag && !forceRefresh) {
            headers['If-None-Match'] = storedEtag;
        }

        const res = await fetch(`${API_BASE}/branches?_t=${Date.now()}`, { headers });
        if (res.status === 200) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                const activeBranches = json.data.filter(b => b && b.isActive !== false);
                const oldStr = JSON.stringify(storefrontBranches || []);
                const newStr = JSON.stringify(activeBranches);
                if (oldStr !== newStr) {
                    storefrontBranches = activeBranches;
                    branchesChanged = true;
                }
                const newEtag = res.headers.get("ETag");
                if (typeof localStorage !== 'undefined') {
                    try {
                        localStorage.setItem(STOREFRONT_BRANCHES_CACHE_KEY, JSON.stringify(storefrontBranches));
                        if (newEtag) localStorage.setItem(BRANCHES_ETAG_KEY, newEtag);
                    } catch (e) {}
                }
            }
        } else if (res.status === 304) {
            // Không thay đổi (304 Not Modified) -> Giữ nguyên cache
            branchesChanged = false;
        } else if (!res.ok) {
            throw new Error("HTTP " + res.status);
        }
    } catch (e) {
        // Fallback file tĩnh config/anne/branches.json nếu API không phản hồi
        if (!storefrontBranches || storefrontBranches.length === 0 || forceRefresh) {
            try {
                const fbRes = await fetch(`config/anne/branches.json?_t=${Date.now()}`);
                if (fbRes.ok) {
                    const fbData = await fbRes.json();
                    if (Array.isArray(fbData) && fbData.length > 0) {
                        const activeBranches = fbData.filter(b => b && b.isActive !== false);
                        const oldStr = JSON.stringify(storefrontBranches || []);
                        const newStr = JSON.stringify(activeBranches);
                        if (oldStr !== newStr) {
                            storefrontBranches = activeBranches;
                            branchesChanged = true;
                        }
                        if (typeof localStorage !== 'undefined') {
                            try {
                                localStorage.setItem(STOREFRONT_BRANCHES_CACHE_KEY, JSON.stringify(storefrontBranches));
                            } catch (e) {}
                        }
                    }
                }
            } catch (errFb) {}
        }
    }

    // Fallback mặc định cuối cùng nếu danh sách rỗng
    if (!storefrontBranches || storefrontBranches.length === 0) {
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

    _lastBranchesSyncTime = Date.now();
    _isSyncingBranches = false;

    // Nếu dữ liệu có thay đổi hoặc bắt buộc làm mới:
    if (branchesChanged || forceRefresh || !currentSelectedBranch) {
        renderStorefrontBranchButtons();

        // Cập nhật lại chi nhánh đang chọn
        let targetBranch = null;
        if (savedBranchId) {
            targetBranch = storefrontBranches.find(b => b.id === savedBranchId);
        }
        if (!targetBranch && currentSelectedBranch) {
            targetBranch = storefrontBranches.find(b => b.id === currentSelectedBranch.id);
        }
        if (!targetBranch && storefrontBranches.length > 0) {
            targetBranch = storefrontBranches[0];
        }

        if (targetBranch) {
            selectShowroomBranch(targetBranch.id, true);
        }
    }

    return { changed: branchesChanged, branches: storefrontBranches };
}

// Tải và hiển thị danh sách chuỗi cửa hàng động (có cache ETag)
export async function loadAndRenderStorefrontBranches() {
    const navContainer = document.getElementById("storeBranchNav");
    if (!navContainer) return;

    // 1. Hiển thị tức thì nếu đã có trong cache (0ms)
    if (storefrontBranches && storefrontBranches.length > 0) {
        renderStorefrontBranchButtons();
        let savedBranchId = null;
        if (typeof localStorage !== 'undefined') {
            try {
                savedBranchId = localStorage.getItem(SELECTED_BRANCH_ID_KEY);
            } catch (e) {}
        }
        const target = (savedBranchId && storefrontBranches.find(b => b.id === savedBranchId)) || currentSelectedBranch || storefrontBranches[0];
        if (target) {
            selectShowroomBranch(target.id, false);
        }
    }

    // 2. Kiểm tra cập nhật từ máy chủ bằng ETag (chỉ tải lại khi file branches.json thay đổi)
    await reloadBranchesIfChanged(false);
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

export function selectShowroomBranch(branchId, saveCache = true) {
    const b = storefrontBranches.find((item) => item.id === branchId) || storefrontBranches[0];
    if (!b) return;

    currentSelectedBranch = b;

    // Lưu lựa chọn chi nhánh của khách hàng vào cache trình duyệt
    if (saveCache && typeof localStorage !== 'undefined') {
        try {
            localStorage.setItem(SELECTED_BRANCH_ID_KEY, b.id);
            localStorage.setItem(SELECTED_BRANCH_DATA_KEY, JSON.stringify(b));
            localStorage.setItem('telua_selected_branch_address_v1', b.address);
        } catch (e) {}
    }

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

    // Cập nhật iframe Google Maps và Link chỉ đường chính xác theo địa chỉ chi nhánh
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
export function openStoreMap(e) {
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
export function copyStoreAddress() {
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

// Tự động kiểm tra thay đổi của file branches.json khi người dùng chuyển lại tab (sau ít nhất 15 giây)
if (typeof window !== "undefined" && typeof document !== "undefined") {
    const handleBranchesVisibilityOrFocus = () => {
        const now = Date.now();
        if (now - _lastBranchesSyncTime > 15000) {
            reloadBranchesIfChanged(false).catch(() => {});
        }
    };
    window.addEventListener("focus", handleBranchesVisibilityOrFocus);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            handleBranchesVisibilityOrFocus();
        }
    });
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
    window.getCurrentSelectedBranch = getCurrentSelectedBranch;
    window.resolveImageUrl = resolveImageUrl;
    window.loadAndRenderStorefrontBranches = loadAndRenderStorefrontBranches;
    window.reloadBranchesIfChanged = reloadBranchesIfChanged;
    window.removeVietnameseTones = removeVietnameseTones;
}
