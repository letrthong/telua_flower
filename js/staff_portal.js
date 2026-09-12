import { getCurrentUser, getAuthToken, openAuthModal } from './auth.js';
import { API_BASE, showToast } from './utils.js';

/**
 * Phân hệ Cổng Nhân Viên Chi Nhánh (Staff Portal - Sales & Florist)
 * - sales_consultant: Tiếp nhận & xem đơn hàng của chi nhánh.
 * - florist: Xem đơn cần cắm & cập nhật trạng thái cắm hoa.
 * Dữ liệu lấy từ API: GET /api/branch/<branch_id>/orders (phân quyền chi nhánh).
 */

const STAFF_ORDER_STATUS_META = {
    pending: { label: "Chờ xác nhận", color: "bg-amber-100 text-amber-700 border-amber-200", icon: "fa-clock" },
    confirmed: { label: "Đã xác nhận", color: "bg-blue-100 text-blue-700 border-blue-200", icon: "fa-check" },
    arranging: { label: "Đang cắm hoa", color: "bg-purple-100 text-purple-700 border-purple-200", icon: "fa-scissors" },
    shipping: { label: "Đang vận chuyển", color: "bg-cyan-100 text-cyan-700 border-cyan-200", icon: "fa-truck" },
    delivered: { label: "Giao thành công", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    ready_for_pickup: { label: "Sẵn sàng nhận", color: "bg-teal-100 text-teal-700 border-teal-200", icon: "fa-store" },
    completed: { label: "Hoàn thành", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    cancelled: { label: "Đã hủy", color: "bg-red-100 text-red-700 border-red-200", icon: "fa-ban" },
    returned: { label: "Trả hàng", color: "bg-orange-100 text-orange-700 border-orange-200", icon: "fa-rotate-left" }
};

const STAFF_PAYMENT_STATUS_META = {
    unpaid: { label: "Chưa thanh toán", color: "bg-gray-100 text-gray-600 border-gray-200", icon: "fa-credit-card" },
    paid: { label: "Đã thanh toán", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    refunded: { label: "Đã hoàn tiền", color: "bg-blue-100 text-blue-700 border-blue-200", icon: "fa-rotate-left" },
    failed: { label: "Thanh toán lỗi", color: "bg-red-100 text-red-700 border-red-200", icon: "fa-circle-xmark" }
};

export const STAFF_KNOWN_BRANCHES = [
    {
        id: "branch_q10",
        name: "Showroom Quận 10 Flagship (183/37 Đường 3/2, Q.10)",
        shortName: "Showroom Q10 (Flagship)"
    },
    {
        id: "branch_q1",
        name: "Showroom Bến Nghé Quận 1 (Số 2 Hải Triều, Q.1)",
        shortName: "Showroom Bến Nghé Q1"
    },
    {
        id: "branch_thao_dien",
        name: "Showroom Thảo Điền (68 Xuân Thủy, TP. Thủ Đức)",
        shortName: "Showroom Thảo Điền"
    }
];

export const STAFF_BRANCH_DISPLAY_MAP = {
    branch_q10: "Showroom Q10 Flagship (183/37 Đ. 3/2)",
    branch_q1: "Showroom Bến Nghé Q1 (Số 2 Hải Triều)",
    branch_thao_dien: "Showroom Thảo Điền (68 Xuân Thủy)",
    admin: "Trung Tâm Admin (Chờ điều phối)"
};

function getStaffBranches() {
    if (typeof window !== "undefined" && Array.isArray(window.allAdminBranches) && window.allAdminBranches.length > 0) {
        return window.allAdminBranches;
    }
    return STAFF_KNOWN_BRANCHES;
}

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

    if (!user || !["sales_consultant", "florist", "branch_manager", "super_admin"].includes(user.role)) {
        alert("Vui lòng đăng nhập bằng tài khoản Nhân sự nội bộ để truy cập Bàn làm việc ca trực!");
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
        if (user.role === "florist") {
            titleEl.textContent = "Công Việc Của Tôi (Thợ Cắm Hoa)";
        } else if (user.role === "sales_consultant") {
            titleEl.textContent = "Công Việc Của Tôi (Tư Vấn Bán Hàng)";
        } else if (user.role === "branch_manager") {
            titleEl.textContent = "Bàn Làm Việc Ca Trực (Quản Lý Chi Nhánh)";
        } else {
            titleEl.textContent = "Bàn Làm Việc Ca Trực (Điều Phối Đơn Hàng)";
        }
    }
    if (subtitleEl) {
        const storeBadge = user.branchName ? ` • 📍 ${user.branchName}` : (user.branchId ? ` • 📍 Showroom (${user.branchId})` : "");
        if (user.role === "florist") {
            subtitleEl.textContent = `Danh sách đơn hoa cần cắm trong ca trực${storeBadge}`;
        } else if (user.role === "sales_consultant") {
            subtitleEl.textContent = `Danh sách đơn mới & tiếp nhận xử lý ca trực${storeBadge}`;
        } else if (user.role === "branch_manager") {
            subtitleEl.textContent = `Theo dõi đơn hàng và tiến độ thực hiện ca trực chi nhánh${storeBadge}`;
        } else {
            subtitleEl.textContent = `Đơn hàng cần xử lý và điều phối về các Showroom chi nhánh`;
        }
    }

    // Badge chỉ dẫn cho Super Admin
    const isSuperAdmin = user.role === "super_admin";
    const dispatchBadge = document.getElementById("staffAdminDispatchBadge");
    if (dispatchBadge) {
        dispatchBadge.classList.toggle("hidden", !isSuperAdmin);
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    loadStaffOrders();
}

/**
 * Nạp danh sách chi nhánh (duy trì tương thích)
 */
export async function populateStaffBranchFilter() {}

export function closeStaffPortalModal() {
    const modal = document.getElementById("staffPortalModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

/**
 * Tải danh sách đơn hàng của chi nhánh (phân quyền tự động theo role & user.branchId)
 * Super Admin: Chỉ nhận danh sách đơn hàng cần điều phối bởi Admin ('admin')
 */
async function loadStaffOrders() {
    const user = (typeof getCurrentUser === "function") ? getCurrentUser() : null;
    const listEl = document.getElementById("staffOrdersList");
    const emptyEl = document.getElementById("staffOrdersEmpty");
    if (!listEl || !user) return;

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
        // Gọi endpoint Task API chuyên trách (/staff/my-tasks)
        // Backend tự động phân quyền: Super Admin chỉ nhận đơn cần điều phối bởi admin ('admin')
        let url = `${API_BASE}/staff/my-tasks?mode=auto`;
        if (status && status !== "all") {
            url += `&status=${encodeURIComponent(status)}`;
        }
        if (search) {
            url += `&search=${encodeURIComponent(search)}`;
        }

        const res = await fetch(url, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
            throw new Error(json.message || "Không tải được danh sách đơn hàng ca trực");
        }

        const orders = (json.data && Array.isArray(json.data.orders))
            ? json.data.orders
            : (Array.isArray(json.data) ? json.data : []);

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
    const isSuperAdmin = role === "super_admin";
    const branches = getStaffBranches();

    listEl.innerHTML = orders.map(order => {
        const statusMeta = staffGetStatusMeta(order.status, STAFF_ORDER_STATUS_META);
        const payMeta = staffGetStatusMeta(order.payment?.status, STAFF_PAYMENT_STATUS_META);
        const total = Number(order.totalAmount) || Number(order.financials?.totalAmount) || 0;
        const items = Array.isArray(order.items) ? order.items : [];
        const itemSummary = items.slice(0, 2).map(it => `${it.productName || it.name || "Sản phẩm"} x${it.quantity || 1}`).join(", ")
            + (items.length > 2 ? ` +${items.length - 2} món khác` : "");

        const branchId = order.branchId || order.assignedBranchId || "admin";
        const branchName = STAFF_BRANCH_DISPLAY_MAP[branchId] || order.branchName || (branchId === "admin" ? "Trung Tâm Admin (Chờ điều phối)" : branchId);
        const isAssignedToAdmin = (branchId === "admin");

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
        } else if (isSuperAdmin) {
            // Super Admin: có dropdown điều phối / gán Showroom trực tiếp + nút xác nhận
            const branchOptions = branches.filter(b => b.isActive !== false).map(b => {
                const label = STAFF_BRANCH_DISPLAY_MAP[b.id] || b.name || b.id;
                return `<option value="${b.id}" ${b.id === branchId ? 'selected' : ''}>📍 ${label}</option>`;
            }).join("");

            actionBtn = `
                <div class="flex flex-col gap-1.5 items-end">
                    <select onclick="event.stopPropagation()" onchange="dispatchStaffOrder('${orderIdSafe}', this.value)" class="px-2.5 py-1 bg-pink-50 border border-pink-300 text-primary font-bold rounded-lg text-[10px] focus:outline-none focus:border-primary shadow-2xs">
                        <option value="">⚡ Gán Showroom...</option>
                        <option value="admin" ${branchId === 'admin' ? 'selected' : ''}>🏢 Trung Tâm Admin (Chờ điều phối)</option>
                        ${branchOptions}
                    </select>
                    ${order.status === "pending" ? `
                        <button onclick="event.stopPropagation(); updateStaffOrderStatus('${orderIdSafe}', 'confirmed')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition shadow-2xs">
                            <i class="fa-solid fa-check mr-1"></i> Duyệt đơn
                        </button>
                    ` : ''}
                </div>
            `;
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
                        ${isSuperAdmin ? `
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${isAssignedToAdmin ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}">
                                <i class="fa-solid ${isAssignedToAdmin ? 'fa-bolt' : 'fa-store'} text-xs"></i> ${branchName}
                            </span>
                        ` : ''}
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
 * Điều phối đơn hàng từ Bàn Làm Việc Ca Trực (Super Admin)
 */
export async function dispatchStaffOrder(orderId, targetBranchId) {
    if (!orderId || !targetBranchId) return;
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    try {
        const res = await fetch(`${API_BASE}/admin/orders/${orderId}/dispatch`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ targetBranchId: targetBranchId })
        });
        const json = await res.json();

        if (json.success) {
            if (typeof showToast === "function") showToast(json.message || "Đã điều phối đơn hàng thành công!", 'success');
            else alert("Đã điều phối đơn hàng thành công!");
            loadStaffOrders();
        } else {
            if (typeof showToast === "function") showToast(json.message || "Lỗi điều phối đơn hàng", 'error');
            else alert(json.message || "Lỗi điều phối đơn hàng");
            loadStaffOrders();
        }
    } catch (e) {
        if (typeof showToast === "function") showToast("Lỗi kết nối điều phối: " + e.message, 'error');
        else alert("Lỗi kết nối điều phối: " + e.message);
    }
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

export async function claimStaffTask(orderId) {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE}/staff/tasks/${orderId}/claim`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        const json = await res.json();
        if (json.success) {
            if (typeof showToast === "function") showToast("Bạn đã nhận nhiệm vụ thành công!", 'success');
            loadStaffOrders();
        } else {
            if (typeof showToast === "function") showToast(json.message || "Lỗi nhận việc", 'error');
        }
    } catch (e) {
        if (typeof showToast === "function") showToast("Lỗi kết nối: " + e.message, 'error');
    }
}

// Global binding
if (typeof window !== "undefined") {
    window.openStaffPortalModal = openStaffPortalModal;
    window.closeStaffPortalModal = closeStaffPortalModal;
    window.loadStaffOrders = loadStaffOrders;
    window.updateStaffOrderStatus = updateStaffOrderStatus;
    window.dispatchStaffOrder = dispatchStaffOrder;
    window.populateStaffBranchFilter = populateStaffBranchFilter;
    window.claimStaffTask = claimStaffTask;
}
