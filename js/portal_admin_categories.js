import { getAuthToken } from './auth.js';
import { API_BASE, showConfirmDialog } from './utils.js';
import { lockScreen, unlockScreen, notifyUser, allAdminCategories } from './portal_admin_state.js';

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
            if (typeof window !== "undefined") window.allAdminCategories = allAdminCategories;
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
            statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200"><i class="fa-solid fa-trash-can mr-1"></i> Đã xóa</span>`;
        } else if (isActive) {
            statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200"><i class="fa-solid fa-circle-check mr-1"></i> Đang hiển thị</span>`;
        } else {
            statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200"><i class="fa-solid fa-eye-slash mr-1"></i> Tạm ẩn</span>`;
        }

        const createdDate = cat.createdAt ? new Date(cat.createdAt).toLocaleDateString('vi-VN') : "—";
        const updatedDate = cat.updatedAt ? new Date(cat.updatedAt).toLocaleDateString('vi-VN') : "—";

        html += `
            <tr class="hover:bg-pink-50/40 transition border-b border-gray-100 ${isDeleted ? 'bg-red-50/30 opacity-75' : ''}">
                <td class="p-3 text-center">
                    <div class="w-10 h-10 rounded-xl bg-pink-100/70 border border-pink-200 flex items-center justify-center text-primary text-lg shadow-2xs mx-auto overflow-hidden">
                        ${cat.image ? `<img src="${cat.image}" class="w-full h-full object-cover" onerror="this.outerHTML='<i class=\\'${cat.icon || 'fa-solid fa-spa'}\\'></i>'"/>` : `<i class="${cat.icon || 'fa-solid fa-spa'}"></i>`}
                    </div>
                </td>
                <td class="p-3">
                    <div class="font-bold text-gray-800 text-sm ${isDeleted ? 'line-through text-gray-400' : ''}">${cat.name}</div>
                    <div class="text-[10px] text-gray-400 font-mono flex items-center gap-1.5 flex-wrap">
                        <span>ID: <span class="text-primary font-semibold">${cat.id}</span></span>
                        ${cat.textId ? `<span class="bg-purple-50 text-purple-700 font-semibold px-1.5 py-0.2 rounded border border-purple-200">🌐 ${cat.textId}</span>` : ''}
                    </div>
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

let editingCategoryI18n = { en: {}, ja: {}, ko: {}, zh: {} };
let currentCatEditingLang = 'vi';

export function switchCategoryLangTab(lang) {
    if (currentCatEditingLang !== 'vi') {
        saveCurrentCatI18nDraft();
    }
    currentCatEditingLang = lang;

    const langTabs = document.querySelectorAll(".cat-lang-tab");
    langTabs.forEach(tab => {
        tab.classList.remove("bg-white", "text-primary", "shadow-xs");
        tab.classList.add("text-gray-600", "hover:text-gray-900");
    });
    const activeTab = document.getElementById(`catLangTab_${lang}`);
    if (activeTab) {
        activeTab.classList.add("bg-white", "text-primary", "shadow-xs");
        activeTab.classList.remove("text-gray-600", "hover:text-gray-900");
    }

    const viContainer = document.getElementById("catFields_vi");
    const i18nContainer = document.getElementById("catFields_i18n");
    const langLabels = document.querySelectorAll(".catCurrentLangLabel");

    const langNameMap = {
        en: "English",
        ja: "日本語",
        ko: "한국어",
        zh: "中文"
    };

    if (lang === 'vi') {
        if (viContainer) viContainer.classList.remove("hidden");
        if (i18nContainer) i18nContainer.classList.add("hidden");
    } else {
        if (viContainer) viContainer.classList.add("hidden");
        if (i18nContainer) i18nContainer.classList.remove("hidden");

        langLabels.forEach(lbl => lbl.textContent = langNameMap[lang] || lang);

        const lData = editingCategoryI18n[lang] || {};
        const nameInp = document.getElementById("catI18nName");
        const descInp = document.getElementById("catI18nDescription");

        if (nameInp) nameInp.value = lData.name || "";
        if (descInp) descInp.value = lData.description || "";
    }
}

export function saveCurrentCatI18nDraft() {
    const l = currentCatEditingLang;
    if (l === 'vi') return;
    if (!editingCategoryI18n[l]) editingCategoryI18n[l] = {};

    const nameInp = document.getElementById("catI18nName");
    const descInp = document.getElementById("catI18nDescription");

    if (nameInp) editingCategoryI18n[l].name = nameInp.value.trim();
    if (descInp) editingCategoryI18n[l].description = descInp.value.trim();
}

export function onCategoryDescTextIdChange() {
    const select = document.getElementById("catDescTextId");
    const container = document.getElementById("catDescTextIdCustomContainer");
    const customInput = document.getElementById("catDescTextIdCustom");
    if (!select || !container) return;

    if (select.value === "__custom__") {
        container.classList.remove("hidden");
        if (customInput) customInput.focus();
    } else {
        container.classList.add("hidden");
        if (customInput) customInput.value = "";
    }
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
        if (document.getElementById("catTextId")) document.getElementById("catTextId").value = "";
        const customContainer = document.getElementById("catTextIdCustomContainer");
        if (customContainer) customContainer.classList.add("hidden");
        if (document.getElementById("catTextIdCustom")) document.getElementById("catTextIdCustom").value = "";

        if (document.getElementById("catDescTextId")) document.getElementById("catDescTextId").value = "";
        const descCustomContainer = document.getElementById("catDescTextIdCustomContainer");
        if (descCustomContainer) descCustomContainer.classList.add("hidden");
        if (document.getElementById("catDescTextIdCustom")) document.getElementById("catDescTextIdCustom").value = "";

        document.getElementById("catOrder").value = (allAdminCategories || []).length + 1;
        document.getElementById("catIsActive").checked = true;
        editingCategoryI18n = { en: {}, ja: {}, ko: {}, zh: {} };
        if (title) title.textContent = "Thêm Danh Mục Hoa Mới";
    }

    switchCategoryLangTab('vi');
    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

export function onCategoryTextIdChange() {
    const select = document.getElementById("catTextId");
    const container = document.getElementById("catTextIdCustomContainer");
    const customInput = document.getElementById("catTextIdCustom");
    if (!select || !container) return;

    if (select.value === "__custom__") {
        container.classList.remove("hidden");
        if (customInput) customInput.focus();
    } else {
        container.classList.add("hidden");
        if (customInput) customInput.value = "";
    }
}

export function closeCategoryModal() {
    const modal = document.getElementById("categoryModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export function editCategory(catId) {
    const cat = (allAdminCategories || []).find((c) => c.id === catId);
    if (!cat) return;

    document.getElementById("editCategoryId").value = cat.id;
    const idInput = document.getElementById("catIdInput");
    if (idInput) {
        idInput.value = cat.id;
        idInput.disabled = true; // Không cho sửa ID khi update
    }
    document.getElementById("catName").value = cat.name || "";
    
    // Tên Text ID
    const textIdSelect = document.getElementById("catTextId");
    const customContainer = document.getElementById("catTextIdCustomContainer");
    const customInput = document.getElementById("catTextIdCustom");
    const targetTextId = cat.textId || "";

    if (textIdSelect) {
        const exists = Array.from(textIdSelect.options).some(opt => opt.value === targetTextId);
        if (exists) {
            textIdSelect.value = targetTextId;
            if (customContainer) customContainer.classList.add("hidden");
            if (customInput) customInput.value = "";
        } else if (targetTextId) {
            textIdSelect.value = "__custom__";
            if (customContainer) customContainer.classList.remove("hidden");
            if (customInput) customInput.value = targetTextId;
        } else {
            textIdSelect.value = "";
            if (customContainer) customContainer.classList.add("hidden");
            if (customInput) customInput.value = "";
        }
    }

    // Mô tả Text ID
    const descTextIdSelect = document.getElementById("catDescTextId");
    const descCustomContainer = document.getElementById("catDescTextIdCustomContainer");
    const descCustomInput = document.getElementById("catDescTextIdCustom");
    const targetDescTextId = cat.descTextId || cat.descriptionTextId || "";

    if (descTextIdSelect) {
        const exists = Array.from(descTextIdSelect.options).some(opt => opt.value === targetDescTextId);
        if (exists) {
            descTextIdSelect.value = targetDescTextId;
            if (descCustomContainer) descCustomContainer.classList.add("hidden");
            if (descCustomInput) descCustomInput.value = "";
        } else if (targetDescTextId) {
            descTextIdSelect.value = "__custom__";
            if (descCustomContainer) descCustomContainer.classList.remove("hidden");
            if (descCustomInput) descCustomInput.value = targetDescTextId;
        } else {
            descTextIdSelect.value = "";
            if (descCustomContainer) descCustomContainer.classList.add("hidden");
            if (descCustomInput) descCustomInput.value = "";
        }
    }

    document.getElementById("catImage").value = cat.image || "";
    document.getElementById("catIcon").value = cat.icon || "fa-solid fa-spa";
    document.getElementById("catOrder").value = cat.order || 1;
    document.getElementById("catDescription").value = cat.description || "";
    document.getElementById("catIsActive").checked = cat.isActive !== false;

    // Load category i18n
    editingCategoryI18n = {
        en: cat.i18n?.en ? { ...cat.i18n.en } : {},
        ja: cat.i18n?.ja ? { ...cat.i18n.ja } : {},
        ko: cat.i18n?.ko ? { ...cat.i18n.ko } : {},
        zh: cat.i18n?.zh ? { ...cat.i18n.zh } : {}
    };

    const title = document.getElementById("categoryModalTitle");
    if (title) title.textContent = `Chỉnh Sửa Danh Mục: ${cat.name}`;

    openCategoryModal(true);
}

export async function handleCategorySubmit(event) {
    if (event) event.preventDefault();

    if (currentCatEditingLang !== 'vi') {
        saveCurrentCatI18nDraft();
    }

    const editId = document.getElementById("editCategoryId").value;
    const catId = (document.getElementById("catIdInput").value || "").trim().toLowerCase().replace(/\s+/g, "_");
    const name = document.getElementById("catName").value.trim();
    
    const textIdSelect = document.getElementById("catTextId");
    let textId = (textIdSelect?.value || "").trim();
    if (textId === "__custom__") {
        textId = (document.getElementById("catTextIdCustom")?.value || "").trim();
    }

    const descTextIdSelect = document.getElementById("catDescTextId");
    let descTextId = (descTextIdSelect?.value || "").trim();
    if (descTextId === "__custom__") {
        descTextId = (document.getElementById("catDescTextIdCustom")?.value || "").trim();
    }

    const image = document.getElementById("catImage").value.trim();
    const icon = document.getElementById("catIcon").value.trim() || "fa-solid fa-spa";
    const order = parseInt(document.getElementById("catOrder").value, 10) || 1;
    const description = document.getElementById("catDescription").value.trim();
    const isActive = document.getElementById("catIsActive").checked;

    if (!name) {
        alert("Vui lòng nhập tên danh mục!");
        return;
    }

    const cleanCatI18n = {};
    ['en', 'ja', 'ko', 'zh'].forEach(l => {
        if (editingCategoryI18n[l] && (editingCategoryI18n[l].name || editingCategoryI18n[l].description)) {
            cleanCatI18n[l] = {
                name: editingCategoryI18n[l].name || "",
                description: editingCategoryI18n[l].description || ""
            };
        }
    });

    const payload = {
        id: editId || catId,
        name,
        textId: textId || undefined,
        descTextId: descTextId || undefined,
        image,
        icon,
        order,
        description,
        i18n: Object.keys(cleanCatI18n).length > 0 ? cleanCatI18n : undefined,
        isActive,
        status: isActive ? "active" : "inactive"
    };

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const isEdit = !!editId;
    const url = isEdit ? `${API_BASE}/admin/categories/${editId}` : `${API_BASE}/admin/categories`;
    const method = isEdit ? "PUT" : "POST";
    const errBox = document.getElementById("categoryModalError");

    lockScreen(isEdit ? `Đang lưu cấu hình danh mục "${name}"...` : `Đang tạo mới danh mục "${name}"...`);
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
            await loadAdminCategories();
            if (typeof window !== "undefined" && typeof window.reloadCategoriesIfChanged === "function") {
                window.reloadCategoriesIfChanged(true).catch(() => {});
            }
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
    } finally {
        unlockScreen();
    }
}

export async function toggleCategory(catId, catName, currentActive) {
    const targetCat = (allAdminCategories || []).find(c => c.id === catId);
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

    lockScreen(`Đang ${actionText.toLowerCase()} danh mục "${displayName}"...`);
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/categories/${catId}/toggle`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminCategories();
            if (typeof window !== "undefined" && typeof window.reloadCategoriesIfChanged === "function") {
                window.reloadCategoriesIfChanged(true).catch(() => {});
            }
            if (typeof renderStorefrontCategories === "function") renderStorefrontCategories();
            if (typeof renderAllProducts === "function") renderAllProducts();
            notifyUser(`Đã ${actionText.toLowerCase()} danh mục "${displayName}" thành công!`, 'success');
        } else {
            notifyUser(`Lỗi cập nhật trạng thái: ${json.message || "Không xác định"}`, 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
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

    lockScreen(`Đang xóa danh mục "${catName}"...`);
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/categories/${catId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminCategories();
            if (typeof window !== "undefined" && typeof window.reloadCategoriesIfChanged === "function") {
                window.reloadCategoriesIfChanged(true).catch(() => {});
            }
            notifyUser("Đã chuyển danh mục sang trạng thái Đã Xóa thành công!", 'success');
        } else {
            notifyUser("Không thể xóa danh mục: " + (json.message || ""), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

export async function restoreCategory(catId, catName) {
    lockScreen(`Đang khôi phục danh mục "${catName || catId}"...`);
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/categories/${catId}/restore`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminCategories();
            if (typeof window !== "undefined" && typeof window.reloadCategoriesIfChanged === "function") {
                window.reloadCategoriesIfChanged(true).catch(() => {});
            }
            notifyUser(`Đã khôi phục danh mục "${catName || catId}" thành công!`, 'success');
        } else {
            notifyUser("Lỗi khôi phục danh mục: " + (json.message || ""), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

export async function moveCategory(catId, direction) {
    lockScreen("Đang cập nhật vị trí thứ tự danh mục...");
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
            await loadAdminCategories();
            if (typeof window !== "undefined" && typeof window.reloadCategoriesIfChanged === "function") {
                window.reloadCategoriesIfChanged(true).catch(() => {});
            }
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
    } finally {
        unlockScreen();
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

if (typeof window !== "undefined") {
    window.loadAdminCategories = loadAdminCategories;
    window.openCategoryModal = openCategoryModal;
    window.closeCategoryModal = closeCategoryModal;
    window.onCategoryTextIdChange = onCategoryTextIdChange;
    window.onCategoryDescTextIdChange = onCategoryDescTextIdChange;
    window.switchCategoryLangTab = switchCategoryLangTab;
    window.saveCurrentCatI18nDraft = saveCurrentCatI18nDraft;
    window.editCategory = editCategory;
    window.handleCategorySubmit = handleCategorySubmit;
    window.toggleCategory = toggleCategory;
    window.deleteCategory = deleteCategory;
    window.restoreCategory = restoreCategory;
    window.moveCategory = moveCategory;
    window.populateCategoryDropdowns = populateCategoryDropdowns;
}
