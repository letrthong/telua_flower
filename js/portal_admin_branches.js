import { getCurrentUser, getAuthToken } from './auth.js';
import { API_BASE } from './utils.js';
import { lockScreen, unlockScreen, notifyUser, allAdminBranches, allAdminUsers } from './portal_admin_state.js';

// ==========================================
// QUẢN LÝ CHUỖI CỬA HÀNG (BRANCHES MANAGEMENT)
// ==========================================

export const BRANCH_NAME_MAP = {
    branch_q10: "Showroom Q10",
    branch_q1: "Showroom Bến Nghé Q1",
    branch_thao_dien: "Showroom Thảo Điền",
    all: "Toàn bộ hệ thống (HQ)"
};

export function populateBranchDropdowns(branches) {
    if (!Array.isArray(branches)) return;

    // 1. Cập nhật dynamic map tên chi nhánh cho bảng nhân sự
    branches.forEach((b) => {
        if (b.id) {
            BRANCH_NAME_MAP[b.id] = b.name || b.code || b.id;
        }
    });

    // 2. Dropdown lọc chi nhánh ở Tab Nhân Sự (filterUserBranch)
    const filterSelect = document.getElementById("filterUserBranch");
    if (filterSelect) {
        const currentVal = filterSelect.value || "all";
        let opts = `<option value="all">Tất cả chi nhánh</option>`;
        branches.filter((b) => b.isActive !== false).forEach((b) => {
            opts += `<option value="${b.id}">${b.name}</option>`;
        });
        filterSelect.innerHTML = opts;
        if (currentVal) filterSelect.value = currentVal;
    }

    // 3. Dropdown chọn chi nhánh trong Modal Thêm/Sửa Nhân Sự (staffBranch)
    const staffBranchSelect = document.getElementById("staffBranch");
    if (staffBranchSelect) {
        const currentVal = staffBranchSelect.value;
        let opts = "";
        branches.filter((b) => b.isActive !== false).forEach((b) => {
            opts += `<option value="${b.id}">${b.name} (${b.code || b.id})</option>`;
        });
        opts += `<option value="all" id="optBranchAll">Toàn bộ hệ thống (HQ - Toàn quyền)</option>`;
        staffBranchSelect.innerHTML = opts;
        if (currentVal) staffBranchSelect.value = currentVal;
    }
}

export async function loadAdminBranches() {
    const tbody = document.getElementById("branchesTableBody");
    if (tbody && (!allAdminBranches || allAdminBranches.length === 0)) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-400 font-medium"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải danh sách chuỗi cửa hàng...</td></tr>`;
    }
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    try {
        const res = await fetch(`${API_BASE}/admin/branches`, { headers: { "Authorization": `Bearer ${token}` } });
        const json = await res.json();

        if (json.success && Array.isArray(json.data)) {
            allAdminBranches = json.data;
            if (typeof window !== "undefined") window.allAdminBranches = allAdminBranches;
            if (tbody) renderBranchesTable(allAdminBranches);
            populateBranchDropdowns(allAdminBranches);
            if (allAdminUsers && allAdminUsers.length > 0 && typeof window.renderUsersTable === "function") {
                window.renderUsersTable(allAdminUsers);
            }
        } else if (tbody && (!allAdminBranches || allAdminBranches.length === 0)) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold">${json.message || "Lỗi tải chi nhánh"}</td></tr>`;
        }
    } catch (e) {
        if (tbody && (!allAdminBranches || allAdminBranches.length === 0)) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
        }
    }
}

function renderBranchesTable(branches) {
    const tbody = document.getElementById("branchesTableBody");
    if (!tbody) return;

    if (branches.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-12 text-center">
                    <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                        <div class="w-16 h-16 rounded-full bg-emerald-50 text-emerald-400 flex items-center justify-center text-2xl mb-3 shadow-inner">
                            <i class="fa-solid fa-store"></i>
                        </div>
                        <p class="font-bold text-gray-700 text-sm">Chưa có chi nhánh showroom nào</p>
                        <p class="text-xs text-gray-400 mt-1">Bấm nút "Mở Thêm Chi Nhánh Mới" để mở rộng mạng lưới showroom.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : {};
    const isSuperAdmin = currentUser.role === "super_admin";

    let html = "";
    branches.forEach((b) => {
        const activeBadge = b.isActive !== false
            ? `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">🟢 Hoạt Động</span>`
            : `<span class="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">⚪ Tạm Đóng Cửa</span>`;

        html += `
            <tr class="hover:bg-gray-50/80 transition">
                <td class="p-3">
                    <span class="font-bold text-xs bg-pink-50 text-primary border border-pink-200 px-2 py-1 rounded-md">${b.code || b.id}</span>
                </td>
                <td class="p-3">
                    <span class="font-bold text-gray-800 text-sm block">${b.name}</span>
                    <span class="text-[11px] text-gray-500">${b.openHours || "07:30 - 21:00"}</span>
                </td>
                <td class="p-3">
                    <div class="font-medium text-gray-700 text-xs">${b.address}</div>
                    <div class="text-[11px] text-primary font-bold"><i class="fa-solid fa-phone mr-1"></i> ${b.phone || "—"}</div>
                </td>
                <td class="p-3 font-mono text-[11px] text-gray-600">
                    ${b.lat}, ${b.lng}
                </td>
                <td class="p-3 font-bold text-accent text-xs">
                    ${b.deliveryRadiusKm || 10} km
                </td>
                <td class="p-3">${activeBadge}</td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center space-x-2">
                        ${isSuperAdmin ? `
                            <button onclick="editBranch('${b.id}')" class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-pen-to-square"></i> Sửa
                            </button>
                            <button onclick="toggleBranch('${b.id}')" class="px-2.5 py-1 ${b.isActive !== false ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'} rounded-lg text-xs font-bold transition">
                                ${b.isActive !== false ? '⚪ Đóng' : '🟢 Mở'}
                            </button>
                        ` : `
                            <span class="text-xs text-gray-400 font-semibold">Chỉ xem</span>
                        `}
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

export function openBranchModal(isEdit = false) {
    const modal = document.getElementById("branchModal");
    const title = document.getElementById("branchModalTitle");
    const form = document.getElementById("branchForm");
    const errBox = document.getElementById("branchModalError");

    if (!modal) return;
    if (errBox) errBox.classList.add("hidden");

    if (!isEdit && form) {
        form.reset();
        document.getElementById("editBranchId").value = "";
        document.getElementById("branchRadius").value = 10;
        document.getElementById("branchOpenHours").value = "07:30 - 21:00";
        document.getElementById("branchLat").value = 10.7769;
        document.getElementById("branchLng").value = 106.7009;
        if (title) title.textContent = "Mở Thêm Chi Nhánh Showroom Mới";
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

export function closeBranchModal() {
    const modal = document.getElementById("branchModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export function editBranch(branchId) {
    const b = (allAdminBranches || []).find((branch) => branch.id === branchId);
    if (!b) return;

    document.getElementById("editBranchId").value = b.id;
    document.getElementById("branchName").value = b.name || "";
    document.getElementById("branchCode").value = b.code || "";
    document.getElementById("branchAddress").value = b.address || "";
    document.getElementById("branchPhone").value = b.phone || "";
    document.getElementById("branchOpenHours").value = b.openHours || "07:30 - 21:00";
    document.getElementById("branchLat").value = b.lat || 10.7769;
    document.getElementById("branchLng").value = b.lng || 106.7009;
    document.getElementById("branchRadius").value = b.deliveryRadiusKm || 10;
    document.getElementById("branchAmenities").value = b.amenities || "";
    document.getElementById("branchIsActive").checked = b.isActive !== false;

    const title = document.getElementById("branchModalTitle");
    if (title) title.textContent = `Chỉnh Sửa Chi Nhánh: ${b.name}`;

    openBranchModal(true);
}

export async function handleBranchSubmit(event) {
    if (event) event.preventDefault();

    const editId = document.getElementById("editBranchId").value;
    const name = document.getElementById("branchName").value.trim();
    const code = document.getElementById("branchCode").value.trim().toUpperCase();
    const address = document.getElementById("branchAddress").value.trim();
    const phone = document.getElementById("branchPhone").value.trim();
    const openHours = document.getElementById("branchOpenHours").value.trim();
    const lat = parseFloat(document.getElementById("branchLat").value);
    const lng = parseFloat(document.getElementById("branchLng").value);
    const deliveryRadiusKm = parseInt(document.getElementById("branchRadius").value, 10) || 10;
    const amenities = document.getElementById("branchAmenities").value.trim();
    const isActive = document.getElementById("branchIsActive").checked;

    const payload = { name, code, address, phone, openHours, lat, lng, deliveryRadiusKm, amenities, isActive };

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const isEdit = !!editId;
    const url = isEdit ? `${API_BASE}/admin/branches/${editId}` : `${API_BASE}/admin/branches`;
    const method = isEdit ? "PUT" : "POST";
    const errBox = document.getElementById("branchModalError");

    lockScreen(isEdit ? `Đang lưu chi nhánh "${name}"...` : `Đang mở thêm chi nhánh "${name}"...`);
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
            closeBranchModal();
            await loadAdminBranches();
            if (typeof window !== "undefined" && typeof window.reloadBranchesIfChanged === "function") {
                window.reloadBranchesIfChanged(true).catch(() => {});
            }
            notifyUser(isEdit ? `Cập nhật chi nhánh "${name}" thành công!` : `Mở chi nhánh mới "${name}" thành công!`, 'success');
        } else {
            const msg = json.message || "Lỗi lưu thông tin chi nhánh";
            if (errBox) {
                errBox.textContent = "❌ " + msg;
                errBox.classList.remove("hidden");
            }
            notifyUser(`Lỗi lưu chi nhánh: ${msg}`, 'error');
        }
    } catch (e) {
        if (errBox) {
            errBox.textContent = "❌ Lỗi kết nối: " + e.message;
            errBox.classList.remove("hidden");
        }
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

export async function toggleBranch(branchId) {
    lockScreen("Đang cập nhật trạng thái chi nhánh...");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/branches/${branchId}/toggle`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const json = await res.json();
        if (res.ok && json.success) {
            await loadAdminBranches();
            if (typeof window !== "undefined" && typeof window.reloadBranchesIfChanged === "function") {
                window.reloadBranchesIfChanged(true).catch(() => {});
            }
            notifyUser("Đã cập nhật trạng thái chi nhánh thành công!", 'success');
        } else {
            notifyUser("Lỗi: " + (json.message || "Không thể cập nhật trạng thái chi nhánh"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

if (typeof window !== "undefined") {
    window.BRANCH_NAME_MAP = BRANCH_NAME_MAP;
    window.populateBranchDropdowns = populateBranchDropdowns;
    window.loadAdminBranches = loadAdminBranches;
    window.openBranchModal = openBranchModal;
    window.closeBranchModal = closeBranchModal;
    window.editBranch = editBranch;
    window.handleBranchSubmit = handleBranchSubmit;
    window.toggleBranch = toggleBranch;
}
