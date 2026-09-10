import { getAuthToken } from './auth.js';
import { API_BASE } from './utils.js';
import { notifyUser } from './portal_admin_state.js';

// ==========================================
// QUẢN LÝ ĐƠN HÀNG (ORDERS MANAGEMENT)
// ==========================================

export const ADMIN_ORDER_STATUS_META = {
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

export const ADMIN_PAYMENT_STATUS_META = {
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

export async function loadAdminOrders() {
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

export async function updateAdminOrderStatus(orderId, newStatus) {
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

if (typeof window !== "undefined") {
    window.ADMIN_ORDER_STATUS_META = ADMIN_ORDER_STATUS_META;
    window.ADMIN_PAYMENT_STATUS_META = ADMIN_PAYMENT_STATUS_META;
    window.loadAdminOrders = loadAdminOrders;
    window.updateAdminOrderStatus = updateAdminOrderStatus;
}
