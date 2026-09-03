import { getCurrentUser, getAuthToken, openAuthModal } from './auth.js';
import { API_BASE, showToast } from './utils.js';

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
export function openCustomerPortalModal() {
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

export function closeCustomerPortalModal() {
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

        const orderIdSafe = (order.id || order.orderCode || "").replace(/'/g, "\\'");
        return `
            <div onclick="openOrderDetailModal('${orderIdSafe}')" class="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden cursor-pointer hover:border-emerald-400 hover:shadow-md transition group">
                <div class="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-3">
                        <span class="font-mono text-xs font-bold text-gray-800 group-hover:text-emerald-700 transition">${order.orderCode || order.id || ""}</span>
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
                        <p class="text-sm font-bold text-gray-800 group-hover:text-emerald-600 transition">${formatVND(total)}</p>
                        <p class="text-[10px] text-gray-400">${order.payment?.method === "vietqr" ? "VietQR" : (order.payment?.method || "Thanh toán")}</p>
                    </div>
                </div>
                <div class="px-4 py-1.5 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between text-[10px]">
                    <span class="text-gray-400">Xem chi tiết đơn hàng & tiến trình</span>
                    <span class="font-bold text-emerald-600 group-hover:text-emerald-700 flex items-center gap-1">
                        Chi tiết <i class="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                    </span>
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
