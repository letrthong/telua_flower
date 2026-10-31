// portal_admin_livestream_orders.js
// Phân hệ Quản Trị & Xử Lý Đơn Hàng Live Stream Tốc Hành trong Admin Portal (Cổng Quản Trị Hệ Thống)

import { getAuthToken } from './auth.js';
import { API_BASE, formatVND, showLiveStreamConfirmDialog } from './utils.js';
import { notifyUser, lockScreen, unlockScreen } from './portal_admin_state.js';
import { ADMIN_ORDER_STATUS_META, ADMIN_PAYMENT_STATUS_META, exportOrdersToCsv } from './portal_admin_orders.js';

export let lastLoadedLiveOrders = [];
export let currentLiveStreamConfig = null;
export let currentLiveOrderSort = "delivery_asc";

const LIVE_FILTER_STORAGE_KEY = "telua_live_orders_filter_state_v1";
const LIVE_ROW_STATUS_STORAGE_KEY = "telua_live_order_row_status_v1";
const LIVE_HEADER_STATS_VISIBLE_KEY = "telua_live_header_stats_visible_v1";
let _liveFilterStateRestored = false;

/**
 * Áp dụng trạng thái Ẩn/Hiện của Bàn Điều Khiển & Thống Kê Live Stream lên giao diện
 */
export function applyLiveStreamHeaderStatsVisibility(isVisible) {
    const container = document.getElementById("liveStreamHeaderAndStatsContainer");
    const btn = document.getElementById("btnToggleLiveStreamHeaderStats");
    const icon = document.getElementById("iconToggleLiveStreamHeaderStats");
    const label = document.getElementById("labelToggleLiveStreamHeaderStats");

    if (container) {
        if (isVisible) {
            container.classList.remove("hidden");
        } else {
            container.classList.add("hidden");
        }
    }

    if (icon) {
        icon.className = isVisible
            ? "fa-regular fa-eye-slash text-gray-600"
            : "fa-regular fa-eye text-rose-600";
    }
    if (label) {
        label.textContent = isVisible
            ? "Ẩn Bàn Điều Khiển & Thống Kê"
            : "Hiện Bàn Điều Khiển & Thống Kê";
    }
    if (btn) {
        btn.className = isVisible
            ? "px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 text-xs font-bold rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            : "px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer";
    }
}

/**
 * Khôi phục cấu hình Ẩn/Hiện Bàn Điều Khiển & Thống Kê từ trình duyệt (Mặc định: false = Ẩn)
 */
export function restoreLiveStreamHeaderStatsVisibility() {
    let isVisible = false;
    if (typeof localStorage !== "undefined") {
        try {
            const saved = localStorage.getItem(LIVE_HEADER_STATS_VISIBLE_KEY);
            // Mặc định là false (hide) nếu chưa có trong localStorage
            isVisible = (saved === "true" || saved === "1");
        } catch (e) {
            isVisible = false;
        }
    }
    applyLiveStreamHeaderStatsVisibility(isVisible);
    return isVisible;
}

/**
 * Bật/Tắt (Hiện/Ẩn) Bàn Điều Khiển & Thống Kê Live Stream và lưu cấu hình vào localStorage
 */
export function toggleLiveStreamHeaderStats(forceVisible = undefined) {
    const container = document.getElementById("liveStreamHeaderAndStatsContainer");
    const currentlyVisible = container ? !container.classList.contains("hidden") : false;
    const nextVisible = (typeof forceVisible === "boolean") ? forceVisible : !currentlyVisible;

    applyLiveStreamHeaderStatsVisibility(nextVisible);

    if (typeof localStorage !== "undefined") {
        try {
            localStorage.setItem(LIVE_HEADER_STATS_VISIBLE_KEY, nextVisible ? "true" : "false");
        } catch (e) { }
    }
    return nextVisible;
}

/**
 * Lưu trạng thái các selectBox lọc & sắp xếp của Bàn Điều Khiển Live Stream vào trình duyệt (localStorage)
 */
export function saveLiveOrderFilterState() {
    if (typeof localStorage === "undefined") return;
    try {
        const statusEl = document.getElementById("filterLiveOrderStatus");
        const paymentEl = document.getElementById("filterLiveOrderPayment");
        const sortEl = document.getElementById("sortLiveOrdersSelect");
        const dateEl = document.getElementById("filterLiveOrderDate");
        const state = {
            status: statusEl ? statusEl.value : "all",
            paymentStatus: paymentEl ? paymentEl.value : "all",
            sort: (sortEl && sortEl.value) ? sortEl.value : currentLiveOrderSort,
            date: dateEl ? dateEl.value : ""
        };
        localStorage.setItem(LIVE_FILTER_STORAGE_KEY, JSON.stringify(state));
    } catch (e) { }
}

/**
 * Khôi phục trạng thái các selectBox lọc & sắp xếp từ localStorage khi tải lại trang (Refresh)
 */
export function restoreLiveOrderFilterState() {
    if (_liveFilterStateRestored || typeof localStorage === "undefined") return;
    _liveFilterStateRestored = true;
    try {
        const raw = localStorage.getItem(LIVE_FILTER_STORAGE_KEY);
        if (!raw) return;
        const state = JSON.parse(raw);
        if (!state || typeof state !== "object") return;

        const statusEl = document.getElementById("filterLiveOrderStatus");
        const paymentEl = document.getElementById("filterLiveOrderPayment");
        const sortEl = document.getElementById("sortLiveOrdersSelect");
        const dateEl = document.getElementById("filterLiveOrderDate");

        if (statusEl && state.status) statusEl.value = state.status;
        if (paymentEl && state.paymentStatus) paymentEl.value = state.paymentStatus;
        if (sortEl && state.sort) {
            sortEl.value = state.sort;
            currentLiveOrderSort = state.sort;
        }
        if (dateEl && typeof state.date === "string") {
            dateEl.value = state.date;
        }
    } catch (e) { }
}

/**
 * Lưu/đọc trạng thái status selectBox từng đơn hàng trong trình duyệt để đồng bộ tức thì khi F5
 */
export function saveLiveOrderRowStatusLocal(orderId, status) {
    if (!orderId || !status || typeof localStorage === "undefined") return;
    try {
        const raw = localStorage.getItem(LIVE_ROW_STATUS_STORAGE_KEY);
        const map = raw ? JSON.parse(raw) : {};
        map[orderId] = status;
        localStorage.setItem(LIVE_ROW_STATUS_STORAGE_KEY, JSON.stringify(map));
    } catch (e) { }
}

export function getLiveOrderRowStatusLocal(orderId) {
    if (!orderId || typeof localStorage === "undefined") return "";
    try {
        const raw = localStorage.getItem(LIVE_ROW_STATUS_STORAGE_KEY);
        if (!raw) return "";
        const map = JSON.parse(raw);
        return (map && map[orderId]) ? map[orderId] : "";
    } catch (e) {
        return "";
    }
}

function formatLiveDate(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatLiveReceivingDateLabel(dateStr) {
    if (!dateStr || typeof dateStr !== "string") return "Hôm nay";
    const clean = dateStr.trim().slice(0, 10);
    const parts = clean.split("-");
    if (parts.length !== 3) return dateStr;
    const [yyyy, mm, dd] = parts;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

    if (clean === todayStr) return `Hôm nay (${dd}/${mm})`;
    if (clean === tomStr) return `Ngày mai (${dd}/${mm})`;
    return `${dd}/${mm}/${yyyy}`;
}

/**
 * Trích xuất chuẩn hóa Ngày Nhận (YYYY-MM-DD) và Giờ Nhận (HH:MM) của đơn hàng Live Stream
 */
export function extractLiveOrderDateAndTime(order) {
    if (!order || typeof order !== "object") {
        return { datePart: "9999-99-99", timePart: "99:99", createdPart: "" };
    }
    const rawDate =
        (order.delivery && order.delivery.deliveryDate) ||
        order.deliveryDate ||
        order.orderDate ||
        order.createdAt ||
        "";
    const datePart = (rawDate && String(rawDate).trim().length >= 10)
        ? String(rawDate).trim().slice(0, 10)
        : "9999-99-99";

    const rawSlot = String(
        (order.delivery && order.delivery.timeSlot) ||
        order.deliveryTime ||
        order.timeSlot ||
        ""
    ).trim();

    let timePart = "23:59";
    if (!rawSlot || rawSlot.toLowerCase().includes("giao ngay") || rawSlot.toLowerCase().includes("sớm nhất")) {
        // Ưu tiên đơn "Giao ngay trong ngày (Sớm nhất)" lên đầu trong cùng ngày nhận
        timePart = "00:00";
    } else {
        const m = rawSlot.match(/(\d{1,2})(?::(\d{2}))?\s*h?/i);
        if (m) {
            const hh = String(m[1]).padStart(2, "0");
            const mm = m[2] ? String(m[2]).padStart(2, "0") : "00";
            timePart = `${hh}:${mm}`;
        }
    }
    const createdPart = String(order.createdAt || "");
    return { datePart, timePart, createdPart };
}

/**
 * Tạo khóa chuẩn hóa YYYY-MM-DD_HH:MM để sắp xếp chính xác theo Ngày nhận & Giờ nhận hoa
 */
export function getLiveOrderDeliverySortKey(order) {
    const { datePart, timePart, createdPart } = extractLiveOrderDateAndTime(order);
    return `${datePart}_${timePart}_${createdPart}`;
}

/**
 * Tạo khóa sắp xếp Giờ Nhận theo từng Ngày Nhận (Nhóm theo YYYY-MM-DD trước, sau đó sắp xếp HH:MM trong ngày đó)
 */
export function getLiveOrderTimeOnlySortKey(order) {
    const { datePart, timePart, createdPart } = extractLiveOrderDateAndTime(order);
    return `${datePart}_${timePart}_${createdPart}`;
}

/**
 * Sắp xếp danh sách đơn Live Stream theo chế độ được chọn:
 * - Khi sort theo Giờ Nhận (deliveryTime_asc / deliveryTime_desc): gom nhóm theo Ngày Nhận trước,
 *   sau đó trong cùng một Ngày Nhận (VD: hôm nay có 10 đơn) sẽ sắp xếp theo Giờ Nhận (08:00 -> 09:00 -> 10:00... hoặc ngược lại).
 * - Khi sort theo Ngày Nhận (deliveryDate_asc / deliveryDate_desc): sắp xếp theo Ngày Nhận trước,
 *   và trong cùng một Ngày Nhận luôn sắp xếp Giờ Nhận từ sớm đến muộn (08:00 -> 09:00 -> 10:00...).
 */
export function sortLiveOrdersList(orders, sortMode = currentLiveOrderSort) {
    if (!Array.isArray(orders)) return [];
    const list = [...orders];
    const mode = sortMode || "delivery_asc";

    list.sort((a, b) => {
        if (mode === "deliveryTime_asc" || mode === "deliveryTime_desc") {
            const pa = extractLiveOrderDateAndTime(a);
            const pb = extractLiveOrderDateAndTime(b);
            // 1. Luôn gom theo Ngày Nhận trước
            if (pa.datePart !== pb.datePart) {
                return pa.datePart.localeCompare(pb.datePart);
            }
            // 2. Trong cùng 1 Ngày Nhận, sắp xếp theo Giờ Nhận (tăng dần hoặc giảm dần)
            if (pa.timePart !== pb.timePart) {
                return mode === "deliveryTime_asc"
                    ? pa.timePart.localeCompare(pb.timePart)
                    : pb.timePart.localeCompare(pa.timePart);
            }
            return pa.createdPart.localeCompare(pb.createdPart);
        }
        if (mode === "deliveryDate_asc" || mode === "deliveryDate_desc") {
            const pa = extractLiveOrderDateAndTime(a);
            const pb = extractLiveOrderDateAndTime(b);
            // 1. Sắp xếp theo Ngày Nhận tăng hoặc giảm
            if (pa.datePart !== pb.datePart) {
                return mode === "deliveryDate_asc"
                    ? pa.datePart.localeCompare(pb.datePart)
                    : pb.datePart.localeCompare(pa.datePart);
            }
            // 2. Trong cùng 1 Ngày Nhận, sắp xếp theo Giờ Nhận từ sớm tới muộn
            if (pa.timePart !== pb.timePart) {
                return pa.timePart.localeCompare(pb.timePart);
            }
            return pa.createdPart.localeCompare(pb.createdPart);
        }
        if (mode === "delivery_asc" || mode === "delivery_desc") {
            const ka = getLiveOrderDeliverySortKey(a);
            const kb = getLiveOrderDeliverySortKey(b);
            return mode === "delivery_asc" ? ka.localeCompare(kb) : kb.localeCompare(ka);
        }
        if (mode === "amount_asc" || mode === "amount_desc") {
            const aa = Number(a.totalAmount) || Number(a.financials?.totalAmount) || Number(a.transferredAmount) || 0;
            const ab = Number(b.totalAmount) || Number(b.financials?.totalAmount) || Number(b.transferredAmount) || 0;
            return mode === "amount_asc" ? (aa - ab) : (ab - aa);
        }
        // Mặc định: created_desc hoặc created_asc
        const ca = String(a.createdAt || a.orderDate || "");
        const cb = String(b.createdAt || b.orderDate || "");
        return mode === "created_asc" ? ca.localeCompare(cb) : cb.localeCompare(ca);
    });

    return list;
}

function updateLiveSortHeaderIcons() {
    const map = {
        created: document.getElementById("sortIconLive_created"),
        deliveryDate: document.getElementById("sortIconLive_deliveryDate"),
        deliveryTime: document.getElementById("sortIconLive_deliveryTime"),
        delivery: document.getElementById("sortIconLive_delivery"),
        amount: document.getElementById("sortIconLive_amount")
    };
    Object.entries(map).forEach(([col, iconEl]) => {
        if (!iconEl) return;
        const isAsc = (currentLiveOrderSort === `${col}_asc`) || (col === "deliveryDate" && currentLiveOrderSort === "delivery_asc");
        const isDesc = (currentLiveOrderSort === `${col}_desc`) || (col === "deliveryDate" && currentLiveOrderSort === "delivery_desc");
        if (isAsc) {
            iconEl.className = "fa-solid fa-sort-up text-[10px] ml-0.5 text-rose-600";
        } else if (isDesc) {
            iconEl.className = "fa-solid fa-sort-down text-[10px] ml-0.5 text-rose-600";
        } else {
            iconEl.className = "fa-solid fa-sort text-[10px] ml-0.5 text-gray-400";
        }
    });
}

/**
 * Xử lý khi Admin chọn chế độ sắp xếp từ dropdown
 */
export function handleLiveOrderSortChange(sortMode) {
    currentLiveOrderSort = sortMode || "delivery_asc";
    const selectEl = document.getElementById("sortLiveOrdersSelect");
    if (selectEl && selectEl.value !== currentLiveOrderSort) {
        selectEl.value = currentLiveOrderSort;
    }
    saveLiveOrderFilterState();
    updateLiveSortHeaderIcons();
    renderLiveOrdersTable(lastLoadedLiveOrders);
}

/**
 * Xử lý khi Admin nhấp trực tiếp vào tiêu đề cột để đảo chiều sắp xếp
 */
export function toggleLiveOrderColumnSort(colName) {
    if (!colName) return;
    if (currentLiveOrderSort === `${colName}_asc`) {
        currentLiveOrderSort = `${colName}_desc`;
    } else {
        currentLiveOrderSort = `${colName}_asc`;
    }
    handleLiveOrderSortChange(currentLiveOrderSort);
}

function getLiveStatusMeta(status, map) {
    return (map && map[status]) || {
        label: status || "Chờ xử lý",
        color: "bg-gray-100 text-gray-600 border-gray-200",
        icon: "fa-circle-question"
    };
}

/**
 * Tải danh sách đơn hàng Live Stream và cấu hình phiên live
 */
export async function loadLiveStreamOrders() {
    const tbody = document.getElementById("adminLiveOrdersTableBody");
    if (!tbody) return;

    // Khôi phục trạng thái Ẩn/Hiện Bàn Điều Khiển & Thống Kê (mặc định: Ẩn)
    restoreLiveStreamHeaderStatsVisibility();

    // Khôi phục trạng thái selectBox từ localStorage ở lần nạp đầu tiên sau khi refresh trang,
    // và lưu lại trạng thái mới nhất ở các lần người dùng đổi bộ lọc
    if (!_liveFilterStateRestored) {
        restoreLiveOrderFilterState();
    } else {
        saveLiveOrderFilterState();
    }

    tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-gray-400">
        <i class="fa-solid fa-circle-notch fa-spin text-xl text-rose-500 mb-2 block"></i>
        <span>Đang nạp danh sách đơn Live Stream...</span>
    </td></tr>`;

    const searchEl = document.getElementById("searchLiveOrderInput");
    const statusEl = document.getElementById("filterLiveOrderStatus");
    const paymentEl = document.getElementById("filterLiveOrderPayment");
    const dateEl = document.getElementById("filterLiveOrderDate");

    const search = searchEl ? searchEl.value.trim() : "";
    const status = statusEl ? statusEl.value : "all";
    const paymentStatus = paymentEl ? paymentEl.value : "all";
    const filterDate = dateEl ? dateEl.value.trim() : "";

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const headers = token ? { "Authorization": `Bearer ${token}` } : {};

    try {
        // 1. Tải cấu hình phiên Live để cập nhật trạng thái banner điều khiển
        fetchLiveConfigQuietly(headers);

        // 2. Tải danh sách đơn hàng lọc theo nguồn livestream_quick_order và ngày
        let url = `${API_BASE}/admin/orders?timeframe=all&source=livestream_quick_order`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (status && status !== "all") url += `&status=${encodeURIComponent(status)}`;
        if (paymentStatus && paymentStatus !== "all") url += `&paymentStatus=${encodeURIComponent(paymentStatus)}`;
        if (filterDate) url += `&date=${encodeURIComponent(filterDate)}`;

        const res = await fetch(url, { headers });
        const json = await res.json();

        if (json.success && json.data) {
            const orders = Array.isArray(json.data.orders) ? json.data.orders : [];
            lastLoadedLiveOrders = orders;
            renderLiveOrdersTable(lastLoadedLiveOrders);
            updateLiveKPIs(lastLoadedLiveOrders);
            updateLiveOrderFilterInfoBar(filterDate, orders.length);
        } else {
            tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-red-500 font-bold">${json.message || "Lỗi tải đơn Live Stream"}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
    }
}

/**
 * Tải cấu hình phiên live ngầm và cập nhật UI điều khiển
 */
async function fetchLiveConfigQuietly(headers = {}) {
    try {
        const res = await fetch(`${API_BASE}/admin/livestream-config?_t=${Date.now()}`, { headers });
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data) {
            currentLiveStreamConfig = json.data;
            updateLiveStreamControlUI(json.data);
        }
    } catch (e) {
        console.warn("[LIVESTREAM] Không thể nạp cấu hình live:", e.message);
    }
}

/**
 * Cập nhật giao diện widget điều khiển Live Stream
 */
function updateLiveStreamControlUI(config) {
    const isLive = !!(config.enableQuickOrder || config.enabled);
    const toggleEl = document.getElementById("liveStreamQuickToggle");
    const statusBadge = document.getElementById("liveStreamStatusBadge");
    const statusText = document.getElementById("liveStreamStatusText");
    const linkInput = document.getElementById("liveStreamShareLinkDisplay");

    if (toggleEl) toggleEl.checked = isLive;

    if (statusBadge) {
        if (isLive) {
            statusBadge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs";
            statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> <i class="fa-solid fa-signal"></i> ĐANG PHÁT SÓNG (BẬT CHỐT ĐƠN)`;
        } else {
            statusBadge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200";
            statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-gray-400"></span> <i class="fa-solid fa-pause"></i> ĐÃ TẠM DỪNG (TẮT CHỐT ĐƠN)`;
        }
    }

    if (statusText) {
        statusText.textContent = isLive
            ? "Khách truy cập link #quick-order có thể chọn hoa và gửi đơn chốt ngay."
            : "Form đặt nhanh đang tạm đóng. Khách truy cập sẽ thấy thông báo phiên live kết thúc.";
    }

    if (linkInput && typeof window !== "undefined") {
        const origin = window.location.origin || "";
        let pathname = window.location.pathname || "/";
        if (!pathname.endsWith("/") && !pathname.includes(".")) pathname += "/";
        linkInput.value = `${origin}${pathname}#quick-order`;
    }
}

/**
 * Bật/tắt nhanh phiên Live Stream trực tiếp trên tab Admin
 */
export async function toggleLiveStreamQuickStatus(checkbox) {
    if (!checkbox) return;
    const isEnabled = !!checkbox.checked;
    const confirmFn = (typeof showLiveStreamConfirmDialog === "function")
        ? showLiveStreamConfirmDialog
        : ((typeof window !== "undefined" && typeof window.showLiveStreamConfirmDialog === "function") ? window.showLiveStreamConfirmDialog : null);

    const confirmed = confirmFn
        ? await confirmFn(isEnabled)
        : window.confirm(isEnabled ? "BẬT PHIÊN LIVE STREAM & MỞ NHẬN ĐƠN NHANH?" : "TẮT PHIÊN LIVE STREAM & ĐÓNG NHẬN ĐƠN?");

    if (!confirmed) {
        checkbox.checked = !isEnabled;
        return;
    }

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    lockScreen(isEnabled ? "Đang BẬT phiên Live Stream & mở cổng đặt đơn..." : "Đang TẮT phiên Live Stream...");
    try {
        const payload = Object.assign({}, currentLiveStreamConfig || {}, {
            enableQuickOrder: isEnabled,
            enabled: isEnabled
        });

        const res = await fetch(`${API_BASE}/admin/livestream-config`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": token ? `Bearer ${token}` : ""
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
            throw new Error(json.message || "Không thể cập nhật trạng thái phiên live");
        }

        currentLiveStreamConfig = json.data;
        updateLiveStreamControlUI(json.data);

        // Đồng bộ với toggle ở tab Cấu hình hệ thống nếu đang có
        const sysToggle = document.getElementById("livestreamQuickOrderToggle");
        if (sysToggle) sysToggle.checked = isEnabled;

        notifyUser(
            isEnabled
                ? "🟢 Đã BẬT nhận đơn Live Stream! Link #quick-order đã sẵn sàng cho khách chốt."
                : "🔴 Đã TẮT nhận đơn Live Stream!",
            "success"
        );
    } catch (e) {
        if (checkbox) checkbox.checked = !isEnabled;
        notifyUser("Lỗi khi đổi trạng thái Live Stream: " + e.message, "error");
    } finally {
        unlockScreen();
    }
}

/**
 * Sao chép nhanh đường link chốt đơn ghim live stream
 */
export function copyLiveStreamQuickLink() {
    const linkInput = document.getElementById("liveStreamShareLinkDisplay");
    const url = (linkInput && linkInput.value) ? linkInput.value.trim() : (window.location.origin + "/#quick-order");

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            notifyUser("Đã sao chép link chốt đơn Live Stream (#quick-order)!", "success");
        }).catch(() => {
            if (linkInput) {
                linkInput.select();
                document.execCommand("copy");
            }
            notifyUser("Đã sao chép link chốt đơn!", "success");
        });
    } else {
        if (linkInput) {
            linkInput.select();
            document.execCommand("copy");
        }
        notifyUser("Đã sao chép link chốt đơn!", "success");
    }
}

/**
 * Cập nhật các chỉ số thống kê đơn hàng Live Stream
 */
function updateLiveKPIs(orders) {
    const totalEl = document.getElementById("kpiLiveTotalOrders");
    const pendingEl = document.getElementById("kpiLivePendingOrders");
    const processingEl = document.getElementById("kpiLiveProcessingOrders");
    const revenueEl = document.getElementById("kpiLiveRevenue");

    if (!Array.isArray(orders)) orders = [];

    const totalCount = orders.length;
    let pendingCount = 0;
    let processingCount = 0;
    let totalRevenue = 0;

    orders.forEach(o => {
        const st = (o.status || "").toLowerCase();
        if (st === "pending") pendingCount++;
        else if (st === "confirmed" || st === "arranging" || st === "shipping") processingCount++;

        const amt = Number(o.totalAmount) || Number(o.financials?.totalAmount) || Number(o.transferredAmount) || 0;
        if (st !== "cancelled") totalRevenue += amt;
    });

    if (totalEl) totalEl.textContent = totalCount.toString();
    if (pendingEl) pendingEl.textContent = pendingCount.toString();
    if (processingEl) processingEl.textContent = processingCount.toString();
    if (revenueEl) revenueEl.textContent = formatVND(totalRevenue);
}

/**
 * Render bảng danh sách đơn hàng Live Stream
 */
export function renderLiveOrdersTable(orders) {
    const tbody = document.getElementById("adminLiveOrdersTableBody");
    if (!tbody) return;

    const selectEl = document.getElementById("sortLiveOrdersSelect");
    if (selectEl && selectEl.value) {
        currentLiveOrderSort = selectEl.value;
    }
    updateLiveSortHeaderIcons();

    if (!Array.isArray(orders) || orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="p-8 text-center text-gray-400">
            <i class="fa-solid fa-video-slash text-2xl text-gray-300 mb-2 block"></i>
            Chưa có đơn hàng nào từ Live Stream phù hợp với bộ lọc hiện tại.
        </td></tr>`;
        return;
    }

    const sortedOrders = sortLiveOrdersList(orders, currentLiveOrderSort);
    const branches = (typeof window !== "undefined" && Array.isArray(window.allAdminBranches)) ? window.allAdminBranches : [];

    tbody.innerHTML = sortedOrders.map(order => {
        const savedRowStatus = getLiveOrderRowStatusLocal(order.id);
        const curStatus = (savedRowStatus || order.status || 'pending').toLowerCase();
        order.status = curStatus;

        const statusMeta = getLiveStatusMeta(curStatus, ADMIN_ORDER_STATUS_META);
        const payMeta = getLiveStatusMeta(order.payment?.status, ADMIN_PAYMENT_STATUS_META);
        const total = Number(order.totalAmount) || Number(order.financials?.totalAmount) || 0;
        const transferred = Number(order.transferredAmount) || Number(order.payment?.amountPaid) || 0;

        const sender = order.sender || {};
        const recipient = order.recipient || {};
        const customerName = order.customerName || order.recipientName || recipient.name || sender.name || "Khách xem Live";
        const customerPhone = order.phone || order.recipientPhone || recipient.phone || sender.phone || "";
        const deliveryAddress = order.shippingAddress || order.deliveryAddress || recipient.address || "Giao hỏa tốc 2H";

        const branchId = order.branchId || order.assignedBranchId || "admin";
        const branchName = order.branchName || (branchId === "admin" ? "Trung Tâm (Admin)" : branchId);
        const assigneeName = order.assigneeName || order.assignedTo || "Super Admin";
        const isAssignedToAdmin = (branchId === "admin");

        const proofImg = order.payment?.proofImage || order.paymentProofImage || order.proofImage || "";
        const flowerName = (order.selectedProduct && order.selectedProduct.productName) ||
            (order.items && order.items[0] && order.items[0].productName) || "Mẫu hoa chốt live";
        const flowerImg = (order.selectedProduct && order.selectedProduct.image) ||
            (order.items && order.items[0] && order.items[0].image) || "";

        // Danh sách chi nhánh cho dropdown điều phối
        const branchOptions = branches.filter(b => b.isActive !== false).map(b => `
            <option value="${b.id}" ${b.id === branchId ? 'selected' : ''}>📍 ${b.name || b.id}</option>
        `).join("");

        let options = `<option value="pending" ${curStatus === 'pending' ? 'selected' : ''}>⏳ Chờ xác nhận</option>`;
        options += `<option value="confirmed" ${curStatus === 'confirmed' ? 'selected' : ''}>✅ Xác nhận đơn</option>`;
        options += `<option value="arranging" ${(curStatus === 'arranging' || curStatus === 'in_progress' || curStatus === 'photo_sent') ? 'selected' : ''}>🌸 Đang cắm hoa</option>`;
        options += `<option value="shipping" ${(curStatus === 'shipping' || curStatus === 'ready_for_pickup') ? 'selected' : ''}>🚚 Đang vận chuyển</option>`;
        options += `<option value="delivered" ${curStatus === 'delivered' ? 'selected' : ''}>🎉 Giao thành công</option>`;
        options += `<option value="completed" ${curStatus === 'completed' ? 'selected' : ''}>🏁 Hoàn tất đơn</option>`;
        options += `<option value="cancelled" ${curStatus === 'cancelled' ? 'selected' : ''}>❌ Hủy đơn hàng</option>`;

        const statusActionHtml = `
            <select onchange="saveLiveOrderRowStatusLocal('${order.id}', this.value); updateAdminOrderStatus('${order.id}', this.value)"
                    class="w-full px-1.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-semibold text-gray-700 focus:outline-none focus:border-primary shadow-2xs">
                ${options}
            </select>
        `;

        return `
            <tr class="cursor-pointer hover:bg-rose-50/70 transition border-b border-gray-100 group"
                onclick="if (!event.target.closest('select, a, button, input')) openOrderDetailModal('${order.id}')"
                title="Nhấp để xem chi tiết & xử lý đơn">
                <td class="p-3 align-top">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="font-mono text-[11px] font-bold text-gray-800">${order.orderCode || order.id || ""}</span>
                        <button type="button"
                            onclick="event.stopPropagation(); if (typeof copyOrderShareHashLink === 'function') copyOrderShareHashLink('${order.orderCode || order.id || ""}');"
                            class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[9px] font-bold transition cursor-pointer"
                            title="Sao chép link #hash chia sẻ đơn hàng (#order=${order.orderCode || order.id || ""})">
                            <i class="fa-solid fa-hashtag text-[8px]"></i> Share
                        </button>
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[9px] font-extrabold border border-rose-200">
                            <i class="fa-solid fa-video text-[8px] animate-pulse"></i> LIVE
                        </span>
                    </div>
                    <div class="text-[10px] text-gray-400 mt-0.5">${formatLiveDate(order.createdAt || order.orderDate)}</div>
                    
                    <div class="flex items-center gap-1.5 mt-1.5">
                        ${flowerImg ? `<img src="${flowerImg}" class="w-7 h-7 rounded-lg object-cover border border-pink-100 flex-shrink-0" alt="flower" onerror="this.style.display='none'">` : ''}
                        <div class="text-[11px] text-rose-600 font-semibold line-clamp-1" title="${flowerName}">🌸 ${flowerName}</div>
                    </div>

                    ${proofImg ? `
                        <div class="mt-1.5">
                            <a href="${proofImg}" target="_blank" rel="noopener noreferrer"
                               class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-[10px] font-bold transition shadow-2xs">
                                <i class="fa-solid fa-receipt text-blue-600"></i> Xem Bill Chuyển Khoản
                            </a>
                        </div>
                    ` : `
                        <div class="text-[10px] text-amber-600 font-medium mt-1">
                            <i class="fa-solid fa-circle-exclamation"></i> Chưa đính kèm bill
                        </div>
                    `}
                </td>

                <td class="p-3 align-top">
                    <div class="text-xs font-bold text-gray-800">${customerName}</div>
                    <div class="text-[11px] text-gray-500 font-mono flex items-center gap-1 mt-0.5">
                        <i class="fa-solid fa-phone text-[9px] text-gray-400"></i>
                        <a href="tel:${customerPhone}" class="hover:text-primary">${customerPhone || "—"}</a>
                    </div>
                </td>

                <td class="p-3 align-top">
                    <div class="text-xs text-gray-700 font-bold">${recipient.name || customerName}</div>
                    <div class="text-[10px] text-gray-500 font-mono">${recipient.phone || customerPhone}</div>
                    <div class="text-[10px] text-gray-600 mt-0.5 max-w-[160px] xl:max-w-[260px] 2xl:max-w-[340px] line-clamp-2" title="${deliveryAddress}">
                        📍 ${deliveryAddress}
                    </div>
                    ${order.notes ? `<div class="text-[10px] text-pink-700 bg-pink-50/70 p-1 rounded mt-1 border border-pink-100 italic" title="${order.notes}">💬 "${order.notes}"</div>` : ''}
                    ${(Array.isArray(order.comments) && order.comments.length > 0) ? `
                        <div class="mt-1 space-y-1">
                            ${order.comments.slice(-2).map(c => `
                                <div class="text-[10px] text-amber-800 bg-amber-50 p-1 rounded border border-amber-200">
                                    <span class="font-bold">📝 ${c.authorName || "Khách"}:</span> ${c.message || ""}
                                </div>
                            `).join("")}
                        </div>
                    ` : ''}
                </td>

                <td class="p-3 align-top bg-rose-50/15">
                    <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700 text-[10px] font-bold shadow-2xs">
                        <i class="fa-regular fa-calendar-check text-[9px]"></i>
                        <span>${formatLiveReceivingDateLabel((order.delivery && order.delivery.deliveryDate) || order.deliveryDate || order.orderDate || "")}</span>
                    </div>
                    <div class="text-[10px] text-gray-400 font-mono mt-1">
                        ${(order.delivery && order.delivery.deliveryDate) || order.deliveryDate || order.orderDate || ""}
                    </div>
                </td>

                <td class="p-3 align-top bg-emerald-50/15">
                    <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-700 text-[11px] font-extrabold shadow-2xs">
                        <i class="fa-regular fa-clock text-[10px] text-emerald-600"></i>
                        <span>${(order.delivery && order.delivery.timeSlot) || order.deliveryTime || order.timeSlot || "⚡ Giao ngay (Sớm nhất)"}</span>
                    </div>
                    <div class="text-[10px] text-gray-500 mt-1">
                        ${((order.delivery && order.delivery.fulfillmentType === 'pickup') || order.fulfillmentType === 'pickup' || String(deliveryAddress).includes('Nhận trực tiếp tại Shop'))
                            ? '<span class="text-emerald-700 font-bold"><i class="fa-solid fa-store text-[9px]"></i> Nhận tại Shop</span>'
                            : '<span><i class="fa-solid fa-truck-fast text-[9px] text-gray-400"></i> Giao tận nơi</span>'}
                    </div>
                </td>

                <td class="p-3 align-top" onclick="event.stopPropagation()">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-[11px] font-semibold ${isAssignedToAdmin ? 'text-amber-700 font-bold' : 'text-gray-700'}">${branchName}</span>
                        ${isAssignedToAdmin ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold border border-amber-200 animate-pulse"><i class="fa-solid fa-bolt"></i> Chờ điều phối</span>' : ''}
                    </div>
                    <select onchange="dispatchAdminOrder('${order.id}', this.value)"
                            class="mt-1.5 w-full px-2 py-1 bg-white border border-gray-200 rounded text-[10px] font-medium focus:outline-none focus:border-primary">
                        <option value="admin" ${branchId === 'admin' ? 'selected' : ''}>🏢 Trung Tâm (Admin)</option>
                        ${branchOptions}
                    </select>
                </td>

                <td class="p-3 align-top">
                    <div class="text-[11px] font-semibold text-gray-800">${assigneeName}</div>
                    <div class="text-[10px] text-gray-400">Thợ cắm hoa / Shipper</div>
                </td>

                <td class="p-3 align-top">
                    <div class="font-bold text-gray-900 text-xs">${formatVND(total)}</div>
                    ${transferred > 0 ? `
                        <div class="text-[10px] text-emerald-600 font-medium mt-0.5">
                            Đã CK: <span class="font-bold">${formatVND(transferred)}</span>
                        </div>
                    ` : ''}
                </td>

                <td class="p-3 align-top">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${payMeta.color}">
                        <i class="fa-solid ${payMeta.icon}"></i> ${payMeta.label}
                    </span>
                </td>

                <td class="p-3 align-top">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusMeta.color}">
                        <i class="fa-solid ${statusMeta.icon}"></i> ${statusMeta.label}
                    </span>
                </td>

                <td class="p-3 align-top text-center" onclick="event.stopPropagation()">
                    <div class="flex flex-col gap-1.5 items-center">
                        <button type="button" onclick="openOrderDetailModal('${order.id}')"
                                class="w-full px-2.5 py-1.5 bg-gradient-to-r from-rose-500 via-pink-600 to-rose-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-lg text-[10px] font-bold shadow-xs hover:shadow transition flex items-center justify-center gap-1 group/btn">
                            <i class="fa-solid fa-bolt text-[9px] group-hover/btn:animate-bounce"></i> Xử lý đơn
                        </button>
                        ${statusActionHtml}
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

/**
 * Đặt hoặc xóa nhanh bộ lọc ngày cho đơn Live Stream
 */
export function setLiveOrderDateFilter(mode) {
    const dateEl = document.getElementById("filterLiveOrderDate");
    if (!dateEl) return;

    if (mode === "today") {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        dateEl.value = `${yyyy}-${mm}-${dd}`;
    } else if (mode === "all") {
        dateEl.value = "";
    }
    loadLiveStreamOrders();
}

/**
 * Cập nhật thanh hiển thị trạng thái lọc ngày
 */
function updateLiveOrderFilterInfoBar(dateStr, count) {
    const barEl = document.getElementById("liveOrderFilterInfoBar");
    const dateDisp = document.getElementById("liveOrderFilterDateDisplay");
    const countDisp = document.getElementById("liveOrderFilterCountDisplay");

    if (!barEl) return;

    if (dateStr) {
        barEl.classList.remove("hidden");
        // Format YYYY-MM-DD -> DD/MM/YYYY
        let formattedDate = dateStr;
        const parts = dateStr.split("-");
        if (parts.length === 3) {
            formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        if (dateDisp) dateDisp.textContent = formattedDate;
        if (countDisp) countDisp.textContent = count.toString();
    } else {
        barEl.classList.add("hidden");
    }
}

// Global window bindings cho trình duyệt và các inline event handlers
if (typeof window !== "undefined") {
    window.loadLiveStreamOrders = loadLiveStreamOrders;
    window.renderLiveOrdersTable = renderLiveOrdersTable;
    window.toggleLiveStreamQuickStatus = toggleLiveStreamQuickStatus;
    window.copyLiveStreamQuickLink = copyLiveStreamQuickLink;
    window.setLiveOrderDateFilter = setLiveOrderDateFilter;
    window.handleLiveOrderSortChange = handleLiveOrderSortChange;
    window.toggleLiveOrderColumnSort = toggleLiveOrderColumnSort;
    window.sortLiveOrdersList = sortLiveOrdersList;
    window.extractLiveOrderDateAndTime = extractLiveOrderDateAndTime;
    window.saveLiveOrderFilterState = saveLiveOrderFilterState;
    window.restoreLiveOrderFilterState = restoreLiveOrderFilterState;
    window.saveLiveOrderRowStatusLocal = saveLiveOrderRowStatusLocal;
    window.getLiveOrderRowStatusLocal = getLiveOrderRowStatusLocal;
    window.toggleLiveStreamHeaderStats = toggleLiveStreamHeaderStats;
    window.restoreLiveStreamHeaderStatsVisibility = restoreLiveStreamHeaderStatsVisibility;
    window.applyLiveStreamHeaderStatsVisibility = applyLiveStreamHeaderStatsVisibility;

    if (typeof document !== "undefined") {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                restoreLiveOrderFilterState();
                restoreLiveStreamHeaderStatsVisibility();
            });
        } else {
            restoreLiveOrderFilterState();
            restoreLiveStreamHeaderStatsVisibility();
        }
    }
}

