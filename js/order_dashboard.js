import { getCurrentUser, getAuthToken, openAuthModal } from './auth.js';
import { API_BASE } from './utils.js';

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
export function openOrderDashboardModal() {
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

export function closeOrderDashboardModal() {
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
