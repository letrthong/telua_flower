import { getAuthToken } from './auth.js';
import { API_BASE, showConfirmDialog, removeVietnameseTones } from './utils.js';
import { 
    lockScreen, 
    unlockScreen, 
    notifyUser, 
    allAdminProducts, 
    allAdminCategories, 
    allAdminBranches, 
    allAdminTranslations, 
    PRICE_LEVEL_CONFIG 
} from './portal_admin_state.js';
import { populateCategoryDropdowns } from './portal_admin_categories.js';

// ==========================================
// QUẢN LÝ SẢN PHẨM & PRICE GOVERNANCE
// ==========================================

export async function loadAdminProducts() {
    const searchInput = document.getElementById("searchProductInput");
    const categorySelect = document.getElementById("filterProductCategory");
    const statusSelect = document.getElementById("filterProductStatus");
    const search = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const category = categorySelect ? categorySelect.value : "";
    const status = statusSelect ? statusSelect.value : "";
    const tbody = document.getElementById("productsTableBody");
    if (!tbody) return;

    if (!allAdminProducts || allAdminProducts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-gray-400 font-medium"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải danh mục hoa tươi...</td></tr>`;
    }

    try {
        let url = `${API_BASE}/products`;
        if (category) url += `?category=${encodeURIComponent(category)}`;
        const res = await fetch(url);
        const json = await res.json();

        if (json.success && json.data) {
            allAdminProducts = json.data;
            if (typeof window !== "undefined") window.allAdminProducts = allAdminProducts;
            let displayProducts = allAdminProducts;
            if (status === "active") {
                displayProducts = displayProducts.filter(p => p && p.isActive !== false);
            } else if (status === "inactive") {
                displayProducts = displayProducts.filter(p => p && p.isActive === false);
            }
            if (search) {
                const normSearch = typeof removeVietnameseTones === 'function' ? removeVietnameseTones(search) : search;
                displayProducts = displayProducts.filter(p => {
                    if (!p) return false;
                    const name = (p.name || "").toLowerCase();
                    const id = (p.id || "").toLowerCase();
                    const comp = (p.flowerComposition || "").toLowerCase();
                    const desc = (p.description || "").toLowerCase();

                    const normName = typeof removeVietnameseTones === 'function' ? removeVietnameseTones(name) : name;
                    const normComp = typeof removeVietnameseTones === 'function' ? removeVietnameseTones(comp) : comp;
                    const normDesc = typeof removeVietnameseTones === 'function' ? removeVietnameseTones(desc) : desc;

                    return normName.includes(normSearch) || id.includes(search) || normComp.includes(normSearch) || normDesc.includes(normSearch);
                });
            }
            renderProductsTable(displayProducts);
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

let currentProductEditLang = "vi";
let editingProductI18n = {};

export function switchProductLangTab(lang) {
    saveCurrentProdI18nDraft();
    currentProductEditLang = lang;

    const langs = ["vi", "en", "ja", "ko", "zh"];
    langs.forEach(l => {
        const tabBtn = document.getElementById(`prodLangTab_${l}`);
        if (tabBtn) {
            if (l === lang) {
                tabBtn.className = "px-3 py-1.5 rounded-lg font-bold bg-white text-primary shadow-2xs border border-pink-200 whitespace-nowrap cursor-pointer";
            } else {
                tabBtn.className = "px-3 py-1.5 rounded-lg font-medium text-gray-600 hover:text-primary hover:bg-white transition whitespace-nowrap cursor-pointer";
            }
        }
    });

    const viBox = document.getElementById("prodFields_vi");
    const i18nBox = document.getElementById("prodFields_i18n");

    if (lang === "vi") {
        if (viBox) viBox.classList.remove("hidden");
        if (i18nBox) i18nBox.classList.add("hidden");
    } else {
        if (viBox) viBox.classList.add("hidden");
        if (i18nBox) i18nBox.classList.remove("hidden");

        const langLabels = {
            en: { name: "English (🇬🇧)", short: "English" },
            ja: { name: "日本語 (🇯🇵)", short: "Tiếng Nhật" },
            ko: { name: "한국어 (🇰🇷)", short: "Tiếng Hàn" },
            zh: { name: "中文 (🇨🇳)", short: "Tiếng Trung" }
        };
        const langInfo = langLabels[lang] || { name: lang, short: lang };

        const nameLabel = document.getElementById("prodI18nLangName");
        if (nameLabel) nameLabel.textContent = langInfo.name;

        document.querySelectorAll(".prodCurrentLangLabel").forEach(el => {
            el.textContent = langInfo.short;
        });

        // Điền dữ liệu từ editingProductI18n[lang]
        const lData = editingProductI18n[lang] || {};
        const nameInp = document.getElementById("prodI18nName");
        const compInp = document.getElementById("prodI18nComposition");
        const descInp = document.getElementById("prodI18nDescription");
        const careInp = document.getElementById("prodI18nCareTips");

        if (nameInp) nameInp.value = lData.name || "";
        if (compInp) compInp.value = lData.flowerComposition || "";
        if (descInp) descInp.value = lData.description || "";
        if (careInp) careInp.value = lData.careTips || "";
    }
}

export function saveCurrentProdI18nDraft() {
    if (currentProductEditLang === "vi") return;
    const l = currentProductEditLang;
    if (!editingProductI18n[l]) editingProductI18n[l] = {};

    const nameInp = document.getElementById("prodI18nName");
    const compInp = document.getElementById("prodI18nComposition");
    const descInp = document.getElementById("prodI18nDescription");
    const careInp = document.getElementById("prodI18nCareTips");

    if (nameInp) editingProductI18n[l].name = nameInp.value.trim();
    if (compInp) editingProductI18n[l].flowerComposition = compInp.value.trim();
    if (descInp) editingProductI18n[l].description = descInp.value.trim();
    if (careInp) editingProductI18n[l].careTips = careInp.value.trim();
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
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    if (statusLabel) {
        statusLabel.textContent = "⏳ Đang tải ảnh lên máy chủ...";
        statusLabel.className = "text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block";
    }

    try {
        // 1. Tải trực tiếp file ảnh lên API /admin/upload-image
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`${API_BASE}/admin/upload-image`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`
            },
            body: formData
        });

        const json = await res.json();
        if (res.ok && json.success && json.data?.url) {
            const uploadedUrl = json.data.url;
            if (inputStr) inputStr.value = uploadedUrl;
            if (previewImg) previewImg.src = uploadedUrl;

            if (statusLabel) {
                statusLabel.textContent = "🟢 Đã Lưu Vào Thư Mục Tĩnh";
                statusLabel.className = "text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md inline-block";
            }
            if (sizeInfo) {
                sizeInfo.textContent = `URL: ${uploadedUrl} (${(file.size / 1024).toFixed(1)} KB)`;
            }
            notifyUser(`Tải ảnh "${file.name}" lên thành công!`, "success");
        } else {
            // Fallback: Nén Base64 (phía backend sẽ tự động chuyển sang file vật lý khi submit)
            const base64String = await compressAndConvertToBase64(file, 800, 800, 0.82);
            if (inputStr) inputStr.value = base64String;
            if (previewImg) previewImg.src = base64String;
            if (statusLabel) {
                statusLabel.textContent = "🟡 Ảnh Base64 Tạm";
                statusLabel.className = "text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block";
            }
        }
    } catch (err) {
        // Fallback nén Base64
        try {
            const base64String = await compressAndConvertToBase64(file, 800, 800, 0.82);
            if (inputStr) inputStr.value = base64String;
            if (previewImg) previewImg.src = base64String;
            if (statusLabel) {
                statusLabel.textContent = "🟡 Ảnh Base64 Tạm";
                statusLabel.className = "text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block";
            }
        } catch (e2) {
            alert("Lỗi xử lý ảnh: " + err.message);
        }
    }
}

let editingProductGallery = [];

export function renderEditingProductGallery() {
    const container = document.getElementById("prodGalleryThumbnailsContainer");
    const countBadge = document.getElementById("prodGalleryCountBadge");
    if (!container) return;

    if (countBadge) {
        countBadge.textContent = `${editingProductGallery.length} ảnh`;
    }

    if (!editingProductGallery || editingProductGallery.length === 0) {
        container.innerHTML = `<span class="text-xs text-gray-400 italic">Chưa có ảnh phụ nào trong bộ sưu tập.</span>`;
        return;
    }

    let html = "";
    editingProductGallery.forEach((imgUrl, idx) => {
        const isBase64 = imgUrl.startsWith("data:image");
        const typeBadge = isBase64 ? "B64" : "URL";
        html += `
            <div class="relative group w-20 h-20 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0 shadow-2xs">
                <img src="${imgUrl}" alt="Gallery ${idx + 1}" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=200'">
                <span class="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-mono px-1 rounded">#${idx + 1} ${typeBadge}</span>
                <button type="button" onclick="removeProductGalleryImage(${idx})" title="Xóa ảnh này" class="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] shadow transition cursor-pointer">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
}

export function addProductGalleryImage(url) {
    const cleanUrl = (url || "").trim();
    if (!cleanUrl) return;
    editingProductGallery.push(cleanUrl);
    renderEditingProductGallery();
}

export function addProductGalleryImageFromInput() {
    const inp = document.getElementById("prodGalleryNewInput");
    if (!inp) return;
    const url = inp.value.trim();
    if (!url) {
        alert("Vui lòng nhập đường dẫn URL ảnh!");
        return;
    }
    addProductGalleryImage(url);
    inp.value = "";
}

export function removeProductGalleryImage(index) {
    if (index >= 0 && index < editingProductGallery.length) {
        editingProductGallery.splice(index, 1);
        renderEditingProductGallery();
    }
}

export async function handleGalleryFileUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen(`Đang tải ảnh phụ lên máy chủ: ${file.name}...`);
    try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`${API_BASE}/admin/upload-image`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData
        });

        const json = await res.json();
        if (res.ok && json.success && json.data?.url) {
            addProductGalleryImage(json.data.url);
            notifyUser(`Đã thêm ảnh "${file.name}" vào Gallery!`, "success");
        } else {
            const base64String = await compressAndConvertToBase64(file, 800, 800, 0.82);
            addProductGalleryImage(base64String);
            notifyUser(`Đã thêm ảnh "${file.name}" vào Gallery!`, "success");
        }
    } catch (err) {
        try {
            const base64String = await compressAndConvertToBase64(file, 800, 800, 0.82);
            addProductGalleryImage(base64String);
            notifyUser(`Đã thêm ảnh "${file.name}" vào Gallery!`, "success");
        } catch (e2) {
            alert("Lỗi xử lý ảnh gallery: " + err.message);
        }
    } finally {
        unlockScreen();
        if (event.target) event.target.value = "";
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

    editingProductI18n = {};
    editingProductGallery = [];
    switchProductLangTab("vi");
    renderEditingProductGallery();

    if (errBox) errBox.classList.add("hidden");
    if (fileInput) fileInput.value = "";

    // Nạp danh sách Text ID vào các SelectBox của Mẫu Hoa
    populateProductTextIdDropdowns(allAdminTranslations);

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

        // Reset các Text ID SelectBoxes
        ["name", "comp", "desc"].forEach(f => {
            const prefix = f === "name" ? "prodName" : (f === "comp" ? "prodComp" : "prodDesc");
            const sel = document.getElementById(`${prefix}TextId`);
            const customBox = document.getElementById(`${prefix}TextIdCustomContainer`);
            const customInp = document.getElementById(`${prefix}TextIdCustom`);
            if (sel) sel.value = "";
            if (customBox) customBox.classList.add("hidden");
            if (customInp) customInp.value = "";
        });
        renderProductModalStockFields({});
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

export function updateProductModalTotalQuota() {
    let total = 0;
    const inputs = document.querySelectorAll(".prod-branch-stock-input");
    inputs.forEach(inp => {
        total += Math.max(0, parseInt(inp.value, 10) || 0);
    });
    const badge = document.getElementById("prodTotalQuotaBadge");
    if (badge) badge.textContent = `Tổng Hạn Mức: ${total} cành/mẫu`;
}

export function renderProductModalStockFields(stockByBranch = {}) {
    const container = document.getElementById("productStockByBranchDynamicContainer");
    if (!container) return;

    const branches = (allAdminBranches && allAdminBranches.length > 0)
        ? allAdminBranches.filter(b => b.isActive !== false)
        : [
            { id: "branch_q10", name: "Showroom Q.10 (Flagship)", code: "CN_Q10" },
            { id: "branch_q1", name: "Showroom Bến Nghé Q.1", code: "CN_Q1" },
            { id: "branch_thao_dien", name: "Showroom Thảo Điền", code: "CN_Q2" }
        ];

    let html = "";
    branches.forEach(b => {
        const val = stockByBranch[b.id] ?? 10;
        const displayName = b.code ? `${b.code} - ${b.name.replace("Nở Hoa Thả Bình - Showroom ", "")}` : b.name;
        html += `
            <div class="bg-white p-2.5 rounded-xl border border-gray-200/80 shadow-2xs hover:border-pink-200 transition">
                <label class="block text-[11px] font-bold text-gray-700 mb-1 flex items-center justify-between">
                    <span class="truncate" title="${b.name}">${displayName}</span>
                    <span class="text-[9px] text-gray-400 font-semibold">Quota</span>
                </label>
                <div class="relative">
                    <input type="number" min="0" value="${val}" data-branch-id="${b.id}" class="prod-branch-stock-input w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-none focus:border-primary transition" oninput="updateProductModalTotalQuota()">
                    <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">cành</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    updateProductModalTotalQuota();
}

export function populateProductTextIdDropdowns(transDict) {
    const keys = Object.keys(transDict || {}).sort();
    
    const fillDropdown = (selectId, prefixFilter, defaultLabel) => {
        const select = document.getElementById(selectId);
        if (!select) return;

        const currentVal = select.value;
        const matchingKeys = keys.filter(k => k.startsWith(prefixFilter));
        const otherKeys = keys.filter(k => !k.startsWith(prefixFilter));

        let html = `<option value="">${defaultLabel}</option>`;
        
        if (matchingKeys.length > 0) {
            html += `<optgroup label="⭐ Khóa Đề Xuất (${prefixFilter}*)">`;
            matchingKeys.forEach(k => {
                const viText = (transDict[k]?.vi || "").slice(0, 30);
                html += `<option value="${k}">${k} — "${viText}"</option>`;
            });
            html += `</optgroup>`;
        }

        if (otherKeys.length > 0) {
            html += `<optgroup label="🔤 Toàn Bộ Text ID Khác">`;
            otherKeys.forEach(k => {
                const viText = (transDict[k]?.vi || "").slice(0, 30);
                html += `<option value="${k}">${k} — "${viText}"</option>`;
            });
            html += `</optgroup>`;
        }

        html += `<option value="__custom__">➕ Nhập mã Text ID tùy chỉnh khác...</option>`;
        select.innerHTML = html;
        if (currentVal) select.value = currentVal;
    };

    fillDropdown("prodNameTextId", "prod_name_", "-- Mặc định (Theo tên tiếng Việt) --");
    fillDropdown("prodCompTextId", "prod_comp_", "-- Mặc định (Theo text thành phần) --");
    fillDropdown("prodDescTextId", "prod_desc_", "-- Mặc định (Theo text mô tả) --");
}

export function onProductTextIdChange(field) {
    const prefix = field === "name" ? "prodName" : (field === "comp" ? "prodComp" : "prodDesc");
    const select = document.getElementById(`${prefix}TextId`);
    const container = document.getElementById(`${prefix}TextIdCustomContainer`);
    const customInput = document.getElementById(`${prefix}TextIdCustom`);
    if (!select || !container) return;

    if (select.value === "__custom__") {
        container.classList.remove("hidden");
        if (customInput) customInput.focus();
    } else {
        container.classList.add("hidden");
        if (customInput) customInput.value = "";
    }
}

export function closeProductModal() {
    const modal = document.getElementById("productModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export async function editProduct(productId) {
    let prod = (allAdminProducts || []).find((p) => p.id === productId);
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
    
    // Gán dữ liệu Text ID vào 3 SelectBox của Mẫu Hoa
    const setFieldTextId = (selectId, containerId, customId, targetKey) => {
        const select = document.getElementById(selectId);
        const container = document.getElementById(containerId);
        const customInput = document.getElementById(customId);
        if (!select) return;

        if (!targetKey) {
            select.value = "";
            if (container) container.classList.add("hidden");
            if (customInput) customInput.value = "";
            return;
        }

        const exists = Array.from(select.options).some(opt => opt.value === targetKey);
        if (exists) {
            select.value = targetKey;
            if (container) container.classList.add("hidden");
            if (customInput) customInput.value = "";
        } else {
            select.value = "__custom__";
            if (container) container.classList.remove("hidden");
            if (customInput) customInput.value = targetKey;
        }
    };

    setFieldTextId("prodNameTextId", "prodNameTextIdCustomContainer", "prodNameTextIdCustom", prod.nameTextId || prod.textId || "");
    setFieldTextId("prodCompTextId", "prodCompTextIdCustomContainer", "prodCompTextIdCustom", prod.compTextId || prod.compositionTextId || "");
    setFieldTextId("prodDescTextId", "prodDescTextIdCustomContainer", "prodDescTextIdCustom", prod.descTextId || prod.descriptionTextId || "");

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

    // Load gallery
    editingProductGallery = Array.isArray(prod.gallery) ? [...prod.gallery] : [];
    renderEditingProductGallery();

    document.getElementById("prodFlowerComposition").value = prod.flowerComposition || "";
    document.getElementById("prodBadge").value = prod.badge || "";
    document.getElementById("prodDimension").value = prod.dimension || "";
    document.getElementById("prodDescription").value = prod.description || "";
    document.getElementById("prodCareTips").value = prod.careTips || "";

    renderProductModalStockFields(prod.stockByBranch || {});

    if (title) title.textContent = `Chỉnh Sửa Mẫu Hoa: ${prod.name}`;
    editingProductI18n = JSON.parse(JSON.stringify(prod.i18n || {}));
    switchProductLangTab("vi");
}

export async function handleProductSubmit(event) {
    if (event) event.preventDefault();

    if (!validateLivePrice()) {
        alert("Giá bán không hợp lệ theo khung phân tầng! Vui lòng điều chỉnh lại.");
        return;
    }

    saveCurrentProdI18nDraft();

    const editId = document.getElementById("editProductId").value;
    const name = document.getElementById("prodName").value.trim();
    const category = document.getElementById("prodCategory").value;
    const priceLevelId = document.getElementById("prodPriceLevel").value;
    const priceNumber = parseInt(document.getElementById("prodPriceNumber").value, 10);
    const image = document.getElementById("prodImage").value.trim();
    const badge = document.getElementById("prodBadge") ? document.getElementById("prodBadge").value.trim() : "";
    const flowerComposition = document.getElementById("prodFlowerComposition") ? document.getElementById("prodFlowerComposition").value.trim() : "";
    const dimension = document.getElementById("prodDimension") ? document.getElementById("prodDimension").value.trim() : "";
    const description = document.getElementById("prodDescription") ? document.getElementById("prodDescription").value.trim() : "";
    const careTips = document.getElementById("prodCareTips") ? document.getElementById("prodCareTips").value.trim() : "";

    const getFinalProductTextId = (selectId, customId) => {
        const sel = document.getElementById(selectId);
        if (!sel) return undefined;
        if (sel.value === "__custom__") {
            const customVal = (document.getElementById(customId)?.value || "").trim().toLowerCase().replace(/\s+/g, "_");
            return customVal || undefined;
        }
        return sel.value ? sel.value.trim() : undefined;
    };

    const nameTextId = getFinalProductTextId("prodNameTextId", "prodNameTextIdCustom");
    const compTextId = getFinalProductTextId("prodCompTextId", "prodCompTextIdCustom");
    const descTextId = getFinalProductTextId("prodDescTextId", "prodDescTextIdCustom");

    const stockByBranch = {};
    const stockInputs = document.querySelectorAll(".prod-branch-stock-input");
    stockInputs.forEach(inp => {
        const bId = inp.getAttribute("data-branch-id");
        if (bId) {
            stockByBranch[bId] = Math.max(0, parseInt(inp.value, 10) || 0);
        }
    });
    if (Object.keys(stockByBranch).length === 0) {
        stockByBranch["branch_q10"] = 10;
        stockByBranch["branch_q1"] = 5;
        stockByBranch["branch_thao_dien"] = 5;
    }
    const dailyQuota = Object.values(stockByBranch).reduce((a, b) => a + b, 0);

    const payload = {
        name,
        nameTextId,
        category,
        priceLevelId,
        priceNumber,
        image,
        gallery: editingProductGallery,
        badge,
        flowerComposition,
        compTextId,
        dimension,
        description,
        descTextId,
        careTips,
        i18n: editingProductI18n,
        stockByBranch,
        dailyQuota
    };

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const method = editId ? "PUT" : "POST";
    const url = editId ? `${API_BASE}/admin/products/${editId}` : `${API_BASE}/admin/products`;

    const errBox = document.getElementById("productModalError");

    lockScreen(editId ? `Đang lưu cấu hình mẫu hoa "${name}"...` : `Đang tạo mẫu hoa mới "${name}"...`);
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
            await loadAdminProducts();
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
    } finally {
        unlockScreen();
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

    lockScreen(`Đang ${actionText.toLowerCase()} mẫu hoa "${displayName}"...`);
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/products/${productId}/toggle`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (res.ok && json.success) {
            await loadAdminProducts();
            if (typeof window !== 'undefined' && typeof window.renderAllProducts === 'function') {
                window.renderAllProducts();
            }
            notifyUser(`Đã ${actionText.toLowerCase()} mẫu hoa "${displayName}" thành công!`, 'success');
        } else {
            notifyUser("Lỗi đổi trạng thái: " + (json.message || "Không thể đổi trạng thái"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

if (typeof window !== "undefined") {
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
    window.populateProductTextIdDropdowns = populateProductTextIdDropdowns;
    window.onProductTextIdChange = onProductTextIdChange;
    window.switchProductLangTab = switchProductLangTab;
    window.saveCurrentProdI18nDraft = saveCurrentProdI18nDraft;
    window.renderEditingProductGallery = renderEditingProductGallery;
    window.addProductGalleryImage = addProductGalleryImage;
    window.addProductGalleryImageFromInput = addProductGalleryImageFromInput;
    window.removeProductGalleryImage = removeProductGalleryImage;
    window.handleGalleryFileUpload = handleGalleryFileUpload;
    window.updateProductModalTotalQuota = updateProductModalTotalQuota;
    window.renderProductModalStockFields = renderProductModalStockFields;
}
