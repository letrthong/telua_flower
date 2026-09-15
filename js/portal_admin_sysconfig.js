import { getAuthToken } from './auth.js';
import { API_BASE, showConfirmDialog } from './utils.js';
import { lockScreen, unlockScreen, notifyUser, setAdminPriceLevels } from './portal_admin_state.js';

// ==========================================
// CẤU HÌNH THÔNG TIN DOANH NGHIỆP (infoCompany.json)
// ==========================================

export const DEFAULT_STATIC_COMPANY_INFO = {
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
            window.reloadPaymentConfigIfChanged(true).catch(() => {});
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
            window.reloadAddonsIfChanged(true).catch(() => {});
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
// CẤU HÌNH BANNER TRÌNH CHIẾU (banners.json)
// ==========================================
export let adminBannersConfig = {
    interval: 5000,
    autoplay: true,
    banners: []
};

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
        } catch (e) {}

        if (!loaded) {
            try {
                const pubRes = await fetch(`${API_BASE}/banners?_t=${Date.now()}`);
                if (pubRes.ok) {
                    const json = await pubRes.json();
                    adminBannersConfig = json.data || json;
                    loaded = true;
                }
            } catch (e) {}
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

    let html = '';
    banners.forEach((b, idx) => {
        const active = b.active !== false;
        const imgUrl = b.image || '';
        const title = b.title || '';
        const link = b.link || '#products';
        const order = b.order || (idx + 1);

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

                    <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <!-- Link đích khi click -->
                        <div class="sm:col-span-8">
                            <label class="block text-[11px] font-bold text-gray-600 mb-1">Link chuyển đến khi click</label>
                            <input type="text" value="${link}" oninput="updateAdminBannerField(${idx}, 'link', this.value)" placeholder="vd: #products hoặc /#bo-hoa" class="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-primary focus:bg-white transition">
                        </div>

                        <!-- Gợi ý ngôn ngữ -->
                        <div class="sm:col-span-4 flex items-end">
                            <div class="text-[10px] text-gray-400 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 w-full">
                                <i class="fa-solid fa-language text-purple-600 mr-1"></i> Alt: <b>Gửi Trọn Vẹn Cảm Xúc</b> (Đa ngữ)
                            </div>
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
        } catch (e) {}

        // Đồng bộ tức thời lên storefront
        if (typeof window !== 'undefined' && typeof window.applyHeroBannersConfig === 'function') {
            window.applyHeroBannersConfig(adminBannersConfig);
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
    setValue("companyZaloInput", data.zalo);
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
            
            // Cập nhật ngay lên giao diện bán hàng và làm mới cache ETag
            if (typeof window !== "undefined") {
                if (typeof window.applyStorefrontCompanyInfo === "function") {
                    window.applyStorefrontCompanyInfo(adminCompanyInfo);
                }
                if (typeof window.loadStorefrontCompanyInfo === "function") {
                    window.loadStorefrontCompanyInfo(true).catch(() => {});
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

if (typeof window !== "undefined") {
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
    window.loadAdminBanners = loadAdminBanners;
    window.renderAdminBanners = renderAdminBanners;
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
}
