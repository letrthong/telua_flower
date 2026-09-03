import { getCurrentUser, getAuthToken, openAuthModal } from './auth.js';
import { API_BASE, showToast } from './utils.js';

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
export function openStaffPortalModal() {
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

export function closeStaffPortalModal() {
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
        const orderIdSafe = (order.id || order.orderCode || "").replace(/'/g, "\\'");
        if (isFlorist) {
            if (order.status === "confirmed") {
                actionBtn = `<button onclick="event.stopPropagation(); updateStaffOrderStatus('${orderIdSafe}', 'arranging')" class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded-lg transition shadow-2xs">
                    <i class="fa-solid fa-scissors mr-1"></i> Bắt đầu cắm
                </button>`;
            } else if (order.status === "arranging") {
                actionBtn = `<button onclick="event.stopPropagation(); openOrderDetailModal('${orderIdSafe}')" class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded-lg transition shadow-2xs">
                    <i class="fa-solid fa-camera mr-1"></i> Tải ảnh hoa
                </button>`;
            } else if (order.status === "photo_sent") {
                const nextStep = order.delivery?.fulfillmentType === "pickup" ? "ready_for_pickup" : "shipping";
                const nextLabel = nextStep === "ready_for_pickup" ? "Chờ khách lấy" : "Chuyển giao hàng";
                actionBtn = `<button onclick="event.stopPropagation(); updateStaffOrderStatus('${orderIdSafe}', '${nextStep}')" class="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-bold rounded-lg transition shadow-2xs">
                    <i class="fa-solid fa-truck mr-1"></i> ${nextLabel}
                </button>`;
            }
        } else {
            // Sales consultant / Branch manager
            if (order.status === "pending") {
                actionBtn = `<button onclick="event.stopPropagation(); updateStaffOrderStatus('${orderIdSafe}', 'confirmed')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition shadow-2xs">
                    <i class="fa-solid fa-check mr-1"></i> Xác nhận đơn
                </button>`;
            } else if (order.payment?.status !== "paid" && order.payment?.method === "cash") {
                actionBtn = `<button onclick="event.stopPropagation(); openOrderDetailModal('${orderIdSafe}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition shadow-2xs">
                    <i class="fa-solid fa-money-bill-wave mr-1"></i> Thu tiền mặt
                </button>`;
            }
        }

        return `
            <div onclick="openOrderDetailModal('${orderIdSafe}')" class="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden cursor-pointer hover:border-emerald-400 hover:shadow-md transition group">
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
export async function updateStaffOrderStatus(orderId, newStatus) {
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
