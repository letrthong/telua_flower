import { getCurrentUser, getAuthToken, openAuthModal } from './auth.js';
import { API_BASE, showToast } from './utils.js';

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

function dashFormatDateTime(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${hours}:${minutes} ${day}/${month}/${year}`;
}

function dashGetOrderUpdatedAt(order) {
    if (order && order.updatedAt) return order.updatedAt;
    if (order && Array.isArray(order.history) && order.history.length > 0) {
        const latest = order.history[order.history.length - 1];
        if (latest && latest.updatedAt) return latest.updatedAt;
    }
    return (order && (order.createdAt || order.orderDate)) || "";
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

    fetchAvailableDashboardMonths();
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
 * Lấy danh sách các tháng có đơn hàng từ backend và cập nhật select #dashMonthSelect
 */
async function fetchAvailableDashboardMonths() {
    const monthSelect = document.getElementById("dashMonthSelect");
    if (!monthSelect) return;

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/orders/months`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (res.ok && json.success && Array.isArray(json.data)) {
            const currentVal = monthSelect.value || "last_month";
            let html = `
                <option value="all">Tất cả các tháng</option>
                <option value="this_month">Tháng này</option>
                <option value="last_month">Tháng trước (1 tháng trước)</option>
            `;
            const hasMonths = json.data.length > 0;
            if (hasMonths) {
                html += `<optgroup label="Tháng cụ thể">`;
                for (const m of json.data) {
                    html += `<option value="${m.key}">${m.label}</option>`;
                }
                html += `</optgroup>`;
            }
            monthSelect.innerHTML = html;
            monthSelect.value = currentVal;
        }
    } catch (e) {
        console.warn("Could not fetch available order months", e);
    }
}

let rawDashboardOrders = [];
let cachedDashboardOrders = [];

/**
 * Tải danh sách đơn hàng theo mốc thời gian / tháng đã chọn
 */
export async function loadDashboardOrders() {
    const listEl = document.getElementById("orderDashboardList");
    const emptyEl = document.getElementById("orderDashboardEmpty");
    if (!listEl) return;

    listEl.innerHTML = `
        <div class="text-center py-12">
            <i class="fa-solid fa-circle-notch fa-spin text-3xl text-emerald-600"></i>
            <p class="text-sm text-gray-500 mt-3">Đang tải đơn hàng...</p>
        </div>
    `;
    if (emptyEl) emptyEl.classList.add("hidden");

    const user = dashGetCurrentUser() || {};
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    const monthSelect = document.getElementById("dashMonthSelect");
    const selectedMonth = monthSelect ? monthSelect.value : "last_month";

    let url = `${API_BASE}/admin/orders?`;
    if (selectedMonth === "this_month" || selectedMonth === "last_month" || selectedMonth === "all") {
        url += `timeframe=${encodeURIComponent(selectedMonth)}`;
    } else if (selectedMonth.includes("_")) {
        url += `month=${encodeURIComponent(selectedMonth)}`;
    } else {
        url += `timeframe=all`;
    }

    // Florist/Sales: giới hạn theo chi nhánh của họ
    if (user.role !== "super_admin" && user.branchId) {
        url += `&branchId=${encodeURIComponent(user.branchId)}`;
    }

    try {
        const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
        const json = await res.json();
        if (!res.ok || !json.success) {
            throw new Error(json.message || "Không tải được đơn hàng");
        }
        const data = json.data || {};
        rawDashboardOrders = Array.isArray(data.orders) ? data.orders : (Array.isArray(data) ? data : []);
        applyDashboardFilters();
    } catch (e) {
        listEl.innerHTML = `
            <div class="text-center py-12 bg-white rounded-xl border border-red-100">
                <i class="fa-solid fa-triangle-exclamation text-3xl text-red-400 mb-3"></i>
                <p class="text-sm font-semibold text-gray-700">Không thể tải đơn hàng</p>
                <p class="text-xs text-gray-400 mt-1">${e.message}</p>
                <button onclick="loadDashboardOrders()" class="mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition shadow-2xs">
                    <i class="fa-solid fa-rotate-right mr-1"></i> Thử lại
                </button>
            </div>
        `;
    }
}

/**
 * Xử lý khi người dùng đổi tháng trên dropdown
 */
/**
 * Xử lý khi người dùng đổi tháng trên dropdown
 */
export function onDashboardMonthChange(monthKey) {
    loadDashboardOrders();
}

/**
 * Xử lý khi người dùng đổi tiêu chí sắp xếp trên dropdown
 */
export function onDashboardSortChange(sortVal) {
    applyDashboardFilters();
}

/**
 * Lọc đơn hàng tức thì (theo trạng thái & từ khóa tìm kiếm & sắp xếp)
 */
export function onDashboardFilterChange() {
    applyDashboardFilters();
}

function applyDashboardFilters() {
    const statusFilter = document.getElementById("dashStatusFilter")?.value || "all";
    const searchKeyword = (document.getElementById("dashSearchInput")?.value || "").trim().toLowerCase();
    const sortVal = document.getElementById("dashSortSelect")?.value || "updatedAt_desc";

    let filtered = [...rawDashboardOrders];

    if (statusFilter && statusFilter !== "all") {
        filtered = filtered.filter(o => (o.status || "").toLowerCase() === statusFilter.toLowerCase());
    }

    if (searchKeyword) {
        filtered = filtered.filter(o => {
            const code = (o.orderCode || o.id || "").toLowerCase();
            const recipientName = (o.recipient?.name || "").toLowerCase();
            const recipientPhone = (o.recipient?.phone || "").toLowerCase();
            const senderName = (o.sender?.name || "").toLowerCase();
            const senderPhone = (o.sender?.phone || "").toLowerCase();
            return code.includes(searchKeyword) ||
                   recipientName.includes(searchKeyword) ||
                   recipientPhone.includes(searchKeyword) ||
                   senderName.includes(searchKeyword) ||
                   senderPhone.includes(searchKeyword);
        });
    }

    // Sắp xếp động trên client-side
    const parts = sortVal.split("_");
    const dir = parts[parts.length - 1]; // "asc" or "desc"
    const field = parts.slice(0, parts.length - 1).join("_"); // "updatedAt", "createdAt", "totalAmount"

    filtered.sort((a, b) => {
        if (field === "totalAmount") {
            const valA = Number(a.totalAmount || a.financials?.totalAmount || 0);
            const valB = Number(b.totalAmount || b.financials?.totalAmount || 0);
            return dir === "asc" ? valA - valB : valB - valA;
        }

        let strA = "";
        let strB = "";

        if (field === "createdAt") {
            strA = String(a.createdAt || a.orderDate || "");
            strB = String(b.createdAt || b.orderDate || "");
        } else {
            // Default "updatedAt"
            strA = String(dashGetOrderUpdatedAt(a));
            strB = String(dashGetOrderUpdatedAt(b));
        }

        if (dir === "asc") {
            return strA.localeCompare(strB);
        }
        return strB.localeCompare(strA);
    });

    renderDashboardOrders(filtered);
}

function renderDashboardOrders(orders) {
    cachedDashboardOrders = Array.isArray(orders) ? orders : [];
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
        const orderIdSafe = (order.id || order.orderCode || "").replace(/'/g, "\\'");
        const updatedAt = dashGetOrderUpdatedAt(order);
        const updatedLabel = updatedAt ? dashFormatDateTime(updatedAt) : "";
        const createdLabel = dashFormatDate(order.createdAt || order.orderDate);

        return `
            <div onclick="openOrderDetailModal('${orderIdSafe}')" class="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden cursor-pointer hover:border-emerald-400 hover:shadow-md transition group">
                <div class="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center flex-wrap gap-2 sm:gap-3">
                        <span class="font-mono text-xs font-bold text-gray-800 group-hover:text-emerald-700 transition">${order.orderCode || order.id || ""}</span>
                        <span class="text-[11px] text-gray-400" title="Thời gian tạo đơn"><i class="fa-regular fa-calendar-plus mr-1 text-[10px]"></i>${createdLabel}</span>
                        ${updatedLabel ? `<span class="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium" title="Thời gian cập nhật mới nhất"><i class="fa-solid fa-clock-rotate-left text-[10px] text-emerald-600"></i> Cập nhật: ${updatedLabel}</span>` : ""}
                        ${branchLabel ? `<span class="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"><i class="fa-solid fa-store mr-1 text-emerald-600"></i>${branchLabel}</span>` : ""}
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
                        <p class="text-sm font-bold text-gray-800 group-hover:text-emerald-600 transition">${dashFormatVND(total)}</p>
                        <p class="text-[10px] text-gray-400">${order.payment?.method === "vietqr" ? "VietQR" : (order.payment?.method || "Thanh toán")}</p>
                    </div>
                </div>
                <div class="px-4 py-2 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between text-[11px]">
                    <span class="text-gray-400 flex items-center gap-1">
                        <i class="fa-solid fa-mouse-pointer text-emerald-500"></i> Nhấp để xem chi tiết đầy đủ
                    </span>
                    <span class="font-bold text-emerald-600 group-hover:text-emerald-700 flex items-center gap-1">
                        Chi tiết <i class="fa-solid fa-arrow-right text-[10px] group-hover:translate-x-1 transition-transform"></i>
                    </span>
                </div>
            </div>
        `;
    }).join("");
}

let currentOpenOrderId = null;

/**
 * Mở modal Chi Tiết Đơn Hàng & Tải dữ liệu từ API hoặc Cache
 */
export async function openOrderDetailModal(orderId) {
    if (!orderId) return;

    currentOpenOrderId = String(orderId).trim();

    const modal = document.getElementById("orderDetailModal");
    const loadingEl = document.getElementById("ordDetailLoading");
    const contentEl = document.getElementById("ordDetailContent");

    if (!modal) return;

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    if (loadingEl) loadingEl.classList.remove("hidden");
    if (contentEl) contentEl.classList.add("hidden");

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const cleanId = currentOpenOrderId;

    try {
        const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(cleanId)}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();

        if (res.ok && json.success && json.data) {
            populateOrderDetail(json.data);
            return;
        }
        throw new Error(json.message || "Không thể tải chi tiết đơn hàng");
    } catch (err) {
        // Fallback: Tìm trong danh sách cache đã tải trước đó
        const cached = cachedDashboardOrders.find(o => o.id === cleanId || o.orderCode === cleanId);
        if (cached) {
            populateOrderDetail(cached);
            return;
        }

        if (loadingEl) {
            loadingEl.innerHTML = `
                <i class="fa-solid fa-triangle-exclamation text-4xl text-rose-500 mb-3"></i>
                <p class="text-sm font-bold text-gray-800">Không tìm thấy chi tiết đơn hàng</p>
                <p class="text-xs text-gray-400 mt-1">${err.message || "Vui lòng thử lại sau"}</p>
                <button onclick="closeOrderDetailModal()" class="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-xl transition">
                    Đóng
                </button>
            `;
        }
    }
}

/**
 * Đóng modal Chi Tiết Đơn Hàng
 */
export function closeOrderDetailModal() {
    const modal = document.getElementById("orderDetailModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
    currentOpenOrderId = null;
}

/**
 * Lấy mốc thời gian (timestamp) theo từng bước từ order.history
 */
function getStepTimestamp(order, stepKey) {
    const history = Array.isArray(order.history) ? order.history : [];
    if (stepKey === "pending") {
        const item = history.find(h => h.status === "pending");
        return item?.updatedAt || order.createdAt || order.orderDate;
    }
    if (stepKey === "confirmed") {
        const item = history.find(h => h.status === "confirmed");
        return item?.updatedAt;
    }
    if (stepKey === "arranging") {
        const item = history.find(h => h.status === "arranging" || h.status === "photo_sent");
        return item?.updatedAt;
    }
    if (stepKey === "shipping") {
        const item = history.find(h => h.status === "shipping");
        return item?.updatedAt;
    }
    if (stepKey === "ready_for_pickup") {
        const item = history.find(h => h.status === "ready_for_pickup");
        return item?.updatedAt;
    }
    if (stepKey === "delivered" || stepKey === "completed") {
        const item = history.find(h => h.status === "delivered" || h.status === "completed");
        return item?.updatedAt;
    }
    return null;
}

/**
 * Hiển thị Progress Bar & Stepper chi tiết 5 bước trạng thái đơn hàng + ngày giờ cập nhật
 */
export function renderOrderProgressStepper(order) {
    const cardEl = document.getElementById("ordDetailProgressCard");
    const subEl = document.getElementById("ordDetailProgressSub");
    const badgeEl = document.getElementById("ordDetailProgressPercentBadge");
    const fillEl = document.getElementById("ordDetailProgressBarFill");
    const nodesEl = document.getElementById("ordDetailStepperNodes");
    if (!cardEl || !nodesEl) return;

    const fulfillment = String(order.fulfillmentType || order.delivery?.fulfillmentType || "delivery").toLowerCase();
    const isPickup = fulfillment === "pickup";

    const steps = isPickup ? [
        { key: "pending", label: "Chờ xác nhận", sub: "Tiếp nhận đơn", icon: "fa-receipt" },
        { key: "confirmed", label: "Đã xác nhận", sub: "Chuẩn bị hoa", icon: "fa-check" },
        { key: "arranging", label: "Đang cắm hoa", sub: "Florist cắm mẫu", icon: "fa-scissors" },
        { key: "ready_for_pickup", label: "Sẵn sàng nhận", sub: "Tại quầy chi nhánh", icon: "fa-store" },
        { key: "completed", label: "Đã nhận hoa", sub: "Hoàn tất đơn", icon: "fa-box-open" }
    ] : [
        { key: "pending", label: "Chờ xác nhận", sub: "Tiếp nhận đơn", icon: "fa-receipt" },
        { key: "confirmed", label: "Đã xác nhận", sub: "Chuẩn bị hoa", icon: "fa-check" },
        { key: "arranging", label: "Đang cắm hoa", sub: "Florist cắm mẫu", icon: "fa-scissors" },
        { key: "shipping", label: "Đang vận chuyển", sub: "Shipper đang giao", icon: "fa-truck-fast" },
        { key: "delivered", label: "Giao thành công", sub: "Hoàn tất đơn", icon: "fa-box-open" }
    ];

    const currentStatus = String(order.status || "pending").toLowerCase();
    const isCancelled = currentStatus === "cancelled";
    const isReturned = currentStatus === "returned";

    let activeIndex = 0;
    if (isCancelled || isReturned) {
        const history = Array.isArray(order.history) ? order.history : [];
        const nonCancelled = history.filter(h => h.status !== "cancelled" && h.status !== "returned");
        const lastStatus = nonCancelled.length > 0 ? nonCancelled[nonCancelled.length - 1].status : "pending";
        activeIndex = steps.findIndex(s => s.key === lastStatus);
        if (activeIndex === -1) activeIndex = 0;
    } else {
        if (currentStatus === "pending") activeIndex = 0;
        else if (currentStatus === "confirmed") activeIndex = 1;
        else if (currentStatus === "arranging" || currentStatus === "photo_sent") activeIndex = 2;
        else if (currentStatus === "shipping" || currentStatus === "ready_for_pickup") activeIndex = 3;
        else if (currentStatus === "delivered" || currentStatus === "completed") activeIndex = 4;
    }

    const isFinished = !isCancelled && !isReturned && (currentStatus === "delivered" || currentStatus === "completed");
    const percent = isFinished ? 100 : Math.round(((activeIndex + (isCancelled || isReturned ? 0 : 0.5)) / steps.length) * 100);

    const latestUpdated = dashGetOrderUpdatedAt(order);
    const formattedLatest = latestUpdated ? dashFormatDateTime(latestUpdated) : dashFormatDateTime(order.createdAt || order.orderDate);

    if (subEl) {
        if (isCancelled) {
            subEl.innerHTML = `<span class="text-red-600 font-bold"><i class="fa-solid fa-ban mr-1"></i> Đơn hàng đã bị hủy</span> • Cập nhật: ${formattedLatest}`;
        } else if (isReturned) {
            subEl.innerHTML = `<span class="text-orange-600 font-bold"><i class="fa-solid fa-rotate-left mr-1"></i> Đơn hàng trả lại</span> • Cập nhật: ${formattedLatest}`;
        } else if (isFinished) {
            subEl.innerHTML = `<span class="text-emerald-700 font-bold"><i class="fa-solid fa-circle-check mr-1"></i> Đã hoàn tất toàn bộ 5/5 bước</span> • Cập nhật: ${formattedLatest}`;
        } else {
            subEl.innerHTML = `Bước ${activeIndex + 1} / ${steps.length} • <span class="text-emerald-700 font-bold">${steps[activeIndex]?.label}</span> • Cập nhật: ${formattedLatest}`;
        }
    }

    if (badgeEl) {
        if (isCancelled) {
            badgeEl.className = "px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 font-mono text-[11px] font-bold";
            badgeEl.textContent = "Đã Hủy";
        } else if (isReturned) {
            badgeEl.className = "px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 font-mono text-[11px] font-bold";
            badgeEl.textContent = "Trả Hàng";
        } else if (isFinished) {
            badgeEl.className = "px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[11px] font-bold";
            badgeEl.textContent = "100% Hoàn Tất";
        } else {
            badgeEl.className = "px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[11px] font-bold";
            badgeEl.textContent = `${percent}% Tiến Trình`;
        }
    }

    if (fillEl) {
        fillEl.style.width = isCancelled ? "100%" : `${percent}%`;
        fillEl.className = isCancelled 
            ? "bg-gradient-to-r from-red-400 to-red-600 h-2 rounded-full transition-all duration-500" 
            : "bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all duration-500";
    }

    // Render 5 step nodes
    nodesEl.innerHTML = steps.map((step, idx) => {
        const stepTime = getStepTimestamp(order, step.key);
        const isPast = idx < activeIndex || isFinished;
        const isCurrent = idx === activeIndex && !isFinished && !isCancelled && !isReturned;

        let circleClass = "";
        let iconHtml = "";
        let titleClass = "";
        let timeHtml = "";

        if (isPast) {
            circleClass = "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-200";
            iconHtml = `<i class="fa-solid fa-check text-xs"></i>`;
            titleClass = "text-emerald-800 font-bold";
            const timeStr = stepTime ? dashFormatDateTime(stepTime) : "";
            timeHtml = timeStr 
                ? `<span class="inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold mt-1" title="${timeStr}">${timeStr.slice(0, 11)}</span>`
                : `<span class="inline-block text-[9px] text-emerald-600 mt-1 font-medium">Hoàn tất</span>`;
        } else if (isCurrent) {
            circleClass = "bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-md ring-4 ring-emerald-100 animate-pulse";
            iconHtml = `<i class="fa-solid ${step.icon} text-xs"></i>`;
            titleClass = "text-emerald-900 font-extrabold";
            const timeStr = stepTime ? dashFormatDateTime(stepTime) : (latestUpdated ? dashFormatDateTime(latestUpdated) : "");
            timeHtml = timeStr 
                ? `<span class="inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold mt-1 shadow-2xs" title="${timeStr}">${timeStr.slice(0, 11)}</span>`
                : `<span class="inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold mt-1">Hiện tại</span>`;
        } else if (isCancelled && idx === activeIndex) {
            circleClass = "bg-red-500 text-white ring-4 ring-red-100";
            iconHtml = `<i class="fa-solid fa-ban text-xs"></i>`;
            titleClass = "text-red-700 font-bold";
            timeHtml = `<span class="inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 mt-1">Đã hủy</span>`;
        } else {
            circleClass = "bg-gray-50 text-gray-400 border-2 border-dashed border-gray-300";
            iconHtml = `<span class="text-xs font-bold font-mono text-gray-400">${idx + 1}</span>`;
            titleClass = "text-gray-400 font-medium";
            timeHtml = `<span class="inline-block text-[9px] text-gray-400 mt-1 italic">Chưa tới</span>`;
        }

        return `
            <div class="flex flex-col items-center text-center p-1 sm:p-2 rounded-xl transition hover:bg-gray-50/80">
                <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition duration-300 ${circleClass}">
                    ${iconHtml}
                </div>
                <div class="mt-1.5 min-w-0 w-full">
                    <div class="text-[10px] sm:text-xs leading-tight truncate ${titleClass}">${step.label}</div>
                    <div class="text-[9px] sm:text-[10px] text-gray-400 leading-tight hidden sm:block truncate mt-0.5">${step.sub}</div>
                    <div class="mt-0.5">${timeHtml}</div>
                </div>
            </div>
        `;
    }).join("");
}

/**
 * Điền toàn bộ thông tin đơn hàng vào Modal
 */
function populateOrderDetail(order) {
    const loadingEl = document.getElementById("ordDetailLoading");
    const contentEl = document.getElementById("ordDetailContent");

    if (loadingEl) loadingEl.classList.add("hidden");
    if (contentEl) contentEl.classList.remove("hidden");

    // 1. Header
    const codeEl = document.getElementById("ordDetailCode");
    if (codeEl) codeEl.textContent = order.orderCode || order.id || "NHTB-ORDER";

    const createdEl = document.getElementById("ordDetailCreatedAt");
    if (createdEl) {
        const dt = order.createdAt || order.orderDate;
        createdEl.textContent = dt ? `Ngày tạo: ${dashFormatDate(dt)}` : "Đơn hàng Telua Flower";
    }

    // 2. Badges
    const statusMeta = dashGetStatusMeta(order.status, DASH_ORDER_STATUS_META);
    const statusBadge = document.getElementById("ordDetailStatusBadge");
    if (statusBadge) {
        statusBadge.className = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${statusMeta.color}`;
        statusBadge.innerHTML = `<i class="fa-solid ${statusMeta.icon}"></i> ${statusMeta.label}`;
    }

    const payMeta = dashGetStatusMeta(order.payment?.status, DASH_PAYMENT_STATUS_META);
    const payBadge = document.getElementById("ordDetailPaymentBadge");
    if (payBadge) {
        payBadge.className = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${payMeta.color}`;
        payBadge.innerHTML = `<i class="fa-solid ${payMeta.icon}"></i> ${payMeta.label}`;
    }

    const branchBadge = document.getElementById("ordDetailBranchBadge");
    if (branchBadge) {
        const bId = order.assignedBranchId || order.branchId || "admin";
        branchBadge.innerHTML = `<i class="fa-solid fa-store text-emerald-600"></i> ${bId}`;
    }

    // 2b. Tiến trình xử lý đơn hàng (5 bước trạng thái + ngày giờ cập nhật)
    renderOrderProgressStepper(order);

    // 3. Staff Actions Bar (Chỉ hiện cho nhân viên nội bộ)
    const user = dashGetCurrentUser();
    const staffActionsEl = document.getElementById("ordDetailStaffActions");
    if (staffActionsEl) {
        const isInternal = user && INTERNAL_ROLES.includes(user.role);
        staffActionsEl.classList.toggle("hidden", !isInternal);

        if (isInternal) {
            const nextStatusSelect = document.getElementById("ordDetailNextStatusSelect");
            if (nextStatusSelect) nextStatusSelect.value = order.status || "";

            const cashBtn = document.getElementById("ordDetailConfirmCashBtn");
            if (cashBtn) {
                const isPaid = order.payment?.status === "paid";
                const isOnline = ["vietqr", "card", "visa", "mastercard"].includes(String(order.payment?.method || "").toLowerCase());
                if (isPaid) {
                    cashBtn.disabled = true;
                    cashBtn.className = "px-3 py-1.5 bg-gray-100 text-gray-400 text-xs font-bold rounded-lg border border-gray-200 cursor-not-allowed flex items-center gap-1.5";
                    cashBtn.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-500"></i> Đã thanh toán';
                } else if (isOnline) {
                    cashBtn.disabled = true;
                    cashBtn.className = "px-3 py-1.5 bg-gray-100 text-gray-400 text-xs font-bold rounded-lg border border-gray-200 cursor-not-allowed flex items-center gap-1.5";
                    cashBtn.innerHTML = '<i class="fa-solid fa-qrcode text-blue-500"></i> Online (Tự động)';
                } else {
                    cashBtn.disabled = false;
                    cashBtn.className = "px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-2xs flex items-center gap-1.5";
                    cashBtn.innerHTML = '<i class="fa-solid fa-money-bill-wave"></i> Thu tiền mặt';
                }
            }
        }
    }

    // 4. Recipient & Delivery
    const recipient = order.recipient || {};
    const setSafe = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || "-";
    };

    setSafe("ordDetailRecipientName", recipient.name || "Chưa cập nhật");
    setSafe("ordDetailRecipientPhone", recipient.phone || "-");
    setSafe("ordDetailRecipientAddress", recipient.address || "Nhận tại quầy (Pickup)");

    const delivery = order.delivery || {};
    const deliveryTime = (delivery.deliveryDate || "") + (delivery.timeSlot ? ` • Khung giờ: ${delivery.timeSlot}` : "");
    setSafe("ordDetailDeliveryTime", deliveryTime || "Theo lịch hẹn cửa hàng");

    const expressBadge = document.getElementById("ordDetailExpressBadge");
    if (expressBadge) {
        expressBadge.classList.toggle("hidden", !delivery.isExpress2H);
    }

    const notesRow = document.getElementById("ordDetailNotesRow");
    if (notesRow) {
        if (recipient.deliveryNotes) {
            notesRow.classList.remove("hidden");
            setSafe("ordDetailDeliveryNotes", recipient.deliveryNotes);
        } else {
            notesRow.classList.add("hidden");
        }
    }

    // 5. Sender / Customer
    const sender = order.sender || {};
    setSafe("ordDetailSenderName", sender.name || "Khách lẻ vãng lai");
    setSafe("ordDetailSenderPhone", sender.phone || "-");
    setSafe("ordDetailSenderEmail", sender.email || "-");

    const anonBadge = document.getElementById("ordDetailAnonBadge");
    if (anonBadge) {
        anonBadge.classList.toggle("hidden", !sender.isAnonymous);
    }

    // 6. Customization: Card & Ribbon
    const custom = order.customization || {};
    const cardEl = document.getElementById("ordDetailCardMessage");
    if (cardEl) {
        cardEl.textContent = custom.cardMessage ? `"${custom.cardMessage}"` : "Không yêu cầu ghi thiệp";
        cardEl.className = custom.cardMessage ? "text-gray-800 font-semibold italic" : "text-gray-400 italic";
    }

    const ribbonEl = document.getElementById("ordDetailRibbonBanner");
    if (ribbonEl) {
        ribbonEl.textContent = custom.ribbonBanner || "Không in băng rôn";
        ribbonEl.className = custom.ribbonBanner ? "text-gray-800 font-bold" : "text-gray-400";
    }

    // 7. Products Table
    const items = Array.isArray(order.items) ? order.items : [];
    const itemsCountEl = document.getElementById("ordDetailItemCount");
    if (itemsCountEl) itemsCountEl.textContent = `${items.length} món`;

    const itemsTable = document.getElementById("ordDetailItemsTable");
    if (itemsTable) {
        if (items.length === 0) {
            itemsTable.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-gray-400">Không có sản phẩm trong đơn</td></tr>`;
        } else {
            itemsTable.innerHTML = items.map(it => {
                const img = it.image || "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=150";
                const pName = it.productName || it.name || "Sản phẩm hoa";
                const pPrice = Number(it.price) || 0;
                const pQty = Number(it.quantity) || 1;
                const pTotal = Number(it.itemTotal) || (pPrice * pQty);

                return `
                    <tr class="hover:bg-gray-50/80 transition">
                        <td class="px-4 py-3 flex items-center gap-3">
                            <img src="${img}" alt="${pName}" class="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0 shadow-2xs" onerror="this.src='https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=150'">
                            <div class="min-w-0">
                                <p class="font-bold text-gray-800 truncate">${pName}</p>
                                <p class="text-[10px] text-gray-400 font-mono">${it.productId || ""}</p>
                            </div>
                        </td>
                        <td class="px-4 py-3 text-center text-gray-600">${dashFormatVND(pPrice)}</td>
                        <td class="px-4 py-3 text-center font-bold text-gray-800">x${pQty}</td>
                        <td class="px-4 py-3 text-right font-bold text-emerald-700">${dashFormatVND(pTotal)}</td>
                    </tr>
                `;
            }).join("");
        }
    }

    // 8. Payment & Financials
    const financials = order.financials || {};
    const total = Number(order.totalAmount) || Number(financials.totalAmount) || 0;
    const subtotal = Number(financials.subtotal) || total;
    const shipping = Number(financials.shippingFee) || 0;
    const discount = Number(financials.discountAmount) || 0;

    setSafe("ordDetailSubtotal", dashFormatVND(subtotal));
    setSafe("ordDetailShippingFee", dashFormatVND(shipping));
    setSafe("ordDetailTotalAmount", dashFormatVND(total));

    const discountRow = document.getElementById("ordDetailDiscountRow");
    if (discountRow) {
        if (discount > 0) {
            discountRow.classList.remove("hidden");
            const discountLabel = document.getElementById("ordDetailDiscountLabel");
            const vCode = financials.appliedVoucher?.code || "";
            if (discountLabel) discountLabel.textContent = vCode ? `Giảm giá (${vCode}):` : "Giảm giá voucher:";
            setSafe("ordDetailDiscount", `-${dashFormatVND(discount)}`);
        } else {
            discountRow.classList.add("hidden");
        }
    }

    const pay = order.payment || {};
    const payMethodEl = document.getElementById("ordDetailPayMethod");
    if (payMethodEl) {
        payMethodEl.textContent = pay.method === "vietqr" ? "Chuyển khoản VietQR" : (pay.method ? pay.method.toUpperCase() : "Tiền mặt");
    }
    setSafe("ordDetailTransferContent", pay.transferContent || order.orderCode || order.id || "-");

    const bankRow = document.getElementById("ordDetailBankRow");
    if (bankRow) {
        if (pay.bankInfo && pay.bankInfo.bankId) {
            bankRow.classList.remove("hidden");
            setSafe("ordDetailBankInfo", `${pay.bankInfo.bankId} • ${pay.bankInfo.accountNo || ""}`);
        } else {
            bankRow.classList.add("hidden");
        }
    }

    // 9. Flower Photo Preview
    const photoSection = document.getElementById("ordDetailFlowerPhotoSection");
    const photoImg = document.getElementById("ordDetailFlowerPhotoImg");
    const photoApproved = document.getElementById("ordDetailPhotoApproved");

    if (photoSection && photoImg) {
        if (order.flowerPhoto && order.flowerPhoto.photoUrl) {
            photoSection.classList.remove("hidden");
            photoImg.src = order.flowerPhoto.photoUrl;
            if (photoApproved) {
                photoApproved.classList.toggle("hidden", !order.flowerPhoto.isApprovedByCustomer);
            }
        } else {
            photoSection.classList.add("hidden");
        }
    }

    // 10. History Timeline
    const timelineEl = document.getElementById("ordDetailTimeline");
    if (timelineEl) {
        const history = Array.isArray(order.history) ? order.history : [];
        if (history.length === 0) {
            timelineEl.innerHTML = `
                <div class="relative pl-7 py-1 text-xs text-gray-500">
                    <span class="absolute left-1.5 top-1.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-xs"></span>
                    <p class="font-bold text-gray-800">Đơn hàng được khởi tạo</p>
                    <p class="text-[10px] text-gray-400 mt-0.5">${dashFormatDate(order.createdAt || order.orderDate)}</p>
                </div>
            `;
        } else {
            timelineEl.innerHTML = history.map((h, idx) => {
                const isLatest = idx === history.length - 1;
                const hMeta = dashGetStatusMeta(h.status, DASH_ORDER_STATUS_META);
                return `
                    <div class="relative pl-7 py-1 text-xs">
                        <span class="absolute left-1.5 top-1.5 w-4 h-4 rounded-full ${isLatest ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-gray-300'} border-2 border-white shadow-xs"></span>
                        <div class="flex flex-wrap items-center justify-between gap-1">
                            <span class="font-bold text-gray-800">${hMeta.label}</span>
                            <span class="text-[10px] text-gray-400 font-mono">${h.updatedAt ? dashFormatDate(h.updatedAt) : ""}</span>
                        </div>
                        <p class="text-xs text-gray-600 mt-0.5">${h.note || "Cập nhật trạng thái đơn hàng"}</p>
                        ${h.updatedBy ? `<p class="text-[10px] text-gray-400 mt-0.5"><i class="fa-solid fa-user-pen mr-1"></i>Thao tác bởi: ${h.updatedBy}</p>` : ""}
                    </div>
                `;
            }).join("");
        }
    }
}

/**
 * Xử lý tải lên ảnh hoa thành phẩm thực tế (Thợ hoa / Quản lý)
 */
export async function handleOrderPhotoUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file || !currentOpenOrderId) return;

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const formData = new FormData();
    formData.append("photo", file);

    const uploadBtn = document.getElementById("ordDetailUploadPhotoBtn");
    const originalHtml = uploadBtn ? uploadBtn.innerHTML : "";
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải ảnh...';
    }

    try {
        const res = await fetch(`${API_BASE}/admin/orders/${encodeURIComponent(currentOpenOrderId)}/photo`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData
        });
        const json = await res.json();

        if (res.ok && json.success) {
            if (typeof showToast === "function") {
                showToast("Đã tải ảnh hoa thành phẩm & chuyển trạng thái sang [Đã gửi ảnh]!", "success");
            } else {
                alert("Đã tải lên ảnh hoa thành phẩm thành công!");
            }
            // Tải lại chi tiết đơn và danh sách dashboard
            openOrderDetailModal(currentOpenOrderId);
            if (typeof loadDashboardOrders === "function") loadDashboardOrders();
        } else {
            throw new Error(json.message || "Tải ảnh thất bại");
        }
    } catch (e) {
        alert("Lỗi tải ảnh hoa: " + e.message);
    } finally {
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = originalHtml;
        }
        event.target.value = "";
    }
}

/**
 * Xử lý xác nhận thu tiền mặt (COD hoặc tại quầy POS)
 */
export async function handleConfirmCashPayment() {
    if (!currentOpenOrderId) return;

    if (!confirm("Xác nhận bạn đã thu đủ tiền mặt cho đơn hàng này?")) return;

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const cashBtn = document.getElementById("ordDetailConfirmCashBtn");
    const originalHtml = cashBtn ? cashBtn.innerHTML : "";
    if (cashBtn) {
        cashBtn.disabled = true;
        cashBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xác nhận...';
    }

    try {
        const res = await fetch(`${API_BASE}/admin/orders/${encodeURIComponent(currentOpenOrderId)}/payment`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                paymentStatus: "paid",
                note: "Nhân viên xác nhận đã thu đủ tiền mặt"
            })
        });
        const json = await res.json();

        if (res.ok && json.success) {
            if (typeof showToast === "function") {
                showToast("Đã xác nhận thanh toán tiền mặt thành công!", "success");
            } else {
                alert("Đã xác nhận thanh toán tiền mặt thành công!");
            }
            openOrderDetailModal(currentOpenOrderId);
            if (typeof loadDashboardOrders === "function") loadDashboardOrders();
        } else {
            throw new Error(json.message || "Không thể xác nhận thanh toán");
        }
    } catch (e) {
        alert("Lỗi: " + e.message);
    } finally {
        if (cashBtn) {
            cashBtn.disabled = false;
            cashBtn.innerHTML = originalHtml;
        }
    }
}

/**
 * Xử lý chuyển trạng thái nhanh từ select dropdown
 */
export async function handleOrderQuickStatusChange(newStatus) {
    if (!newStatus || !currentOpenOrderId) return;

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const selectEl = document.getElementById("ordDetailNextStatusSelect");
    if (selectEl) selectEl.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/admin/orders/${encodeURIComponent(currentOpenOrderId)}/status`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: newStatus })
        });
        const json = await res.json();

        if (res.ok && json.success) {
            if (typeof showToast === "function") {
                showToast(`Đã chuyển trạng thái đơn hàng sang [${newStatus}]!`, "success");
            }
            openOrderDetailModal(currentOpenOrderId);
            if (typeof loadDashboardOrders === "function") loadDashboardOrders();
        } else {
            throw new Error(json.message || "Chuyển trạng thái thất bại");
        }
    } catch (e) {
        alert("Lỗi: " + e.message);
    } finally {
        if (selectEl) selectEl.disabled = false;
    }
}

/**
 * In thông tin đơn hàng
 */
export function printOrderDetail() {
    window.print();
}

// Global binding (bundle chạy trong IIFE, gán ra window để HTML inline onclick gọi được)
if (typeof window !== "undefined") {
    window.openOrderDashboardModal = openOrderDashboardModal;
    window.closeOrderDashboardModal = closeOrderDashboardModal;
    window.loadDashboardOrders = loadDashboardOrders;
    window.openOrderDetailModal = openOrderDetailModal;
    window.closeOrderDetailModal = closeOrderDetailModal;
    window.handleOrderPhotoUpload = handleOrderPhotoUpload;
    window.handleConfirmCashPayment = handleConfirmCashPayment;
    window.handleOrderQuickStatusChange = handleOrderQuickStatusChange;
    window.onDashboardMonthChange = onDashboardMonthChange;
    window.onDashboardSortChange = onDashboardSortChange;
    window.onDashboardFilterChange = onDashboardFilterChange;
    window.renderOrderProgressStepper = renderOrderProgressStepper;
    window.printOrderDetail = printOrderDetail;
}
