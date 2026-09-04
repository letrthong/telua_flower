import { API_BASE } from './utils.js';
import { getProducts, getProductById, getCategories } from './products.js';
import { translations, setLanguage, fetchAndSyncTranslations } from './i18n.js';
import { addToCart } from './checkout.js';

// Cache sản phẩm toàn cục cho Storefront
let allStorefrontProducts = [];
let activeStorefrontCategories = [];

// Gắn các hàm tiện ích vào window cho toàn bộ trang
if (typeof window !== 'undefined') {
    window.translations = translations;
    window.setLanguage = setLanguage;
    window.addToCart = addToCart;
    window.getProducts = getProducts;
    window.getProductById = getProductById;
    window.getCategories = getCategories;
}

/**
 * Lấy tên hiển thị sản phẩm theo ngôn ngữ hiện tại
 */
export function getProductName(prod) {
    if (!prod) return "";
    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    
    // 1. Ưu tiên đọc từ khối i18n bên trong chính sản phẩm (Modular i18n Architecture)
    if (prod.i18n && prod.i18n[lang] && prod.i18n[lang].name) {
        return prod.i18n[lang].name;
    }

    // 2. Fallback đọc theo Text ID từ từ điển chung
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const textId = prod.nameTextId || prod.textId;
    if (textId && trans && trans[lang] && trans[lang][textId]) {
        return trans[lang][textId];
    }
    return prod.name || "";
}

/**
 * Lấy thành phần hoa theo ngôn ngữ hiện tại
 */
export function getProductComposition(prod) {
    if (!prod) return "";
    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    
    // 1. Ưu tiên đọc từ khối i18n bên trong chính sản phẩm
    if (prod.i18n && prod.i18n[lang] && prod.i18n[lang].flowerComposition) {
        return prod.i18n[lang].flowerComposition;
    }

    // 2. Fallback đọc theo Text ID từ từ điển chung
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const textId = prod.compTextId || prod.compositionTextId;
    if (textId && trans && trans[lang] && trans[lang][textId]) {
        return trans[lang][textId];
    }
    return prod.flowerComposition || prod.composition || "";
}

/**
 * Lấy mô tả cảm xúc theo ngôn ngữ hiện tại
 */
export function getProductDescription(prod) {
    if (!prod) return "";
    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    
    // 1. Ưu tiên đọc từ khối i18n bên trong chính sản phẩm
    if (prod.i18n && prod.i18n[lang] && prod.i18n[lang].description) {
        return prod.i18n[lang].description;
    }

    // 2. Fallback đọc theo Text ID từ từ điển chung
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const textId = prod.descTextId || prod.descriptionTextId;
    if (textId && trans && trans[lang] && trans[lang][textId]) {
        return trans[lang][textId];
    }
    return prod.description || "";
}

/**
 * Lấy hướng dẫn chăm sóc theo ngôn ngữ hiện tại
 */
export function getProductCareTips(prod) {
    if (!prod) return "";
    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    if (prod.i18n && prod.i18n[lang] && prod.i18n[lang].careTips) {
        return prod.i18n[lang].careTips;
    }
    return prod.careTips || "";
}

/**
 * Lấy nhãn nổi bật (Badge) sản phẩm tự động dịch theo ngôn ngữ hiện tại
 */
export function getProductBadge(prod) {
    if (!prod || !prod.badge) return "";
    const rawBadge = (prod.badge || "").trim();
    if (!rawBadge) return "";

    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[lang]) ? trans[lang] : {};

    const lower = rawBadge.toLowerCase();
    if (lower === "mới" || lower === "moi" || lower === "new") {
        return dict.badge_new || (lang === "en" ? "New" : (lang === "ja" ? "新着" : (lang === "ko" ? "신상품" : (lang === "zh" ? "新品" : "Mới"))));
    }
    if (lower === "bán chạy" || lower === "ban chay" || lower === "best seller") {
        return dict.badge_best_seller || (lang === "en" ? "Best Seller" : (lang === "ja" ? "人気" : (lang === "ko" ? "베스트" : (lang === "zh" ? "畅销" : "Bán chạy"))));
    }
    if (lower === "hot") {
        return dict.badge_hot || (lang === "en" ? "Hot" : (lang === "ja" ? "おすすめ" : (lang === "ko" ? "인기" : (lang === "zh" ? "热门" : "Hot"))));
    }
    if (lower === "mẫu mới" || lower === "mau moi" || lower === "new arrival") {
        return dict.badge_model_new || (lang === "en" ? "New Arrival" : (lang === "ja" ? "新着アイテム" : (lang === "ko" ? "신규 디자인" : (lang === "zh" ? "最新款式" : "Mẫu Mới"))));
    }
    if (lower.includes("độc bản") || lower.includes("vip") || lower.includes("exclusive")) {
        return dict.badge_vip || (lang === "en" ? "VIP Exclusive" : (lang === "ja" ? "VIP限定" : (lang === "ko" ? "VIP 독점" : (lang === "zh" ? "VIP尊享" : rawBadge))));
    }
    return rawBadge;
}

/**
 * 1. Hàm Render sản phẩm HTML (Tối ưu Lazy Loading & i18n)
 */
export function renderProducts(products, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!Array.isArray(products) || products.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-8 text-center text-gray-400 text-sm">
                <i class="fa-solid fa-seedling text-2xl mb-2 text-pink-300"></i>
                <p>Danh mục này đang được cập nhật thêm các mẫu hoa mới.</p>
            </div>
        `;
        return;
    }

    let html = '';
    const lang = (typeof window !== 'undefined' && window.currentLang) ? window.currentLang : 'vi';
    const trans = (typeof window !== 'undefined' && window.translations) ? window.translations : translations;
    const btnText = (trans && trans[lang] && trans[lang].btn_add_to_cart) ? trans[lang].btn_add_to_cart : "Thêm giỏ hàng";

    products.forEach(product => {
        const origPrice = product.originalPrice || `${(product.priceNumber || 420000).toLocaleString()}₫`;
        const salePrice = product.salePrice || `${(product.priceNumber || 420000).toLocaleString()}₫`;
        const hasDiscount = origPrice !== salePrice;

        const displayBadge = getProductBadge(product);
        const badgeHtml = displayBadge
            ? `<span class="absolute top-2 left-2 bg-accent text-white text-xs font-bold px-2 py-1 rounded shadow-sm z-10">${displayBadge}</span>`
            : '';
        const priceHtml = hasDiscount
            ? `<span class="text-gray-400 line-through text-xs md:text-sm mr-2">${origPrice}</span>
               <span class="text-primary font-bold text-sm md:text-base">${salePrice}</span>`
            : `<span class="text-primary font-bold text-sm md:text-base">${salePrice}</span>`;

        const numericPrice = product.priceNumber || parseInt(salePrice.replace(/[^\d]/g, ''), 10) || 420000;
        const prodDisplayName = getProductName(product);
        const safeName = (prodDisplayName || product.name || "").replace(/'/g, "\\'");
        const prodId = product.id || `prod_${(product.name || 'hoa').toLowerCase().replace(/\s+/g, '_')}`;
        const prodImg = product.image || "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500";
        const nameTextId = product.nameTextId || product.textId || "";

        html += `
            <div class="product-card bg-white rounded-xl shadow-sm hover:shadow-xl transition duration-300 overflow-hidden flex flex-col group relative border border-gray-100">
                ${badgeHtml}
                <div onclick="openProductQuickDetail('${prodId}')" class="relative h-48 md:h-64 overflow-hidden cursor-pointer">
                    <img src="${prodImg}" alt="${prodDisplayName}" loading="lazy" decoding="async" onload="this.classList.add('loaded')" onerror="handleImageErrorFallback(this)" class="product-img w-full h-full object-cover group-hover:scale-105 transition duration-500">
                    
                    <!-- Nút Thêm vào giỏ hàng (Hiển thị khi hover) -->
                    <div class="absolute inset-0 bg-black/30 flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4" onclick="event.stopPropagation()">
                        <button onclick="addToCart('${prodId}', '${safeName}', ${numericPrice}, '${prodImg}')" class="bg-primary hover:bg-primaryHover text-white w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-md flex items-center justify-center">
                            <i class="fa-solid fa-cart-plus mr-1.5"></i> <span data-i18n="btn_add_to_cart">${btnText}</span>
                        </button>
                    </div>
                </div>
                <div class="p-4 flex flex-col flex-grow text-center">
                    <h3 onclick="openProductQuickDetail('${prodId}')" ${nameTextId ? `data-i18n="${nameTextId}"` : ''} class="font-bold text-gray-800 text-sm md:text-base mb-2 flex-grow hover:text-primary cursor-pointer line-clamp-2">${prodDisplayName}</h3>
                    <div class="mt-auto">
                        ${priceHtml}
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

let currentOpenDetailProductId = null;

/**
 * Đổ dữ liệu sản phẩm vào Modal Chi Tiết Nhanh
 */
export function populateProductDetailModalContent(prod, currentAppLang, productId) {
    const modal = document.getElementById("productQuickDetailModal");
    const spinner = document.getElementById("detailLoadingSpinner");
    const body = document.getElementById("detailContentBody");
    if (!modal || !prod) return;

    const numericPrice = prod.priceNumber || parseInt((prod.salePrice || "420000").replace(/[^\d]/g, ''), 10) || 420000;
    const prodDisplayName = getProductName(prod);
    const prodCompText = getProductComposition(prod);
    const prodDescText = getProductDescription(prod);
    const prodCareTipsText = getProductCareTips(prod);
    const safeName = (prodDisplayName || prod.name || "").replace(/'/g, "\\'");
    const prodImg = prod.image || "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500";

    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[currentAppLang]) ? trans[currentAppLang] : {};

    // Cập nhật lại toàn bộ nhãn tĩnh đa ngôn ngữ trong modal
    modal.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            el.innerHTML = dict[key];
        }
    });

    // Điền thông tin vào modal
    const nameEl = document.getElementById("detailProdName");
    if (nameEl) {
        nameEl.textContent = prodDisplayName;
        if (prod.nameTextId) nameEl.setAttribute("data-i18n", prod.nameTextId);
        else nameEl.removeAttribute("data-i18n");
    }

    const badgeEl = document.getElementById("detailBadge");
    if (badgeEl) badgeEl.textContent = getProductBadge(prod) || dict.badge_model_new || dict.prod_badge_new || "Mẫu Mới";

    const salePriceEl = document.getElementById("detailSalePrice");
    if (salePriceEl) salePriceEl.textContent = prod.salePrice || `${numericPrice.toLocaleString()}₫`;

    const origPriceEl = document.getElementById("detailOrigPrice");
    if (origPriceEl) origPriceEl.textContent = prod.originalPrice && prod.originalPrice !== prod.salePrice ? prod.originalPrice : "";

    const catLabelEl = document.getElementById("detailCategoryLabel");
    if (catLabelEl) {
        const catObj = (activeStorefrontCategories || []).find(c => c && c.id === prod.category);
        catLabelEl.textContent = catObj ? getCategoryDisplayName(catObj).toUpperCase() : (prod.category ? prod.category.toUpperCase().replace("_", " ") : "HOA TƯƠI CAO CẤP");
    }

    const descEl = document.getElementById("detailDescription");
    if (descEl) {
        descEl.textContent = prodDescText || dict.prod_desc_fallback || "Mẫu hoa tươi thiết kế độc quyền tại Nở Hoa Thả Bình với sự kết hợp hài hòa giữa màu sắc và hương thơm.";
        if (prod.descTextId) descEl.setAttribute("data-i18n", prod.descTextId);
        else descEl.removeAttribute("data-i18n");
    }

    const compEl = document.getElementById("detailComposition");
    if (compEl) {
        compEl.textContent = prodCompText || dict.prod_comp_fallback || "Hoa tươi tự nhiên chọn lọc loại 1, giấy gói cao cấp chuẩn showroom.";
        if (prod.compTextId) compEl.setAttribute("data-i18n", prod.compTextId);
        else compEl.removeAttribute("data-i18n");
    }

    const dimEl = document.getElementById("detailDimension");
    if (dimEl) dimEl.textContent = prod.dimension || dict.prod_dim_standard || "Kích thước tiêu chuẩn";

    const careEl = document.getElementById("detailCareTips");
    if (careEl) careEl.textContent = prodCareTipsText || dict.prod_care_default || "Cắt vát gốc 45 độ, phun sương nhẹ cánh hoa và giữ nước sạch mỗi ngày.";

    const mainImgEl = document.getElementById("detailMainImg");
    if (mainImgEl) {
        if (mainImgEl.parentElement) mainImgEl.parentElement.classList.add('img-skeleton');
        mainImgEl.classList.remove('loaded');
        mainImgEl.src = prodImg;
        mainImgEl.alt = prodDisplayName;
    }

    // Gallery thumbnails (với Lazy loading và Skeleton preview)
    const galleryContainer = document.getElementById("detailGalleryThumbnails");
    if (galleryContainer) {
        const galleryList = Array.isArray(prod.gallery) && prod.gallery.length > 0 ? prod.gallery : [prodImg];
        let galHtml = '';
        galleryList.forEach(imgUrl => {
            galHtml += `
                <div onclick="const mImg=document.getElementById('detailMainImg'); if(mImg){mImg.parentElement?.classList.add('img-skeleton'); mImg.classList.remove('loaded'); mImg.src='${imgUrl}';}" class="w-12 h-12 rounded-lg overflow-hidden border-2 border-gray-200 cursor-pointer hover:border-primary flex-shrink-0 transition img-skeleton">
                    <img src="${imgUrl}" loading="lazy" decoding="async" onload="this.classList.add('loaded'); this.parentElement?.classList.remove('img-skeleton');" onerror="handleImageErrorFallback(this)" class="w-full h-full object-cover">
                </div>
            `;
        });
        galleryContainer.innerHTML = galHtml;
    }

    // Render Add-Ons (sản phẩm kèm theo) trong modal
    renderAddonsInModal(currentAppLang);

    // Gắn sự kiện nút Thêm Giỏ Hàng (kèm các add-on đã chọn)
    const btnAdd = document.getElementById("btnQuickAddToCart");
    if (btnAdd) {
        btnAdd.onclick = () => {
            if (typeof addToCart === "function") {
                addToCart(prod.id || productId, safeName, numericPrice, prodImg);
                // Thêm từng add-on đã chọn vào giỏ hàng
                const selected = getSelectedAddons();
                selected.forEach(addon => {
                    if (typeof addToCart === "function") {
                        addToCart(addon.id, getAddonName(addon, currentAppLang), addon.price, addon.image, "addon");
                    }
                });
                clearSelectedAddons();
            }
            closeProductQuickDetail();
        };
    }

    if (spinner) spinner.classList.add("hidden");
    if (body) body.classList.remove("hidden");
}

// ================= ADD-ONS (SẢN PHẨM KÈM THEO) =================
let cachedAddons = null;
let cachedAddonVisible = null; // null = chưa tải; true/false = cấu hình showAddons
let selectedAddons = new Map(); // addonId -> { addon, quantity }

/**
 * Kiểm tra cấu hình bật/tắt hiển thị khu vực add-on (config/anne/addonConfig.json).
 * Mặc định hiển thị nếu lỗi tải cấu hình.
 */
export async function isAddonSectionEnabled(forceRefresh = false) {
    if (cachedAddonVisible !== null && !forceRefresh) return cachedAddonVisible;
    try {
        const res = await fetch(`${API_BASE}/addon-config`);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        const cfg = (data && data.data) ? data.data : data;
        cachedAddonVisible = cfg && typeof cfg.showAddons === "boolean" ? cfg.showAddons : true;
    } catch (err) {
        console.warn("[ADDONS] Lỗi tải addon-config, mặc định hiển thị:", err);
        cachedAddonVisible = true;
    }
    return cachedAddonVisible;
}

/**
 * Lấy danh sách add-ons đang hoạt động từ API (có cache)
 */
export async function loadAddons(forceRefresh = false) {
    console.debug("[ADDONS] loadAddons() gọi, forceRefresh =", forceRefresh, "| cachedAddons =", cachedAddons);
    if (cachedAddons && !forceRefresh) {
        console.debug("[ADDONS] Dùng cache:", cachedAddons.length, "add-ons");
        return cachedAddons;
    }
    try {
        console.debug("[ADDONS] Fetch:", `${API_BASE}/addons`);
        const res = await fetch(`${API_BASE}/addons`);
        console.debug("[ADDONS] HTTP status:", res.status);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        // Endpoint trả về { success, data: [...] }
        cachedAddons = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : (data.addons || []));
        console.debug("[ADDONS] Đã parse:", cachedAddons.length, "add-ons");
        cachedAddons.forEach(a => console.debug("[ADDONS]   -", a.id, "| image:", a.image));
    } catch (err) {
        console.warn("[ADDONS] Lỗi tải add-ons:", err);
        cachedAddons = cachedAddons || [];
    }
    return cachedAddons;
}

/**
 * Lấy tên hiển thị add-on theo ngôn ngữ hiện tại (hỗ trợ 5 ngôn ngữ: vi, en, ja, ko, zh)
 */
export function getAddonName(addon, lang = "vi") {
    if (!addon) return "";
    const effectiveLang = lang || (typeof window !== "undefined" && window.currentLang) || "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[effectiveLang]) ? trans[effectiveLang] : {};

    // 1. Kiểm tra từ điển dịch translation matrix (key addon_{id}_name)
    const transKey = `addon_${addon.id}_name`;
    if (dict[transKey]) return dict[transKey];

    // 2. Kiểm tra thuộc tính ngôn ngữ trực tiếp trên addon object
    if (effectiveLang === "vi") return addon.nameVi || addon.name || "";
    if (effectiveLang === "en") return addon.nameEn || addon.name || addon.nameVi || "";
    if (effectiveLang === "ja") return addon.nameJa || addon.nameEn || addon.name || addon.nameVi || "";
    if (effectiveLang === "ko") return addon.nameKo || addon.nameEn || addon.name || addon.nameVi || "";
    if (effectiveLang === "zh") return addon.nameZh || addon.nameEn || addon.name || addon.nameVi || "";

    return addon.nameVi || addon.name || "";
}

/**
 * Render danh sách add-ons vào #addonsList trong modal chi tiết sản phẩm
 */
export async function renderAddonsInModal(currentAppLang) {
    const section = document.getElementById("addonsSection");
    const list = document.getElementById("addonsList");
    console.debug("[ADDONS] renderAddonsInModal() | section =", !!section, "| list =", !!list);
    if (!section || !list) return;

    const effectiveLang = currentAppLang || (typeof window !== "undefined" && window.currentLang) || "vi";

    // Cập nhật tiêu đề đa ngôn ngữ cho mục add-on (Select Add-Ons To Make It Extra Special)
    const titleEl = section.querySelector('[data-i18n="addons_title"]');
    if (titleEl) {
        const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
        const dict = (trans && trans[effectiveLang]) ? trans[effectiveLang] : {};
        if (dict.addons_title) {
            titleEl.textContent = dict.addons_title;
        }
    }

    // Kiểm tra cấu hình bật/tắt hiển thị add-on trước
    const enabled = await isAddonSectionEnabled();
    if (!enabled) {
        console.debug("[ADDONS] showAddons=false -> ẩn section theo cấu hình");
        section.classList.add("hidden");
        list.innerHTML = "";
        return;
    }

    const addons = await loadAddons();
    console.debug("[ADDONS] Số add-ons nhận được:", Array.isArray(addons) ? addons.length : "KHÔNG PHẢI MẢNG");
    if (!Array.isArray(addons) || addons.length === 0) {
        console.debug("[ADDONS] Không có add-ons -> ẩn section");
        section.classList.add("hidden");
        list.innerHTML = "";
        return;
    }

    section.classList.remove("hidden");
    let html = "";
    addons.forEach(addon => {
        const sel = selectedAddons.get(addon.id);
        const qty = sel ? sel.quantity : 0;
        const isSelected = qty > 0;
        const name = getAddonName(addon, currentAppLang);
        const price = (Number(addon.price) || 0).toLocaleString("vi-VN");
        const img = addon.image || "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=200";
        html += `
            <div data-addon-id="${addon.id}"
                 class="addon-card relative border-2 rounded-xl overflow-hidden cursor-pointer transition select-none flex-shrink-0 w-28 ${isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'}">
                <div class="relative" onclick="toggleAddonSelection('${addon.id}')">
                    <img src="${img}" alt="${name}" loading="lazy" decoding="async"
                         onload="this.classList.add('loaded')"
                         onerror="handleImageErrorFallback(this)"
                         class="w-full h-20 object-cover">
                    <div class="addon-check absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] ${isSelected ? 'bg-primary border-primary text-white' : 'bg-white border-gray-300 text-transparent'}">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </div>
                <div class="p-2">
                    <div class="text-[11px] font-bold text-gray-800 leading-tight line-clamp-2">${name}</div>
                    <div class="text-[11px] font-bold text-accent mt-0.5">${price}₫</div>
                    <div class="addon-qty-control mt-1.5 flex items-center justify-between ${isSelected ? '' : 'hidden'}">
                        <button type="button" onclick="event.stopPropagation(); changeAddonQty('${addon.id}', -1)" class="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center transition">−</button>
                        <span class="addon-qty text-xs font-bold text-gray-800">${qty}</span>
                        <button type="button" onclick="event.stopPropagation(); changeAddonQty('${addon.id}', 1)" class="w-6 h-6 rounded-full bg-primary hover:bg-primaryHover text-white font-bold text-sm flex items-center justify-center transition">+</button>
                    </div>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
    console.debug("[ADDONS] Đã render", addons.length, "thẻ add-on vào #addonsList");
    console.debug("[ADDONS] #addonsList innerHTML dài:", list.innerHTML.length, "ký tự");
    console.debug("[ADDONS] #addonsSection class:", section.className);

    // Cập nhật trạng thái bật/tắt nút prev/next theo độ tràn khung
    list.onscroll = updateAddonNavButtons;
    requestAnimationFrame(updateAddonNavButtons);
    setTimeout(updateAddonNavButtons, 120);
}

/**
 * Bật/tắt nút prev/next: chỉ bật khi danh sách add-on tràn khung (nhiều sản phẩm).
 */
export function updateAddonNavButtons() {
    const list = document.getElementById("addonsList");
    const prevBtn = document.getElementById("addonPrevBtn");
    const nextBtn = document.getElementById("addonNextBtn");
    if (!list) return;
    const hasOverflow = list.scrollWidth > list.clientWidth + 4;
    const atStart = list.scrollLeft <= 2;
    const atEnd = list.scrollLeft + list.clientWidth >= list.scrollWidth - 2;
    if (prevBtn) prevBtn.disabled = !hasOverflow || atStart;
    if (nextBtn) nextBtn.disabled = !hasOverflow || atEnd;
}

/**
 * Cuộn ngang danh sách add-ons (prev/next)
 */
export function scrollAddons(direction) {
    const list = document.getElementById("addonsList");
    if (!list) return;
    const cardWidth = 112 + 8; // w-28 (112px) + gap-2 (8px)
    list.scrollBy({ left: direction * cardWidth * 2, behavior: "smooth" });
    setTimeout(updateAddonNavButtons, 350);
}

/**
 * Chọn / bỏ chọn một add-on (bấm vào thẻ)
 */
export function toggleAddonSelection(addonId) {
    const addon = (cachedAddons || []).find(a => a && a.id === addonId);
    if (!addon) return;
    if (selectedAddons.has(addonId)) {
        selectedAddons.delete(addonId);
    } else {
        selectedAddons.set(addonId, { addon, quantity: 1 });
    }
    updateAddonCardUI(addonId);
}

/**
 * Tăng / giảm số lượng add-on
 */
export function changeAddonQty(addonId, delta) {
    const addon = (cachedAddons || []).find(a => a && a.id === addonId);
    if (!addon) return;
    const sel = selectedAddons.get(addonId);
    const newQty = (sel ? sel.quantity : 0) + delta;
    if (newQty <= 0) {
        selectedAddons.delete(addonId);
    } else {
        selectedAddons.set(addonId, { addon, quantity: newQty });
    }
    updateAddonCardUI(addonId);
}

/**
 * Cập nhật giao diện của một thẻ add-on theo trạng thái chọn hiện tại
 */
function updateAddonCardUI(addonId) {
    const card = document.querySelector(`[data-addon-id="${addonId}"]`);
    if (!card) return;
    const sel = selectedAddons.get(addonId);
    const isSelected = !!sel && sel.quantity > 0;
    const qty = sel ? sel.quantity : 0;

    card.classList.toggle("border-primary", isSelected);
    card.classList.toggle("bg-primary/5", isSelected);
    card.classList.toggle("border-gray-200", !isSelected);
    card.classList.toggle("hover:border-primary/50", !isSelected);

    const check = card.querySelector(".addon-check");
    if (check) {
        check.classList.toggle("bg-primary", isSelected);
        check.classList.toggle("border-primary", isSelected);
        check.classList.toggle("text-white", isSelected);
        check.classList.toggle("bg-white", !isSelected);
        check.classList.toggle("border-gray-300", !isSelected);
        check.classList.toggle("text-transparent", !isSelected);
    }

    const qtyControl = card.querySelector(".addon-qty-control");
    const qtyEl = card.querySelector(".addon-qty");
    if (qtyControl) qtyControl.classList.toggle("hidden", !isSelected);
    if (qtyEl) qtyEl.textContent = qty;
}

/**
 * Lấy danh sách add-ons đã chọn (mỗi add-on lặp theo số lượng)
 */
function getSelectedAddons() {
    const result = [];
    selectedAddons.forEach(({ addon, quantity }) => {
        for (let i = 0; i < quantity; i++) {
            result.push(addon);
        }
    });
    return result;
}

/**
 * Xóa toàn bộ add-ons đã chọn (sau khi thêm vào giỏ)
 */
function clearSelectedAddons() {
    selectedAddons.clear();
    const list = document.getElementById("addonsList");
    if (list) {
        list.querySelectorAll(".addon-card").forEach(card => {
            card.classList.remove("border-primary", "bg-primary/5");
            card.classList.add("border-gray-200", "hover:border-primary/50");
            const check = card.querySelector(".addon-check");
            if (check) {
                check.classList.remove("bg-primary", "border-primary", "text-white");
                check.classList.add("bg-white", "border-gray-300", "text-transparent");
            }
            const qtyControl = card.querySelector(".addon-qty-control");
            if (qtyControl) qtyControl.classList.add("hidden");
        });
    }
}

/**
 * Mở Modal Xem Chi Tiết Sản Phẩm (Mở tức thì 0ms qua Optimistic Cache + Lazy Load on-demand)
 */
export async function openProductQuickDetail(productId) {
    currentOpenDetailProductId = productId;
    const modal = document.getElementById("productQuickDetailModal");
    const spinner = document.getElementById("detailLoadingSpinner");
    const body = document.getElementById("detailContentBody");
    if (!modal) return;

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    const currentAppLang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";

    // 1. Optimistic Render: Kiểm tra cache RAM có sẵn từ danh mục sản phẩm
    let cachedProd = null;
    if (Array.isArray(allStorefrontProducts) && allStorefrontProducts.length > 0) {
        cachedProd = allStorefrontProducts.find(p => p && (p.id === productId || p.name === productId));
    }

    if (cachedProd) {
        // Hiển thị ngay lập tức 0ms không để khách hàng phải chờ spinner
        populateProductDetailModalContent(cachedProd, currentAppLang, productId);
    } else {
        if (spinner) {
            spinner.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin text-primary text-3xl"></i>
                <span class="text-xs text-gray-400 font-medium">Đang tải chi tiết & album ảnh...</span>
            `;
            spinner.classList.remove("hidden");
        }
        if (body) body.classList.add("hidden");
    }

    // 2. Tải thêm chi tiết đầy đủ ngầm qua API (album gallery, thành phần chi tiết, tồn kho)
    try {
        const fullProd = await getProductById(productId, currentAppLang);
        if (fullProd && currentOpenDetailProductId === productId) {
            populateProductDetailModalContent(fullProd, currentAppLang, productId);
        }
    } catch (err) {
        console.warn("Lỗi đồng bộ chi tiết sản phẩm:", err);
    }
}

export function closeProductQuickDetail() {
    const modal = document.getElementById("productQuickDetailModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

/**
 * Cuộn mượt mà tới section danh mục tương ứng
 * @param {string} categoryId - Mã danh mục (VD: 'gio_hoa', 'bo_hoa', 'ke_hoa', 'binh_hoa', 'lan_ho_diep', 'hoa_cuoi')
 */
export function scrollToCategory(categoryId) {
    if (!categoryId) return;
    const targetId = categoryId.startsWith('cat-') ? categoryId : `cat-${categoryId}`;
    const sec = document.getElementById(targetId) || document.getElementById(categoryId);
    if (sec) {
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

if (typeof window !== 'undefined') {
    window.scrollToCategory = scrollToCategory;
    window.filterStorefrontCategory = scrollToCategory;
}

/**
 * Tự động đổ danh mục vào tất cả các thẻ select dropdown trên giao diện (Không hardcode)
 */
export function populateCategoryDropdowns(categories) {
    if (!Array.isArray(categories)) return;
    const activeCats = categories.filter(c => c && c.isActive !== false && c.status !== 'inactive' && !c.isDeleted);
    activeCats.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));

    // 1. Dropdown bộ lọc sản phẩm trong Admin Portal
    const filterSelect = document.getElementById('filterProductCategory');
    if (filterSelect) {
        const currentVal = filterSelect.value;
        let optHtml = `<option value="">Tất cả danh mục (${activeCats.length})</option>`;
        activeCats.forEach(c => {
            optHtml += `<option value="${c.id}">${c.name}</option>`;
        });
        filterSelect.innerHTML = optHtml;
        if (currentVal) filterSelect.value = currentVal;
    }

    // 2. Dropdown chọn danh mục trong Form Tạo/Sửa Sản phẩm
    const formSelect = document.getElementById('prodCategory');
    if (formSelect) {
        const currentVal = formSelect.value;
        let optHtml = '<option value="">-- Chọn danh mục hoa --</option>';
        activeCats.forEach(c => {
            optHtml += `<option value="${c.id}">${c.name} (${c.id})</option>`;
        });
        formSelect.innerHTML = optHtml;
        if (currentVal) formSelect.value = currentVal;
    }
}

/**
 * Lấy tên hiển thị danh mục theo ngôn ngữ hiện tại:
 * - Nếu textId tồn tại và có bản dịch: trả về bản dịch theo ngôn ngữ hiện tại
 * - Nếu không có textId: fallback về cat.name (không bao giờ set cat.name khi có textId)
 */
export function getCategoryDisplayName(cat) {
    if (!cat) return "";
    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    
    if (cat.textId && trans && trans[lang] && trans[lang][cat.textId]) {
        return trans[lang][cat.textId];
    }
    return cat.name || "";
}

/**
 * Lấy mô tả hiển thị danh mục theo ngôn ngữ hiện tại:
 * - Ưu tiên 1: cat.i18n?.[lang]?.description
 * - Ưu tiên 2: trans[lang][descTextId]
 * - Fallback: cat.description
 */
export function getCategoryDescription(cat) {
    if (!cat) return "";
    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});

    if (cat.i18n && cat.i18n[lang] && cat.i18n[lang].description) {
        return cat.i18n[lang].description;
    }

    const descTextId = cat.descTextId || cat.descriptionTextId;
    if (descTextId && trans && trans[lang] && trans[lang][descTextId]) {
        return trans[lang][descTextId];
    }

    return cat.description || "";
}

/**
 * TỰ ĐỘNG TẠO TOÀN BỘ CÁC SECTION DANH MỤC & PRODUCT GRIDS TRÊN STOREFRONT
 * Thay thế hoàn toàn mã HTML tĩnh / hardcoded
 */
export function renderDynamicStorefrontSections(categories, products) {
    const container = document.getElementById('dynamicCategorySections');
    if (!container || !Array.isArray(categories)) return;

    const activeCats = categories.filter(c => 
        c && 
        c.isActive !== false && 
        c.isActive !== 'false' && 
        c.status !== 'inactive' && 
        c.status !== 'deleted' && 
        !c.isDeleted
    );
    activeCats.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));

    const allProds = Array.isArray(products) ? products : [];
    let html = '';
    let promoBannerRendered = false;

    // Lấy từ điển đa ngôn ngữ cho Banner Khuyến Mãi
    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[lang]) ? trans[lang] : {};

    const promoTitle = dict.banner_promo_title || "Kệ Hoa Chúc Mừng & Khai Trương";
    const promoDesc = dict.banner_promo_desc || "Mang thịnh vượng, tài lộc đến đối tác và bạn bè";
    const promoBtn = dict.banner_promo_btn || "Khám Phá Kệ Hoa";

    activeCats.forEach((cat, index) => {
        const isEven = index % 2 === 0;
        const bgClass = cat.id === 'hoa_cuoi' 
            ? 'bg-pink-50/40 border-t border-pink-100' 
            : (isEven ? 'bg-white' : 'bg-gray-50');

        const catDisplayName = getCategoryDisplayName(cat);
        const catDesc = getCategoryDescription(cat);
        const descDataAttr = cat.descTextId ? `data-i18n="${cat.descTextId}"` : '';

        // Section Danh mục Động
        html += `
            <section id="cat-${cat.id}" class="py-12 md:py-16 ${bgClass} scroll-mt-20">
                <div class="container mx-auto max-w-7xl px-4">
                    <div class="text-center mb-8">
                        <h2 class="font-serif text-3xl md:text-4xl font-bold text-gray-900 inline-block relative pb-3" ${cat.textId ? `data-i18n="${cat.textId}"` : ''}>
                            ${catDisplayName}
                            <div class="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-primary rounded"></div>
                        </h2>
                        ${catDesc ? `<p class="text-gray-500 mt-3 text-sm md:text-base max-w-2xl mx-auto" ${descDataAttr}>${catDesc}</p>` : ''}
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6" id="dyn-grid-${cat.id}">
                        <!-- Products rendered dynamically -->
                    </div>
                </div>
            </section>
        `;

        // Chèn Promo Banner ở vị trí hài hòa duy nhất 1 lần (sau danh mục thứ 2 hoặc sau danh mục đầu tiên nếu chỉ có 1 danh mục)
        const shouldInsertBanner = !promoBannerRendered && (index === 1 || (index === 0 && activeCats.length === 1));
        if (shouldInsertBanner) {
            promoBannerRendered = true;
            html += `
                <section class="py-8 bg-white">
                    <div class="container mx-auto max-w-7xl px-4">
                        <div class="relative rounded-2xl overflow-hidden h-48 md:h-60 shadow-md group img-skeleton">
                            <img src="https://images.unsplash.com/photo-1561181286-d3fee7d55364?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
                                alt="Banner Hoa Chúc Mừng" loading="lazy" decoding="async" onload="this.classList.add('loaded'); this.parentElement.classList.remove('img-skeleton');"
                                class="w-full h-full object-cover group-hover:scale-105 transition duration-700">
                            <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <div class="text-center text-white p-4">
                                    <h3 class="font-serif text-2xl md:text-4xl font-bold mb-2 shadow-sm" data-i18n="banner_promo_title">${promoTitle}</h3>
                                    <p class="mb-4 text-sm md:text-base hidden md:block" data-i18n="banner_promo_desc">${promoDesc}</p>
                                    <a href="#cat-ke_hoa" onclick="scrollToCategory('ke_hoa'); return false;"
                                        class="bg-white text-gray-900 hover:bg-primary hover:text-white px-6 py-2 rounded-full font-bold text-sm transition inline-block shadow-md">
                                        <span data-i18n="banner_promo_btn">${promoBtn}</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            `;
        }
    });

    container.innerHTML = html;

    // Render sản phẩm vào từng Grid danh mục vừa tạo
    activeCats.forEach(cat => {
        const catProds = allProds.filter(p => p && p.category === cat.id && p.isActive !== false);
        renderProducts(catProds, `dyn-grid-${cat.id}`);
    });
}

/**
 * Hiển thị thông báo khi không thể tải danh sách sản phẩm
 */
export function renderStorefrontLoadError(container) {
    if (!container) return;
    container.innerHTML = `
        <div class="py-12 text-center text-gray-500">
            <p class="text-sm font-medium" data-i18n="load_products_error">Không thể tải danh sách sản phẩm. Vui lòng kiểm tra lại kết nối mạng.</p>
            <button type="button" onclick="retryLoadStorefrontProducts()" class="mt-4 px-5 py-2 bg-primary hover:bg-primaryHover text-white text-xs font-bold rounded-full transition shadow-sm">
                Thử lại
            </button>
        </div>
    `;
}

/**
 * Thử lại nạp sản phẩm cho trang chủ
 */
export async function retryLoadStorefrontProducts() {
    await renderAllProducts();
}

/**
 * Render toàn bộ danh mục sản phẩm từ API Backend vào từng Section
 * Tự động nạp êm đềm (silent/graceful loading), không hiển thị cảnh báo lỗi làm hoang mang người dùng
 */
export async function renderAllProducts() {
    const container = document.getElementById('dynamicCategorySections');

    try {
        const [prods, cats] = await Promise.all([
            getProducts(true),
            getCategories(true)
        ]);

        if (Array.isArray(cats) && cats.length > 0) {
            activeStorefrontCategories = cats;
            populateCategoryDropdowns(cats);
        } else if (typeof window !== 'undefined' && window.default_categories) {
            activeStorefrontCategories = window.default_categories;
        }

        if (Array.isArray(prods) && prods.length > 0) {
            allStorefrontProducts = prods;
        } else if (typeof window !== 'undefined' && window.default_products) {
            allStorefrontProducts = window.default_products;
        }

        if (allStorefrontProducts && allStorefrontProducts.length > 0 && container) {
            renderDynamicStorefrontSections(activeStorefrontCategories, allStorefrontProducts);
        }
    } catch (e) {
        console.warn("Nạp dữ liệu sản phẩm:", e);
        if (typeof window !== 'undefined' && window.default_products && container) {
            allStorefrontProducts = window.default_products;
            renderDynamicStorefrontSections(activeStorefrontCategories, allStorefrontProducts);
        }
    }
}


/**
 * Chuẩn hóa chuỗi tiếng Việt: loại bỏ dấu thanh, dấu mũ, chuyển đ/Đ -> d để tìm kiếm không dấu
 */
export function removeVietnameseTones(str) {
    if (!str) return '';
    return str
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .trim();
}

let _searchDebounceTimer = null;

/**
 * Ẩn/Hiện nút xóa tìm kiếm (dấu X) trên thanh tìm kiếm Desktop và Mobile
 */
export function updateSearchClearButtonVisibility(query) {
    if (typeof document === 'undefined') return;
    const hasText = Boolean(query && query.toString().trim().length > 0);
    const deskClearBtn = document.getElementById('storefrontSearchClearBtn');
    const mobClearBtn = document.getElementById('storefrontSearchMobileClearBtn');

    if (deskClearBtn) {
        if (hasText) {
            deskClearBtn.classList.remove('hidden');
            deskClearBtn.classList.add('flex');
        } else {
            deskClearBtn.classList.add('hidden');
            deskClearBtn.classList.remove('flex');
        }
    }

    if (mobClearBtn) {
        if (hasText) {
            mobClearBtn.classList.remove('hidden');
            mobClearBtn.classList.add('flex');
        } else {
            mobClearBtn.classList.add('hidden');
            mobClearBtn.classList.remove('flex');
        }
    }
}

/**
 * Tìm kiếm có Debounce (trì hoãn ~120ms) giúp tối ưu hiệu năng và tránh giật lag UI khi gõ nhanh
 * Tự động scroll mượt mà xuống phần kết quả tìm kiếm giống như khi bấm tab danh mục hoa
 */
export function debouncedSearchStorefrontProducts(query, updateUrl = true, delay = 120, autoScroll = true) {
    updateSearchClearButtonVisibility(query);
    if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = setTimeout(() => {
        searchStorefrontProducts(query, updateUrl, autoScroll);
    }, delay);
}

/**
 * Đóng tất cả bảng kết quả tìm kiếm trực tiếp (Desktop & Mobile)
 */
export function closeLiveSearchResults() {
    if (typeof document === 'undefined') return;
    const desktopResults = document.getElementById('desktopLiveSearchResults');
    const mobileResults = document.getElementById('mobileLiveSearchResults');
    if (desktopResults) desktopResults.classList.add('hidden');
    if (mobileResults) mobileResults.classList.add('hidden');
}

/**
 * Render bảng kết quả tìm kiếm ngay dưới thanh tìm kiếm (Hỗ trợ cả PC Desktop & Mobile)
 */
export function renderLiveSearchResults(matchedProds = [], rawQuery = '') {
    if (typeof document === 'undefined') return;
    const desktopResults = document.getElementById('desktopLiveSearchResults');
    const mobileResults = document.getElementById('mobileLiveSearchResults');

    const containers = [
        { el: desktopResults, isDesktop: true },
        { el: mobileResults, isDesktop: false }
    ];

    if (!rawQuery || !rawQuery.trim()) {
        containers.forEach(({ el }) => {
            if (el) {
                el.classList.add('hidden');
                el.innerHTML = '';
            }
        });
        return;
    }

    containers.forEach(({ el, isDesktop }) => {
        if (!el) return;

        if (matchedProds.length === 0) {
            el.innerHTML = `
                <div class="py-5 px-3 text-center">
                    <div class="w-10 h-10 bg-pink-50 text-pink-400 rounded-full flex items-center justify-center text-base mx-auto mb-2 shadow-inner">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </div>
                    <p class="text-xs font-bold text-gray-800">Không tìm thấy mẫu hoa nào khớp với "${rawQuery}"</p>
                    <p class="text-[11px] text-gray-500 mt-1">Gợi ý: <i>Hoa hồng, Lan hồ điệp, Tulip, Khai trương...</i></p>
                </div>
            `;
            el.classList.remove('hidden');
            return;
        }

        let itemsHtml = `
            <div class="flex items-center justify-between pb-2.5 mb-2.5 border-b border-gray-100 px-1">
                <span class="text-xs font-bold text-gray-600">
                    Tìm thấy <b class="text-primary font-bold">${matchedProds.length}</b> mẫu hoa
                </span>
                <button type="button" onclick="closeLiveSearchResults()" class="text-gray-400 hover:text-gray-600 p-1 text-xs font-bold flex items-center gap-1 cursor-pointer">
                    <i class="fa-solid fa-xmark"></i> Đóng
                </button>
            </div>
            <div class="space-y-2 max-h-[50vh] overflow-y-auto pr-1 divide-y divide-gray-50">
        `;

        matchedProds.forEach(prod => {
            const priceFmt = (prod.priceNumber || 0).toLocaleString('vi-VN') + '₫';
            const imgUrl = prod.image || 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=500&q=80';
            itemsHtml += `
                <div class="flex items-center gap-3 pt-2 first:pt-0 p-2 rounded-xl hover:bg-pink-50/60 transition cursor-pointer border border-transparent hover:border-pink-100 group"
                     onclick="openProductQuickDetail('${prod.id}'); closeLiveSearchResults();">
                    <img src="${imgUrl}" alt="${prod.name}" class="w-12 h-12 md:w-13 md:h-13 object-cover rounded-lg flex-shrink-0 shadow-xs group-hover:scale-105 transition">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-xs md:text-sm font-bold text-gray-800 truncate group-hover:text-primary transition">${prod.name}</h4>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span class="text-xs md:text-sm font-bold text-primary">${priceFmt}</span>
                            ${prod.badge ? `<span class="text-[9px] bg-pink-100 text-pink-700 px-1.5 py-0.2 rounded font-semibold">${getProductBadge(prod)}</span>` : ''}
                        </div>
                    </div>
                    <button type="button" onclick="event.stopPropagation(); addToCart('${prod.id}'); closeLiveSearchResults();" 
                            title="Thêm vào giỏ hàng"
                            class="w-8 h-8 bg-primary hover:bg-primaryHover text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 shadow-xs cursor-pointer hover:scale-110 transition">
                        <i class="fa-solid fa-bag-shopping text-xs"></i>
                    </button>
                </div>
            `;
        });

        itemsHtml += `
            </div>
            <div class="pt-2.5 mt-2.5 border-t border-gray-100 text-center">
                <button type="button" onclick="closeLiveSearchResults(); document.getElementById('search-results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });"
                        class="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1.5 cursor-pointer">
                    Xem toàn bộ kết quả dạng lưới bên dưới <i class="fa-solid fa-arrow-down text-xs"></i>
                </button>
            </div>
        `;

        el.innerHTML = itemsHtml;
        el.classList.remove('hidden');
    });
}

export const renderMobileSearchResults = renderLiveSearchResults;

/**
 * Tìm kiếm sản phẩm theo tên / mô tả / thành phần trên Storefront
 * Hỗ trợ tìm kiếm cả tiếng Việt CÓ DẤU và KHÔNG DẤU (vd: 'hoa hong' -> khớp 'Hoa hồng')
 * Hỗ trợ đồng bộ Hash URL dạng: /#/search?q=tên_hoa
 * Hiển thị bảng kết quả trực tiếp ngay dưới thanh tìm kiếm trên cả PC (Desktop) và Mobile
 */
export function searchStorefrontProducts(query, updateUrl = true, autoScroll = false) {
    const rawQuery = (query || '').trim();
    const q = rawQuery.toLowerCase();
    const normQ = removeVietnameseTones(rawQuery);
    const container = document.getElementById('dynamicCategorySections');
    if (!container) return;

    // Cập nhật trạng thái hiển thị nút xóa (dấu X)
    updateSearchClearButtonVisibility(query);

    // Đồng bộ giá trị 2 input desktop & mobile
    const desktopInput = document.getElementById('storefrontSearchInput');
    const mobileInput = document.getElementById('storefrontSearchMobileInput');
    if (desktopInput && desktopInput.value !== query) desktopInput.value = query;
    if (mobileInput && mobileInput.value !== query) mobileInput.value = query;

    // Cập nhật URL trình duyệt sang dạng Hash: /#/search?q=...
    if (updateUrl && typeof window !== 'undefined') {
        if (rawQuery) {
            const targetHash = `#/search?q=${encodeURIComponent(rawQuery)}`;
            if (window.location.hash !== targetHash) {
                window.location.hash = `/search?q=${encodeURIComponent(rawQuery)}`;
            }
        } else {
            if (window.location.hash.includes('search') || window.location.hash.includes('q=')) {
                window.history.pushState(null, '', window.location.pathname);
            }
        }
    }

    if (!q) {
        renderLiveSearchResults([], '');
        renderDynamicStorefrontSections(activeStorefrontCategories, allStorefrontProducts);
        return;
    }

    const matchedProds = allStorefrontProducts.filter(p => {
        if (!p || p.isActive === false) return false;
        const name = (p.name || '').toLowerCase();
        const id = (p.id || '').toLowerCase();
        const comp = (p.flowerComposition || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();

        const normName = removeVietnameseTones(name);
        const normComp = removeVietnameseTones(comp);
        const normDesc = removeVietnameseTones(desc);

        return normName.includes(normQ) || id.includes(q) || normComp.includes(normQ) || normDesc.includes(normQ);
    });

    // 1. Hiển thị bảng kết quả trực tiếp ngay bên dưới thanh tìm kiếm (cả PC và Mobile)
    renderLiveSearchResults(matchedProds, rawQuery);

    let html = `
        <section class="py-12 bg-white min-h-[50vh] scroll-mt-20" id="search-results-section">
            <div class="container mx-auto max-w-7xl px-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-gray-100 pb-4">
                    <div>
                        <h2 class="font-serif text-2xl md:text-3xl font-bold text-gray-900">
                            Kết quả tìm kiếm cho: <span class="text-primary font-sans italic">"${rawQuery}"</span>
                        </h2>
                        <p class="text-gray-500 text-xs sm:text-sm mt-1">Tìm thấy <b class="text-primary font-bold">${matchedProds.length}</b> mẫu hoa tươi phù hợp</p>
                    </div>
                    <button onclick="clearStorefrontSearch()" class="text-xs font-bold text-gray-600 hover:text-primary transition flex items-center gap-1.5 self-start sm:self-auto bg-gray-50 hover:bg-pink-50 px-4 py-2 rounded-full border border-gray-200 shadow-2xs cursor-pointer">
                        <i class="fa-solid fa-xmark text-sm"></i> Xóa tìm kiếm & Xem tất cả
                    </button>
                </div>
    `;

    if (matchedProds.length === 0) {
        html += `
                <div class="py-16 text-center">
                    <div class="w-20 h-20 bg-pink-50 text-pink-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </div>
                    <h3 class="text-lg font-bold text-gray-800 mb-1">Không tìm thấy mẫu hoa nào khớp với "${rawQuery}"</h3>
                    <p class="text-gray-500 text-xs sm:text-sm max-w-md mx-auto mb-6">Hãy thử tìm kiếm với các từ khóa phổ biến như: <i>Hoa hồng, Lan hồ điệp, Tulip, Khai trương, Bình cắm hoa...</i></p>
                    <button onclick="clearStorefrontSearch()" class="px-6 py-2.5 bg-primary hover:bg-primaryHover text-white text-xs sm:text-sm font-bold rounded-full shadow-md transition inline-flex items-center">
                        <i class="fa-solid fa-house mr-2"></i> Quay lại Tất Cả Danh Mục
                    </button>
                </div>
            </div>
        </section>
        `;
        container.innerHTML = html;
    } else {
        html += `
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6" id="search-results-grid">
                    <!-- Sẽ render sản phẩm tìm kiếm vào đây -->
                </div>
            </div>
        </section>
        `;
        container.innerHTML = html;
        renderProducts(matchedProds, 'search-results-grid');
    }

    // Trên Desktop (máy tính): Tự động cuộn mượt mà tới phần danh sách kết quả
    if (autoScroll && !isMobileView && typeof document !== 'undefined') {
        const searchSec = document.getElementById('search-results-section') || container;
        if (searchSec && typeof searchSec.scrollIntoView === 'function') {
            searchSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

/**
 * Xóa bộ lọc tìm kiếm và đưa Storefront về trang chủ
 */
export function clearStorefrontSearch(updateUrl = true) {
    const desktopInput = document.getElementById('storefrontSearchInput');
    const mobileInput = document.getElementById('storefrontSearchMobileInput');
    if (desktopInput) desktopInput.value = '';
    if (mobileInput) mobileInput.value = '';

    updateSearchClearButtonVisibility('');
    renderMobileSearchResults([], '');

    if (updateUrl && typeof window !== 'undefined') {
        window.history.pushState(null, '', window.location.pathname);
    }

    renderDynamicStorefrontSections(activeStorefrontCategories, allStorefrontProducts);

    const container = document.getElementById('dynamicCategorySections');
    if (container && typeof container.scrollIntoView === 'function') {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * 2. Logic Menu Mobile
 */
export function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuContent = document.getElementById('mobileMenuContent');

    if (mobileMenuBtn && mobileMenu && mobileMenuContent) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.remove('hidden');
            setTimeout(() => {
                mobileMenuContent.classList.remove('-translate-x-full');
            }, 10);
        });
    }

    if (typeof window !== 'undefined') {
        window.closeMenu = function() {
            if (mobileMenuContent) mobileMenuContent.classList.add('-translate-x-full');
            setTimeout(() => {
                if (mobileMenu) mobileMenu.classList.add('hidden');
            }, 300);
        };
    }

    if (closeMenuBtn) closeMenuBtn.addEventListener('click', window.closeMenu);
    if (mobileMenu) {
        mobileMenu.addEventListener('click', (e) => {
            if (e.target === mobileMenu && typeof window.closeMenu === 'function') window.closeMenu();
        });
    }
}

/**
 * Render danh mục nhanh trên Storefront & Navigation từ API /api/categories
 */
export async function renderStorefrontCategories() {
    const container = document.getElementById('storefrontQuickCategories');
    const desktopDynamicNav = document.getElementById('dynamicNavItems');
    const mobileDynamicNav = document.getElementById('mobileDynamicNavItems');

    try {
        const catsList = await getCategories(true);
        if (!Array.isArray(catsList) || catsList.length === 0) return;

        const activeCats = catsList.filter(c => 
            c && 
            c.isActive !== false && 
            c.isActive !== 'false' && 
            c.status !== 'inactive' && 
            c.status !== 'deleted' && 
            !c.isDeleted
        );
        activeCats.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
        activeStorefrontCategories = activeCats;

        // 1. Quick Category Circles trên Storefront
        if (container) {
            let html = '';
            activeCats.forEach((cat) => {
                const fallbackImg = "https://images.unsplash.com/photo-1591886960571-74d43a9d4166?w=200";
                const img = cat.image || fallbackImg;
                const catDisplayName = getCategoryDisplayName(cat);
                html += `
                    <div onclick="scrollToCategory('${cat.id}')" class="flex flex-col items-center group cursor-pointer w-24 md:w-32 transition transform hover:-translate-y-1">
                        <div class="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-pink-100 group-hover:border-primary transition p-1 shadow-sm bg-white">
                            <img src="${img}" alt="${catDisplayName}" loading="lazy" decoding="async" onload="this.classList.add('loaded')" class="product-img w-full h-full object-cover rounded-full">
                        </div>
                        <span ${cat.textId ? `data-i18n="${cat.textId}"` : ''} class="mt-2.5 font-bold text-gray-800 group-hover:text-primary transition text-xs md:text-sm text-center line-clamp-1">${catDisplayName}</span>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        // 2. Desktop Header Navigation (Các Tab Danh Mục trên Header)
        if (desktopDynamicNav) {
            let navHtml = '';
            activeCats.forEach((cat) => {
                const catDisplayName = getCategoryDisplayName(cat);
                navHtml += `
                    <a href="#cat-${cat.id}" ${cat.textId ? `data-i18n="${cat.textId}"` : ''} onclick="scrollToCategory('${cat.id}'); return false;" class="hover:text-primary transition whitespace-nowrap text-sm font-bold text-gray-700 uppercase tracking-wide">${catDisplayName}</a>
                `;
            });
            desktopDynamicNav.innerHTML = navHtml;
        }

        // 3. Mobile Menu Navigation (Các Tab Danh Mục trên Mobile)
        if (mobileDynamicNav) {
            let mobHtml = '';
            activeCats.forEach((cat) => {
                const catDisplayName = getCategoryDisplayName(cat);
                mobHtml += `
                    <li><a href="#cat-${cat.id}" ${cat.textId ? `data-i18n="${cat.textId}"` : ''} onclick="scrollToCategory('${cat.id}'); if(typeof closeMenu==='function')closeMenu(); return false;" class="block">${catDisplayName}</a></li>
                `;
            });
            mobileDynamicNav.innerHTML = mobHtml;
        }

        // 4. Populate các select dropdowns
        populateCategoryDropdowns(catsList);
    } catch (e) {
        console.warn("Lỗi nạp danh mục:", e);
    }
}

/**
 * 3. Đồng bộ thông tin thương hiệu & liên hệ doanh nghiệp (infoCompany.json) lên Storefront
 */
export function applyStorefrontCompanyInfo(info) {
    if (!info || typeof document === 'undefined') return;
    if (typeof window !== 'undefined') window.currentCompanyInfo = info;

    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    const setHref = (id, href) => {
        const el = document.getElementById(id);
        if (el && href) el.setAttribute('href', href);
    };

    if (info.address) {
        setText('footerAddress', info.address);
        setText('storeAddressVal', info.address);
    }

    if (info.phone || info.hotline) {
        const phone = info.hotline || info.phone;
        const cleanPhone = phone.replace(/[^\d+]/g, '');

        // 1. Cập nhật Hotline trên Top Header Bar
        setText('topHeaderHotlineVal', phone);
        setHref('topHeaderHotlineLink', `tel:${cleanPhone}`);

        // 2. Cập nhật Footer, Store Locator & Floating Buttons
        setText('footerPhone', phone);
        setHref('footerPhone', `tel:${cleanPhone}`);
        setText('storeHotlineLink', phone);
        setHref('storeHotlineLink', `tel:${cleanPhone}`);
        setHref('floatingHotlineLink', `tel:${cleanPhone}`);
        setText('floatingHotlineText', phone);
    }

    if (info.email) {
        setText('topHeaderEmailVal', info.email);
        setHref('topHeaderEmailLink', `mailto:${info.email}`);
        setText('footerEmail', info.email);
        setHref('footerEmail', `mailto:${info.email}`);
    }

    if (info.workingHours) {
        setText('footerHours', info.workingHours);
        setText('storeHoursVal', info.workingHours);
    }

    if (info.companyName) {
        const yr = new Date().getFullYear();
        setText('footerCopyright', `© ${yr} Bản quyền thuộc về ${info.companyName}.`);
    }

    if (info.zalo) {
        setHref('floatingZaloLink', info.zalo);
    }

    if (info.mapUrl) {
        setHref('storeDirectionsLink', info.mapUrl);
        setHref('storeLargerMapLink', info.mapUrl);
    }

    if (info.mapEmbedUrl) {
        const iframe = document.getElementById('storeMapIframe');
        if (iframe && info.mapEmbedUrl) {
            iframe.src = info.mapEmbedUrl;
        }
    }
}

export async function loadStorefrontCompanyInfo() {
    try {
        const res = await fetch(`${API_BASE}/company-info?_t=${Date.now()}`);
        if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
                applyStorefrontCompanyInfo(json.data);
                return;
            }
        }
    } catch (e) {
        // Thử fallback trực tiếp từ file JSON tĩnh
    }

    try {
        const fallbackRes = await fetch(`config/anne/infoCompany.json?_t=${Date.now()}`);
        if (fallbackRes.ok) {
            const info = await fallbackRes.json();
            if (info) applyStorefrontCompanyInfo(info);
        }
    } catch (err) {
        console.log("Using static default company info.");
    }
}

function parseSearchQueryFromUrl() {
    if (typeof window === 'undefined') return null;
    
    // 1. Kiểm tra từ Hash (ví dụ: #/search?q=h%C3%B4ng hoặc #search?q=h%C3%B4ng hoặc #q=h%C3%B4ng)
    const hash = (window.location.hash || '').replace(/^#\/?/, '');
    if (hash) {
        if (hash.includes('?') || hash.startsWith('q=')) {
            const queryPart = hash.includes('?') ? hash.split('?')[1] : hash;
            const params = new URLSearchParams(queryPart);
            if (params.get('q')) return params.get('q');
        } else if (hash.startsWith('search/')) {
            const term = decodeURIComponent(hash.replace('search/', ''));
            if (term) return term;
        }
    }
    
    // 2. Kiểm tra từ Search Query String (?q=...)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('q')) return urlParams.get('q');
    
    return null;
}

// 4. Khởi chạy khi tải xong trang (DOM Content Loaded - Đảm bảo chỉ chạy duy nhất 1 lần để tránh rò rỉ listener)
let _hasInitApp = false;
async function initApp() {
    if (_hasInitApp) return;
    _hasInitApp = true;

    initMobileMenu();
    renderStorefrontCategories();
    await renderAllProducts();
    loadStorefrontCompanyInfo();
    
    // 1. Kiểm tra tham số tìm kiếm từ URL Hash (#/search?q=...) hoặc query khi vừa tải trang
    if (typeof window !== 'undefined') {
        const queryFromUrl = parseSearchQueryFromUrl();
        if (queryFromUrl) {
            const desktopInput = document.getElementById('storefrontSearchInput');
            const mobileInput = document.getElementById('storefrontSearchMobileInput');
            if (desktopInput) desktopInput.value = queryFromUrl;
            if (mobileInput) mobileInput.value = queryFromUrl;
            searchStorefrontProducts(queryFromUrl, false);
        }

        // Lắng nghe sự kiện đổi Hash và Back/Forward của trình duyệt
        const handleUrlChange = () => {
            const q = parseSearchQueryFromUrl();
            if (q) {
                searchStorefrontProducts(q, false);
            } else {
                clearStorefrontSearch(false);
            }
        };

        window.addEventListener('hashchange', handleUrlChange);
        window.addEventListener('popstate', handleUrlChange);
    }

    // Gắn sự kiện đóng modal bằng phím ESC và click ra ngoài backdrop
    if (typeof document !== 'undefined') {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                closeProductQuickDetail();
                closeLiveSearchResults();
            }
        });

        // Đóng bảng live search khi nhấp chuột ra ngoài
        document.addEventListener('click', (e) => {
            const deskInput = document.getElementById('storefrontSearchInput');
            const deskResults = document.getElementById('desktopLiveSearchResults');
            const mobInput = document.getElementById('storefrontSearchMobileInput');
            const mobResults = document.getElementById('mobileLiveSearchResults');

            if (deskResults && !deskResults.classList.contains('hidden')) {
                const isInsideDesk = (deskInput && deskInput.parentElement && deskInput.parentElement.contains(e.target));
                if (!isInsideDesk) {
                    deskResults.classList.add('hidden');
                }
            }

            if (mobResults && !mobResults.classList.contains('hidden')) {
                const isInsideMob = (mobInput && mobInput.parentElement && mobInput.parentElement.contains(e.target));
                if (!isInsideMob) {
                    mobResults.classList.add('hidden');
                }
            }
        });

        const detailModal = document.getElementById("productQuickDetailModal");
        if (detailModal) {
            detailModal.addEventListener('click', (e) => {
                if (e.target === detailModal) {
                    closeProductQuickDetail();
                }
            });
        }
    }

    // Tự động kiểm tra đăng nhập khi mở app
    if (typeof checkAuthStatus === 'function') {
        checkAuthStatus();
    }

    // 2. Đọc ngôn ngữ từ Cache
    let cachedLang = 'vi';
    try {
        if (typeof localStorage !== 'undefined') {
            cachedLang = localStorage.getItem('anne_flower_lang') || 'vi';
        }
    } catch (e) {
        cachedLang = 'vi';
    }

    // 3. Thiết lập ngôn ngữ
    if (typeof setLanguage === 'function') {
        setLanguage(cachedLang);
    }
}

if (typeof window !== 'undefined') {
    window.renderProducts = renderProducts;
    window.renderAllProducts = renderAllProducts;
    window.renderStorefrontLoadError = renderStorefrontLoadError;
    window.retryLoadStorefrontProducts = retryLoadStorefrontProducts;
    window.renderStorefrontCategories = renderStorefrontCategories;
    window.getCategoryDisplayName = getCategoryDisplayName;
    window.getCategoryDescription = getCategoryDescription;
    window.getProductName = getProductName;
    window.getProductBadge = getProductBadge;
    window.getProductComposition = getProductComposition;
    window.getProductDescription = getProductDescription;
    window.getProductCareTips = getProductCareTips;
    window.populateCategoryDropdowns = populateCategoryDropdowns;
    window.renderDynamicStorefrontSections = renderDynamicStorefrontSections;
    window.searchStorefrontProducts = searchStorefrontProducts;
    window.debouncedSearchStorefrontProducts = debouncedSearchStorefrontProducts;
    window.clearStorefrontSearch = clearStorefrontSearch;
    window.renderLiveSearchResults = renderLiveSearchResults;
    window.renderMobileSearchResults = renderMobileSearchResults;
    window.closeLiveSearchResults = closeLiveSearchResults;
    window.updateSearchClearButtonVisibility = updateSearchClearButtonVisibility;
    window.removeVietnameseTones = removeVietnameseTones;
    window.initMobileMenu = initMobileMenu;
    window.openProductQuickDetail = openProductQuickDetail;
    window.closeProductQuickDetail = closeProductQuickDetail;
    window.loadAddons = loadAddons;
    window.renderAddonsInModal = renderAddonsInModal;
    window.getAddonName = getAddonName;
    window.toggleAddonSelection = toggleAddonSelection;
    window.changeAddonQty = changeAddonQty;
    window.scrollAddons = scrollAddons;
    window.applyStorefrontCompanyInfo = applyStorefrontCompanyInfo;
    window.loadStorefrontCompanyInfo = loadStorefrontCompanyInfo;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
}
