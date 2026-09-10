import { getCurrentUser, getAuthToken } from './auth.js';
import { API_BASE, showConfirmDialog } from './utils.js';
import { lockScreen, unlockScreen, notifyUser, allAdminUsers, allAdminBranches } from './portal_admin_state.js';
import { BRANCH_NAME_MAP, populateBranchDropdowns } from './portal_admin_branches.js';

// ==========================================
// 1. QUẢN LÝ NHÂN SỰ NỘI BỘ (STAFF & RBAC)
// ==========================================

import { ROLE_DISPLAY_MAP } from './roles_const.js';
export { ROLE_DISPLAY_MAP };

export async function loadAdminUsers() {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    // Đảm bảo dữ liệu chi nhánh đã được tải từ backend và đồng bộ vào dropdowns
    if (!allAdminBranches || allAdminBranches.length === 0) {
        try {
            const bRes = await fetch(`${API_BASE}/admin/branches`, { headers: { "Authorization": `Bearer ${token}` } });
            const bJson = await bRes.json();
            if (bJson.success && Array.isArray(bJson.data)) {
                allAdminBranches = bJson.data;
                if (typeof window !== "undefined") window.allAdminBranches = allAdminBranches;
                populateBranchDropdowns(allAdminBranches);
            }
        } catch (err) {
            console.warn("Không thể tải danh sách chi nhánh:", err);
        }
    }

    const filterSelect = document.getElementById("filterUserBranch");
    const branch = filterSelect ? filterSelect.value : "all";
    const tbody = document.getElementById("usersTableBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-400">Đang tải danh sách nhân sự nội bộ...</td></tr>`;

    try {
        let url = `${API_BASE}/admin/users`;
        if (branch && branch !== "all") url += `?branchId=${branch}`;
        const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
        const json = await res.json();

        if (json.success && Array.isArray(json.data)) {
            // Lọc chỉ lấy nhân viên nội bộ (loại bỏ khách hàng role='customer')
            allAdminUsers = json.data.filter((u) => u.role !== "customer");
            if (typeof window !== "undefined") window.allAdminUsers = allAdminUsers;
            renderUsersTable(allAdminUsers);
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold">${json.message || "Lỗi tải nhân sự"}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
    }
}

export function renderUsersTable(users) {
    const tbody = document.getElementById("usersTableBody");
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400 font-medium">Chưa có nhân sự nội bộ nào trong danh sách.</td></tr>`;
        return;
    }

    const currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : {};

    let html = "";
    users.forEach((u) => {
        const roleInfo = ROLE_DISPLAY_MAP[u.role] || { label: u.role, badge: "bg-gray-100 text-gray-800" };
        const branchName = BRANCH_NAME_MAP[u.branchId] || (u.branchId ? u.branchId : "—");
        const activeBadge = u.isActive !== false
            ? `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">🟢 Đang Hoạt Động</span>`
            : `<span class="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">⚪ Đã Tạm Khóa</span>`;

        const isSelf = u.id === currentUser.userId || u.id === currentUser.id;

        html += `
            <tr class="hover:bg-gray-50/80 transition">
                <td class="p-3">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-full bg-pink-100 text-primary border border-pink-200 flex items-center justify-center font-bold text-xs">
                            ${(u.fullName || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <span class="font-bold text-gray-800 block">${u.fullName}</span>
                            <span class="text-[10px] text-gray-400 font-mono">${u.id}</span>
                        </div>
                    </div>
                </td>
                <td class="p-3">
                    <div class="font-medium text-gray-800">${u.phone || "—"}</div>
                    <div class="text-[11px] text-gray-500">${u.email || "—"}</div>
                </td>
                <td class="p-3">
                    <span class="text-[11px] font-bold px-2.5 py-1 rounded-lg ${roleInfo.badge}">${roleInfo.label}</span>
                </td>
                <td class="p-3 font-semibold text-gray-700">
                    <i class="fa-solid fa-location-dot text-primary mr-1 text-xs"></i> ${branchName}
                </td>
                <td class="p-3">${activeBadge}</td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center space-x-2">
                        <button onclick="editUser('${u.id}')" title="Chỉnh sửa thông tin & Mật khẩu" class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition">
                            <i class="fa-solid fa-pen-to-square"></i> Sửa
                        </button>
                        ${!isSelf ? `
                            <button onclick="deleteUser('${u.id}', '${u.fullName}')" title="Xóa nhân sự" class="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ==========================================
// 2. QUẢN LÝ KHÁCH HÀNG & CRM (CUSTOMERS)
// ==========================================

export let allAdminCustomers = [];

export const TIER_DISPLAY_MAP = {
    vip: { label: "👑 VIP Kim Cương", badge: "bg-purple-100 text-purple-800 border border-purple-200" },
    diamond: { label: "💎 Kim Cương", badge: "bg-cyan-100 text-cyan-800 border border-cyan-200" },
    gold: { label: "🥇 Vàng (Gold)", badge: "bg-amber-100 text-amber-800 border border-amber-200" },
    silver: { label: "🥈 Bạc (Silver)", badge: "bg-slate-100 text-slate-800 border border-slate-200" },
    standard: { label: "🥉 Tiêu Chuẩn", badge: "bg-gray-100 text-gray-700 border border-gray-200" }
};

export async function loadAdminCustomers() {
    const searchInput = document.getElementById("searchCustomerInput");
    const tierSelect = document.getElementById("filterCustomerTier");
    const search = searchInput ? searchInput.value.trim() : "";
    const tier = tierSelect ? tierSelect.value : "all";
    const tbody = document.getElementById("customersTableBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-400">Đang tải danh sách khách hàng CRM...</td></tr>`;
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    try {
        let url = `${API_BASE}/admin/customers?`;
        if (search) url += `search=${encodeURIComponent(search)}&`;
        if (tier && tier !== "all") url += `tier=${encodeURIComponent(tier)}&`;

        const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
        const json = await res.json();

        if (json.success && Array.isArray(json.data)) {
            allAdminCustomers = json.data;
            if (typeof window !== "undefined") window.allAdminCustomers = allAdminCustomers;
            renderCustomersTable(allAdminCustomers);
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold">${json.message || "Lỗi tải khách hàng"}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
    }
}

export function renderCustomersTable(customers) {
    const tbody = document.getElementById("customersTableBody");
    if (!tbody) return;

    if (customers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="p-12 text-center">
                    <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                        <div class="w-16 h-16 rounded-full bg-amber-50 text-amber-400 flex items-center justify-center text-2xl mb-3 shadow-inner">
                            <i class="fa-solid fa-crown"></i>
                        </div>
                        <p class="font-bold text-gray-700 text-sm">Không tìm thấy khách hàng nào</p>
                        <p class="text-xs text-gray-400 mt-1">Dữ liệu khách hàng thân thiết CRM sẽ tự động hiển thị tại đây.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = "";
    customers.forEach((c) => {
        const tierKey = (c.tier || "standard").toLowerCase();
        const tierInfo = TIER_DISPLAY_MAP[tierKey] || TIER_DISPLAY_MAP.standard;
        const totalSpent = (c.totalSpent || 0).toLocaleString() + "₫";
        const points = (c.loyaltyPoints || 0).toLocaleString();
        const orderCount = c.orderCount || 0;
        const regDate = c.createdAt ? c.createdAt.split("T")[0] : "—";

        html += `
            <tr class="hover:bg-amber-50/20 transition">
                <td class="p-3">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center font-bold text-xs">
                            ${(c.fullName || "K").charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <span class="font-bold text-gray-800 block">${c.fullName}</span>
                            <span class="text-[10px] text-gray-400 font-mono">ID: ${c.id || "—"}</span>
                        </div>
                    </div>
                </td>
                <td class="p-3">
                    <div class="font-bold text-primary text-xs"><i class="fa-solid fa-phone mr-1"></i> ${c.phone || "—"}</div>
                    <div class="text-[11px] text-gray-500">${c.email || "—"}</div>
                </td>
                <td class="p-3">
                    <span class="text-[10px] font-bold px-2.5 py-1 rounded-lg ${tierInfo.badge}">${tierInfo.label}</span>
                </td>
                <td class="p-3">
                    <div class="font-extrabold text-amber-600 text-xs"><i class="fa-solid fa-star text-amber-400 mr-1"></i> ${points} điểm</div>
                </td>
                <td class="p-3">
                    <div class="font-bold text-gray-800 text-xs">${totalSpent}</div>
                    <div class="text-[10px] text-gray-500">${orderCount} đơn hàng</div>
                </td>
                <td class="p-3 text-[11px] text-gray-500">
                    ${regDate}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

export function openUserModal(isEdit = false) {
    const modal = document.getElementById("userModal");
    const title = document.getElementById("userModalTitle");
    const form = document.getElementById("userForm");
    const errBox = document.getElementById("userModalError");
    const pwdHint = document.getElementById("staffPwdHint");
    const user = typeof getCurrentUser === "function" ? getCurrentUser() : {};

    if (!modal) return;
    if (errBox) errBox.classList.add("hidden");

    // Luôn đảm bảo dropdown chọn chi nhánh được cập nhật các chi nhánh mới nhất
    if (allAdminBranches && allAdminBranches.length > 0) {
        populateBranchDropdowns(allAdminBranches);
    }

    if (!isEdit && form) {
        form.reset();
        document.getElementById("editUserId").value = "";
        if (title) title.textContent = "Thêm Nhân Sự Mới Vào Hệ Thống";
        if (pwdHint) pwdHint.textContent = "(ít nhất 6 ký tự)";
        document.getElementById("staffPassword").required = true;

        if (user.role === "branch_manager") {
            document.getElementById("staffBranch").value = user.branchId;
            document.getElementById("staffBranch").disabled = true;
        } else {
            document.getElementById("staffBranch").disabled = false;
        }
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

export function closeUserModal() {
    const modal = document.getElementById("userModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export function editUser(userId) {
    const u = (allAdminUsers || []).find((user) => user.id === userId);
    if (!u) return;

    document.getElementById("editUserId").value = u.id;
    document.getElementById("staffFullName").value = u.fullName || "";
    document.getElementById("staffPhone").value = u.phone || "";
    document.getElementById("staffEmail").value = u.email || "";
    document.getElementById("staffRole").value = u.role || "florist";
    document.getElementById("staffBranch").value = u.branchId || "branch_q10";
    document.getElementById("staffPassword").value = "";
    document.getElementById("staffPassword").required = false;
    document.getElementById("staffIsActive").checked = u.isActive !== false;

    const pwdHint = document.getElementById("staffPwdHint");
    if (pwdHint) pwdHint.textContent = "(để trống nếu giữ nguyên mật khẩu cũ)";

    const title = document.getElementById("userModalTitle");
    if (title) title.textContent = `Chỉnh Sửa Nhân Sự: ${u.fullName}`;

    openUserModal(true);
}

export async function handleUserSubmit(event) {
    if (event) event.preventDefault();

    const editId = document.getElementById("editUserId").value;
    const isEdit = !!editId;
    const fullName = document.getElementById("staffFullName").value.trim();
    const phone = document.getElementById("staffPhone").value.trim();
    const email = document.getElementById("staffEmail").value.trim();
    const role = document.getElementById("staffRole").value;
    const branchSelect = document.getElementById("staffBranch");
    const branchId = branchSelect.value;
    const password = document.getElementById("staffPassword").value;
    const isActiveInput = document.getElementById("staffIsActive");
    const isActive = isActiveInput ? isActiveInput.checked : true;
    const errBox = document.getElementById("userModalError");

    if (!isEdit && !password) {
        if (errBox) {
            errBox.textContent = "❌ Vui lòng nhập mật khẩu cho tài khoản nhân sự mới (tối thiểu 6 ký tự)";
            errBox.classList.remove("hidden");
        }
        notifyUser("Vui lòng nhập mật khẩu cho nhân sự mới!", 'error');
        document.getElementById("staffPassword")?.focus();
        return;
    }

    if (password && password.length < 6) {
        if (errBox) {
            errBox.textContent = "❌ Mật khẩu phải có độ dài tối thiểu 6 ký tự";
            errBox.classList.remove("hidden");
        }
        notifyUser("Mật khẩu phải có tối thiểu 6 ký tự!", 'error');
        document.getElementById("staffPassword")?.focus();
        return;
    }

    const payload = { fullName, phone, email, role, branchId, isActive };
    if (password) payload.password = password;

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const url = isEdit ? `${API_BASE}/admin/users/${editId}` : `${API_BASE}/admin/users`;
    const method = isEdit ? "PUT" : "POST";

    lockScreen(isEdit ? `Đang cập nhật nhân sự "${fullName}"...` : `Đang tạo tài khoản nhân sự "${fullName}"...`);
    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (res.ok && json.success) {
            closeUserModal();
            await loadAdminUsers();
            notifyUser(isEdit ? "Cập nhật nhân sự thành công!" : "🎉 Thêm nhân sự mới thành công!", 'success');
        } else {
            if (errBox) {
                errBox.textContent = json.message || "Lỗi lưu thông tin nhân sự";
                errBox.classList.remove("hidden");
            }
            notifyUser(json.message || "Lỗi lưu thông tin nhân sự", 'error');
        }
    } catch (e) {
        if (errBox) {
            errBox.textContent = "Lỗi kết nối: " + e.message;
            errBox.classList.remove("hidden");
        }
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

export async function deleteUser(userId, fullName) {
    const isConfirmed = await (typeof showConfirmDialog === 'function' ? showConfirmDialog : window.showConfirmDialog)({
        title: "Xác nhận Xóa Nhân Sự",
        message: `Bạn có chắc chắn muốn xóa tài khoản nhân sự "${fullName}" khỏi hệ thống không?`,
        detail: "Tài khoản này sẽ bị vô hiệu hóa quyền truy cập vào Cổng Quản Trị.",
        confirmText: "Xóa tài khoản",
        cancelText: "Hủy bỏ",
        type: "danger",
        icon: "fa-solid fa-user-xmark"
    });
    if (!isConfirmed) return;

    lockScreen(`Đang xóa tài khoản nhân sự "${fullName}"...`);
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const json = await res.json();
        if (res.ok && json.success) {
            await loadAdminUsers();
            notifyUser("Đã xóa tài khoản nhân sự thành công!", 'success');
        } else {
            notifyUser("Lỗi: " + (json.message || "Không thể xóa nhân sự"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

if (typeof window !== "undefined") {
    window.ROLE_DISPLAY_MAP = ROLE_DISPLAY_MAP;
    window.loadAdminUsers = loadAdminUsers;
    window.loadAdminStaff = loadAdminUsers;
    window.renderUsersTable = renderUsersTable;
    window.allAdminCustomers = allAdminCustomers;
    window.loadAdminCustomers = loadAdminCustomers;
    window.renderCustomersTable = renderCustomersTable;
    window.openUserModal = openUserModal;
    window.closeUserModal = closeUserModal;
    window.editUser = editUser;
    window.handleUserSubmit = handleUserSubmit;
    window.deleteUser = deleteUser;
}
