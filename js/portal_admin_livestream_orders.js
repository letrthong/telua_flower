// portal_admin_livestream_orders.js
// Phân hệ Quản Trị & Xử Lý Đơn Hàng Live Stream Tốc Hành trong Admin Portal (Cổng Quản Trị Hệ Thống)

import { getAuthToken } from './auth.js';
import { API_BASE, formatVND } from './utils.js';
import { notifyUser, lockScreen, unlockScreen } from './portal_admin_state.js';
import { ADMIN_ORDER_STATUS_META, ADMIN_PAYMENT_STATUS_META, exportOrdersToCsv } from './portal_admin_orders.js';

export let lastLoadedLiveOrders = [];
export let currentLiveStreamConfig = null;

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

    tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-gray-400">
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
    const isEnabled = !!(checkbox && checkbox.checked);
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    lockScreen();
    try {
        const payload = Object.assign({}, currentLiveStreamConfig || {}, {
            enableQuickOrder: isEnabled
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

    if (!Array.isArray(orders) || orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-gray-400">
            <i class="fa-solid fa-video-slash text-2xl text-gray-300 mb-2 block"></i>
            Chưa có đơn hàng nào từ Live Stream phù hợp với bộ lọc hiện tại.
        </td></tr>`;
        return;
    }

    const branches = (typeof window !== "undefined" && Array.isArray(window.allAdminBranches)) ? window.allAdminBranches : [];

    tbody.innerHTML = orders.map(order => {
        const statusMeta = getLiveStatusMeta(order.status, ADMIN_ORDER_STATUS_META);
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

        const curStatus = (order.status || 'pending').toLowerCase();
        const isTerminal = ['delivered', 'completed', 'cancelled', 'returned'].includes(curStatus);
        const STATUS_LEVELS = { pending: 1, confirmed: 2, arranging: 3, in_progress: 3, photo_sent: 3, shipping: 4, ready_for_pickup: 4, delivered: 5, completed: 5 };
        const curLevel = STATUS_LEVELS[curStatus] || 1;

        let statusActionHtml = '';
        if (isTerminal) {
            statusActionHtml = `
                <div class="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-400 flex items-center justify-center gap-1 cursor-not-allowed" title="Đơn hàng đã hoàn tất hoặc kết thúc, không thể thay đổi trạng thái">
                    <i class="fa-solid fa-lock text-[9px]"></i> Đã chốt xong
                </div>
            `;
        } else {
            let options = '<option value="">Cập nhật nhanh...</option>';
            if (curLevel < 2) options += '<option value="confirmed">✅ Xác nhận đơn</option>';
            if (curLevel < 3) options += '<option value="arranging">🌸 Đang cắm hoa</option>';
            if (curLevel < 4) options += '<option value="shipping">🚚 Đang vận chuyển</option>';
            if (curLevel < 5) options += '<option value="delivered">🎉 Giao thành công</option>';
            options += '<option value="completed">🏁 Hoàn tất đơn</option>';
            options += '<option value="cancelled">❌ Hủy đơn hàng</option>';

            statusActionHtml = `
                <select onchange="updateAdminOrderStatus('${order.id}', this.value)"
                        class="w-full px-1.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-semibold text-gray-700 focus:outline-none focus:border-primary shadow-2xs">
                    ${options}
                </select>
            `;
        }

        return `
            <tr class="cursor-pointer hover:bg-rose-50/70 transition border-b border-gray-100 group"
                onclick="if (!event.target.closest('select, a, button, input')) openOrderDetailModal('${order.id}')"
                title="Nhấp để xem chi tiết & xử lý đơn">
                <td class="p-3 align-top">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="font-mono text-[11px] font-bold text-gray-800">${order.orderCode || order.id || ""}</span>
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
                    <div class="text-[10px] text-gray-600 mt-0.5 max-w-[160px] line-clamp-2" title="${deliveryAddress}">
                        📍 ${deliveryAddress}
                    </div>
                    ${order.notes ? `<div class="text-[10px] text-pink-700 bg-pink-50/70 p-1 rounded mt-1 border border-pink-100 italic" title="${order.notes}">💬 "${order.notes}"</div>` : ''}
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
}

