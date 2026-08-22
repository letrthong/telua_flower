/**
 * Phân hệ Quản Trị Hệ Thống (TASK 07 - Admin Portal, Product CMS & Price Governance)
 */

const PRICE_LEVEL_CONFIG = {
    price_lvl_01: { name: "LV_01: Phổ Thông (Standard)", min: 300000, max: 550000 },
    price_lvl_02: { name: "LV_02: Cao Cấp (Premium)", min: 600000, max: 950000 },
    price_lvl_03: { name: "LV_03: Sang Trọng (Luxury)", min: 1000000, max: 2500000 },
    price_lvl_04: { name: "LV_04: Độc Bản VIP (Exclusive)", min: 2600000, max: 15000000 }
};

let allAdminProducts = [];
let allAdminPromotions = [];
let allAdminTranslations = {};

document.addEventListener("DOMContentLoaded", () => {
    // 1. Kiểm tra quyền truy cập (Route Guard)
    checkAdminAccess();

    // 2. Nạp dữ liệu ban đầu
    loadAdminProducts();
    onPriceLevelChange();
});

export function checkAdminAccess() {
    if (typeof getCurrentUser !== "function" || typeof getAuthToken !== "function") return;

    const user = getCurrentUser();
    const token = getAuthToken();

    if (!token || !user) {
        alert("Vui lòng đăng nhập bằng tài khoản Quản trị viên!");
        window.location.href = "/";
        return;
    }

    if (user.role !== "super_admin" && user.role !== "branch_manager") {
        alert("Bạn không có quyền truy cập trang quản trị này!");
        window.location.href = "/";
        return;
    }

    const nameEl = document.getElementById("adminUserName");
    const roleEl = document.getElementById("adminUserRole");
    if (nameEl) nameEl.textContent = user.fullName || "Quản trị viên";
    if (roleEl) roleEl.textContent = user.role;
}

export function switchAdminTab(tabName) {
    const tabs = ["products", "promotions", "translations"];
    tabs.forEach((t) => {
        const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const content = document.getElementById(`tabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (btn && content) {
            if (t === tabName) {
                btn.className = "py-3 font-bold text-sm border-b-2 border-primary text-primary transition flex items-center";
                content.classList.remove("hidden");
            } else {
                btn.className = "py-3 font-bold text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition flex items-center";
                content.classList.add("hidden");
            }
        }
    });

    if (tabName === "promotions") loadAdminPromotions();
    if (tabName === "translations") loadAdminTranslations();
}

// ==========================================
// QUẢN LÝ SẢN PHẨM & PRICE GOVERNANCE
// ==========================================

export async function loadAdminProducts() {
    const categorySelect = document.getElementById("filterProductCategory");
    const category = categorySelect ? categorySelect.value : "";
    const tbody = document.getElementById("productsTableBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-gray-400">Đang tải danh mục hoa tươi...</td></tr>`;

    try {
        let url = "/api/products";
        if (category) url += `?category=${category}`;
        const res = await fetch(url);
        const json = await res.json();

        if (json.success && json.data) {
            allAdminProducts = json.data;
            renderProductsTable(allAdminProducts);
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-red-500 font-bold">Lỗi tải sản phẩm: ${e.message}</td></tr>`;
    }
}

function renderProductsTable(products) {
    const tbody = document.getElementById("productsTableBody");
    if (!tbody) return;

    if (products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-gray-400 font-medium">Không tìm thấy sản phẩm nào trong danh mục này.</td></tr>`;
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
                    Q10: <b class="text-gray-900">${stockQ10}</b> • Q1: <b class="text-gray-900">${stockQ10}</b> • TD: <b class="text-gray-900">${stockTD}</b>
                </td>
                <td class="p-4">${activeBadge}</td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center space-x-2">
                        <button onclick="editProduct('${p.id}')" title="Chỉnh sửa mẫu hoa" class="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition">
                            <i class="fa-solid fa-pen-to-square text-xs"></i>
                        </button>
                        <button onclick="toggleProduct('${p.id}')" title="${p.isActive !== false ? 'Ẩn mẫu hoa' : 'Hiện mẫu hoa'}" class="w-7 h-7 rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-600 flex items-center justify-center transition">
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

export function openProductModal(isEdit = false) {
    const modal = document.getElementById("productModal");
    const title = document.getElementById("productModalTitle");
    const form = document.getElementById("productForm");
    const errBox = document.getElementById("productModalError");
    if (!modal) return;

    if (errBox) errBox.classList.add("hidden");
    if (!isEdit && form) {
        form.reset();
        document.getElementById("editProductId").value = "";
        if (title) title.textContent = "Thêm Mẫu Hoa Mới Vào Catalogue";
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

export function editProduct(productId) {
    const prod = allAdminProducts.find((p) => p.id === productId);
    if (!prod) return;

    document.getElementById("editProductId").value = prod.id;
    document.getElementById("prodName").value = prod.name || "";
    document.getElementById("prodCategory").value = prod.category || "bo_hoa";
    document.getElementById("prodPriceLevel").value = prod.priceLevelId || "price_lvl_01";
    document.getElementById("prodPriceNumber").value = prod.priceNumber || 420000;
    document.getElementById("prodImage").value = prod.image || "";
    document.getElementById("prodFlowerComposition").value = prod.flowerComposition || "";
    document.getElementById("prodStockQ10").value = prod.stockByBranch?.branch_q10 ?? 10;
    document.getElementById("prodStockQ1").value = prod.stockByBranch?.branch_q1 ?? 5;
    document.getElementById("prodStockTD").value = prod.stockByBranch?.branch_thao_dien ?? 5;

    const title = document.getElementById("productModalTitle");
    if (title) title.textContent = `Chỉnh Sửa Mẫu Hoa: ${prod.name}`;

    openProductModal(true);
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
    const url = editId ? `/api/admin/products/${editId}` : "/api/admin/products";

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
        } else {
            if (errBox) {
                errBox.textContent = json.message || "Lỗi lưu sản phẩm";
                errBox.classList.remove("hidden");
            }
        }
    } catch (e) {
        if (errBox) {
            errBox.textContent = "Lỗi kết nối máy chủ: " + e.message;
            errBox.classList.remove("hidden");
        }
    }
}

export async function toggleProduct(productId) {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`/api/admin/products/${productId}/toggle`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) loadAdminProducts();
    } catch (e) {
        alert("Lỗi đổi trạng thái: " + e.message);
    }
}

// ==========================================
// QUẢN LÝ KHUYẾN MÃI (PROMOTIONS)
// ==========================================

export async function loadAdminPromotions() {
    const grid = document.getElementById("promotionsGrid");
    if (!grid) return;

    try {
        const res = await fetch("/api/promotions");
        const json = await res.json();
        if (json.success && json.data) {
            allAdminPromotions = json.data;
            let html = "";
            allAdminPromotions.forEach((p) => {
                const isChecked = p.isActive !== false ? "checked" : "";
                html += `
                    <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
                        <div class="flex justify-between items-start">
                            <div>
                                <span class="bg-pink-100 text-primary font-extrabold text-xs px-2.5 py-1 rounded-lg">${p.code}</span>
                                <h4 class="font-bold text-gray-800 text-sm mt-2">${p.title}</h4>
                            </div>
                            <label class="inline-flex items-center cursor-pointer">
                                <input type="checkbox" onchange="togglePromo('${p.id}')" ${isChecked} class="sr-only peer">
                                <div class="relative w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                        </div>
                        <div class="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-100">
                            <div>Giảm: <b class="text-primary font-bold">${p.discountType === 'percentage' ? p.discountValue + '%' : p.discountValue.toLocaleString() + '₫'}</b></div>
                            <div>Đơn tối thiểu: <b>${p.minOrderAmount?.toLocaleString()}₫</b></div>
                            <div>Giới hạn: <b>${p.usedCount || 0}/${p.usageLimit || 500} lượt</b></div>
                        </div>
                    </div>
                `;
            });
            grid.innerHTML = html;
        }
    } catch (e) {
        grid.innerHTML = `<p class="text-red-500 text-xs">Lỗi tải khuyến mãi: ${e.message}</p>`;
    }
}

export async function togglePromo(promoId) {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        await fetch(`/api/admin/promotions/${promoId}/toggle`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
        });
        loadAdminPromotions();
    } catch (e) {
        alert("Lỗi: " + e.message);
    }
}

// ==========================================
// BIÊN DỊCH ĐA NGÔN NGỮ ĐỘNG (i18n Matrix)
// ==========================================

export async function loadAdminTranslations() {
    const tbody = document.getElementById("translationsTableBody");
    if (!tbody) return;

    try {
        const res = await fetch("/api/translations");
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
        const res = await fetch("/api/admin/translations", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(updatedDict)
        });

        const json = await res.json();
        if (res.ok && json.success) {
            alert("🎉 Đã lưu toàn bộ bản dịch 5 ngôn ngữ thành công!");
        } else {
            alert("Lỗi lưu bản dịch: " + (json.message || "Không xác định"));
        }
    } catch (e) {
        alert("Lỗi kết nối máy chủ: " + e.message);
    }
}

// Global binding
if (typeof window !== "undefined") {
    window.switchAdminTab = switchAdminTab;
    window.loadAdminProducts = loadAdminProducts;
    window.openProductModal = openProductModal;
    window.closeProductModal = closeProductModal;
    window.editProduct = editProduct;
    window.handleProductSubmit = handleProductSubmit;
    window.toggleProduct = toggleProduct;
    window.onPriceLevelChange = onPriceLevelChange;
    window.validateLivePrice = validateLivePrice;
    window.togglePromo = togglePromo;
    window.filterTranslations = filterTranslations;
    window.saveAllTranslations = saveAllTranslations;
}
