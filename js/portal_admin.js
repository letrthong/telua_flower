import { getCurrentUser, getAuthToken, openAuthModal, logout } from './auth.js';
import { API_BASE, showToast, showConfirmDialog } from './utils.js';

function notifyUser(message, type = 'success', duration = 5000) {
    if (typeof showToast === 'function') {
        showToast(message, type, duration);
    } else if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        window.showToast(message, type, duration);
    } else {
        alert(message);
    }
}

/**
 * Phân hệ Quản Trị Hệ Thống (TASK 07 - Admin Portal, Product CMS & Price Governance)
 */

const PRICE_LEVEL_CONFIG = {
    price_lvl_01: { name: "LV_01: Phổ Thông (Standard)", min: 300000, max: 550000 },
    price_lvl_02: { name: "LV_02: Cao Cấp (Premium)", min: 600000, max: 950000 },
    price_lvl_03: { name: "LV_03: Sang Trọng (Luxury)", min: 1000000, max: 2500000 },
    price_lvl_04: { name: "LV_04: Độc Bản VIP (Exclusive)", min: 2600000, max: 15000000 }
};

let allAdminCategories = [];
let allAdminProducts = [];
let allAdminPromotions = [];
let allAdminTranslations = {};
let allAdminUsers = [];
let allAdminBranches = [];

document.addEventListener("DOMContentLoaded", () => {
    const path = (window.location.pathname || "").toLowerCase();
    const hash = (window.location.hash || "").toLowerCase();
    if (path.includes("/portal/admin") || path.includes("/portal/manager") || hash === "#admin") {
        const user = typeof getCurrentUser === "function" ? getCurrentUser() : null;
        if (user && (user.role === "super_admin" || user.role === "branch_manager")) {
            setTimeout(() => openAdminPortalModal(), 100);
        } else {
            if (typeof openAuthModal === "function") {
                setTimeout(() => openAuthModal("login"), 100);
            }
        }
    }
});

export function openAdminPortalModal() {
    const dropdown = document.getElementById("userDropdownMenu");
    if (dropdown) dropdown.classList.add("hidden");

    const user = (typeof getCurrentUser === "function") 
        ? getCurrentUser() 
        : ((typeof window !== "undefined" && typeof window.getCurrentUser === "function") ? window.getCurrentUser() : null);

    if (!user || (user.role !== "super_admin" && user.role !== "branch_manager")) {
        alert("Vui lòng đăng nhập bằng tài khoản Super Admin hoặc Quản Lý Chi Nhánh để truy cập Cổng Quản Trị!");
        if (typeof openAuthModal === "function") openAuthModal("login");
        else if (typeof window !== "undefined" && typeof window.openAuthModal === "function") window.openAuthModal("login");
        return;
    }

    const modal = document.getElementById("adminPortalModal");
    if (!modal) return;

    const nameEl = document.getElementById("adminUserName");
    const roleEl = document.getElementById("adminUserRole");
    if (nameEl) nameEl.textContent = user.fullName || user.phone || "Quản trị viên";
    if (roleEl) roleEl.textContent = user.role;

    // Phân quyền hiển thị Tab Chuỗi Cửa Hàng
    const branchTabBtn = document.getElementById("tabBtnBranches");
    const optSuperAdmin = document.getElementById("optRoleSuperAdmin");
    const optBranchManager = document.getElementById("optRoleBranchManager");
    const filterBranchSelect = document.getElementById("filterUserBranch");

    if (user.role === "branch_manager") {
        // Quản lý chi nhánh không thấy tab chuỗi cửa hàng
        if (branchTabBtn) branchTabBtn.classList.add("hidden");
        if (optSuperAdmin) optSuperAdmin.classList.add("hidden");
        if (optBranchManager) optBranchManager.classList.add("hidden");
        if (filterBranchSelect) {
            filterBranchSelect.value = user.branchId;
            filterBranchSelect.disabled = true;
        }
    } else {
        // Super Admin thấy toàn bộ
        if (branchTabBtn) branchTabBtn.classList.remove("hidden");
        if (optSuperAdmin) optSuperAdmin.classList.remove("hidden");
        if (optBranchManager) optBranchManager.classList.remove("hidden");
        if (filterBranchSelect) filterBranchSelect.disabled = false;
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    loadAdminCategories();
    loadAdminProducts();
    loadAdminBranches();
    onPriceLevelChange();
}

export function closeAdminPortalModal() {
    const modal = document.getElementById("adminPortalModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export function checkAdminAccess() {
    if (typeof getCurrentUser !== "function" || typeof getAuthToken !== "function") return;
    const user = getCurrentUser();
    const nameEl = document.getElementById("adminUserName");
    const roleEl = document.getElementById("adminUserRole");
    if (nameEl && user) nameEl.textContent = user.fullName || "Quản trị viên";
    if (roleEl && user) roleEl.textContent = user.role;
}

export function switchAdminTab(tabName) {
    // Chuẩn hóa tên tab (hỗ trợ alias 'users' -> 'staff')
    if (tabName === "users") tabName = "staff";

    const tabs = ["products", "categories", "staff", "customers", "branches", "promotions", "translations"];
    tabs.forEach((t) => {
        const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const content = document.getElementById(`tabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (btn && content) {
            if (t === tabName) {
                btn.className = "py-3 font-bold text-xs sm:text-sm border-b-2 border-primary text-primary transition flex items-center flex-shrink-0";
                content.classList.remove("hidden");
            } else {
                btn.className = "py-3 font-bold text-xs sm:text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition flex items-center flex-shrink-0";
                content.classList.add("hidden");
            }
        }
    });

    if (tabName === "categories") loadAdminCategories();
    if (tabName === "staff") loadAdminUsers();
    if (tabName === "customers") loadAdminCustomers();
    if (tabName === "branches") loadAdminBranches();
    if (tabName === "promotions") loadAdminPromotions();
    if (tabName === "translations") loadAdminTranslations();
}

// ==========================================
// 0. QUẢN LÝ DANH MỤC HOA ĐỘNG (CATEGORIES CMS)
// ==========================================

export async function loadAdminCategories() {
    const tbody = document.getElementById("categoriesTableBody");
    if (!tbody) return;

    // Chỉ hiển thị placeholder đang tải nếu bảng chưa có dữ liệu nào trước đó
    if (!allAdminCategories || allAdminCategories.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-400 font-medium"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải danh mục hoa từ hệ thống...</td></tr>`;
    }
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    try {
        const res = await fetch(`${API_BASE}/admin/categories`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();

        if (json.success && Array.isArray(json.data)) {
            allAdminCategories = json.data;
            renderCategoriesTable(allAdminCategories);
            populateCategoryDropdowns(allAdminCategories);
        } else if (!allAdminCategories || allAdminCategories.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold">${json.message || "Lỗi tải danh mục"}</td></tr>`;
        }
    } catch (e) {
        if (!allAdminCategories || allAdminCategories.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
        }
    }
}

function renderCategoriesTable(categories) {
    const tbody = document.getElementById("categoriesTableBody");
    if (!tbody) return;

    if (categories.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-12 text-center">
                    <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                        <div class="w-16 h-16 rounded-full bg-pink-50 text-pink-400 flex items-center justify-center text-2xl mb-3 shadow-inner">
                            <i class="fa-solid fa-layer-group"></i>
                        </div>
                        <p class="font-bold text-gray-700 text-sm">Chưa có danh mục nào</p>
                        <p class="text-xs text-gray-400 mt-1">Bấm nút "Thêm Danh Mục Mới" ở góc trên để tạo danh mục hoa tươi.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Luôn sắp xếp theo số thứ tự hiển thị (order) từ bé đến lớn (1, 2, 3...)
    const sortedCategories = [...categories].sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));

    let html = "";
    sortedCategories.forEach((cat) => {
        const isDeleted = cat.status === "deleted" || cat.isDeleted === true;
        const isActive = cat.isActive !== false && !isDeleted;

        let statusBadge = "";
        if (isDeleted) {
            statusBadge = `<span class="bg-red-100 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-200">🔴 Đã Xóa Mềm</span>`;
        } else if (isActive) {
            statusBadge = `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-200">🟢 Đang Bán (Active)</span>`;
        } else {
            statusBadge = `<span class="bg-gray-100 text-gray-500 text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-200">⚪ Đã Ẩn (Inactive)</span>`;
        }

        const fallbackImg = "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500";
        const catImg = cat.image || fallbackImg;
        const iconClass = cat.icon || "fa-solid fa-spa";
        const createdDate = cat.createdAt ? cat.createdAt.replace("T", " ").replace("Z", "") : "—";
        const updatedDate = cat.updatedAt ? cat.updatedAt.replace("T", " ").replace("Z", "") : createdDate;

        const rowBg = isDeleted ? "bg-red-50/20 opacity-75" : "hover:bg-pink-50/20";

        html += `
            <tr class="${rowBg} transition border-b border-gray-100">
                <td class="p-3">
                    <div class="flex items-center space-x-3">
                        <img src="${catImg}" alt="${cat.name}" class="w-10 h-10 object-cover rounded-xl border border-gray-200 shadow-2xs ${isDeleted ? 'grayscale' : ''}">
                        <div class="w-7 h-7 rounded-lg bg-pink-50 text-primary flex items-center justify-center text-xs">
                            <i class="${iconClass}"></i>
                        </div>
                    </div>
                </td>
                <td class="p-3">
                    <div class="font-bold text-gray-800 text-sm ${isDeleted ? 'line-through text-gray-400' : ''}">${cat.name}</div>
                    <div class="text-[10px] text-gray-400 font-mono">Mã ID: <span class="text-primary font-semibold">${cat.id}</span></div>
                </td>
                <td class="p-3">
                    <span class="text-xs text-gray-500 line-clamp-1 max-w-[180px]">${cat.description || "—"}</span>
                </td>
                <td class="p-3">
                    <div class="flex items-center space-x-1.5">
                        <span class="w-6 h-6 rounded-full bg-pink-50 text-primary font-extrabold text-xs flex items-center justify-center border border-pink-200 shadow-2xs">
                            ${cat.order || 1}
                        </span>
                        <div class="flex flex-col space-y-0.5">
                            <button onclick="moveCategory('${cat.id}', 'up')" title="Đẩy danh mục lên trước" class="w-4 h-3.5 bg-gray-100 hover:bg-primary hover:text-white text-gray-600 rounded text-[9px] flex items-center justify-center transition">
                                <i class="fa-solid fa-chevron-up"></i>
                            </button>
                            <button onclick="moveCategory('${cat.id}', 'down')" title="Đẩy danh mục xuống sau" class="w-4 h-3.5 bg-gray-100 hover:bg-primary hover:text-white text-gray-600 rounded text-[9px] flex items-center justify-center transition">
                                <i class="fa-solid fa-chevron-down"></i>
                            </button>
                        </div>
                    </div>
                </td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3 text-[11px] text-gray-500 font-mono leading-tight">
                    <div><span class="text-gray-400">Tạo:</span> ${createdDate}</div>
                    <div><span class="text-gray-400">Sửa:</span> ${updatedDate}</div>
                </td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center space-x-1.5">
                        ${!isDeleted ? `
                            <button onclick="editCategory('${cat.id}')" title="Chỉnh sửa danh mục" class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="toggleCategory('${cat.id}', '${cat.name.replace(/'/g, "\\'")}', ${isActive})" title="${isActive ? 'Ẩn khỏi web' : 'Hiện trên web'}" class="px-2.5 py-1 ${isActive ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' : 'bg-green-50 hover:bg-green-100 text-green-700'} rounded-lg text-xs font-bold transition">
                                <i class="fa-solid ${isActive ? 'fa-eye-slash' : 'fa-eye'} mr-1"></i> ${isActive ? 'Ẩn' : 'Hiện'}
                            </button>
                            <button onclick="deleteCategory('${cat.id}', '${cat.name}')" title="Xóa mềm danh mục (vẫn lưu trong json)" class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-trash"></i> Xóa
                            </button>
                        ` : `
                            <button onclick="restoreCategory('${cat.id}', '${cat.name}')" title="Khôi phục lại danh mục này" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-rotate-left mr-1"></i> Khôi Phục
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

export function openCategoryModal(isEdit = false) {
    const modal = document.getElementById("categoryModal");
    const title = document.getElementById("categoryModalTitle");
    const form = document.getElementById("categoryForm");
    const errBox = document.getElementById("categoryModalError");

    if (!modal) return;
    if (errBox) errBox.classList.add("hidden");

    if (!isEdit && form) {
        form.reset();
        document.getElementById("editCategoryId").value = "";
        document.getElementById("catIdInput").disabled = false;
        document.getElementById("catOrder").value = allAdminCategories.length + 1;
        document.getElementById("catIsActive").checked = true;
        if (title) title.textContent = "Thêm Danh Mục Hoa Mới";
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

export function closeCategoryModal() {
    const modal = document.getElementById("categoryModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export function editCategory(catId) {
    const cat = allAdminCategories.find((c) => c.id === catId);
    if (!cat) return;

    document.getElementById("editCategoryId").value = cat.id;
    const idInput = document.getElementById("catIdInput");
    if (idInput) {
        idInput.value = cat.id;
        idInput.disabled = true; // Không cho sửa ID khi update
    }
    document.getElementById("catName").value = cat.name || "";
    document.getElementById("catImage").value = cat.image || "";
    document.getElementById("catIcon").value = cat.icon || "fa-solid fa-spa";
    document.getElementById("catOrder").value = cat.order || 1;
    document.getElementById("catDescription").value = cat.description || "";
    document.getElementById("catIsActive").checked = cat.isActive !== false;

    const title = document.getElementById("categoryModalTitle");
    if (title) title.textContent = `Chỉnh Sửa Danh Mục: ${cat.name}`;

    openCategoryModal(true);
}

export async function handleCategorySubmit(event) {
    if (event) event.preventDefault();

    const editId = document.getElementById("editCategoryId").value;
    const catId = (document.getElementById("catIdInput").value || "").trim().toLowerCase().replace(/\s+/g, "_");
    const name = document.getElementById("catName").value.trim();
    const image = document.getElementById("catImage").value.trim();
    const icon = document.getElementById("catIcon").value.trim() || "fa-solid fa-spa";
    const order = parseInt(document.getElementById("catOrder").value, 10) || 1;
    const description = document.getElementById("catDescription").value.trim();
    const isActive = document.getElementById("catIsActive").checked;

    if (!name) {
        alert("Vui lòng nhập tên danh mục!");
        return;
    }

    const payload = {
        id: editId || catId,
        name,
        image,
        icon,
        order,
        description,
        isActive,
        status: isActive ? "active" : "inactive"
    };

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const isEdit = !!editId;
    const url = isEdit ? `${API_BASE}/admin/categories/${editId}` : `${API_BASE}/admin/categories`;
    const method = isEdit ? "PUT" : "POST";
    const errBox = document.getElementById("categoryModalError");

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
            closeCategoryModal();
            loadAdminCategories();
            if (typeof renderStorefrontCategories === "function") renderStorefrontCategories();
            if (typeof renderAllProducts === "function") renderAllProducts();
            notifyUser(isEdit ? `Đã cập nhật danh mục "${name}" thành công!` : `Đã tạo danh mục mới "${name}" thành công!`, 'success');
        } else {
            const msg = json.message || "Lỗi lưu danh mục";
            if (errBox) {
                errBox.textContent = "❌ " + msg;
                errBox.classList.remove("hidden");
            }
            notifyUser(`Không thể lưu danh mục: ${msg}`, 'error');
        }
    } catch (e) {
        if (errBox) {
            errBox.textContent = "❌ Lỗi kết nối: " + e.message;
            errBox.classList.remove("hidden");
        }
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    }
}

export async function toggleCategory(catId, catName, currentActive) {
    const targetCat = allAdminCategories.find(c => c.id === catId);
    const displayName = catName || (targetCat ? targetCat.name : catId);
    const isCurrentlyActive = currentActive !== undefined ? currentActive : (targetCat ? targetCat.isActive !== false : true);
    const actionText = isCurrentlyActive ? "Ẩn đi" : "Bật hiển thị";
    const detailText = isCurrentlyActive 
        ? `Khi ẩn, danh mục "${displayName}" và các sản phẩm thuộc danh mục này sẽ tạm thời không hiển thị trên website khách hàng.`
        : `Khi bật, danh mục "${displayName}" và các mẫu hoa liên quan sẽ được mở bán và hiển thị công khai trên website.`;

    const isConfirmed = await (typeof showConfirmDialog === 'function' ? showConfirmDialog : window.showConfirmDialog)({
        title: isCurrentlyActive ? "Xác nhận Ẩn Danh Mục" : "Xác nhận Mở Danh Mục",
        message: `Bạn có chắc chắn muốn ${actionText.toLowerCase()} danh mục "${displayName}" không?`,
        detail: detailText,
        confirmText: isCurrentlyActive ? "Ẩn danh mục" : "Bật hiển thị",
        cancelText: "Hủy bỏ",
        type: isCurrentlyActive ? "warning" : "success",
        icon: isCurrentlyActive ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"
    });
    if (!isConfirmed) return;

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/categories/${catId}/toggle`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            loadAdminCategories();
            if (typeof renderStorefrontCategories === "function") renderStorefrontCategories();
            if (typeof renderAllProducts === "function") renderAllProducts();
            notifyUser(`Đã ${actionText.toLowerCase()} danh mục "${displayName}" thành công!`, 'success');
        } else {
            notifyUser(`Lỗi cập nhật trạng thái: ${json.message || "Không xác định"}`, 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    }
}

export async function deleteCategory(catId, catName) {
    const isConfirmed = await (typeof showConfirmDialog === 'function' ? showConfirmDialog : window.showConfirmDialog)({
        title: "Xác nhận Xóa Danh Mục",
        message: `Bạn có chắc chắn muốn xóa danh mục "${catName}" (ID: ${catId}) không?`,
        detail: "Dữ liệu sẽ được đánh dấu 'Đã xóa mềm' (Soft Deleted) và vẫn được lưu trữ an toàn để có thể khôi phục lại khi cần.",
        confirmText: "Xóa danh mục",
        cancelText: "Hủy bỏ",
        type: "danger",
        icon: "fa-solid fa-trash"
    });
    if (!isConfirmed) return;

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/categories/${catId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            loadAdminCategories();
            notifyUser("Đã chuyển danh mục sang trạng thái Đã Xóa thành công!", 'success');
        } else {
            notifyUser("Không thể xóa danh mục: " + (json.message || ""), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    }
}

export async function restoreCategory(catId, catName) {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/categories/${catId}/restore`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            loadAdminCategories();
            notifyUser(`Đã khôi phục danh mục "${catName || catId}" thành công!`, 'success');
        } else {
            notifyUser("Lỗi khôi phục danh mục: " + (json.message || ""), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    }
}

export async function moveCategory(catId, direction) {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/categories/${catId}/move`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ direction })
        });
        
        const contentType = res.headers.get("content-type") || "";
        let json;
        if (contentType.includes("application/json")) {
            json = await res.json();
        } else {
            const rawText = await res.text();
            throw new Error(`Máy chủ không phản hồi định dạng JSON (${res.status} ${res.statusText}). Vui lòng đảm bảo backend Flask đang chạy trên cổng 5000.`);
        }

        if (json.success) {
            loadAdminCategories();
            if (typeof renderStorefrontCategories === "function") {
                renderStorefrontCategories();
            }
            if (typeof renderAllProducts === "function") {
                renderAllProducts();
            }
            notifyUser("Đã thay đổi thứ tự danh mục thành công!", 'success');
        } else {
            notifyUser(`Không thể di chuyển thứ tự: ${json.message || "Lỗi không xác định"}`, 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    }
}



export function populateCategoryDropdowns(categories) {
    if (!Array.isArray(categories)) return;

    // Luôn sắp xếp theo số thứ tự hiển thị (order) từ bé đến lớn
    const sortedCategories = [...categories].sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));

    // 1. Dropdown lọc danh mục ở trang Admin Sản Phẩm
    const filterSelect = document.getElementById("filterProductCategory");
    if (filterSelect) {
        const currentVal = filterSelect.value;
        let opts = `<option value="">Tất cả danh mục</option>`;
        sortedCategories.forEach((c) => {
            opts += `<option value="${c.id}">${c.name} (${c.id})</option>`;
        });
        filterSelect.innerHTML = opts;
        if (currentVal) filterSelect.value = currentVal;
    }

    // 2. Dropdown chọn danh mục trong Modal Thêm/Sửa Mẫu Hoa
    const prodCatSelect = document.getElementById("prodCategory");
    if (prodCatSelect) {
        const currentVal = prodCatSelect.value;
        let opts = "";
        sortedCategories.forEach((c) => {
            opts += `<option value="${c.id}">${c.name}</option>`;
        });
        prodCatSelect.innerHTML = opts;
        if (currentVal) prodCatSelect.value = currentVal;
    }
}


// ==========================================
// 1. QUẢN LÝ NHÂN SỰ NỘI BỘ (STAFF & RBAC)
// ==========================================

const ROLE_DISPLAY_MAP = {
    super_admin: { label: "👑 Tổng Quản Trị", badge: "bg-purple-100 text-purple-800" },
    branch_manager: { label: "🏬 Quản Lý Chi Nhánh", badge: "bg-blue-100 text-blue-800" },
    florist: { label: "🌸 Thợ Cắm Hoa", badge: "bg-pink-100 text-pink-800" },
    sales_consultant: { label: "💼 Tư Vấn Viên", badge: "bg-amber-100 text-amber-800" }
};

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

export async function loadAdminUsers() {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    // Đảm bảo dữ liệu chi nhánh đã được tải từ backend và đồng bộ vào dropdowns
    if (!allAdminBranches || allAdminBranches.length === 0) {
        try {
            const bRes = await fetch(`${API_BASE}/admin/branches`, { headers: { "Authorization": `Bearer ${token}` } });
            const bJson = await bRes.json();
            if (bJson.success && Array.isArray(bJson.data)) {
                allAdminBranches = bJson.data;
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
            renderUsersTable(allAdminUsers);
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold">${json.message || "Lỗi tải nhân sự"}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
    }
}

function renderUsersTable(users) {
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

let allAdminCustomers = [];

const TIER_DISPLAY_MAP = {
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
            renderCustomersTable(allAdminCustomers);
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold">${json.message || "Lỗi tải khách hàng"}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
    }
}

function renderCustomersTable(customers) {
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
    const u = allAdminUsers.find((user) => user.id === userId);
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
    const fullName = document.getElementById("staffFullName").value.trim();
    const phone = document.getElementById("staffPhone").value.trim();
    const email = document.getElementById("staffEmail").value.trim();
    const role = document.getElementById("staffRole").value;
    const branchSelect = document.getElementById("staffBranch");
    const branchId = branchSelect.value;
    const password = document.getElementById("staffPassword").value;
    const isActive = document.getElementById("staffIsActive").checked;

    const payload = { fullName, phone, email, role, branchId, isActive };
    if (password) payload.password = password;

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const isEdit = !!editId;
    const url = isEdit ? `${API_BASE}/admin/users/${editId}` : `${API_BASE}/admin/users`;
    const method = isEdit ? "PUT" : "POST";

    const errBox = document.getElementById("userModalError");

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
            loadAdminUsers();
            alert(isEdit ? "Cập nhật nhân sự thành công!" : "🎉 Thêm nhân sự mới thành công!");
        } else {
            if (errBox) {
                errBox.textContent = json.message || "Lỗi lưu thông tin nhân sự";
                errBox.classList.remove("hidden");
            } else {
                alert(json.message || "Lỗi lưu thông tin nhân sự");
            }
        }
    } catch (e) {
        if (errBox) {
            errBox.textContent = "Lỗi kết nối: " + e.message;
            errBox.classList.remove("hidden");
        }
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

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const json = await res.json();
        if (res.ok && json.success) {
            loadAdminUsers();
            notifyUser("Đã xóa tài khoản nhân sự thành công!", 'success');
        } else {
            notifyUser("Lỗi: " + (json.message || "Không thể xóa nhân sự"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    }
}

// ==========================================
// QUẢN LÝ CHUỖI CỬA HÀNG (BRANCHES MANAGEMENT)
// ==========================================

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
            if (tbody) renderBranchesTable(allAdminBranches);
            populateBranchDropdowns(allAdminBranches);
            if (allAdminUsers && allAdminUsers.length > 0) {
                renderUsersTable(allAdminUsers);
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
    const b = allAdminBranches.find((branch) => branch.id === branchId);
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
            loadAdminBranches();
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
    }
}

export async function toggleBranch(branchId) {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/branches/${branchId}/toggle`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const json = await res.json();
        if (res.ok && json.success) {
            loadAdminBranches();
            notifyUser("Đã cập nhật trạng thái chi nhánh thành công!", 'success');
        } else {
            notifyUser("Lỗi: " + (json.message || "Không thể cập nhật trạng thái chi nhánh"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    }
}

// ==========================================
// QUẢN LÝ SẢN PHẨM & PRICE GOVERNANCE
// ==========================================

export async function loadAdminProducts() {
    const categorySelect = document.getElementById("filterProductCategory");
    const category = categorySelect ? categorySelect.value : "";
    const tbody = document.getElementById("productsTableBody");
    if (!tbody) return;

    if (!allAdminProducts || allAdminProducts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-gray-400 font-medium"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải danh mục hoa tươi...</td></tr>`;
    }

    try {
        let url = `${API_BASE}/products`;
        if (category) url += `?category=${category}`;
        const res = await fetch(url);
        const json = await res.json();

        if (json.success && json.data) {
            allAdminProducts = json.data;
            renderProductsTable(allAdminProducts);
        }
    } catch (e) {
        if (!allAdminProducts || allAdminProducts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-red-500 font-bold">Lỗi tải sản phẩm: ${e.message}</td></tr>`;
        }
    }
}

function renderProductsTable(products) {
    const tbody = document.getElementById("productsTableBody");
    if (!tbody) return;

    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="p-12 text-center">
                    <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                        <div class="w-16 h-16 rounded-full bg-pink-50 text-pink-400 flex items-center justify-center text-2xl mb-3 shadow-inner">
                            <i class="fa-solid fa-spa"></i>
                        </div>
                        <p class="font-bold text-gray-700 text-sm">Không có mẫu hoa nào trong danh mục này</p>
                        <p class="text-xs text-gray-400 mt-1">Bấm nút "Thêm Mẫu Hoa Mới" ở góc trên để bổ sung vào Catalogue.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = "";
    products.forEach((p) => {
        const lvlCode = (p.priceLevelId || "").replace("price_lvl_", "LV_").toUpperCase();
        const activeBadge = p.isActive !== false
            ? `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">🟢 Đang Bán</span>`
            : `<span class="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full">⚪ Đã Ẩn</span>`;

        const stockQ10 = p.stockByBranch?.branch_q10 ?? 0;
        const stockQ1 = p.stockByBranch?.branch_q1 ?? 0;
        const stockTD = p.stockByBranch?.branch_thao_dien ?? 0;

        html += `
            <tr class="hover:bg-pink-50/30 transition">
                <td class="p-4">
                    <img src="${p.image}" alt="${p.name}" class="w-12 h-12 object-cover rounded-lg border border-gray-200 shadow-2xs">
                </td>
                <td class="p-4">
                    <div class="font-bold text-gray-900">${p.name}</div>
                    <div class="text-[10px] text-gray-400">ID: ${p.id}</div>
                </td>
                <td class="p-4 uppercase font-bold text-gray-600">${p.category}</td>
                <td class="p-4">
                    <span class="bg-pink-100 text-primary font-extrabold text-[10px] px-2 py-0.5 rounded-md">${lvlCode}</span>
                </td>
                <td class="p-4 font-bold text-primary text-sm">${p.salePrice || (p.priceNumber?.toLocaleString() + '₫')}</td>
                <td class="p-4 text-[11px] font-semibold text-gray-600">
                    Q10: <b class="text-gray-900">${stockQ10}</b> • Q1: <b class="text-gray-900">${stockQ1}</b> • TD: <b class="text-gray-900">${stockTD}</b>
                </td>
                <td class="p-4">${activeBadge}</td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center space-x-2">
                        <button onclick="editProduct('${p.id}')" title="Chỉnh sửa mẫu hoa" class="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition">
                            <i class="fa-solid fa-pen-to-square text-xs"></i>
                        </button>
                        <button onclick="toggleProduct('${p.id}', '${(p.name || '').replace(/'/g, "\\'")}', ${p.isActive !== false})" title="${p.isActive !== false ? 'Ẩn mẫu hoa' : 'Hiện mẫu hoa'}" class="w-7 h-7 rounded-lg ${p.isActive !== false ? 'bg-yellow-50 hover:bg-yellow-100 text-yellow-600' : 'bg-green-50 hover:bg-green-100 text-green-600'} flex items-center justify-center transition">
                            <i class="fa-solid ${p.isActive !== false ? 'fa-eye-slash' : 'fa-eye'} text-xs"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

export function onPriceLevelChange() {
    const lvlSelect = document.getElementById("prodPriceLevel");
    const hint = document.getElementById("priceRangeHint");
    if (!lvlSelect || !hint) return;

    const lvl = PRICE_LEVEL_CONFIG[lvlSelect.value];
    if (lvl) {
        hint.textContent = `Khung giá: ${lvl.min.toLocaleString()}₫ - ${lvl.max.toLocaleString()}₫`;
    }
    validateLivePrice();
}

export function validateLivePrice() {
    const lvlSelect = document.getElementById("prodPriceLevel");
    const priceInput = document.getElementById("prodPriceNumber");
    const warn = document.getElementById("livePriceWarning");
    if (!lvlSelect || !priceInput || !warn) return true;

    const val = parseInt(priceInput.value, 10);
    const lvl = PRICE_LEVEL_CONFIG[lvlSelect.value];
    if (!lvl || isNaN(val)) {
        warn.classList.add("hidden");
        return true;
    }

    if (val < lvl.min) {
        warn.textContent = `⚠️ Giá bán (${val.toLocaleString()}₫) thấp hơn giá sàn (${lvl.min.toLocaleString()}₫)!`;
        warn.classList.remove("hidden");
        return false;
    } else if (val > lvl.max) {
        warn.textContent = `⚠️ Giá bán (${val.toLocaleString()}₫) vượt quá giá trần (${lvl.max.toLocaleString()}₫)!`;
        warn.classList.remove("hidden");
        return false;
    } else {
        warn.classList.add("hidden");
        return true;
    }
}

/**
 * Tự động nén và chuyển đổi tệp ảnh sang chuỗi Base64 (Data URI)
 */
export function compressAndConvertToBase64(file, maxWidth = 800, maxHeight = 800, quality = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith("image/")) {
            return reject(new Error("Tệp được chọn không phải là hình ảnh"));
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Tính toán tỷ lệ co giãn ảnh
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                // Xuất ra Base64 Data URI
                const base64DataUri = canvas.toDataURL("image/jpeg", quality);
                resolve(base64DataUri);
            };
            img.onerror = () => reject(new Error("Lỗi tải hình ảnh để chuyển đổi Base64"));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("Lỗi đọc tệp từ thiết bị"));
        reader.readAsDataURL(file);
    });
}

/**
 * Xử lý khi người dùng chọn tải ảnh từ máy tính/điện thoại
 */
export async function handleImageFileUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    const previewImg = document.getElementById("prodImagePreview");
    const inputStr = document.getElementById("prodImage");
    const statusLabel = document.getElementById("imageStatusLabel");
    const sizeInfo = document.getElementById("imageSizeInfo");

    if (statusLabel) {
        statusLabel.textContent = "⏳ Đang nén & chuyển Base64...";
        statusLabel.className = "text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block";
    }

    try {
        const base64String = await compressAndConvertToBase64(file, 800, 800, 0.82);
        
        if (inputStr) inputStr.value = base64String;
        if (previewImg) previewImg.src = base64String;

        // Tính kích thước Base64 theo KB
        const sizeInKB = ((base64String.length * 3) / 4 / 1024).toFixed(1);

        if (statusLabel) {
            statusLabel.textContent = "🟢 Base64 Đã Sẵn Sàng";
            statusLabel.className = "text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md inline-block";
        }
        if (sizeInfo) {
            sizeInfo.textContent = `Dung lượng nén: ~${sizeInKB} KB (${file.name})`;
        }
    } catch (err) {
        alert("Lỗi xử lý ảnh: " + err.message);
        if (statusLabel) {
            statusLabel.textContent = "❌ Lỗi chuyển đổi";
            statusLabel.className = "text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md inline-block";
        }
    }
}

export function openProductModal(isEdit = false) {
    const modal = document.getElementById("productModal");
    const title = document.getElementById("productModalTitle");
    const form = document.getElementById("productForm");
    const errBox = document.getElementById("productModalError");
    const previewImg = document.getElementById("prodImagePreview");
    const statusLabel = document.getElementById("imageStatusLabel");
    const sizeInfo = document.getElementById("imageSizeInfo");
    const fileInput = document.getElementById("prodImageFileInput");

    if (!modal) return;

    if (errBox) errBox.classList.add("hidden");
    if (fileInput) fileInput.value = "";

    if (!isEdit && form) {
        form.reset();
        document.getElementById("editProductId").value = "";
        const defaultImg = "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500";
        document.getElementById("prodImage").value = defaultImg;
        if (previewImg) previewImg.src = defaultImg;
        if (statusLabel) {
            statusLabel.textContent = "Ảnh mặc định";
            statusLabel.className = "text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md inline-block";
        }
        if (sizeInfo) sizeInfo.textContent = "Upload file để chuyển sang Base64";
        if (title) title.textContent = "Thêm Mẫu Hoa Mới Vào Catalogue";
    }

    if (allAdminCategories && allAdminCategories.length > 0) {
        populateCategoryDropdowns(allAdminCategories);
    } else if (typeof window !== "undefined" && window.default_categories) {
        populateCategoryDropdowns(window.default_categories);
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");
    onPriceLevelChange();
}

export function closeProductModal() {
    const modal = document.getElementById("productModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export async function editProduct(productId) {
    let prod = allAdminProducts.find((p) => p.id === productId);
    if (!prod) return;

    openProductModal(true);
    const title = document.getElementById("productModalTitle");
    if (title) title.textContent = `Đang tải chi tiết: ${prod.name}...`;

    // Tải chi tiết đầy đủ từ API /api/products/<productId> (Lazy load)
    try {
        const res = await fetch(`${API_BASE}/products/${productId}`);
        if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
                prod = json.data;
            }
        }
    } catch (e) {
        console.warn("Dùng dữ liệu tóm tắt cục bộ do không thể tải chi tiết:", e);
    }

    document.getElementById("editProductId").value = prod.id;
    document.getElementById("prodName").value = prod.name || "";
    document.getElementById("prodCategory").value = prod.category || "bo_hoa";
    document.getElementById("prodPriceLevel").value = prod.priceLevelId || "price_lvl_01";
    document.getElementById("prodPriceNumber").value = prod.priceNumber || 420000;
    
    const prodImg = prod.image || "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500";
    document.getElementById("prodImage").value = prodImg;

    const previewImg = document.getElementById("prodImagePreview");
    const statusLabel = document.getElementById("imageStatusLabel");
    const sizeInfo = document.getElementById("imageSizeInfo");
    if (previewImg) previewImg.src = prodImg;
    if (statusLabel) {
        const isBase64 = prodImg.startsWith("data:image");
        statusLabel.textContent = isBase64 ? "🟢 Ảnh Base64" : "🌐 Link Ảnh Web";
        statusLabel.className = `text-[10px] font-bold ${isBase64 ? 'text-purple-600 bg-purple-50' : 'text-blue-600 bg-blue-50'} px-2 py-0.5 rounded-md inline-block`;
    }
    if (sizeInfo) {
        sizeInfo.textContent = prodImg.startsWith("data:image") ? `Base64 (${(prodImg.length / 1024).toFixed(1)} KB)` : "Đường dẫn URL trực tiếp";
    }

    document.getElementById("prodFlowerComposition").value = prod.flowerComposition || "";
    document.getElementById("prodStockQ10").value = prod.stockByBranch?.branch_q10 ?? 10;
    document.getElementById("prodStockQ1").value = prod.stockByBranch?.branch_q1 ?? 5;
    document.getElementById("prodStockTD").value = prod.stockByBranch?.branch_thao_dien ?? 5;

    if (title) title.textContent = `Chỉnh Sửa Mẫu Hoa: ${prod.name}`;
}

export async function handleProductSubmit(event) {
    if (event) event.preventDefault();

    if (!validateLivePrice()) {
        alert("Giá bán không hợp lệ theo khung phân tầng! Vui lòng điều chỉnh lại.");
        return;
    }

    const editId = document.getElementById("editProductId").value;
    const name = document.getElementById("prodName").value.trim();
    const category = document.getElementById("prodCategory").value;
    const priceLevelId = document.getElementById("prodPriceLevel").value;
    const priceNumber = parseInt(document.getElementById("prodPriceNumber").value, 10);
    const image = document.getElementById("prodImage").value.trim();
    const flowerComposition = document.getElementById("prodFlowerComposition").value.trim();

    const stockQ10 = parseInt(document.getElementById("prodStockQ10").value, 10) || 0;
    const stockQ1 = parseInt(document.getElementById("prodStockQ1").value, 10) || 0;
    const stockTD = parseInt(document.getElementById("prodStockTD").value, 10) || 0;

    const payload = {
        name,
        category,
        priceLevelId,
        priceNumber,
        image,
        flowerComposition,
        stockByBranch: {
            branch_q10: stockQ10,
            branch_q1: stockQ1,
            branch_thao_dien: stockTD
        }
    };

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const method = editId ? "PUT" : "POST";
    const url = editId ? `${API_BASE}/admin/products/${editId}` : `${API_BASE}/admin/products`;

    const errBox = document.getElementById("productModalError");

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
            closeProductModal();
            loadAdminProducts();
            if (typeof window !== 'undefined' && typeof window.renderAllProducts === 'function') {
                window.renderAllProducts();
            }
            notifyUser(editId ? `Đã cập nhật mẫu hoa "${name}" thành công!` : `Đã thêm mẫu hoa mới "${name}" thành công!`, 'success');
        } else {
            const msg = json.message || "Lỗi lưu sản phẩm";
            if (errBox) {
                errBox.textContent = "❌ " + msg;
                errBox.classList.remove("hidden");
            }
            notifyUser(`Không thể lưu sản phẩm: ${msg}`, 'error');
        }
    } catch (e) {
        if (errBox) {
            errBox.textContent = "❌ Lỗi kết nối máy chủ: " + e.message;
            errBox.classList.remove("hidden");
        }
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    }
}

export async function toggleProduct(productId, productName, currentActive) {
    const targetProd = (allAdminProducts || []).find(p => p.id === productId);
    const displayName = productName || (targetProd ? targetProd.name : productId);
    const isCurrentlyActive = currentActive !== undefined ? currentActive : (targetProd ? targetProd.isActive !== false : true);
    const actionText = isCurrentlyActive ? "Ẩn đi" : "Bật hiển thị";
    const detailText = isCurrentlyActive 
        ? `Khi ẩn, mẫu hoa "${displayName}" sẽ tạm thời không hiển thị trên website khách hàng.`
        : `Khi bật, mẫu hoa "${displayName}" sẽ được mở bán và hiển thị công khai trên website.`;

    const isConfirmed = await (typeof showConfirmDialog === 'function' ? showConfirmDialog : window.showConfirmDialog)({
        title: isCurrentlyActive ? "Xác nhận Ẩn Mẫu Hoa" : "Xác nhận Mở Bán Mẫu Hoa",
        message: `Bạn có chắc chắn muốn ${actionText.toLowerCase()} mẫu hoa "${displayName}" không?`,
        detail: detailText,
        confirmText: isCurrentlyActive ? "Ẩn mẫu hoa" : "Bật mở bán",
        cancelText: "Hủy bỏ",
        type: isCurrentlyActive ? "warning" : "success",
        icon: isCurrentlyActive ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"
    });
    if (!isConfirmed) return;

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/products/${productId}/toggle`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (res.ok && json.success) {
            loadAdminProducts();
            if (typeof window !== 'undefined' && typeof window.renderAllProducts === 'function') {
                window.renderAllProducts();
            }
            notifyUser(`Đã ${actionText.toLowerCase()} mẫu hoa "${displayName}" thành công!`, 'success');
        } else {
            notifyUser("Lỗi đổi trạng thái: " + (json.message || "Không thể đổi trạng thái"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    }
}

// ==========================================
// QUẢN LÝ KHUYẾN MÃI & VOUCHER (PROMOTIONS - Timestamps & Soft Delete)
// ==========================================

export async function loadAdminPromotions() {
    const tbody = document.getElementById("promotionsTableBody");
    if (!tbody) return;

    if (!allAdminPromotions || allAdminPromotions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-gray-400 font-medium"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải dữ liệu voucher...</td></tr>`;
    }

    try {
        const res = await fetch(`${API_BASE}/promotions`);
        const json = await res.json();
        if (json.success && json.data) {
            allAdminPromotions = json.data;
            renderPromotionsTable(allAdminPromotions);
        } else if (!allAdminPromotions || allAdminPromotions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-red-500 font-bold">${json.message || "Không thể tải danh sách khuyến mãi"}</td></tr>`;
        }
    } catch (e) {
        if (!allAdminPromotions || allAdminPromotions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
        }
    }
}

export function renderPromotionsTable(promotions) {
    const tbody = document.getElementById("promotionsTableBody");
    if (!tbody) return;

    if (!Array.isArray(promotions) || promotions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="p-12 text-center">
                    <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                        <div class="w-16 h-16 rounded-full bg-purple-50 text-purple-400 flex items-center justify-center text-2xl mb-3 shadow-inner">
                            <i class="fa-solid fa-ticket-simple"></i>
                        </div>
                        <p class="font-bold text-gray-700 text-sm">Chưa có voucher khuyến mãi nào</p>
                        <p class="text-xs text-gray-400 mt-1">Bấm nút "Thêm Voucher Mới" để phát hành mã giảm giá cho khách hàng.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = "";
    promotions.forEach((p) => {
        const isDeleted = p.status === "deleted" || p.isDeleted === true;
        const isActive = !isDeleted && p.isActive !== false;

        let statusBadge = "";
        if (isDeleted) {
            statusBadge = `<span class="bg-red-100 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-200">🔴 Đã Xóa Mềm</span>`;
        } else if (isActive) {
            statusBadge = `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-200">🟢 Đang Áp Dụng</span>`;
        } else {
            statusBadge = `<span class="bg-gray-100 text-gray-500 text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-200">⚪ Tạm Dừng</span>`;
        }

        const discountStr = p.discountType === "percentage" 
            ? `<span class="font-extrabold text-primary text-sm">${p.discountValue}%</span>`
            : `<span class="font-extrabold text-primary text-sm">${(p.discountValue || 0).toLocaleString()}₫</span>`;

        const minOrder = (p.minOrderAmount || 0).toLocaleString() + "₫";
        const maxDiscount = (p.maxDiscountAmount || 0).toLocaleString() + "₫";

        const start = p.startDate ? p.startDate.split("T")[0] : "—";
        const end = p.endDate ? p.endDate.split("T")[0] : "—";

        const createdDate = p.createdAt ? p.createdAt.replace("T", " ").replace("Z", "") : "—";
        const updatedDate = p.updatedAt ? p.updatedAt.replace("T", " ").replace("Z", "") : createdDate;
        const deletedDate = p.deletedAt ? p.deletedAt.replace("T", " ").replace("Z", "") : null;

        const rowBg = isDeleted ? "bg-red-50/20 opacity-75" : "hover:bg-pink-50/20";

        html += `
            <tr class="${rowBg} transition border-b border-gray-100">
                <td class="p-3">
                    <div class="flex items-center space-x-2">
                        <span class="bg-pink-100 text-primary font-mono font-extrabold text-xs px-2.5 py-1 rounded-lg border border-pink-200 ${isDeleted ? 'line-through text-gray-400' : ''}">${p.code}</span>
                    </div>
                    <div class="font-bold text-gray-800 text-xs mt-1 ${isDeleted ? 'line-through text-gray-400' : ''}">${p.title}</div>
                    ${p.topBarMessage ? `<div class="text-[10px] text-amber-600 truncate max-w-[200px]" title="${p.topBarMessage}">📢 ${p.topBarMessage}</div>` : ''}
                </td>
                <td class="p-3">${discountStr}</td>
                <td class="p-3 text-[11px] text-gray-600">
                    <div>Đơn tối thiểu: <b>${minOrder}</b></div>
                    <div>Giảm tối đa: <b>${maxDiscount}</b></div>
                </td>
                <td class="p-3 text-[11px]">
                    <span class="font-bold text-gray-800">${p.usedCount || 0}</span> / <span class="text-gray-500">${p.usageLimit || 500}</span>
                </td>
                <td class="p-3 text-[11px] text-gray-500 font-mono">
                    <div>${start}</div>
                    <div>➔ ${end}</div>
                </td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3 text-[10px] text-gray-500 font-mono leading-tight">
                    <div><span class="text-gray-400">Tạo:</span> ${createdDate}</div>
                    <div><span class="text-gray-400">Sửa:</span> ${updatedDate}</div>
                    ${deletedDate ? `<div class="text-red-500 font-bold"><span>Xóa:</span> ${deletedDate}</div>` : ''}
                </td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center space-x-1.5">
                        ${!isDeleted ? `
                            <button onclick="editPromo('${p.id}')" title="Chỉnh sửa voucher" class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="togglePromo('${p.id}')" title="${isActive ? 'Tạm dừng voucher' : 'Kích hoạt voucher'}" class="px-2.5 py-1 ${isActive ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' : 'bg-green-50 hover:bg-green-100 text-green-700'} rounded-lg text-xs font-bold transition">
                                <i class="fa-solid ${isActive ? 'fa-pause' : 'fa-play'} mr-1"></i> ${isActive ? 'Dừng' : 'Bật'}
                            </button>
                            <button onclick="deletePromo('${p.id}', '${p.code}')" title="Xóa mềm voucher (vẫn lưu trong json)" class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        ` : `
                            <button onclick="restorePromo('${p.id}', '${p.code}')" title="Khôi phục voucher đã xóa mềm" class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center">
                                <i class="fa-solid fa-rotate-left mr-1"></i> Khôi Phục
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

export function openPromoModal(isEdit = false) {
    const modal = document.getElementById("promoModal");
    const title = document.getElementById("promoModalTitle");
    const err = document.getElementById("promoModalError");
    if (!modal) return;

    if (err) {
        err.textContent = "";
        err.classList.add("hidden");
    }

    if (!isEdit) {
        title.textContent = "Thêm Voucher Khuyến Mãi Mới";
        document.getElementById("editPromoId").value = "";
        document.getElementById("promoCode").value = "";
        document.getElementById("promoCode").disabled = false;
        document.getElementById("promoTitle").value = "";
        document.getElementById("promoDiscountType").value = "percentage";
        document.getElementById("promoDiscountValue").value = "15";
        document.getElementById("promoMinOrder").value = "300000";
        document.getElementById("promoMaxDiscount").value = "150000";
        document.getElementById("promoStartDate").value = "2026-01-01";
        document.getElementById("promoEndDate").value = "2026-12-31";
        document.getElementById("promoUsageLimit").value = "500";
        document.getElementById("promoTopBarMessage").value = "";
        document.getElementById("promoIsActive").checked = true;
    } else {
        title.textContent = "Chỉnh Sửa Voucher Khuyến Mãi";
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

export function closePromoModal() {
    const modal = document.getElementById("promoModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export function editPromo(promoId) {
    const promo = (allAdminPromotions || []).find((p) => p.id === promoId);
    if (!promo) return alert("Không tìm thấy dữ liệu voucher");

    openPromoModal(true);

    document.getElementById("editPromoId").value = promo.id;
    document.getElementById("promoCode").value = promo.code || "";
    document.getElementById("promoCode").disabled = true; // Không cho sửa code chính
    document.getElementById("promoTitle").value = promo.title || "";
    document.getElementById("promoDiscountType").value = promo.discountType || "percentage";
    document.getElementById("promoDiscountValue").value = promo.discountValue || 10;
    document.getElementById("promoMinOrder").value = promo.minOrderAmount || 0;
    document.getElementById("promoMaxDiscount").value = promo.maxDiscountAmount || 100000;
    document.getElementById("promoStartDate").value = promo.startDate ? promo.startDate.split("T")[0] : "2026-01-01";
    document.getElementById("promoEndDate").value = promo.endDate ? promo.endDate.split("T")[0] : "2026-12-31";
    document.getElementById("promoUsageLimit").value = promo.usageLimit || 500;
    document.getElementById("promoTopBarMessage").value = promo.topBarMessage || "";
    document.getElementById("promoIsActive").checked = promo.isActive !== false;
}

export async function handlePromoSubmit(event) {
    event.preventDefault();
    const btn = document.getElementById("btnSavePromo");
    const err = document.getElementById("promoModalError");
    const editId = document.getElementById("editPromoId").value.trim();
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    const payload = {
        code: document.getElementById("promoCode").value.trim().toUpperCase(),
        title: document.getElementById("promoTitle").value.trim(),
        discountType: document.getElementById("promoDiscountType").value,
        discountValue: parseInt(document.getElementById("promoDiscountValue").value, 10) || 10,
        minOrderAmount: parseInt(document.getElementById("promoMinOrder").value, 10) || 0,
        maxDiscountAmount: parseInt(document.getElementById("promoMaxDiscount").value, 10) || 100000,
        startDate: (document.getElementById("promoStartDate").value || "2026-01-01") + "T00:00:00Z",
        endDate: (document.getElementById("promoEndDate").value || "2026-12-31") + "T23:59:59Z",
        usageLimit: parseInt(document.getElementById("promoUsageLimit").value, 10) || 500,
        topBarMessage: document.getElementById("promoTopBarMessage").value.trim(),
        isActive: document.getElementById("promoIsActive").checked
    };

    if (btn) btn.disabled = true;
    try {
        const url = editId ? `${API_BASE}/admin/promotions/${editId}` : `${API_BASE}/admin/promotions`;
        const method = editId ? "PUT" : "POST";

        const res = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (json.success) {
            closePromoModal();
            loadAdminPromotions();
            notifyUser(editId ? "Đã cập nhật voucher thành công!" : "Đã tạo voucher mới thành công!", 'success');
        } else {
            const msg = json.message || "Lỗi lưu voucher";
            if (err) {
                err.textContent = "❌ " + msg;
                err.classList.remove("hidden");
            }
            notifyUser(`Lỗi lưu voucher: ${msg}`, 'error');
        }
    } catch (e) {
        if (err) {
            err.textContent = "❌ Lỗi kết nối: " + e.message;
            err.classList.remove("hidden");
        }
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

export async function togglePromo(promoId) {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/promotions/${promoId}/toggle`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            loadAdminPromotions();
            notifyUser("Đã cập nhật trạng thái voucher khuyến mãi thành công!", 'success');
        } else {
            notifyUser("Lỗi: " + (json.message || "Lỗi cập nhật trạng thái voucher"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    }
}

export async function deletePromo(promoId, promoCode) {
    const isConfirmed = await (typeof showConfirmDialog === 'function' ? showConfirmDialog : window.showConfirmDialog)({
        title: "Xác nhận Xóa Voucher",
        message: `Bạn có chắc chắn muốn xóa voucher khuyến mãi "${promoCode}" không?`,
        detail: "Dữ liệu voucher sẽ được chuyển sang trạng thái 'Đã xóa mềm' (Soft Deleted) và lưu trong hệ thống.",
        confirmText: "Xóa voucher",
        cancelText: "Hủy bỏ",
        type: "danger",
        icon: "fa-solid fa-trash"
    });
    if (!isConfirmed) return;

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/promotions/${promoId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            loadAdminPromotions();
            notifyUser("Đã chuyển voucher sang trạng thái Đã Xóa thành công!", 'success');
        } else {
            notifyUser("Không thể xóa voucher: " + (json.message || ""), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    }
}

export async function restorePromo(promoId, promoCode) {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/promotions/${promoId}/restore`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            loadAdminPromotions();
            notifyUser(`Đã khôi phục voucher "${promoCode || promoId}" thành công!`, 'success');
        } else {
            notifyUser(json.message || "Lỗi khôi phục voucher", 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    }
}

// ==========================================
// BIÊN DỊCH ĐA NGÔN NGỮ ĐỘNG (i18n Matrix)
// ==========================================

export async function loadAdminTranslations() {
    const tbody = document.getElementById("translationsTableBody");
    if (!tbody) return;

    try {
        const res = await fetch(`${API_BASE}/translations`);
        const json = await res.json();
        if (json.success && json.data) {
            allAdminTranslations = json.data.translations || {};
            renderTranslationsTable(allAdminTranslations);
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold">Lỗi tải từ điển: ${e.message}</td></tr>`;
    }
}

function renderTranslationsTable(transObj) {
    const tbody = document.getElementById("translationsTableBody");
    if (!tbody) return;

    let html = "";
    Object.keys(transObj).forEach((k) => {
        const row = transObj[k] || {};
        html += `
            <tr class="hover:bg-gray-50/60 transition translation-row" data-key="${k}">
                <td class="p-3 font-bold text-gray-700 text-[11px] font-mono">${k}</td>
                <td class="p-2"><input type="text" value="${(row.vi || '').replace(/"/g, '&quot;')}" class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-primary i18n-input" data-key="${k}" data-lang="vi"></td>
                <td class="p-2"><input type="text" value="${(row.en || '').replace(/"/g, '&quot;')}" class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-primary i18n-input" data-key="${k}" data-lang="en"></td>
                <td class="p-2"><input type="text" value="${(row.ja || '').replace(/"/g, '&quot;')}" class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-primary i18n-input" data-key="${k}" data-lang="ja"></td>
                <td class="p-2"><input type="text" value="${(row.ko || '').replace(/"/g, '&quot;')}" class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-primary i18n-input" data-key="${k}" data-lang="ko"></td>
                <td class="p-2"><input type="text" value="${(row.zh || '').replace(/"/g, '&quot;')}" class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-primary i18n-input" data-key="${k}" data-lang="zh"></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

export function filterTranslations() {
    const input = document.getElementById("searchTranslationKey");
    const query = (input ? input.value : "").trim().toLowerCase();
    const rows = document.querySelectorAll(".translation-row");

    rows.forEach((r) => {
        const key = r.getAttribute("data-key") || "";
        if (key.toLowerCase().includes(query)) {
            r.classList.remove("hidden");
        } else {
            r.classList.add("hidden");
        }
    });
}

export async function saveAllTranslations() {
    const inputs = document.querySelectorAll(".i18n-input");
    const updatedDict = {};

    inputs.forEach((inp) => {
        const key = inp.getAttribute("data-key");
        const lang = inp.getAttribute("data-lang");
        const val = inp.value;

        if (!updatedDict[key]) updatedDict[key] = {};
        updatedDict[key][lang] = val;
    });

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/translations`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(updatedDict)
        });

        const json = await res.json();
        if (res.ok && json.success) {
            notifyUser("Đã lưu toàn bộ bản dịch 5 ngôn ngữ thành công!", 'success');
        } else {
            notifyUser("Lỗi lưu bản dịch: " + (json.message || "Không xác định"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    }
}

// Global binding
if (typeof window !== "undefined") {
    window.openAdminPortalModal = openAdminPortalModal;
    window.closeAdminPortalModal = closeAdminPortalModal;
    window.switchAdminTab = switchAdminTab;
    window.loadAdminProducts = loadAdminProducts;
    window.openProductModal = openProductModal;
    window.closeProductModal = closeProductModal;
    window.editProduct = editProduct;
    window.handleProductSubmit = handleProductSubmit;
    window.handleImageFileUpload = handleImageFileUpload;
    window.compressAndConvertToBase64 = compressAndConvertToBase64;
    window.toggleProduct = toggleProduct;
    window.onPriceLevelChange = onPriceLevelChange;
    window.validateLivePrice = validateLivePrice;
    window.filterTranslations = filterTranslations;
    window.saveAllTranslations = saveAllTranslations;

    // Promotions & Vouchers
    window.loadAdminPromotions = loadAdminPromotions;
    window.openPromoModal = openPromoModal;
    window.closePromoModal = closePromoModal;
    window.editPromo = editPromo;
    window.handlePromoSubmit = handlePromoSubmit;
    window.togglePromo = togglePromo;
    window.deletePromo = deletePromo;
    window.restorePromo = restorePromo;

    // Categories
    window.loadAdminCategories = loadAdminCategories;
    window.openCategoryModal = openCategoryModal;
    window.closeCategoryModal = closeCategoryModal;
    window.editCategory = editCategory;
    window.handleCategorySubmit = handleCategorySubmit;
    window.toggleCategory = toggleCategory;
    window.deleteCategory = deleteCategory;
    window.restoreCategory = restoreCategory;
    window.moveCategory = moveCategory;
    window.populateCategoryDropdowns = populateCategoryDropdowns;

    // Staff & Customers
    window.loadAdminUsers = loadAdminUsers;
    window.loadAdminStaff = loadAdminUsers;
    window.loadAdminCustomers = loadAdminCustomers;
    window.openUserModal = openUserModal;
    window.closeUserModal = closeUserModal;
    window.editUser = editUser;
    window.handleUserSubmit = handleUserSubmit;
    window.deleteUser = deleteUser;

    // Branches
    window.loadAdminBranches = loadAdminBranches;
    window.openBranchModal = openBranchModal;
    window.closeBranchModal = closeBranchModal;
    window.editBranch = editBranch;
    window.handleBranchSubmit = handleBranchSubmit;
    window.toggleBranch = toggleBranch;
    window.populateBranchDropdowns = populateBranchDropdowns;
    window.notifyUser = notifyUser;
}
