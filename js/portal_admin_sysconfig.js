import { getAuthToken } from './auth.js';
import { API_BASE, showConfirmDialog, showLiveStreamConfirmDialog, showSaveLiveStreamConfigDialog, showLiveStreamPaymentBlockConfirmDialog, removeVietnameseTones } from './utils.js';
import { lockScreen, unlockScreen, notifyUser, setAdminPriceLevels, allAdminCategories } from './portal_admin_state.js';

// ==========================================
// CẤU HÌNH THÔNG TIN DOANH NGHIỆP (infoCompany.json)
// ==========================================

export const DEFAULT_STATIC_COMPANY_INFO = {
    companyName: "NỞ HOA THẢ BÌNH",
    brandSlogan: "Hoa Tươi Thiết Kế & Cắm Hoa Thả Bình Nghệ Thuật",
    address: "62A, Nguyễn Hồng Đào, Phường Tân Bình, TP. Hồ Chí Minh",
    phone: "0976.491.322",
    hotline: "0976.491.322",
    email: "cskh@nohoathabinh.vn",
    workingHours: "Thứ 2 - Chủ Nhật: 7:00 - 21:00",
    taxCode: "0318999888",
    website: "https://nohoathabinh.vn",
    facebook: "https://facebook.com/nohoathabinh",
    instagram: "https://instagram.com/nohoathabinh",
    tiktok: "https://www.tiktok.com/@nohoathabinh",
    zalo: "https://zalo.me/0976491322",
    whatsapp: "https://wa.me/84976491323",
    mapUrl: "https://maps.google.com/?q=183/37+Đường+3+Tháng+2,+Phường+11,+Quận+10,+TP.+Hồ+Chí+Minh",
    mapEmbedUrl: "https://maps.google.com/maps?q=183%2F37%20%C4%90%C6%B0%E1%BB%9Dng%203%20Th%C3%A1ng%202%2C%20Ph%C6%B0%E1%BB%9Dng%2011%2C%20Qu%E1%BA%ADn%2010%2C%20Th%C3%A0nh%20ph%E1%BB%91%20H%E1%BB%93%20Ch%C3%AD%20Minh&t=&z=16&ie=UTF8&iwloc=&output=embed"
};

export let adminCompanyInfo = { ...DEFAULT_STATIC_COMPANY_INFO };

// ==========================================
// CẤU HÌNH PHƯƠNG THỨC THANH TOÁN (paymentConfig.json)
// ==========================================

export let adminPaymentConfig = { methods: {} };

export async function loadAdminPaymentConfig() {
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

export function onPaymentMethodToggle() {
    // Đồng bộ trạng thái checkbox vào state cục bộ (chưa lưu tới khi bấm Lưu Cấu Hình)
    const toggles = document.querySelectorAll(".payment-method-toggle");
    toggles.forEach((el) => {
        const key = el.getAttribute("data-method-key");
        if (key && adminPaymentConfig.methods && adminPaymentConfig.methods[key]) {
            adminPaymentConfig.methods[key].enabled = el.checked;
        }
    });
}

export async function savePaymentConfig() {
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
        if (typeof window !== "undefined" && typeof window.reloadPaymentConfigIfChanged === "function") {
            window.reloadPaymentConfigIfChanged(true).catch(() => { });
        }
        notifyUser("Đã lưu cấu hình phương thức thanh toán thành công!", "success");
    } catch (e) {
        notifyUser("Lỗi lưu cấu hình thanh toán: " + e.message, "error");
    }
}

// ==========================================
// CẤU HÌNH HIỂN THỊ SẢN PHẨM KÈM THEO (ADD-ON)
// ==========================================
export let adminAddonConfig = { showAddons: true };

export async function loadAdminAddonConfig() {
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

export async function saveAddonConfig() {
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
        if (typeof window !== 'undefined' && typeof window.reloadAddonsIfChanged === 'function') {
            window.reloadAddonsIfChanged(true).catch(() => { });
        }
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

// ==========================================
// CẤU HÌNH LIVE STREAM & ĐẶT HÀNG NHANH (livestreamConfig.json)
// ==========================================
export const DEFAULT_LIVESTREAM_CONFIG = {
    enableQuickOrder: false,
    enabled: false,
    title: "Đặt Hoa Nhanh Live Stream",
    description: "Quý khách vui lòng chọn bó hoa, điền thông tin và tải ảnh chuyển khoản để shop đóng gói giao ngay!",
    bankInfo: {
        bankName: "Vietcombank (VCB)",
        accountNumber: "0976491322",
        accountName: "NO HOA THA BINH",
        qrCodeImage: ""
    },
    qrCodeImage: "",
    featuredProductIds: []
};

export let adminLiveStreamConfig = { ...DEFAULT_LIVESTREAM_CONFIG };

export async function loadAdminLiveStreamConfig() {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const statusEl = document.getElementById("livestreamConfigStatus");
    if (statusEl) {
        statusEl.textContent = "Đang tải…";
        statusEl.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200";
    }

    try {
        const res = await fetch(`${API_BASE}/admin/livestream-config?_t=${Date.now()}`, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Không thể tải cấu hình");
        adminLiveStreamConfig = json.data || { ...DEFAULT_LIVESTREAM_CONFIG };
        if (statusEl) {
            statusEl.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200";
            statusEl.innerHTML = `<i class="fa-solid fa-circle-check mr-1 text-[8px] text-emerald-500"></i> Đã nạp • ${new Date().toLocaleTimeString()}`;
        }
    } catch (e) {
        adminLiveStreamConfig = { ...DEFAULT_LIVESTREAM_CONFIG };
        console.warn("[LIVESTREAM-CONFIG] load lỗi:", e.message);
        if (statusEl) {
            statusEl.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200";
            statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1 text-[8px] text-red-500"></i> Lỗi nạp`;
        }
    }
    // Mặc định luôn bật khóa bảo vệ chống gõ nhầm mỗi khi nạp cấu hình (chỉ lưu tạm trên web)
    isLiveStreamPaymentBlocked = true;
    await renderLiveStreamConfig(adminLiveStreamConfig);
}

// =========================================================================
// KHÓA BẢO VỆ CHỐNG SỬA NHẦM THÔNG TIN THANH TOÁN (CARD 2: TÀI KHOẢN & CARD 3: QR)
// Mặc định là ENABLE (isLiveStreamPaymentBlocked = true) - Chỉ lưu tạm trên giao diện Web
// =========================================================================
let isLiveStreamPaymentBlocked = true;

export function getLiveStreamPaymentBlockState() {
    return isLiveStreamPaymentBlocked;
}

export async function toggleLiveStreamPaymentBlock(forcedState = null) {
    const nextState = (forcedState !== null) ? !!forcedState : !isLiveStreamPaymentBlocked;

    // Nếu thay đổi trạng thái, hiển thị Dialog xác nhận
    if (nextState !== isLiveStreamPaymentBlocked) {
        const willUnlock = !nextState; // nextState = false nghĩa là Mở Khóa (isBlocked = false)
        let confirmed = false;

        if (typeof showLiveStreamPaymentBlockConfirmDialog === "function") {
            confirmed = await showLiveStreamPaymentBlockConfirmDialog(willUnlock);
        } else if (typeof showConfirmDialog === "function") {
            confirmed = await showConfirmDialog({
                title: willUnlock ? "Mở Khóa Chỉnh Sửa Thông Tin Thanh Toán?" : "Kích Hoạt Lại Khóa Chống Sửa?",
                message: willUnlock
                    ? "Tài khoản nhận tiền và Mã QR là thông tin tài chính nhạy cảm. Bạn có chắc chắn muốn mở khóa bảo vệ để chỉnh sửa?"
                    : "Hệ thống sẽ khóa bảo vệ lại toàn bộ ô nhập tài khoản và ảnh QR để ngăn thao tác gõ hoặc chỉnh sửa ngoài ý muốn.",
                detail: willUnlock ? "Khóa bảo vệ chỉ mở tạm thời trong phiên làm việc hiện tại và sẽ tự động khóa lại sau khi lưu cấu hình." : "",
                confirmText: willUnlock ? "Mở Khóa Chỉnh Sửa" : "Khóa Lại Ngay",
                cancelText: willUnlock ? "Giữ Khóa Bảo Vệ" : "Hủy Bỏ",
                type: willUnlock ? "warning" : "info",
                icon: willUnlock ? "fa-solid fa-lock-open" : "fa-solid fa-lock"
            });
        } else {
            confirmed = window.confirm(willUnlock ? "Bạn có chắc chắn muốn mở khóa chỉnh sửa thông tin thanh toán không?" : "Bạn có muốn khóa lại không?");
        }

        if (!confirmed) return;

        isLiveStreamPaymentBlocked = nextState;
    }

    applyLiveStreamPaymentBlockUI(isLiveStreamPaymentBlocked);

    if (isLiveStreamPaymentBlocked) {
        if (typeof showToast === "function") {
            showToast("🔒 Đã BẬT khóa bảo vệ: Thông tin Tài khoản & Mã QR đang được khóa chống gõ nhầm!", "info");
        }
    } else {
        if (typeof showToast === "function") {
            showToast("🔓 Đã MỞ KHÓA: Bạn có thể chỉnh sửa Tài khoản & Mã QR (Chỉ tạm thời trên web)!", "warning");
        }
    }
}

export async function handleLiveStreamLockedInputClick() {
    if (isLiveStreamPaymentBlocked) {
        await toggleLiveStreamPaymentBlock(false);
    }
}

export function applyLiveStreamPaymentBlockUI(isBlocked = isLiveStreamPaymentBlocked) {
    const btnBank = document.getElementById("btnToggleBankBlock");
    const btnQr = document.getElementById("btnToggleQrBlock");

    const bankNameInput = document.getElementById("livestreamBankNameInput");
    const bankAccInput = document.getElementById("livestreamBankAccountInput");
    const bankOwnerInput = document.getElementById("livestreamBankOwnerInput");

    const qrUrlInput = document.getElementById("adminLiveStreamQrUrlInput");
    const qrFileInput = document.getElementById("adminLiveStreamQrFileInput");
    const qrUploadLabel = document.getElementById("adminLiveStreamQrUploadLabel");
    const qrRemoveBtn = document.getElementById("adminLiveStreamQrRemoveBtn");

    // 1. Cập nhật giao diện nút bấm trên Card 2 và Card 3
    const updateBtn = (btn) => {
        if (!btn) return;
        if (isBlocked) {
            btn.className = "px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300";
            btn.innerHTML = `<i class="fa-solid fa-lock text-amber-600"></i> <span>Khóa chống sửa: BẬT</span>`;
            btn.title = "Đang bật khóa bảo vệ chống gõ nhầm. Bấm để mở khóa chỉnh sửa";
        } else {
            btn.className = "px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300";
            btn.innerHTML = `<i class="fa-solid fa-lock-open text-emerald-600"></i> <span>Khóa chống sửa: TẮT</span>`;
            btn.title = "Đang mở khóa chỉnh sửa. Bấm để khóa lại";
        }
    };
    updateBtn(btnBank);
    updateBtn(btnQr);

    // 2. Card 2: Các trường tài khoản
    [bankNameInput, bankAccInput, bankOwnerInput].forEach(inp => {
        if (!inp) return;
        inp.readOnly = isBlocked;
        if (isBlocked) {
            inp.classList.add("bg-gray-100", "text-gray-500", "cursor-not-allowed", "select-none");
            inp.classList.remove("focus:bg-white");
        } else {
            inp.classList.remove("bg-gray-100", "text-gray-500", "cursor-not-allowed", "select-none");
            inp.classList.add("focus:bg-white");
        }
    });

    // 3. Card 3: Mã QR
    if (qrUrlInput) {
        qrUrlInput.readOnly = isBlocked;
        if (isBlocked) {
            qrUrlInput.classList.add("bg-gray-100", "text-gray-500", "cursor-not-allowed");
            qrUrlInput.classList.remove("focus:bg-white");
        } else {
            qrUrlInput.classList.remove("bg-gray-100", "text-gray-500", "cursor-not-allowed");
            qrUrlInput.classList.add("focus:bg-white");
        }
    }

    if (qrUploadLabel) {
        if (isBlocked) {
            qrUploadLabel.classList.add("pointer-events-none", "opacity-40", "cursor-not-allowed");
            qrUploadLabel.classList.remove("cursor-pointer");
        } else {
            qrUploadLabel.classList.remove("pointer-events-none", "opacity-40", "cursor-not-allowed");
            qrUploadLabel.classList.add("cursor-pointer");
        }
    }

    if (qrFileInput) {
        qrFileInput.disabled = isBlocked;
    }

    if (qrRemoveBtn) {
        if (isBlocked) {
            qrRemoveBtn.classList.add("pointer-events-none", "opacity-40", "cursor-not-allowed");
        } else {
            qrRemoveBtn.classList.remove("pointer-events-none", "opacity-40", "cursor-not-allowed");
        }
    }
}

export async function renderLiveStreamConfig(config) {
    const toggle = document.getElementById("livestreamQuickOrderToggle");
    const activeBadge = document.getElementById("livestreamQuickOrderStatusBadge");
    const titleInput = document.getElementById("livestreamTitleInput");
    const descInput = document.getElementById("livestreamDescInput");
    const bankNameInput = document.getElementById("livestreamBankNameInput");
    const bankAccInput = document.getElementById("livestreamBankAccountInput");
    const bankOwnerInput = document.getElementById("livestreamBankOwnerInput");
    const linkInput = document.getElementById("livestreamShareLinkInput");

    const isEnabled = !!(config && (config.enableQuickOrder || config.enabled));
    if (toggle) toggle.checked = isEnabled;

    if (activeBadge) {
        if (isEnabled) {
            activeBadge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 animate-pulse";
            activeBadge.innerHTML = `<i class="fa-solid fa-circle text-[8px] text-emerald-600"></i> Đang BẬT Nhận Đơn Nhanh`;
        } else {
            activeBadge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold border border-gray-300";
            activeBadge.innerHTML = `<i class="fa-solid fa-circle text-[8px] text-gray-400"></i> Đang TẮT Nhận Đơn Nhanh`;
        }
    }

    if (titleInput) titleInput.value = (config && config.title) || DEFAULT_LIVESTREAM_CONFIG.title;
    if (descInput) descInput.value = (config && config.description) || DEFAULT_LIVESTREAM_CONFIG.description;

    const bInfo = (config && config.bankInfo) || DEFAULT_LIVESTREAM_CONFIG.bankInfo;
    if (bankNameInput) bankNameInput.value = bInfo.bankName || "";
    if (bankAccInput) bankAccInput.value = bInfo.accountNumber || "";
    if (bankOwnerInput) bankOwnerInput.value = bInfo.accountName || "";

    // Cập nhật xem trước mã QR chuyển khoản ngân hàng
    const qrPreview = document.getElementById("adminLiveStreamQrPreview");
    const qrEmpty = document.getElementById("adminLiveStreamQrEmpty");
    const qrRemoveBtn = document.getElementById("adminLiveStreamQrRemoveBtn");
    const qrStatus = document.getElementById("adminLiveStreamQrStatus");
    const qrUrlInput = document.getElementById("adminLiveStreamQrUrlInput");
    const qrImg = (config && (config.qrCodeImage || (config.bankInfo && config.bankInfo.qrCodeImage))) || "";

    if (qrUrlInput) qrUrlInput.value = qrImg || "";

    if (qrPreview) {
        if (qrImg) {
            qrPreview.src = qrImg;
            qrPreview.classList.remove("hidden");
            if (qrEmpty) qrEmpty.classList.add("hidden");
            if (qrRemoveBtn) qrRemoveBtn.classList.remove("hidden");
            if (qrStatus) {
                if (qrImg.startsWith("data:image/webp")) {
                    qrStatus.textContent = "Mã QR đã nén WebP Base64 (Lưu trong config)";
                } else if (qrImg.startsWith("data:")) {
                    qrStatus.textContent = "Mã QR Base64 (Lưu trong config)";
                } else {
                    qrStatus.textContent = "Mã QR chuyển khoản (URL)";
                }
                qrStatus.className = "text-[10px] text-emerald-600 font-bold block mt-1";
            }
        } else {
            // Không có mã QR: TUYỆT ĐỐI KHÔNG tự ý sinh/tạo hình ảnh mã QR
            qrPreview.removeAttribute("src");
            qrPreview.classList.add("hidden");
            if (qrEmpty) qrEmpty.classList.remove("hidden");
            if (qrRemoveBtn) qrRemoveBtn.classList.add("hidden");
            if (qrStatus) {
                qrStatus.textContent = "Chưa có ảnh mã QR chuyển khoản";
                qrStatus.className = "text-[10px] text-gray-500 font-medium block mt-1";
            }
        }
    }

    if (linkInput && typeof window !== "undefined") {
        const origin = window.location.origin || "";
        const pathname = window.location.pathname.replace(/\/+$/, "");
        linkInput.value = `${origin}${pathname}#quick-order`;
    }

    // Áp dụng trạng thái khóa bảo vệ thanh toán lên giao diện (mặc định là khóa)
    applyLiveStreamPaymentBlockUI(isLiveStreamPaymentBlocked);

    // Hiển thị danh sách bó hoa nổi bật ghim trong phiên live
    await renderAdminLiveStreamFeaturedProducts((config && config.featuredProductIds) || []);
}

let cachedAdminLiveStreamProducts = [];
let adminLiveStreamSearchQuery = "";
let adminLiveStreamFilterMode = "all"; // 'all' | 'pinned'

/**
 * Cập nhật số lượng các mẫu hoa đã ghim trên huy hiệu và bộ lọc
 */
export function updateAdminLiveStreamFeaturedBadges() {
    const featuredList = (adminLiveStreamConfig && adminLiveStreamConfig.featuredProductIds) || [];
    const countBadge = document.getElementById("adminLiveStreamFeaturedCountBadge");
    const filterPinnedCount = document.getElementById("adminLiveStreamFilterPinnedCount");
    if (countBadge) {
        countBadge.textContent = `Đã ghim: ${featuredList.length} mẫu`;
    }
    if (filterPinnedCount) {
        filterPinnedCount.textContent = featuredList.length;
    }
}

/**
 * Xử lý khi admin gõ từ khóa tìm kiếm tên mẫu hoa ghim
 */
export function handleAdminLiveStreamProductSearch(keyword = "") {
    adminLiveStreamSearchQuery = (keyword || "").trim();
    const clearBtn = document.getElementById("adminLiveStreamProductSearchClearBtn");
    if (clearBtn) {
        if (adminLiveStreamSearchQuery) clearBtn.classList.remove("hidden");
        else clearBtn.classList.add("hidden");
    }
    filterAndRenderAdminLiveStreamFeaturedProducts();
}

/**
 * Xóa từ khóa tìm kiếm mẫu hoa
 */
export function clearAdminLiveStreamProductSearch() {
    const input = document.getElementById("adminLiveStreamProductSearch");
    if (input) input.value = "";
    handleAdminLiveStreamProductSearch("");
}

/**
 * Chuyển đổi bộ lọc: Tất cả | Chỉ xem mẫu đã ghim
 */
export function setAdminLiveStreamProductFilter(mode = "all") {
    adminLiveStreamFilterMode = mode;
    const btnAll = document.getElementById("btnFilterLiveProdsAll");
    const btnPinned = document.getElementById("btnFilterLiveProdsPinned");
    if (btnAll && btnPinned) {
        if (mode === "pinned") {
            btnPinned.className = "px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white shadow-2xs transition cursor-pointer";
            btnAll.className = "px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer";
        } else {
            btnAll.className = "px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gray-800 text-white shadow-2xs transition cursor-pointer";
            btnPinned.className = "px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer";
        }
    }
    filterAndRenderAdminLiveStreamFeaturedProducts();
}

/**
 * Lọc và render danh sách mẫu hoa theo từ khóa tìm kiếm & bộ lọc
 */
export function filterAndRenderAdminLiveStreamFeaturedProducts() {
    const container = document.getElementById("adminLiveStreamFeaturedContainer");
    if (!container) return;

    const featuredSet = new Set((adminLiveStreamConfig && Array.isArray(adminLiveStreamConfig.featuredProductIds)) ? adminLiveStreamConfig.featuredProductIds : []);
    const prods = cachedAdminLiveStreamProducts || [];

    const normQuery = typeof removeVietnameseTones === "function"
        ? removeVietnameseTones(adminLiveStreamSearchQuery.toLowerCase())
        : adminLiveStreamSearchQuery.toLowerCase();

    const filtered = prods.filter(p => {
        if (!p) return false;
        const isPinned = featuredSet.has(p.id) || featuredSet.has(p.uuid);
        if (adminLiveStreamFilterMode === "pinned" && !isPinned) {
            return false;
        }

        if (normQuery) {
            const pName = (p.name || "").toLowerCase();
            const pNameNorm = typeof removeVietnameseTones === "function" ? removeVietnameseTones(pName) : pName;
            const pCodeNorm = String(p.code || p.id || "").toLowerCase();
            if (!pNameNorm.includes(normQuery) && !pCodeNorm.includes(normQuery) && !pName.includes(adminLiveStreamSearchQuery.toLowerCase())) {
                return false;
            }
        }
        return true;
    });

    const countEl = document.getElementById("adminLiveStreamProductVisibleCount");
    if (countEl) {
        countEl.textContent = `Hiển thị ${filtered.length} / ${prods.length} mẫu`;
    }

    updateAdminLiveStreamFeaturedBadges();

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-8 text-center text-gray-400 space-y-2">
                <div class="w-10 h-10 mx-auto rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-sm">
                    <i class="fa-solid fa-magnifying-glass"></i>
                </div>
                <p class="text-xs font-medium text-gray-600">Không tìm thấy mẫu hoa nào khớp với từ khóa "${adminLiveStreamSearchQuery}"</p>
                ${adminLiveStreamSearchQuery ? `<button type="button" onclick="clearAdminLiveStreamProductSearch()" class="text-xs text-rose-600 font-bold hover:underline cursor-pointer">Xóa tìm kiếm để xem tất cả</button>` : ''}
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(p => {
        const isChecked = featuredSet.has(p.id) || featuredSet.has(p.uuid);
        const price = p.priceNumber || (p.salePrice ? parseInt(String(p.salePrice).replace(/\D/g, ''), 10) : 0);
        const priceStr = price > 0 ? `${price.toLocaleString('vi-VN')}₫` : '';
        const img = p.image || 'https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=100';

        return `
            <label class="flex items-center gap-3 p-2.5 rounded-xl border ${isChecked ? 'bg-rose-50/80 border-rose-300 shadow-2xs' : 'bg-white border-gray-200'} hover:border-rose-400 transition cursor-pointer select-none">
                <input type="checkbox" value="${p.id}" ${isChecked ? 'checked' : ''}
                    onchange="toggleAdminLiveStreamFeaturedProduct('${p.id}', this.checked)"
                    class="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer">
                <img src="${img}" alt="${p.name}" class="w-10 h-10 object-cover rounded-lg border border-gray-100 flex-shrink-0" onerror="this.src='https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=100'">
                <div class="min-w-0 flex-1">
                    <p class="text-xs font-bold text-gray-800 line-clamp-1">${p.name}</p>
                    <p class="text-[11px] text-rose-600 font-semibold">${priceStr}</p>
                </div>
                ${isChecked ? '<span class="text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 flex items-center gap-1 shadow-2xs"><i class="fa-solid fa-thumbtack text-[8px]"></i> Ghim</span>' : ''}
            </label>
        `;
    }).join('');
}

/**
 * Hiển thị danh sách checkbox các bó hoa để ghim vào phiên Live Stream
 */
export async function renderAdminLiveStreamFeaturedProducts(featuredIds = []) {
    if (Array.isArray(featuredIds)) {
        if (!adminLiveStreamConfig) adminLiveStreamConfig = {};
        adminLiveStreamConfig.featuredProductIds = [...featuredIds];
    }

    try {
        if (typeof window !== "undefined" && Array.isArray(window.allStorefrontProducts) && window.allStorefrontProducts.length > 0) {
            cachedAdminLiveStreamProducts = window.allStorefrontProducts;
        } else {
            const res = await fetch(`${API_BASE}/products?_t=${Date.now()}`);
            if (res.ok) {
                const json = await res.json();
                if (json && Array.isArray(json.data)) cachedAdminLiveStreamProducts = json.data;
            }
        }
    } catch (_) { }

    filterAndRenderAdminLiveStreamFeaturedProducts();
}

/**
 * Bật/tắt ghim mẫu hoa trong phiên Live Stream
 */
export function toggleAdminLiveStreamFeaturedProduct(productId, isChecked) {
    if (!adminLiveStreamConfig.featuredProductIds) {
        adminLiveStreamConfig.featuredProductIds = [];
    }
    const idx = adminLiveStreamConfig.featuredProductIds.indexOf(productId);
    if (isChecked && idx === -1) {
        adminLiveStreamConfig.featuredProductIds.push(productId);
    } else if (!isChecked && idx !== -1) {
        adminLiveStreamConfig.featuredProductIds.splice(idx, 1);
    }
    updateAdminLiveStreamFeaturedBadges();
    filterAndRenderAdminLiveStreamFeaturedProducts();
}

/**
 * Cập nhật ảnh mã QR Live Stream trực tiếp từ ô nhập đường dẫn URL
 */
export function handleAdminLiveStreamQrUrlInput(url) {
    if (isLiveStreamPaymentBlocked) {
        handleLiveStreamLockedInputClick();
        return;
    }
    const cleanUrl = (url || "").trim();
    adminLiveStreamConfig.qrCodeImage = cleanUrl;
    if (adminLiveStreamConfig.bankInfo) adminLiveStreamConfig.bankInfo.qrCodeImage = cleanUrl;

    const qrPreview = document.getElementById("adminLiveStreamQrPreview");
    const qrEmpty = document.getElementById("adminLiveStreamQrEmpty");
    const qrRemoveBtn = document.getElementById("adminLiveStreamQrRemoveBtn");
    const qrStatus = document.getElementById("adminLiveStreamQrStatus");

    if (cleanUrl) {
        if (qrPreview) {
            qrPreview.src = cleanUrl;
            qrPreview.classList.remove("hidden");
        }
        if (qrEmpty) qrEmpty.classList.add("hidden");
        if (qrRemoveBtn) qrRemoveBtn.classList.remove("hidden");
        if (qrStatus) {
            if (cleanUrl.startsWith("data:image/webp")) {
                qrStatus.textContent = "Mã QR đã nén WebP Base64 (Hợp lệ)";
            } else if (cleanUrl.startsWith("data:")) {
                qrStatus.textContent = "Mã QR Base64 (Hợp lệ)";
            } else {
                qrStatus.textContent = "Mã QR từ đường dẫn URL (Hợp lệ)";
            }
            qrStatus.className = "text-[10px] text-purple-600 font-bold block mt-1";
        }
    } else {
        removeAdminLiveStreamQr();
    }
}

/**
 * Chuyển đổi và nén tệp hình ảnh sang định dạng WebP Base64 Data URI
 * Tự động vẽ nền trắng (tránh mã QR PNG trong suốt bị nền đen) và giới hạn kích thước tối đa
 */
export function convertImageToWebpBase64(file, maxWidth = 800, maxHeight = 800, quality = 0.85) {
    return new Promise((resolve, reject) => {
        if (!file) return reject(new Error("Không có tệp ảnh"));
        if (!file.type || !file.type.startsWith("image/")) {
            return reject(new Error("Tệp được chọn không phải là hình ảnh hợp lệ"));
        }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Không thể đọc tệp ảnh"));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error("Không thể giải mã tệp ảnh"));
            img.onload = () => {
                try {
                    let width = img.naturalWidth || img.width;
                    let height = img.naturalHeight || img.height;

                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width = Math.max(1, Math.round(width * ratio));
                        height = Math.max(1, Math.round(height * ratio));
                    }

                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return reject(new Error("Trình duyệt không hỗ trợ Canvas 2D"));

                    // Phủ nền trắng để đảm bảo mã QR luôn sắc nét và PNG trong suốt không bị đen
                    ctx.fillStyle = "#FFFFFF";
                    ctx.fillRect(0, 0, width, height);

                    ctx.drawImage(img, 0, 0, width, height);

                    // Xuất định dạng chuẩn image/jpeg chất lượng cao (0.90) kèm nền trắng để 100% app ngân hàng nhận diện được
                    let dataUrl = canvas.toDataURL("image/jpeg", 0.90);
                    if (!dataUrl || !dataUrl.startsWith("data:image/jpeg")) {
                        dataUrl = canvas.toDataURL("image/webp", quality);
                    }
                    resolve(dataUrl);
                } catch (err) {
                    reject(err);
                }
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Xử lý tải lên ảnh mã QR chuyển khoản ngân hàng:
 * Tự động convert ảnh sang định dạng chuẩn JPG Base64 để lưu trực tiếp trong config và tương thích mọi app ngân hàng
 */
export async function handleAdminLiveStreamQrUpload(event) {
    if (isLiveStreamPaymentBlocked) {
        handleLiveStreamLockedInputClick();
        if (event && event.target) event.target.value = "";
        return;
    }
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Vui lòng chọn tệp hình ảnh mã QR (JPG, PNG, WEBP...)");
        event.target.value = "";
        return;
    }

    lockScreen("Đang nén & chuyển đổi ảnh mã QR sang JPG Base64 chuẩn quét ngân hàng...");
    try {
        const base64Jpg = await convertImageToWebpBase64(file, 800, 800, 0.90);

        adminLiveStreamConfig.qrCodeImage = base64Jpg;
        if (adminLiveStreamConfig.bankInfo) adminLiveStreamConfig.bankInfo.qrCodeImage = base64Jpg;

        // Cập nhật ô nhập URL và xem trước ngay lập tức
        const qrUrlInput = document.getElementById("adminLiveStreamQrUrlInput");
        if (qrUrlInput) qrUrlInput.value = base64Jpg;

        const qrPreview = document.getElementById("adminLiveStreamQrPreview");
        const qrEmpty = document.getElementById("adminLiveStreamQrEmpty");
        const qrRemoveBtn = document.getElementById("adminLiveStreamQrRemoveBtn");
        const qrStatus = document.getElementById("adminLiveStreamQrStatus");
        if (qrPreview) {
            qrPreview.src = base64Jpg;
            qrPreview.classList.remove("hidden");
        }
        if (qrEmpty) qrEmpty.classList.add("hidden");
        if (qrRemoveBtn) qrRemoveBtn.classList.remove("hidden");

        const approxKb = Math.round((base64Jpg.length * 0.75) / 1024);
        if (qrStatus) {
            qrStatus.textContent = `Mã QR đã nén JPG Base64 (~${approxKb} KB) - Chuẩn quét mọi App ngân hàng`;
            qrStatus.className = "text-[10px] text-emerald-600 font-bold block mt-1";
        }

        notifyUser(`Đã nén mã QR sang định dạng JPG (~${approxKb} KB)! Nhấn 'Lưu Cấu Hình Live Stream' để áp dụng.`, "success");
    } catch (e) {
        notifyUser("Lỗi chuyển đổi ảnh mã QR: " + e.message, "error");
    } finally {
        unlockScreen();
        event.target.value = "";
    }
}

/**
 * Xóa ảnh mã QR chuyển khoản (không tự ý sinh ảnh thay thế)
 */
export function removeAdminLiveStreamQr() {
    if (isLiveStreamPaymentBlocked) {
        handleLiveStreamLockedInputClick();
        return;
    }
    adminLiveStreamConfig.qrCodeImage = "";
    if (adminLiveStreamConfig.bankInfo) adminLiveStreamConfig.bankInfo.qrCodeImage = "";
    const qrUrlInput = document.getElementById("adminLiveStreamQrUrlInput");
    const qrPreview = document.getElementById("adminLiveStreamQrPreview");
    const qrEmpty = document.getElementById("adminLiveStreamQrEmpty");
    const qrRemoveBtn = document.getElementById("adminLiveStreamQrRemoveBtn");
    const qrStatus = document.getElementById("adminLiveStreamQrStatus");

    if (qrUrlInput) qrUrlInput.value = "";
    if (qrPreview) {
        qrPreview.removeAttribute("src");
        qrPreview.classList.add("hidden");
    }
    if (qrEmpty) qrEmpty.classList.remove("hidden");
    if (qrRemoveBtn) qrRemoveBtn.classList.add("hidden");
    if (qrStatus) {
        qrStatus.textContent = "Chưa có ảnh mã QR chuyển khoản";
        qrStatus.className = "text-[10px] text-gray-500 font-medium block mt-1";
    }
    notifyUser("Đã gỡ ảnh mã QR chuyển khoản.", "info");
}

/**
 * Xử lý bật/tắt cờ Live Stream có Dialog xác nhận và tự động lưu ngay xuống máy chủ
 */
export async function handleLiveStreamQuickToggleConfirm(checkbox) {
    if (!checkbox) checkbox = document.getElementById("livestreamQuickOrderToggle");
    if (!checkbox) return;

    const isEnabling = !!checkbox.checked;
    const confirmFn = (typeof showLiveStreamConfirmDialog === "function")
        ? showLiveStreamConfirmDialog
        : ((typeof window !== "undefined" && typeof window.showLiveStreamConfirmDialog === "function") ? window.showLiveStreamConfirmDialog : null);

    const confirmed = confirmFn
        ? await confirmFn(isEnabling)
        : window.confirm(isEnabling ? "BẬT PHIÊN LIVE STREAM & MỞ NHẬN ĐƠN NHANH?" : "TẮT PHIÊN LIVE STREAM & ĐÓNG NHẬN ĐƠN?");

    if (!confirmed) {
        checkbox.checked = !isEnabling;
        return;
    }

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen(isEnabling ? "Đang BẬT phiên Live Stream & mở cổng đặt đơn..." : "Đang TẮT phiên Live Stream...");

    try {
        const payload = Object.assign({}, adminLiveStreamConfig || {}, {
            enableQuickOrder: isEnabling,
            enabled: isEnabling
        });

        const res = await fetch(`${API_BASE}/admin/livestream-config`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Không thể cập nhật trạng thái Live Stream");

        adminLiveStreamConfig = json.data;
        await renderLiveStreamConfig(adminLiveStreamConfig);

        // Đồng bộ với toggle và badge ở tab Đơn Live Stream (nếu có trên DOM)
        const tabLiveToggle = document.getElementById("liveStreamQuickToggle");
        if (tabLiveToggle) tabLiveToggle.checked = isEnabling;
        const tabLiveBadge = document.getElementById("liveStreamStatusBadge");
        if (tabLiveBadge) {
            if (isEnabling) {
                tabLiveBadge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs";
                tabLiveBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> <i class="fa-solid fa-signal"></i> ĐANG PHÁT SÓNG (BẬT CHỐT ĐƠN)`;
            } else {
                tabLiveBadge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200";
                tabLiveBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-gray-400"></span> <i class="fa-solid fa-pause"></i> ĐÃ TẠM DỪNG (TẮT CHỐT ĐƠN)`;
            }
        }

        notifyUser(
            isEnabling
                ? "🟢 Đã BẬT phiên Live Stream & mở cổng đặt nhanh thành công!"
                : "🔴 Đã TẮT phiên Live Stream & tạm dừng nhận đơn thành công!",
            "success"
        );
    } catch (e) {
        checkbox.checked = !isEnabling;
        notifyUser("Lỗi cập nhật Live Stream: " + e.message, "error");
    } finally {
        unlockScreen();
    }
}

export async function saveLiveStreamConfig() {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const toggle = document.getElementById("livestreamQuickOrderToggle");
    const titleInput = document.getElementById("livestreamTitleInput");
    const descInput = document.getElementById("livestreamDescInput");
    const bankNameInput = document.getElementById("livestreamBankNameInput");
    const bankAccInput = document.getElementById("livestreamBankAccountInput");
    const bankOwnerInput = document.getElementById("livestreamBankOwnerInput");

    // Giữ nguyên trạng thái cờ live hiện tại của phiên
    const isLive = toggle ? !!toggle.checked : !!(adminLiveStreamConfig?.enableQuickOrder || adminLiveStreamConfig?.enabled);
    const title = titleInput ? titleInput.value.trim() : "";
    const bankName = bankNameInput ? bankNameInput.value.trim() : "";
    const accountNumber = bankAccInput ? bankAccInput.value.trim() : "";
    const hasQr = !!(adminLiveStreamConfig?.qrCodeImage || adminLiveStreamConfig?.bankInfo?.qrCodeImage);
    const pinnedCount = (adminLiveStreamConfig?.featuredProductIds || []).length;

    // Hiển thị hộp thoại xác nhận lưu cấu hình Live Stream
    const confirmFn = (typeof showSaveLiveStreamConfigDialog === "function")
        ? showSaveLiveStreamConfigDialog
        : ((typeof window !== "undefined" && typeof window.showSaveLiveStreamConfigDialog === "function") ? window.showSaveLiveStreamConfigDialog : null);

    const confirmed = confirmFn
        ? await confirmFn({ title, isLive, bankName, accountNumber, hasQr, pinnedCount })
        : window.confirm("Bạn có chắc chắn muốn lưu toàn bộ thông tin cấu hình Live Stream xuống hệ thống?");

    if (!confirmed) {
        return;
    }

    const payload = {
        enableQuickOrder: isLive,
        enabled: isLive,
        title: title,
        description: descInput ? descInput.value.trim() : "",
        qrCodeImage: adminLiveStreamConfig.qrCodeImage || "",
        featuredProductIds: adminLiveStreamConfig.featuredProductIds || [],
        bankInfo: {
            bankName: bankName,
            accountNumber: accountNumber,
            accountName: bankOwnerInput ? bankOwnerInput.value.trim() : "",
            qrCodeImage: adminLiveStreamConfig.qrCodeImage || ""
        }
    };

    lockScreen("Đang lưu thông tin cấu hình Live Stream (Tiêu đề, STK, Mã QR, Mẫu hoa ghim)...");
    try {
        const res = await fetch(`${API_BASE}/admin/livestream-config`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Không thể lưu cấu hình Live Stream");

        adminLiveStreamConfig = json.data;
        isLiveStreamPaymentBlocked = true;
        await renderLiveStreamConfig(adminLiveStreamConfig);
        notifyUser(
            "Đã lưu thông tin cấu hình Live Stream (Tiêu đề, STK, QR, Bó hoa ghim) thành công!",
            "success"
        );
    } catch (e) {
        notifyUser("Lỗi lưu cấu hình Live Stream: " + e.message, "error");
    } finally {
        unlockScreen();
    }
}

export function getLiveStreamQuickOrderUrl() {
    const linkInput = document.getElementById("livestreamShareLinkInput");
    if (linkInput && linkInput.value && linkInput.value.trim()) {
        return linkInput.value.trim();
    }
    if (typeof window !== "undefined") {
        const origin = window.location.origin || "";
        let pathname = window.location.pathname || "/";
        if (!pathname.endsWith("/") && !pathname.includes(".")) {
            pathname += "/";
        }
        return `${origin}${pathname}#quick-order`;
    }
    return "#quick-order";
}

export function copyQuickOrderLink() {
    const linkInput = document.getElementById("livestreamShareLinkInput");
    const url = getLiveStreamQuickOrderUrl();

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            notifyUser("Đã sao chép đường link Đặt Hàng Nhanh Live Stream vào bộ nhớ tạm!", "success");
        }).catch(() => {
            if (linkInput) linkInput.select();
            document.execCommand("copy");
            notifyUser("Đã sao chép link đặt hàng nhanh!", "success");
        });
    } else {
        if (linkInput) linkInput.select();
        document.execCommand("copy");
        notifyUser("Đã sao chép link đặt hàng nhanh!", "success");
    }
}

export function previewQuickOrder() {
    const targetUrl = getLiveStreamQuickOrderUrl();
    if (typeof window !== "undefined") {
        // Luôn mở cửa sổ / tab mới để quản trị viên kiểm tra trải nghiệm khách hàng độc lập
        const newWin = window.open(targetUrl, "_blank");
        if (newWin) {
            try {
                newWin.focus();
            } catch (_) { }
        } else {
            // Trường hợp trình duyệt chặn popup mới hiển thị cảnh báo và mở modal dự phòng
            notifyUser("Trình duyệt đang chặn cửa sổ bật lên (popup). Đang mở xem trước tại cửa sổ này...", "warning");
            if (typeof openQuickOrderModal === "function") {
                openQuickOrderModal();
            }
        }
    } else if (typeof openQuickOrderModal === "function") {
        openQuickOrderModal();
    }
}

export function shareQuickOrderLink() {
    const url = getLiveStreamQuickOrderUrl();
    const title = (document.getElementById("livestreamTitleInput")?.value || "Đặt Hoa Nhanh Live Stream");

    if (navigator.share) {
        navigator.share({
            title: title,
            text: "Đặt hoa tươi nhanh trong phiên Live Stream Nở Hoa Thả Bình:",
            url: url
        }).catch(() => { });
    } else {
        copyQuickOrderLink();
    }
}

// ==========================================
// CẤU HÌNH BANNER TRÌNH CHIẾU (banners.json)
// ==========================================
export let adminBannersConfig = {
    interval: 5000,
    autoplay: true,
    banners: []
};
export let adminBannerCategories = [];

export async function fetchBannerCategoriesIfNeeded() {
    if (Array.isArray(adminBannerCategories) && adminBannerCategories.length > 0) {
        return adminBannerCategories;
    }
    if (typeof allAdminCategories !== 'undefined' && Array.isArray(allAdminCategories) && allAdminCategories.length > 0) {
        adminBannerCategories = allAdminCategories;
        return adminBannerCategories;
    }
    if (typeof window !== 'undefined' && Array.isArray(window.allAdminCategories) && window.allAdminCategories.length > 0) {
        adminBannerCategories = window.allAdminCategories;
        return adminBannerCategories;
    }
    try {
        const token = typeof getAuthToken === "function" ? getAuthToken() : "";
        const res = await fetch(`${API_BASE}/admin/categories`, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                adminBannerCategories = json.data;
                if (typeof window !== 'undefined') window.allAdminCategories = adminBannerCategories;
                return adminBannerCategories;
            }
        }
    } catch (e) { }

    try {
        const pubRes = await fetch(`${API_BASE}/categories?_t=${Date.now()}`);
        if (pubRes.ok) {
            const json = await pubRes.json();
            if (json.success && Array.isArray(json.data)) {
                adminBannerCategories = json.data;
                return adminBannerCategories;
            }
        }
    } catch (e) { }

    try {
        const fbRes = await fetch(`config/anne/categories.json?_t=${Date.now()}`);
        if (fbRes.ok) {
            const data = await fbRes.json();
            if (Array.isArray(data)) {
                adminBannerCategories = data;
                return adminBannerCategories;
            }
        }
    } catch (e) { }

    return adminBannerCategories;
}

export async function loadAdminBanners() {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const listEl = document.getElementById("adminBannersList");
    const statusEl = document.getElementById("adminBannersStatus");
    if (!listEl) return;

    if (statusEl) {
        statusEl.textContent = "Đang tải…";
        statusEl.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500";
    }

    try {
        let loaded = false;
        try {
            const res = await fetch(`${API_BASE}/admin/banners?_t=${Date.now()}`, {
                headers: token ? { "Authorization": `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) {
                    adminBannersConfig = json.data;
                    loaded = true;
                }
            }
        } catch (e) { }

        if (!loaded) {
            try {
                const pubRes = await fetch(`${API_BASE}/banners?_t=${Date.now()}`);
                if (pubRes.ok) {
                    const json = await pubRes.json();
                    adminBannersConfig = json.data || json;
                    loaded = true;
                }
            } catch (e) { }
        }

        if (!loaded) {
            const staticRes = await fetch(`config/anne/banners.json?_t=${Date.now()}`);
            if (staticRes.ok) {
                adminBannersConfig = await staticRes.json();
                loaded = true;
            }
        }

        if (statusEl) {
            statusEl.textContent = "Đã nạp";
            statusEl.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700";
        }
    } catch (err) {
        if (statusEl) {
            statusEl.textContent = "Lỗi nạp";
            statusEl.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600";
        }
    }

    await fetchBannerCategoriesIfNeeded();
    renderAdminBanners();
}

export function renderAdminBanners() {
    const listEl = document.getElementById("adminBannersList");
    const intervalInput = document.getElementById("adminBannerIntervalInput");
    const autoplayInput = document.getElementById("adminBannerAutoplayInput");
    const intervalWrapper = document.getElementById("adminBannerIntervalWrapper");
    if (!listEl) return;

    if (autoplayInput) {
        autoplayInput.checked = adminBannersConfig.autoplay !== false;
        if (intervalWrapper) {
            intervalWrapper.style.opacity = autoplayInput.checked ? "1" : "0.5";
        }
        if (intervalInput) {
            intervalInput.disabled = !autoplayInput.checked;
        }
        autoplayInput.onchange = () => {
            adminBannersConfig.autoplay = autoplayInput.checked;
            if (intervalWrapper) {
                intervalWrapper.style.opacity = autoplayInput.checked ? "1" : "0.5";
            }
            if (intervalInput) {
                intervalInput.disabled = !autoplayInput.checked;
            }
        };
    }

    if (intervalInput) {
        intervalInput.value = Math.round((adminBannersConfig.interval || 5000) / 1000);
    }

    const banners = Array.isArray(adminBannersConfig.banners) ? adminBannersConfig.banners : [];
    if (banners.length === 0) {
        listEl.innerHTML = `
            <div class="col-span-full text-center py-10 bg-white rounded-2xl border border-gray-200 text-gray-400 text-xs">
                <i class="fa-solid fa-images text-2xl mb-2 text-gray-300"></i>
                <p>Chưa có hình ảnh nào trong danh sách. Hãy nhấn "Thêm Banner Mới" bên dưới!</p>
            </div>
        `;
        return;
    }

    const activeCats = (Array.isArray(adminBannerCategories) && adminBannerCategories.length > 0)
        ? adminBannerCategories
        : ((typeof allAdminCategories !== 'undefined' && Array.isArray(allAdminCategories) && allAdminCategories.length > 0)
            ? allAdminCategories
            : ((typeof window !== 'undefined' && Array.isArray(window.allAdminCategories)) ? window.allAdminCategories : []));

    let html = '';
    banners.forEach((b, idx) => {
        const active = b.active !== false;
        const imgUrl = b.image || '';
        const title = b.title || '';
        const link = b.link || '#products';
        const order = b.order || (idx + 1);

        const isProductLink = link === '#products';
        const isAboutLink = link === '#about';
        const isContactLink = link === '#contact';
        const matchedCat = activeCats.find(c => {
            const catId = c.id;
            return link === `#cat-${catId}` || link === `#${catId}` || (c.slug && link === `#${c.slug}`);
        });

        let selectVal = 'custom';
        if (isProductLink) selectVal = '#products';
        else if (isAboutLink) selectVal = '#about';
        else if (isContactLink) selectVal = '#contact';
        else if (matchedCat) selectVal = `#cat-${matchedCat.id}`;

        html += `
            <div class="bg-white rounded-2xl border ${active ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-60'} p-4 shadow-sm hover:shadow-md transition flex flex-col md:flex-row gap-4 items-start relative group" data-banner-idx="${idx}">
                <!-- Ảnh xem trước -->
                <div class="w-full md:w-44 h-32 md:h-28 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200 relative group/thumb">
                    <img id="adminBannerPreview_${idx}" src="${imgUrl}" alt="${title}" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=500'">
                    <span class="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs">#${idx + 1}</span>
                </div>

                <!-- Các trường dữ liệu -->
                <div class="flex-1 w-full space-y-2.5">
                    <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <!-- Đường dẫn ảnh -->
                        <div class="sm:col-span-8">
                            <label class="block text-[11px] font-bold text-gray-600 mb-1">
                                Đường Dẫn Hình Ảnh (URL / Path) <span class="text-rose-500">*</span>
                            </label>
                            <input type="text" value="${imgUrl}" oninput="updateAdminBannerField(${idx}, 'image', this.value)" placeholder="https://images.unsplash.com/... hoặc /api/flower/v1/images/..." class="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-800 focus:outline-none focus:border-primary focus:bg-white transition">
                        </div>

                        <!-- Thứ tự -->
                        <div class="sm:col-span-4">
                            <label class="block text-[11px] font-bold text-gray-600 mb-1">Thứ tự hiển thị</label>
                            <input type="number" min="1" value="${order}" onchange="updateAdminBannerField(${idx}, 'order', parseInt(this.value) || 1)" class="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-primary focus:bg-white transition">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <!-- Chọn nhanh danh mục hoa / đích đến -->
                        <div class="sm:col-span-6">
                            <label class="block text-[11px] font-bold text-gray-700 mb-1 flex items-center justify-between">
                                <span class="flex items-center gap-1"><i class="fa-solid fa-layer-group text-primary"></i> Đích đến (Danh mục hoa)</span>
                                <span class="text-[10px] text-gray-400 font-normal">Chọn nhanh</span>
                            </label>
                            <select id="adminBannerSelect_${idx}" onchange="handleAdminBannerTargetSelect(${idx}, this.value)" class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:border-primary focus:bg-white transition cursor-pointer">
                                <option value="#products" ${selectVal === '#products' ? 'selected' : ''}>Toàn bộ sản phẩm (#products)</option>
                                ${activeCats && activeCats.length > 0 ? `
                                <optgroup label="Danh mục hoa tươi">
                                    ${activeCats.map(cat => {
            const catTarget = `#cat-${cat.id}`;
            const catName = cat.name || cat.id;
            const isSel = selectVal === catTarget;
            return `<option value="${catTarget}" ${isSel ? 'selected' : ''}>🌸 ${catName} (${catTarget})</option>`;
        }).join('')}
                                </optgroup>` : ''}
                                <optgroup label="Khu vực khác trên trang">
                                    <option value="#about" ${selectVal === '#about' ? 'selected' : ''}>Về chúng tôi (#about)</option>
                                    <option value="#contact" ${selectVal === '#contact' ? 'selected' : ''}>Liên hệ & Đặt hàng (#contact)</option>
                                </optgroup>
                                <option value="custom" ${selectVal === 'custom' ? 'selected' : ''}>🔗 Tùy chỉnh (Nhập link riêng)...</option>
                            </select>
                        </div>

                        <!-- Đường dẫn link thực tế -->
                        <div class="sm:col-span-6">
                            <label class="block text-[11px] font-bold text-gray-700 mb-1 flex items-center justify-between">
                                <span class="flex items-center gap-1"><i class="fa-solid fa-link text-gray-400"></i> Link chuyển đến khi click</span>
                                <span class="text-[10px] text-gray-400 font-normal">Tự động đồng bộ</span>
                            </label>
                            <input type="text" id="adminBannerLinkInput_${idx}" value="${link}" oninput="handleAdminBannerLinkCustomInput(${idx}, this.value)" placeholder="vd: #products hoặc #cat-bo_hoa" class="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-800 focus:outline-none focus:border-primary focus:bg-white transition">
                        </div>
                    </div>

                    <!-- Nút thao tác: Bật/Tắt & Xóa -->
                    <div class="flex items-center justify-between pt-1 border-t border-gray-100">
                        <label class="inline-flex items-center gap-2 cursor-pointer select-none text-xs">
                            <input type="checkbox" ${active ? 'checked' : ''} onchange="updateAdminBannerField(${idx}, 'active', this.checked)" class="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary">
                            <span class="${active ? 'text-green-700 font-semibold' : 'text-gray-400'}">${active ? 'Đang kích hoạt' : 'Tạm ẩn'}</span>
                        </label>

                        <button type="button" onclick="removeAdminBannerItem(${idx})" class="text-xs text-rose-500 hover:text-rose-700 font-bold px-2 py-1 rounded hover:bg-rose-50 transition flex items-center gap-1">
                            <i class="fa-solid fa-trash-can text-xs"></i> Xóa
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    listEl.innerHTML = html;
}

export function updateAdminBannerField(idx, field, value) {
    if (!adminBannersConfig.banners || !adminBannersConfig.banners[idx]) return;
    adminBannersConfig.banners[idx][field] = value;

    if (field === 'image') {
        const preview = document.getElementById(`adminBannerPreview_${idx}`);
        if (preview && value) {
            preview.src = value;
        }
    }
}

export function addAdminBannerItem() {
    if (!Array.isArray(adminBannersConfig.banners)) {
        adminBannersConfig.banners = [];
    }
    const newIdx = adminBannersConfig.banners.length + 1;
    adminBannersConfig.banners.push({
        id: `banner_${Date.now().toString().slice(-4)}`,
        image: "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
        link: "#products",
        active: true,
        order: newIdx
    });
    renderAdminBanners();
}

export function handleAdminBannerTargetSelect(idx, value) {
    const input = document.getElementById(`adminBannerLinkInput_${idx}`);
    if (value === 'custom') {
        if (input) {
            input.focus();
            input.select();
        }
        return;
    }
    updateAdminBannerField(idx, 'link', value);
    if (input) {
        input.value = value;
    }
}

export function handleAdminBannerLinkCustomInput(idx, value) {
    updateAdminBannerField(idx, 'link', value);
    const select = document.getElementById(`adminBannerSelect_${idx}`);
    if (select) {
        const hasOption = Array.from(select.options).some(opt => opt.value === value);
        select.value = hasOption ? value : 'custom';
    }
}

export function removeAdminBannerItem(idx) {
    if (!adminBannersConfig.banners || !adminBannersConfig.banners[idx]) return;
    if (adminBannersConfig.banners.length <= 1) {
        alert("Cần giữ ít nhất 1 ảnh banner cho trang chủ!");
        return;
    }
    adminBannersConfig.banners.splice(idx, 1);
    renderAdminBanners();
}

export async function saveAdminBanners() {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const autoplayInput = document.getElementById("adminBannerAutoplayInput");
    if (autoplayInput) {
        adminBannersConfig.autoplay = autoplayInput.checked;
    }
    const intervalInput = document.getElementById("adminBannerIntervalInput");
    if (intervalInput) {
        const sec = parseInt(intervalInput.value) || 5;
        adminBannersConfig.interval = Math.max(1, sec) * 1000;
    }

    if (!Array.isArray(adminBannersConfig.banners) || adminBannersConfig.banners.length === 0) {
        alert("Danh sách banner không được để trống!");
        return;
    }

    try {
        let saved = false;
        try {
            const res = await fetch(`${API_BASE}/admin/banners`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                },
                body: JSON.stringify(adminBannersConfig)
            });
            if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) {
                    adminBannersConfig = json.data;
                    saved = true;
                }
            }
        } catch (e) { }

        // Đồng bộ tức thời lên LocalStorage cache và giao diện storefront
        try {
            localStorage.setItem('telua_hero_banners_cache', JSON.stringify({
                etag: '',
                data: adminBannersConfig,
                updatedAt: adminBannersConfig.updatedAt || new Date().toISOString()
            }));
        } catch (e) { }

        if (typeof window !== 'undefined' && typeof window.applyHeroBannersConfig === 'function') {
            window.applyHeroBannersConfig(adminBannersConfig, true);
        }

        renderAdminBanners();
        if (typeof notifyUser === 'function') {
            notifyUser("Đã lưu cấu hình banner trình chiếu (banners.json) thành công!", "success");
        } else {
            alert("Đã lưu cấu hình banner thành công!");
        }
    } catch (err) {
        if (typeof notifyUser === 'function') {
            notifyUser("Lỗi lưu cấu hình: " + err.message, "error");
        } else {
            alert("Lỗi: " + err.message);
        }
    }
}

export async function loadAdminCompanyInfo() {
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

export const OPERATING_DAYS_MAP = [
    { key: "T2", label: "Thứ 2", full: "Thứ 2" },
    { key: "T3", label: "Thứ 3", full: "Thứ 3" },
    { key: "T4", label: "Thứ 4", full: "Thứ 4" },
    { key: "T5", label: "Thứ 5", full: "Thứ 5" },
    { key: "T6", label: "Thứ 6", full: "Thứ 6" },
    { key: "T7", label: "Thứ 7", full: "Thứ 7" },
    { key: "CN", label: "Chủ Nhật", full: "Chủ Nhật" }
];

export let companyActiveDays = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];
export let branchActiveDays = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];

export function formatOperatingDays(daysList) {
    if (!daysList || daysList.length === 0) return "Thứ 2 - Chủ Nhật";
    if (daysList.length === 7) return "Thứ 2 - Chủ Nhật";
    const allWeekdays = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
    const isT2T7 = daysList.length === 6 && allWeekdays.every(d => daysList.includes(d));
    if (isT2T7) return "Thứ 2 - Thứ 7";
    const isT2T6 = daysList.length === 5 && ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"].every(d => daysList.includes(d));
    if (isT2T6) return "Thứ 2 - Thứ 6";
    return daysList.join(", ");
}

export function parseDaysFromHoursString(hoursStr) {
    if (!hoursStr || typeof hoursStr !== "string") return ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];
    if (hoursStr.includes("Thứ 2 - Thứ 6")) {
        return ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
    } else if (hoursStr.includes("Thứ 2 - Thứ 7")) {
        return ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
    } else if (hoursStr.includes("Thứ 2 - Chủ Nhật") || hoursStr.includes("Hàng ngày")) {
        return ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];
    }
    const matched = [];
    ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"].forEach(d => {
        if (hoursStr.includes(d)) matched.push(d);
    });
    return matched.length > 0 ? matched : ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];
}

export function renderOperatingDaysPills(target = "company") {
    const isCompany = target === "company";
    const containerId = isCompany ? "companyDaysPills" : "branchDaysPills";
    const el = document.getElementById(containerId);
    if (!el) return;

    const currentList = isCompany ? companyActiveDays : branchActiveDays;
    let html = "";
    OPERATING_DAYS_MAP.forEach(d => {
        const isChecked = currentList.includes(d.full);
        const btnClass = isChecked
            ? "px-2.5 py-1 bg-primary text-white font-bold text-xs rounded-lg shadow-2xs transition flex items-center"
            : "px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium text-xs rounded-lg transition flex items-center";
        html += `<button type="button" onclick="toggleOperatingDay('${target}', '${d.full}')" class="${btnClass}">
            <i class="fa-solid ${isChecked ? 'fa-circle-check text-white' : 'fa-circle text-gray-300'} text-[10px] mr-1"></i>${d.label}
        </button>`;
    });
    el.innerHTML = html;

    const formattedDays = formatOperatingDays(currentList);
    const hiddenId = isCompany ? "companyDaysValue" : "branchDaysValue";
    const hiddenEl = document.getElementById(hiddenId);
    if (hiddenEl) hiddenEl.value = formattedDays;

    if (isCompany) syncCompanyHoursFromControls();
    else if (typeof syncBranchHoursFromControls === "function") syncBranchHoursFromControls();
}

export function toggleOperatingDay(target, day) {
    let list = target === "company" ? companyActiveDays : branchActiveDays;
    if (list.includes(day)) {
        if (list.length > 1) {
            list = list.filter(d => d !== day);
        }
    } else {
        list.push(day);
    }
    if (target === "company") companyActiveDays = list;
    else branchActiveDays = list;
    renderOperatingDaysPills(target);
}

export function selectOperatingDaysPreset(target, preset) {
    let list = [];
    if (preset === "all") {
        list = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];
    } else if (preset === "t2_t7") {
        list = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
    } else if (preset === "t2_t6") {
        list = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
    }
    if (target === "company") companyActiveDays = list;
    else branchActiveDays = list;
    renderOperatingDaysPills(target);
}

export function populateOperatingTimeSelects(openSelectId, closeSelectId, defaultOpen = "07:00", defaultClose = "21:00") {
    const openEl = document.getElementById(openSelectId);
    const closeEl = document.getElementById(closeSelectId);
    if (!openEl || !closeEl) return;

    let optionsHtml = '';
    for (let h = 5; h <= 23; h++) {
        for (let m = 0; m < 60; m += 30) {
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            optionsHtml += `<option value="${timeStr}">${timeStr}</option>`;
        }
    }
    openEl.innerHTML = optionsHtml;
    closeEl.innerHTML = optionsHtml;
    openEl.value = defaultOpen;
    closeEl.value = defaultClose;
}

export function syncCompanyHoursFromControls() {
    const openEl = document.getElementById("companyOpenTimeSelect");
    const closeEl = document.getElementById("companyCloseTimeSelect");
    const inputEl = document.getElementById("companyHoursInput");
    const displayEl = document.getElementById("companyHoursDisplay");
    const previewEl = document.getElementById("previewCompanyHours");

    if (!openEl || !closeEl || !inputEl) return;

    const openTime = openEl.value || "07:00";
    const closeTime = closeEl.value || "21:00";
    const days = formatOperatingDays(companyActiveDays);

    const formatted = `${days}: ${openTime} - ${closeTime}`;
    inputEl.value = formatted;
    if (displayEl) displayEl.textContent = formatted;
    if (previewEl) previewEl.textContent = formatted;
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
    setValue("companyFacebookInput", data.facebook);
    setValue("companyInstagramInput", data.instagram);
    setValue("companyTiktokInput", data.tiktok);
    setValue("companyZaloInput", data.zalo);
    setValue("companyWhatsappInput", data.whatsapp);
    setValue("companyMapUrlInput", data.mapUrl);
    setValue("companyMapEmbedUrlInput", data.mapEmbedUrl);

    // Phân giải và đồng bộ Giờ Mở Cửa kiểu hh:mm vào select box
    populateOperatingTimeSelects("companyOpenTimeSelect", "companyCloseTimeSelect", "07:00", "21:00");
    const workingHours = data.workingHours || "Thứ 2 - Chủ Nhật: 07:00 - 21:00";
    setValue("companyHoursInput", workingHours);

    const matchTime = workingHours.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (matchTime) {
        const openTime = matchTime[1].length === 4 ? `0${matchTime[1]}` : matchTime[1];
        const closeTime = matchTime[2].length === 4 ? `0${matchTime[2]}` : matchTime[2];
        setValue("companyOpenTimeSelect", openTime);
        setValue("companyCloseTimeSelect", closeTime);
    }
    companyActiveDays = parseDaysFromHoursString(workingHours);
    renderOperatingDaysPills("company");
    syncCompanyHoursFromControls();
}

function updateLiveCompanyPreview(data) {
    if (!data) return;
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || "—";
    };

    setText("previewCompanyName", data.companyName || "NỞ HOA THẢ BÌNH");
    setText("previewCompanySlogan", data.brandSlogan || "Hoa Tươi Thiết Kế & Cắm Hoa Thả Bình");
    setText("previewCompanyAddress", data.address || "62A, Nguyễn Hồng Đào, Phường Tân Bình, TP. Hồ Chí Minh");
    setText("previewCompanyHotline", data.hotline || data.phone || "0976.491.322");
    setText("previewCompanyEmail", data.email || "cskh@nohoathabinh.vn");
    setText("previewCompanyHours", data.workingHours || "Thứ 2 - Chủ Nhật: 7:00 - 21:00");
}

function bindLiveCompanyInfoInputs() {
    const inputs = [
        { id: "companyNameInput", target: "previewCompanyName", fallback: "NỞ HOA THẢ BÌNH" },
        { id: "companySloganInput", target: "previewCompanySlogan", fallback: "Hoa Tươi Thiết Kế & Cắm Hoa Thả Bình" },
        { id: "companyAddressInput", target: "previewCompanyAddress", fallback: "62A, Nguyễn Hồng Đào, Phường Tân Bình, TP. Hồ Chí Minh" },
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

export async function handleCompanyInfoSubmit(event) {
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
        tiktok: getValue("companyTiktokInput"),
        zalo: getValue("companyZaloInput"),
        whatsapp: getValue("companyWhatsappInput"),
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

            // Cập nhật ngay lên giao diện bán hàng và làm mới cache ETag
            if (typeof window !== "undefined") {
                if (typeof window.applyStorefrontCompanyInfo === "function") {
                    window.applyStorefrontCompanyInfo(adminCompanyInfo);
                }
                if (typeof window.loadStorefrontCompanyInfo === "function") {
                    window.loadStorefrontCompanyInfo(true).catch(() => { });
                }
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
// CẤU HÌNH PHÂN TẦNG MỨC GIÁ (price_levels.json)
// ==========================================

export let adminPriceLevels = [];

export async function loadAdminPriceLevels() {
    const listEl = document.getElementById("adminPriceLevelsList");
    const badge = document.getElementById("priceLevelsConfigStatus");
    if (!listEl) return;

    listEl.innerHTML = `
        <div class="text-center py-10 text-gray-400 text-xs">
            <i class="fa-solid fa-circle-notch fa-spin text-lg mb-2 text-indigo-500"></i>
            <p>Đang nạp cấu hình phân tầng giá...</p>
        </div>`;

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/price-levels?_t=${Date.now()}`, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        const json = await res.json();
        if (!res.ok || !json.success || !Array.isArray(json.data)) {
            throw new Error(json.message || "Không tải được danh sách phân tầng giá");
        }
        adminPriceLevels = json.data;
        if (typeof setAdminPriceLevels === "function") {
            setAdminPriceLevels(adminPriceLevels);
        }
        renderAdminPriceLevels(adminPriceLevels);
        if (badge) {
            badge.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200";
            badge.innerHTML = `<i class="fa-solid fa-circle-check mr-1 text-[8px] text-emerald-500"></i> Đã tải ${adminPriceLevels.length} mức giá • ${new Date().toLocaleTimeString()}`;
        }
    } catch (e) {
        listEl.innerHTML = `
            <div class="text-center py-8 bg-white rounded-xl border border-red-100">
                <i class="fa-solid fa-triangle-exclamation text-xl text-red-400 mb-2"></i>
                <p class="text-xs font-semibold text-gray-700">Không thể tải cấu hình phân tầng giá</p>
                <p class="text-[11px] text-gray-400 mt-1">${e.message}</p>
            </div>`;
        if (badge) {
            badge.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200";
            badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1 text-[8px] text-red-500"></i> Lỗi tải`;
        }
    }
}

export function renderAdminPriceLevels(levels) {
    const listEl = document.getElementById("adminPriceLevelsList");
    if (!listEl) return;

    if (!levels || levels.length === 0) {
        listEl.innerHTML = `<p class="text-center text-xs text-gray-400 py-8">Chưa có phân tầng mức giá nào.</p>`;
        return;
    }

    listEl.innerHTML = levels.map((lvl, idx) => {
        const minP = Number(lvl.minPrice) || 0;
        const maxP = Number(lvl.maxPrice) || 0;
        const defP = Number(lvl.defaultPrice) || minP;
        return `
            <div class="bg-white rounded-2xl border border-gray-200 shadow-2xs p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-indigo-200">
                <div class="flex items-start gap-3.5 min-w-0 flex-1">
                    <div class="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-base font-extrabold flex-shrink-0 border border-indigo-100 shadow-inner">
                        ${lvl.code || `LV_${idx + 1}`}
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h5 class="text-sm font-bold text-gray-900">${lvl.name || lvl.id}</h5>
                            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200 font-semibold">${lvl.id}</span>
                        </div>
                        <p class="text-xs text-gray-500 mt-1 leading-relaxed">${lvl.description || "Chưa có mô tả định hướng"}</p>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100 md:min-w-[340px] text-center">
                    <div>
                        <span class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Giá Sàn</span>
                        <span class="text-xs font-bold text-gray-800">${minP.toLocaleString()}₫</span>
                    </div>
                    <div class="border-x border-gray-200">
                        <span class="block text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Đề Xuất</span>
                        <span class="text-xs font-bold text-indigo-600">${defP.toLocaleString()}₫</span>
                    </div>
                    <div>
                        <span class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Giá Trần</span>
                        <span class="text-xs font-bold text-gray-800">${maxP.toLocaleString()}₫</span>
                    </div>
                </div>

                <div class="flex items-center gap-2 flex-shrink-0 justify-end">
                    <button type="button" onclick="openPriceLevelModal('${lvl.id}')" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition flex items-center gap-1 cursor-pointer">
                        <i class="fa-solid fa-pen-to-square"></i> Sửa
                    </button>
                    <button type="button" onclick="deletePriceLevel('${lvl.id}')" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl border border-red-200 transition flex items-center gap-1 cursor-pointer">
                        <i class="fa-solid fa-trash-can"></i> Xóa
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

export function openPriceLevelModal(levelId = null) {
    const modal = document.getElementById("priceLevelModal");
    const title = document.getElementById("priceLevelModalTitle");
    const form = document.getElementById("priceLevelForm");
    const errBox = document.getElementById("priceLevelModalError");
    const warnBox = document.getElementById("priceLevelRangeWarning");
    const idInput = document.getElementById("priceLevelIdInput");
    if (!modal) return;

    if (errBox) errBox.classList.add("hidden");
    if (warnBox) warnBox.classList.add("hidden");
    if (form) form.reset();

    if (levelId) {
        const lvl = (adminPriceLevels || []).find(l => l.id === levelId || l.code === levelId);
        if (lvl) {
            document.getElementById("priceLevelModalMode").value = "edit";
            document.getElementById("priceLevelId").value = lvl.id;
            document.getElementById("priceLevelCode").value = lvl.code || "";
            if (idInput) {
                idInput.value = lvl.id || "";
                idInput.disabled = true;
            }
            document.getElementById("priceLevelName").value = lvl.name || "";
            document.getElementById("priceLevelDescription").value = lvl.description || "";
            document.getElementById("priceLevelMinPrice").value = lvl.minPrice || "";
            document.getElementById("priceLevelDefaultPrice").value = lvl.defaultPrice || "";
            document.getElementById("priceLevelMaxPrice").value = lvl.maxPrice || "";
            if (title) title.textContent = `Chỉnh Sửa Phân Tầng: ${lvl.name}`;
        }
    } else {
        document.getElementById("priceLevelModalMode").value = "create";
        document.getElementById("priceLevelId").value = "";
        if (idInput) {
            idInput.value = `price_lvl_${String((adminPriceLevels.length || 0) + 1).padStart(2, '0')}`;
            idInput.disabled = false;
        }
        document.getElementById("priceLevelCode").value = `LV_${String((adminPriceLevels.length || 0) + 1).padStart(2, '0')}`;
        if (title) title.textContent = "Thêm Mới Phân Tầng Mức Giá";
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

export function closePriceLevelModal() {
    const modal = document.getElementById("priceLevelModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export function validatePriceLevelModalNumbers() {
    const minEl = document.getElementById("priceLevelMinPrice");
    const defEl = document.getElementById("priceLevelDefaultPrice");
    const maxEl = document.getElementById("priceLevelMaxPrice");
    const warn = document.getElementById("priceLevelRangeWarning");
    if (!minEl || !defEl || !maxEl || !warn) return true;

    const minP = parseInt(minEl.value, 10) || 0;
    const defP = parseInt(defEl.value, 10) || 0;
    const maxP = parseInt(maxEl.value, 10) || 0;

    if (maxP > 0 && maxP < minP) {
        warn.textContent = `⚠️ Giá trần (${maxP.toLocaleString()}₫) đang nhỏ hơn giá sàn (${minP.toLocaleString()}₫)!`;
        warn.classList.remove("hidden");
        return false;
    }
    if (defP > 0 && (defP < minP || (maxP > 0 && defP > maxP))) {
        warn.textContent = `⚠️ Giá đề xuất (${defP.toLocaleString()}₫) phải nằm trong khoảng [${minP.toLocaleString()}₫ - ${maxP.toLocaleString()}₫]!`;
        warn.classList.remove("hidden");
        return false;
    }

    warn.classList.add("hidden");
    return true;
}

export async function savePriceLevelFromModal(event) {
    if (event) event.preventDefault();
    const mode = document.getElementById("priceLevelModalMode").value;
    const id = document.getElementById("priceLevelId").value;
    const idInput = document.getElementById("priceLevelIdInput");
    const customId = idInput ? idInput.value.trim() : "";
    const code = document.getElementById("priceLevelCode").value.trim().toUpperCase();
    const name = document.getElementById("priceLevelName").value.trim();
    const description = document.getElementById("priceLevelDescription").value.trim();
    const minPrice = parseInt(document.getElementById("priceLevelMinPrice").value, 10);
    const defaultPrice = parseInt(document.getElementById("priceLevelDefaultPrice").value, 10);
    const maxPrice = parseInt(document.getElementById("priceLevelMaxPrice").value, 10);

    const errBox = document.getElementById("priceLevelModalError");
    if (!validatePriceLevelModalNumbers()) {
        return;
    }

    const payload = {
        code,
        name,
        description,
        minPrice,
        defaultPrice,
        maxPrice
    };
    if (mode === "create" && customId) {
        payload.id = customId;
    }

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen(mode === "create" ? "Đang thêm phân tầng mức giá mới..." : "Đang cập nhật phân tầng mức giá...");
    try {
        const url = mode === "create"
            ? `${API_BASE}/admin/price-levels`
            : `${API_BASE}/admin/price-levels/${encodeURIComponent(id)}`;
        const method = mode === "create" ? "POST" : "PUT";

        const res = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (res.ok && json.success) {
            notifyUser(json.message || "Đã lưu phân tầng mức giá thành công!", 'success');
            closePriceLevelModal();
            await loadAdminPriceLevels();
            if (typeof window !== "undefined" && typeof window.populatePriceLevelSelect === "function") {
                window.populatePriceLevelSelect();
            }
        } else {
            if (errBox) {
                errBox.textContent = json.message || "Lỗi khi lưu phân tầng mức giá";
                errBox.classList.remove("hidden");
            } else {
                notifyUser(json.message || "Lỗi lưu mức giá", 'error');
            }
        }
    } catch (e) {
        if (errBox) {
            errBox.textContent = "Lỗi kết nối máy chủ: " + e.message;
            errBox.classList.remove("hidden");
        } else {
            notifyUser("Lỗi kết nối: " + e.message, 'error');
        }
    } finally {
        unlockScreen();
    }
}

export async function deletePriceLevel(levelId) {
    if (!levelId) return;
    const lvl = (adminPriceLevels || []).find(l => l.id === levelId || l.code === levelId);
    const lvlName = lvl ? `${lvl.code}: ${lvl.name}` : levelId;

    const isConfirmed = await (typeof showConfirmDialog === 'function' ? showConfirmDialog : window.showConfirmDialog)({
        title: "Xác nhận xóa phân tầng giá",
        message: `Bạn có chắc chắn muốn xóa phân tầng "${lvlName}" khỏi hệ thống không? Lưu ý: Nếu có mẫu hoa đang thuộc phân tầng này, hệ thống sẽ từ chối xóa để đảm bảo an toàn.`,
        confirmText: "Xóa Ngay",
        cancelText: "Hủy Bỏ",
        type: "danger"
    });
    if (!isConfirmed) return;

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen("Đang xóa phân tầng giá...");
    try {
        const res = await fetch(`${API_BASE}/admin/price-levels/${encodeURIComponent(levelId)}`, {
            method: "DELETE",
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        const json = await res.json();
        if (res.ok && json.success) {
            notifyUser(json.message || "Đã xóa phân tầng mức giá thành công!", 'success');
            await loadAdminPriceLevels();
            if (typeof window !== "undefined" && typeof window.populatePriceLevelSelect === "function") {
                window.populatePriceLevelSelect();
            }
        } else {
            notifyUser(json.message || "Không thể xóa phân tầng giá", 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}


// ==========================================
// CẤU HÌNH THÔNG BÁO ĐƠN HÀNG (notifyConfig.json - Telegram Channel / Email)
// ==========================================

export let adminNotifyConfig = {
    enabled: false,
    notifyOnStandardOrder: true,
    notifyOnQuickOrder: true,
    telegram: {
        enabled: false,
        botToken: "",
        chatId: "",
        channelName: "",
        parseMode: "HTML",
        includeCustomerPhone: true,
        includeAddress: true,
        includeNotes: true
    },
    email: {
        enabled: false,
        recipientEmail: ""
    }
};

export async function loadAdminNotifyConfig() {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const badge = document.getElementById("notifyConfigStatus");
    const testBox = document.getElementById("notifyTestResultBox");
    if (testBox) testBox.classList.add("hidden");

    try {
        const res = await fetch(`${API_BASE}/admin/notify-config?_t=${Date.now()}`, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.data) {
            throw new Error(json.message || "Không thể tải cấu hình thông báo");
        }
        adminNotifyConfig = json.data;
        renderAdminNotifyConfig(adminNotifyConfig);
        if (badge) {
            const isReady = !!(adminNotifyConfig.enabled && adminNotifyConfig.telegram && adminNotifyConfig.telegram.enabled && adminNotifyConfig.telegram.chatId);
            badge.className = isReady
                ? "inline-flex items-center text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "inline-flex items-center text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-300";
            badge.innerHTML = isReady
                ? `<i class="fa-solid fa-circle-check mr-1 text-[8px] text-emerald-500"></i> Đang bật Telegram (${adminNotifyConfig.telegram.channelName || adminNotifyConfig.telegram.chatId})`
                : `<i class="fa-solid fa-circle-pause mr-1 text-[8px] text-gray-400"></i> Đang tắt hoặc chưa điền Channel`;
        }
    } catch (e) {
        if (badge) {
            badge.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200";
            badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1 text-[8px] text-red-500"></i> Lỗi tải cấu hình`;
        }
    }
}

export function renderAdminNotifyConfig(cfg) {
    if (!cfg) return;
    const tg = cfg.telegram || {};
    const em = cfg.email || {};

    const masterToggle = document.getElementById("notifyMasterEnabledToggle");
    const quickToggle = document.getElementById("notifyOnQuickOrderToggle");
    const stdToggle = document.getElementById("notifyOnStandardOrderToggle");
    const tgToggle = document.getElementById("notifyTelegramEnabledToggle");
    const botTokenInput = document.getElementById("notifyTelegramBotTokenInput");
    const chatIdInput = document.getElementById("notifyTelegramChatIdInput");
    const channelNameInput = document.getElementById("notifyTelegramChannelNameInput");
    const incPhone = document.getElementById("notifyTelegramIncludePhone");
    const incAddr = document.getElementById("notifyTelegramIncludeAddress");
    const incNotes = document.getElementById("notifyTelegramIncludeNotes");
    const emailInput = document.getElementById("notifyEmailRecipientInput");

    if (masterToggle) masterToggle.checked = !!cfg.enabled;
    if (quickToggle) quickToggle.checked = cfg.notifyOnQuickOrder !== false;
    if (stdToggle) stdToggle.checked = cfg.notifyOnStandardOrder !== false;
    if (tgToggle) tgToggle.checked = !!tg.enabled;
    if (botTokenInput) botTokenInput.value = tg.botToken || "";
    if (chatIdInput) chatIdInput.value = tg.chatId || "";
    if (channelNameInput) channelNameInput.value = tg.channelName || "";
    if (incPhone) incPhone.checked = tg.includeCustomerPhone !== false;
    if (incAddr) incAddr.checked = tg.includeAddress !== false;
    if (incNotes) incNotes.checked = tg.includeNotes !== false;
    if (emailInput) emailInput.value = em.recipientEmail || "";
}

export function collectAdminNotifyConfigPayload() {
    return {
        enabled: !!document.getElementById("notifyMasterEnabledToggle")?.checked,
        notifyOnQuickOrder: !!document.getElementById("notifyOnQuickOrderToggle")?.checked,
        notifyOnStandardOrder: !!document.getElementById("notifyOnStandardOrderToggle")?.checked,
        telegram: {
            enabled: !!document.getElementById("notifyTelegramEnabledToggle")?.checked,
            botToken: (document.getElementById("notifyTelegramBotTokenInput")?.value || "").trim(),
            chatId: (document.getElementById("notifyTelegramChatIdInput")?.value || "").trim(),
            channelName: (document.getElementById("notifyTelegramChannelNameInput")?.value || "").trim(),
            parseMode: "HTML",
            includeCustomerPhone: !!document.getElementById("notifyTelegramIncludePhone")?.checked,
            includeAddress: !!document.getElementById("notifyTelegramIncludeAddress")?.checked,
            includeNotes: !!document.getElementById("notifyTelegramIncludeNotes")?.checked
        },
        email: {
            enabled: false,
            recipientEmail: (document.getElementById("notifyEmailRecipientInput")?.value || "").trim()
        }
    };
}

export async function saveAdminNotifyConfig() {
    const payload = collectAdminNotifyConfigPayload();
    if (payload.enabled && payload.telegram.enabled) {
        if (!payload.telegram.botToken) {
            notifyUser("Vui lòng nhập Telegram Bot Token để bật thông báo Telegram!", "warning");
            return;
        }
        if (!payload.telegram.chatId) {
            notifyUser("Vui lòng nhập Channel ID / Chat ID nhận thông báo Telegram!", "warning");
            return;
        }
    }

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen("Đang lưu cấu hình thông báo đơn hàng (notifyConfig.json)...");
    try {
        const res = await fetch(`${API_BASE}/admin/notify-config`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
            throw new Error(json.message || "Không thể lưu cấu hình thông báo");
        }
        adminNotifyConfig = json.data || payload;
        renderAdminNotifyConfig(adminNotifyConfig);
        await loadAdminNotifyConfig();
        notifyUser(json.message || "Đã lưu cấu hình thông báo đơn hàng thành công!", "success");
    } catch (e) {
        notifyUser("Lỗi lưu cấu hình thông báo: " + e.message, "error");
    } finally {
        unlockScreen();
    }
}

export async function testTelegramNotification() {
    const payload = collectAdminNotifyConfigPayload();
    const tg = payload.telegram || {};
    const testBox = document.getElementById("notifyTestResultBox");

    if (!tg.botToken || !tg.chatId) {
        if (testBox) {
            testBox.className = "p-3 rounded-xl text-xs font-medium border bg-amber-50 text-amber-800 border-amber-200";
            testBox.textContent = "⚠️ Vui lòng nhập đầy đủ Telegram Bot Token và Channel ID / Chat ID trước khi gửi thử!";
            testBox.classList.remove("hidden");
        }
        notifyUser("Vui lòng nhập Telegram Bot Token và Channel ID trước khi gửi thử!", "warning");
        return;
    }

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen("Đang gửi tin nhắn kiểm thử tới Telegram Channel...");
    try {
        const res = await fetch(`${API_BASE}/admin/notify-config/test-telegram`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ telegram: tg })
        });
        const json = await res.json();
        if (res.ok && json.success) {
            if (testBox) {
                testBox.className = "p-3 rounded-xl text-xs font-medium border bg-emerald-50 text-emerald-800 border-emerald-200";
                testBox.innerHTML = `<i class="fa-solid fa-circle-check mr-1 text-emerald-600"></i> ${json.message || "Đã gửi tin nhắn thử nghiệm tới Telegram Channel thành công!"}`;
                testBox.classList.remove("hidden");
            }
            notifyUser(json.message || "Đã gửi tin nhắn kiểm thử tới Telegram Channel thành công!", "success");
        } else {
            const errMsg = json.message || "Không thể gửi tin nhắn tới Telegram Channel";
            if (testBox) {
                testBox.className = "p-3 rounded-xl text-xs font-medium border bg-red-50 text-red-700 border-red-200";
                testBox.innerHTML = `<i class="fa-solid fa-circle-exclamation mr-1 text-red-600"></i> ${errMsg}`;
                testBox.classList.remove("hidden");
            }
            notifyUser(errMsg, "error");
        }
    } catch (e) {
        if (testBox) {
            testBox.className = "p-3 rounded-xl text-xs font-medium border bg-red-50 text-red-700 border-red-200";
            testBox.textContent = "Lỗi kết nối máy chủ: " + e.message;
            testBox.classList.remove("hidden");
        }
        notifyUser("Lỗi kết nối: " + e.message, "error");
    } finally {
        unlockScreen();
    }
}

export function toggleTelegramTokenVisibility() {
    const input = document.getElementById("notifyTelegramBotTokenInput");
    const icon = document.getElementById("notifyTelegramTokenEyeIcon");
    if (!input) return;
    if (input.type === "password") {
        input.type = "text";
        if (icon) icon.className = "fa-solid fa-eye-slash text-sky-600";
    } else {
        input.type = "password";
        if (icon) icon.className = "fa-solid fa-eye";
    }
}

// ==========================================
// CẤU HÌNH GIÁM SÁT CỤM INSTANCES & LOAD BALANCER (instancesMonitor.json)
// ==========================================

export let adminClusterMonitorData = null;
export let monitorAutoRefreshTimer = null;

export async function loadAdminMonitorInstances(showLoading = true) {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const listEl = document.getElementById("adminMonitorInstancesList");
    const healthBadge = document.getElementById("clusterHealthBadge");

    if (showLoading && listEl) {
        listEl.innerHTML = `
            <div class="p-8 text-center text-gray-400">
                <i class="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-500 mb-2"></i>
                <p class="text-xs font-medium">Đang tải trạng thái các instance trong cụm...</p>
            </div>
        `;
    }

    try {
        const res = await fetch(`${API_BASE}/admin/monitor/instances?_t=${Date.now()}`, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.data) {
            throw new Error(json.message || "Không thể tải danh sách instance");
        }
        adminClusterMonitorData = json.data;
        renderAdminMonitorInstances(adminClusterMonitorData);
    } catch (e) {
        if (listEl) {
            listEl.innerHTML = `
                <div class="p-6 text-center text-red-500 bg-red-50/50 rounded-xl border border-red-100">
                    <i class="fa-solid fa-triangle-exclamation text-xl mb-1 text-red-400"></i>
                    <p class="text-xs font-bold">Lỗi nạp dữ liệu giám sát cụm: ${e.message}</p>
                </div>
            `;
        }
        if (healthBadge) {
            healthBadge.className = "inline-flex items-center text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200";
            healthBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1 text-[8px] text-red-500"></i> Mất kết nối`;
        }
    }
}

export function formatUptimeDuration(seconds) {
    if (!seconds || seconds <= 0) return "0s";
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

export function formatHeartbeatAge(ageSec) {
    if (typeof ageSec !== "number" || ageSec < 0) return "Không rõ";
    if (ageSec < 5) return "vừa xong";
    if (ageSec < 60) return `${ageSec}s trước`;
    const m = Math.floor(ageSec / 60);
    if (m < 60) return `${m}m trước`;
    const h = Math.floor(m / 60);
    return `${h}h trước`;
}

export function formatDateTimeDisplay(isoStr) {
    if (!isoStr) return "N/A";
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");
        const ss = String(d.getSeconds()).padStart(2, "0");
        return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
    } catch (_) {
        return isoStr;
    }
}

export function renderAdminMonitorInstances(data) {
    if (!data) return;
    const stats = data.stats || {};
    const instances = Array.isArray(data.instances) ? data.instances : [];
    const lb = data.loadBalancer || {};

    // 1. Health Badge
    const healthBadge = document.getElementById("clusterHealthBadge");
    if (healthBadge) {
        const health = stats.clusterHealth || "healthy";
        if (health === "healthy") {
            healthBadge.className = "inline-flex items-center text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200";
            healthBadge.innerHTML = `<i class="fa-solid fa-circle-check mr-1 text-[8px] text-emerald-500 animate-pulse"></i> Cụm Khỏe Mạnh (${stats.onlineInstances}/${stats.totalInstances} nodes online)`;
        } else if (health === "warning") {
            healthBadge.className = "inline-flex items-center text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200";
            healthBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1 text-[8px] text-amber-500"></i> Cảnh Báo (${stats.degradedInstances || 0} node trễ, ${stats.offlineInstances || 0} offline)`;
        } else {
            healthBadge.className = "inline-flex items-center text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200";
            healthBadge.innerHTML = `<i class="fa-solid fa-circle-xmark mr-1 text-[8px] text-red-500"></i> Nghiêm Trọng (Không có node online)`;
        }
    }

    // 2. KPI Cards
    const elTot = document.getElementById("monStatTotalNodes");
    const elTot2 = document.getElementById("monStatTotalNodes2");
    const elOnl = document.getElementById("monStatOnlineNodes");
    const elCurr = document.getElementById("monStatCurrentNodeId");
    const elCurrSub = document.getElementById("monStatCurrentNodeSub");
    const elDegOff = document.getElementById("monStatDegradedOffline");
    const elMem = document.getElementById("monStatTotalMem");
    const elReqs = document.getElementById("monStatTotalReqs");

    if (elTot) elTot.textContent = stats.totalInstances || 0;
    if (elTot2) elTot2.textContent = stats.totalInstances || 0;
    if (elOnl) elOnl.textContent = stats.onlineInstances || 0;
    if (elDegOff) {
        elDegOff.textContent = `${stats.degradedInstances || 0} node trễ • ${stats.offlineInstances || 0} offline`;
    }
    if (elCurr) {
        elCurr.textContent = data.currentInstanceId || "node-default";
    }
    if (elCurrSub) {
        elCurrSub.textContent = `Tên: ${data.currentInstanceName || "Local Node"} • Phản hồi phiên này`;
    }
    if (elMem) {
        elMem.textContent = stats.totalMemoryMb ? `${stats.totalMemoryMb} MB` : "N/A";
    }
    if (elReqs) {
        elReqs.textContent = (stats.totalRequests || 0).toLocaleString();
    }

    // 3. Cluster Settings Form Inputs
    const clusterNameInput = document.getElementById("clusterNameInput");
    const clusterLbEnabled = document.getElementById("clusterLbEnabledToggle");
    const clusterLbProvider = document.getElementById("clusterLbProviderInput");
    const clusterLbAlgo = document.getElementById("clusterLbAlgorithmSelect");
    const clusterHbInterval = document.getElementById("clusterHeartbeatIntervalInput");
    const clusterStaleTimeout = document.getElementById("clusterStaleTimeoutInput");
    const clusterAutoPrune = document.getElementById("clusterAutoPruneDaysInput");
    const clusterNotes = document.getElementById("clusterNotesInput");

    if (clusterNameInput) clusterNameInput.value = data.clusterName || "";
    if (clusterLbEnabled) clusterLbEnabled.checked = lb.enabled !== false;
    if (clusterLbProvider) clusterLbProvider.value = lb.provider || "Nginx / Cloudflare / AWS ALB";
    if (clusterLbAlgo) clusterLbAlgo.value = lb.algorithm || "Round Robin";
    if (clusterHbInterval) clusterHbInterval.value = data.heartbeatIntervalSeconds || 30;
    if (clusterStaleTimeout) clusterStaleTimeout.value = data.staleTimeoutSeconds || 90;
    if (clusterAutoPrune) clusterAutoPrune.value = data.autoPruneDays || 7;
    if (clusterNotes) clusterNotes.value = lb.notes || "";

    // 4. Instances List
    const listEl = document.getElementById("adminMonitorInstancesList");
    if (!listEl) return;

    if (instances.length === 0) {
        listEl.innerHTML = `
            <div class="p-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">
                <i class="fa-solid fa-server text-3xl mb-2 text-gray-300"></i>
                <p class="text-xs font-semibold text-gray-600">Chưa có instance nào đăng ký vào cụm</p>
                <p class="text-[11px] text-gray-400 mt-1">Instance hiện tại sẽ tự động ghi nhận khi bạn tải lại trang.</p>
            </div>
        `;
        return;
    }

    let rowsHtml = "";
    instances.forEach((inst) => {
        const isCurrent = !!inst.isCurrentInstance;
        const status = inst.status || "offline";
        const uptimeStr = formatUptimeDuration(inst.uptimeSeconds);
        const ageStr = formatHeartbeatAge(inst.ageSeconds);
        const lastUpdatedFormatted = formatDateTimeDisplay(inst.updatedAt || inst.lastHeartbeat);

        let statusBadge = "";
        let rowBorder = "border-gray-100";
        if (status === "online") {
            statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <i class="fa-solid fa-circle text-[7px] text-emerald-500 mr-1 animate-pulse"></i> Online
            </span>`;
        } else if (status === "degraded") {
            statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <i class="fa-solid fa-triangle-exclamation text-[7px] text-amber-500 mr-1"></i> Trễ (${ageStr})
            </span>`;
            rowBorder = "border-amber-200 bg-amber-50/20";
        } else {
            statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-300">
                <i class="fa-solid fa-circle-xmark text-[7px] text-gray-400 mr-1"></i> Offline (${ageStr})
            </span>`;
            rowBorder = "border-red-100 bg-gray-50/40";
        }

        const currentBadge = isCurrent ? `
            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-primary text-white shadow-2xs">
                <i class="fa-solid fa-star text-[8px] mr-1 text-yellow-300"></i> Đang Phục Vụ Bạn
            </span>
        ` : "";

        const memDisplay = inst.memoryMb ? `${inst.memoryMb} MB` : "N/A";
        const reqDisplay = typeof inst.requestCount === "number" ? inst.requestCount.toLocaleString() : "0";
        const hostDisplay = `${inst.host || "0.0.0.0"}:${inst.port || 5000}`;

        rowsHtml += `
            <tr class="hover:bg-gray-50/70 transition border-b ${rowBorder}">
                <td class="px-4 py-3 text-left">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold text-xs text-gray-900">${inst.name || inst.instanceId}</span>
                        ${currentBadge}
                    </div>
                    <div class="text-[10px] font-mono text-gray-400 mt-0.5 flex items-center gap-2">
                        <span>ID: ${inst.instanceId}</span>
                        <span>•</span>
                        <span>PID: ${inst.pid || "N/A"}</span>
                        <span>•</span>
                        <span class="px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 font-sans">${inst.role || "worker"}</span>
                    </div>
                    ${inst.notes ? `<div class="text-[10px] text-gray-500 italic mt-0.5">${inst.notes}</div>` : ""}
                </td>
                <td class="px-3 py-3 text-left">
                    <span class="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">${hostDisplay}</span>
                </td>
                <td class="px-3 py-3 text-center">
                    ${statusBadge}
                    <div class="text-[10px] text-gray-400 mt-0.5">${ageStr}</div>
                </td>
                <td class="px-3 py-3 text-left text-xs">
                    <div class="font-semibold text-gray-800 flex items-center gap-1.5">
                        <i class="fa-regular fa-calendar-check text-emerald-600 text-[10px]"></i>
                        <span>${lastUpdatedFormatted}</span>
                    </div>
                    <div class="text-[10px] text-gray-400 mt-0.5">Ngày: ${inst.updatedDate || "N/A"}</div>
                </td>
                <td class="px-3 py-3 text-left text-xs">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-sky-50 text-sky-700 border border-sky-200" title="Mức tải CPU tiến trình">
                            <i class="fa-solid fa-microchip text-[10px]"></i> ${typeof inst.cpuPercent === 'number' ? inst.cpuPercent.toFixed(1) + '%' : '0.0%'}
                        </span>
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-purple-50 text-purple-700 border border-purple-200" title="Bộ nhớ RAM tiến trình (RSS)">
                            <i class="fa-solid fa-memory text-[10px]"></i> ${memDisplay}
                        </span>
                    </div>
                    <div class="text-[10px] text-gray-500 mt-1 font-mono">Xử lý: ${reqDisplay} reqs</div>
                </td>
                <td class="px-3 py-3 text-left text-xs">
                    <div class="font-semibold text-gray-700">Uptime: ${uptimeStr}</div>
                    <div class="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[130px]" title="${inst.os || ''}">${inst.os || 'Linux/Windows'}</div>
                </td>
                <td class="px-3 py-3 text-right whitespace-nowrap">
                    <div class="flex items-center justify-end gap-1.5">
                        <button type="button" onclick="openClusterInstanceDetailModal('${inst.instanceId}')"
                            title="Xem chi tiết & tài nguyên CPU / RAM"
                            class="px-2.5 py-1.5 rounded-lg text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition cursor-pointer text-xs flex items-center gap-1 font-semibold">
                            <i class="fa-solid fa-chart-simple"></i> Chi Tiết
                        </button>
                        ${!isCurrent ? `
                            <button type="button" onclick="pruneOfflineInstance('${inst.instanceId}')"
                                title="Xóa node khỏi danh sách"
                                class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer text-xs">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });

    listEl.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-gray-100/80 text-[11px] font-bold text-gray-600 uppercase border-b border-gray-200">
                        <th class="px-4 py-2.5">Node / Instance</th>
                        <th class="px-3 py-2.5">Host & Port</th>
                        <th class="px-3 py-2.5 text-center">Trạng Thái</th>
                        <th class="px-3 py-2.5">Ngày Cập Nhật</th>
                        <th class="px-3 py-2.5">Tài Nguyên</th>
                        <th class="px-3 py-2.5">Thời Gian Chạy</th>
                        <th class="px-3 py-2.5 text-right">Thao Tác</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 bg-white">
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;
}

export async function saveAdminClusterConfig() {
    const clusterName = (document.getElementById("clusterNameInput")?.value || "").trim();
    const lbEnabled = !!document.getElementById("clusterLbEnabledToggle")?.checked;
    const provider = (document.getElementById("clusterLbProviderInput")?.value || "").trim();
    const algorithm = (document.getElementById("clusterLbAlgorithmSelect")?.value || "").trim();
    const hbInterval = parseInt(document.getElementById("clusterHeartbeatIntervalInput")?.value || "30", 10);
    const staleTimeout = parseInt(document.getElementById("clusterStaleTimeoutInput")?.value || "90", 10);
    const autoPruneDays = parseInt(document.getElementById("clusterAutoPruneDaysInput")?.value || "7", 10);
    const notes = (document.getElementById("clusterNotesInput")?.value || "").trim();

    const payload = {
        clusterName: clusterName || "No Hoa Tha Binh Production Cluster",
        heartbeatIntervalSeconds: hbInterval,
        staleTimeoutSeconds: staleTimeout,
        autoPruneDays: autoPruneDays,
        loadBalancer: {
            enabled: lbEnabled,
            provider: provider,
            algorithm: algorithm,
            notes: notes
        }
    };

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen("Đang lưu cấu hình Cụm & Load Balancer (instancesMonitor.json)...");
    try {
        const res = await fetch(`${API_BASE}/admin/monitor/cluster-config`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
            throw new Error(json.message || "Không thể lưu cấu hình cụm");
        }
        notifyUser(json.message || "Đã lưu cấu hình Cụm & Load Balancer thành công!", "success");
        await loadAdminMonitorInstances(false);
    } catch (e) {
        notifyUser("Lỗi lưu cấu hình: " + e.message, "error");
    } finally {
        unlockScreen();
    }
}

export async function pruneOfflineInstance(instanceId) {
    if (!instanceId) return;
    if (!confirm(`Bạn có chắc chắn muốn gỡ bỏ instance '${instanceId}' khỏi cấu hình cụm?`)) {
        return;
    }

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen(`Đang gỡ bỏ instance ${instanceId}...`);
    try {
        const res = await fetch(`${API_BASE}/admin/monitor/instances/${encodeURIComponent(instanceId)}`, {
            method: "DELETE",
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
            throw new Error(json.message || "Không thể xóa instance");
        }
        notifyUser(json.message || `Đã gỡ bỏ instance ${instanceId} thành công!`, "success");
        await loadAdminMonitorInstances(false);
    } catch (e) {
        notifyUser("Lỗi: " + e.message, "error");
    } finally {
        unlockScreen();
    }
}

export async function cleanupAllStaleInstances() {
    if (!confirm("Hệ thống sẽ dọn dẹp toàn bộ các instance đang ở trạng thái Offline khỏi danh sách. Bạn có muốn tiếp tục?")) {
        return;
    }

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen("Đang dọn dẹp các node offline...");
    try {
        const res = await fetch(`${API_BASE}/admin/monitor/cleanup-stale`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            }
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
            throw new Error(json.message || "Không thể dọn dẹp node offline");
        }
        notifyUser(json.message || "Đã dọn dẹp thành công!", "success");
        await loadAdminMonitorInstances(false);
    } catch (e) {
        notifyUser("Lỗi: " + e.message, "error");
    } finally {
        unlockScreen();
    }
}

export function toggleMonitorAutoRefresh(enable) {
    if (monitorAutoRefreshTimer) {
        clearInterval(monitorAutoRefreshTimer);
        monitorAutoRefreshTimer = null;
    }
    if (enable) {
        monitorAutoRefreshTimer = setInterval(() => {
            const modal = document.getElementById("systemConfigModal");
            const content = document.getElementById("tabSysContentMonitor");
            if (modal && !modal.classList.contains("hidden") && content && !content.classList.contains("hidden")) {
                loadAdminMonitorInstances(false);
            }
        }, 15000);
        notifyUser("Đã bật tự động làm mới trạng thái cụm mỗi 15 giây.", "info");
    }
}

let currentViewingInstanceId = null;

export function openClusterInstanceDetailModal(instanceId) {
    if (!adminClusterMonitorData || !Array.isArray(adminClusterMonitorData.instances)) return;
    const inst = adminClusterMonitorData.instances.find(x => x.instanceId === instanceId);
    if (!inst) {
        notifyUser("Không tìm thấy thông tin instance: " + instanceId, "warning");
        return;
    }
    currentViewingInstanceId = instanceId;

    const modal = document.getElementById("clusterInstanceDetailModal");
    if (!modal) {
        alert(`[Chi tiết Instance: ${inst.name || inst.instanceId}]\n\n` + JSON.stringify(inst, null, 2));
        return;
    }

    const isCurrent = adminClusterMonitorData && adminClusterMonitorData.currentInstanceId === inst.instanceId;
    const status = (inst.status || "offline").toLowerCase();

    // 1. Header elements
    const titleEl = document.getElementById("instanceDetailTitle");
    if (titleEl) {
        const safeName = String(inst.name || inst.instanceId).replace(/</g, "&lt;").replace(/>/g, "&gt;");
        titleEl.innerHTML = `${safeName} ${isCurrent ? '<span class="text-xs font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 ml-1.5"><i class="fa-solid fa-bolt mr-1"></i>Node Hiện Tại</span>' : ''}`;
    }

    const subEl = document.getElementById("instanceDetailSubtitle");
    if (subEl) {
        subEl.textContent = `ID: ${inst.instanceId} | Role: ${inst.role || 'worker'} | Host: ${inst.host || '127.0.0.1'}:${inst.port || 5000}`;
    }

    const badgeEl = document.getElementById("instanceDetailStatusBadge");
    if (badgeEl) {
        if (status === "online") {
            badgeEl.className = "px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 flex-shrink-0";
            badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Online`;
        } else if (status === "degraded") {
            badgeEl.className = "px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5 flex-shrink-0";
            badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> Degraded`;
        } else {
            badgeEl.className = "px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200 flex items-center gap-1.5 flex-shrink-0";
            badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-gray-400"></span> Offline`;
        }
    }

    // 2. CPU Gauge & Metrics
    const cpuPct = typeof inst.cpuPercent === "number" ? inst.cpuPercent : 0.0;
    const cpuValEl = document.getElementById("instanceDetailCpuValue");
    if (cpuValEl) cpuValEl.textContent = `${cpuPct.toFixed(1)}%`;

    const cpuBarEl = document.getElementById("instanceDetailCpuBar");
    if (cpuBarEl) {
        const barWidth = Math.min(Math.max(cpuPct, 0), 100);
        cpuBarEl.style.width = `${barWidth}%`;
        if (cpuPct > 80) {
            cpuBarEl.className = "bg-red-500 h-full rounded-full transition-all duration-500";
        } else if (cpuPct > 50) {
            cpuBarEl.className = "bg-amber-500 h-full rounded-full transition-all duration-500";
        } else {
            cpuBarEl.className = "bg-sky-500 h-full rounded-full transition-all duration-500";
        }
    }

    const cpuCoresEl = document.getElementById("instanceDetailCpuCores");
    if (cpuCoresEl) {
        cpuCoresEl.innerHTML = `<i class="fa-solid fa-layer-group text-sky-500 mr-1"></i>Số Cores: <b>${inst.cpuCores || 1}</b>`;
    }

    const loadAvgEl = document.getElementById("instanceDetailLoadAvg");
    if (loadAvgEl) {
        if (Array.isArray(inst.loadAvg) && inst.loadAvg.length > 0) {
            loadAvgEl.textContent = `Load (1/5/15m): ${inst.loadAvg.join(', ')}`;
        } else {
            loadAvgEl.textContent = `Load: Tốt`;
        }
    }

    // 3. RAM Gauge & Metrics
    const procMemMb = typeof inst.memoryMb === "number" ? inst.memoryMb : null;
    const ramValEl = document.getElementById("instanceDetailRamValue");
    if (ramValEl) {
        ramValEl.textContent = procMemMb !== null ? `${procMemMb.toFixed(1)} MB` : "N/A";
    }

    const sysMem = inst.systemMemory;
    const sysRamTotalEl = document.getElementById("instanceDetailSysRamTotal");
    const sysRamUsageEl = document.getElementById("instanceDetailSysRamUsage");
    const ramBarEl = document.getElementById("instanceDetailRamBar");

    if (sysMem && typeof sysMem.totalMb === "number" && sysMem.totalMb > 0) {
        const totalGb = (sysMem.totalMb / 1024).toFixed(1);
        const usedGb = ((sysMem.usedMb || 0) / 1024).toFixed(1);
        const usagePct = sysMem.usagePercent !== undefined ? sysMem.usagePercent : (sysMem.usedMb / sysMem.totalMb * 100);
        if (sysRamTotalEl) {
            sysRamTotalEl.innerHTML = `<i class="fa-solid fa-server text-purple-500 mr-1"></i>RAM Máy Chủ: <b>${usedGb} / ${totalGb} GB</b>`;
        }
        if (sysRamUsageEl) {
            sysRamUsageEl.textContent = `Hệ thống: ${usagePct.toFixed(1)}%`;
        }
        if (ramBarEl) {
            const barW = Math.min(Math.max(usagePct, 0), 100);
            ramBarEl.style.width = `${barW}%`;
            if (usagePct > 85) {
                ramBarEl.className = "bg-red-500 h-full rounded-full transition-all duration-500";
            } else if (usagePct > 70) {
                ramBarEl.className = "bg-amber-500 h-full rounded-full transition-all duration-500";
            } else {
                ramBarEl.className = "bg-purple-500 h-full rounded-full transition-all duration-500";
            }
        }
    } else {
        if (sysRamTotalEl) sysRamTotalEl.innerHTML = `<i class="fa-solid fa-memory text-purple-500 mr-1"></i>RAM Tiến Trình: <b>${procMemMb ? procMemMb + ' MB' : '--'}</b>`;
        if (sysRamUsageEl) sysRamUsageEl.textContent = "";
        if (ramBarEl) {
            const simulatedW = procMemMb ? Math.min(procMemMb / 5, 100) : 0;
            ramBarEl.style.width = `${simulatedW}%`;
            ramBarEl.className = "bg-purple-500 h-full rounded-full transition-all duration-500";
        }
    }

    // 4. Details Grid
    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || "--";
    };
    setTxt("instanceDetailId", inst.instanceId);
    setTxt("instanceDetailName", inst.name || inst.instanceId);
    setTxt("instanceDetailRole", inst.role || "worker");
    setTxt("instanceDetailHostPort", `${inst.host || '127.0.0.1'}:${inst.port || 5000}`);
    setTxt("instanceDetailPid", inst.pid ? String(inst.pid) : "N/A");
    setTxt("instanceDetailRequests", (inst.requestCount || 0).toLocaleString("vi-VN"));
    setTxt("instanceDetailStartTime", formatDateTimeDisplay(inst.startTime));
    setTxt("instanceDetailUptime", formatUptimeDuration(inst.uptimeSeconds));
    setTxt("instanceDetailUpdatedDate", `${formatDateTimeDisplay(inst.updatedAt || inst.lastHeartbeat)} (Ngày: ${inst.updatedDate || 'N/A'})`);
    setTxt("instanceDetailLastHb", `${formatHeartbeatAge(inst.lastHeartbeatTimestamp || inst.lastUpdatedTimestamp)} (${formatDateTimeDisplay(inst.lastHeartbeat)})`);

    const osEl = document.getElementById("instanceDetailOs");
    if (osEl) {
        osEl.textContent = inst.os || "Linux / Windows / Docker";
        osEl.title = inst.os || "";
    }
    setTxt("instanceDetailPython", inst.pythonVersion ? `Python ${inst.pythonVersion}` : "N/A");
    setTxt("instanceDetailVersion", inst.version || "1.0.0");
    setTxt("instanceDetailNotes", inst.notes || "Node phục vụ qua Load Balancer");

    // 5. Raw JSON
    const rawPre = document.getElementById("instanceRawJson");
    if (rawPre) {
        rawPre.textContent = JSON.stringify(inst, null, 2);
    }

    const jsonContainer = document.getElementById("instanceJsonContainer");
    if (jsonContainer) jsonContainer.classList.add("hidden");
    const jsonIcon = document.getElementById("instanceJsonToggleIcon");
    if (jsonIcon) jsonIcon.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';

    modal.style.display = "flex";
}

export function closeClusterInstanceDetailModal() {
    const modal = document.getElementById("clusterInstanceDetailModal");
    if (modal) modal.style.display = "none";
    currentViewingInstanceId = null;
}

export async function refreshCurrentInstanceDetail() {
    if (!currentViewingInstanceId) return;
    await loadAdminMonitorInstances(false);
    openClusterInstanceDetailModal(currentViewingInstanceId);
}

export function toggleInstanceJsonView() {
    const container = document.getElementById("instanceJsonContainer");
    const icon = document.getElementById("instanceJsonToggleIcon");
    if (!container) return;
    const isHidden = container.classList.contains("hidden");
    if (isHidden) {
        container.classList.remove("hidden");
        if (icon) icon.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
    } else {
        container.classList.add("hidden");
        if (icon) icon.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
    }
}

export function copyCurrentInstanceJson() {
    const rawPre = document.getElementById("instanceRawJson");
    if (!rawPre || !rawPre.textContent) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(rawPre.textContent).then(() => {
            notifyUser("Đã sao chép JSON của instance vào clipboard!", "success");
        }).catch(() => {
            notifyUser("Không thể sao chép tự động", "warning");
        });
    } else {
        notifyUser("Trình duyệt không hỗ trợ sao chép tự động", "warning");
    }
}

export function showInstanceJsonDetail(instanceId) {
    openClusterInstanceDetailModal(instanceId);
}


if (typeof window !== "undefined") {
    window.loadAdminNotifyConfig = loadAdminNotifyConfig;
    window.renderAdminNotifyConfig = renderAdminNotifyConfig;
    window.saveAdminNotifyConfig = saveAdminNotifyConfig;
    window.testTelegramNotification = testTelegramNotification;
    window.toggleTelegramTokenVisibility = toggleTelegramTokenVisibility;
    window.loadAdminMonitorInstances = loadAdminMonitorInstances;
    window.renderAdminMonitorInstances = renderAdminMonitorInstances;
    window.saveAdminClusterConfig = saveAdminClusterConfig;
    window.pruneOfflineInstance = pruneOfflineInstance;
    window.cleanupAllStaleInstances = cleanupAllStaleInstances;
    window.toggleMonitorAutoRefresh = toggleMonitorAutoRefresh;
    window.showInstanceJsonDetail = showInstanceJsonDetail;
    window.openClusterInstanceDetailModal = openClusterInstanceDetailModal;
    window.closeClusterInstanceDetailModal = closeClusterInstanceDetailModal;
    window.refreshCurrentInstanceDetail = refreshCurrentInstanceDetail;
    window.toggleInstanceJsonView = toggleInstanceJsonView;
    window.copyCurrentInstanceJson = copyCurrentInstanceJson;
    window.formatDateTimeDisplay = formatDateTimeDisplay;
    window.DEFAULT_STATIC_COMPANY_INFO = DEFAULT_STATIC_COMPANY_INFO;
    window.loadAdminCompanyInfo = loadAdminCompanyInfo;
    window.handleCompanyInfoSubmit = handleCompanyInfoSubmit;
    window.syncCompanyHoursFromControls = syncCompanyHoursFromControls;
    window.populateOperatingTimeSelects = populateOperatingTimeSelects;
    window.renderOperatingDaysPills = renderOperatingDaysPills;
    window.toggleOperatingDay = toggleOperatingDay;
    window.selectOperatingDaysPreset = selectOperatingDaysPreset;
    window.loadAdminPaymentConfig = loadAdminPaymentConfig;
    window.onPaymentMethodToggle = onPaymentMethodToggle;
    window.savePaymentConfig = savePaymentConfig;
    window.loadAdminAddonConfig = loadAdminAddonConfig;
    window.saveAddonConfig = saveAddonConfig;
    window.loadAdminLiveStreamConfig = loadAdminLiveStreamConfig;
    window.handleLiveStreamQuickToggleConfirm = handleLiveStreamQuickToggleConfirm;
    window.saveLiveStreamConfig = saveLiveStreamConfig;
    window.renderLiveStreamConfig = renderLiveStreamConfig;
    window.copyQuickOrderLink = copyQuickOrderLink;
    window.shareQuickOrderLink = shareQuickOrderLink;
    window.previewQuickOrder = previewQuickOrder;
    window.handleAdminLiveStreamQrUpload = handleAdminLiveStreamQrUpload;
    window.convertImageToWebpBase64 = convertImageToWebpBase64;
    window.handleAdminLiveStreamQrUrlInput = handleAdminLiveStreamQrUrlInput;
    window.removeAdminLiveStreamQr = removeAdminLiveStreamQr;
    window.handleAdminLiveStreamProductSearch = handleAdminLiveStreamProductSearch;
    window.clearAdminLiveStreamProductSearch = clearAdminLiveStreamProductSearch;
    window.setAdminLiveStreamProductFilter = setAdminLiveStreamProductFilter;
    window.toggleAdminLiveStreamFeaturedProduct = toggleAdminLiveStreamFeaturedProduct;
    window.renderAdminLiveStreamFeaturedProducts = renderAdminLiveStreamFeaturedProducts;
    window.filterAndRenderAdminLiveStreamFeaturedProducts = filterAndRenderAdminLiveStreamFeaturedProducts;
    window.updateAdminLiveStreamFeaturedBadges = updateAdminLiveStreamFeaturedBadges;
    window.loadAdminBanners = loadAdminBanners;
    window.renderAdminBanners = renderAdminBanners;
    window.handleAdminBannerTargetSelect = handleAdminBannerTargetSelect;
    window.handleAdminBannerLinkCustomInput = handleAdminBannerLinkCustomInput;
    window.updateAdminBannerField = updateAdminBannerField;
    window.addAdminBannerItem = addAdminBannerItem;
    window.removeAdminBannerItem = removeAdminBannerItem;
    window.saveAdminBanners = saveAdminBanners;
    window.loadAdminPriceLevels = loadAdminPriceLevels;
    window.renderAdminPriceLevels = renderAdminPriceLevels;
    window.openPriceLevelModal = openPriceLevelModal;
    window.closePriceLevelModal = closePriceLevelModal;
    window.validatePriceLevelModalNumbers = validatePriceLevelModalNumbers;
    window.savePriceLevelFromModal = savePriceLevelFromModal;
    window.deletePriceLevel = deletePriceLevel;
    window.toggleLiveStreamPaymentBlock = toggleLiveStreamPaymentBlock;
    window.handleLiveStreamLockedInputClick = handleLiveStreamLockedInputClick;
    window.applyLiveStreamPaymentBlockUI = applyLiveStreamPaymentBlockUI;
    window.getLiveStreamPaymentBlockState = getLiveStreamPaymentBlockState;
}
