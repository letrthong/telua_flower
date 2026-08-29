import { API_BASE } from './utils.js';
import { getProducts, getProductById, getCategories } from './products.js';
import { translations } from './translations.js';
import { setLanguage } from './i18n.js';
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

        const badgeHtml = product.badge
            ? `<span class="absolute top-2 left-2 bg-accent text-white text-xs font-bold px-2 py-1 rounded shadow-sm z-10">${product.badge}</span>`
            : '';
        const priceHtml = hasDiscount
            ? `<span class="text-gray-400 line-through text-xs md:text-sm mr-2">${origPrice}</span>
               <span class="text-primary font-bold text-sm md:text-base">${salePrice}</span>`
            : `<span class="text-primary font-bold text-sm md:text-base">${salePrice}</span>`;

        const numericPrice = product.priceNumber || parseInt(salePrice.replace(/[^\d]/g, ''), 10) || 420000;
        const safeName = (product.name || "").replace(/'/g, "\\'");
        const prodId = product.id || `prod_${(product.name || 'hoa').toLowerCase().replace(/\s+/g, '_')}`;
        const prodImg = product.image || "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500";

        html += `
            <div class="product-card bg-white rounded-xl shadow-sm hover:shadow-xl transition duration-300 overflow-hidden flex flex-col group relative border border-gray-100">
                ${badgeHtml}
                <div onclick="openProductQuickDetail('${prodId}')" class="relative h-48 md:h-64 overflow-hidden cursor-pointer">
                    <img src="${prodImg}" alt="${product.name}" loading="lazy" decoding="async" onload="this.classList.add('loaded')" onerror="this.classList.add('loaded')" class="product-img w-full h-full object-cover group-hover:scale-105 transition duration-500">
                    
                    <!-- Nút Thêm vào giỏ hàng (Hiển thị khi hover) -->
                    <div class="absolute inset-0 bg-black/30 flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4" onclick="event.stopPropagation()">
                        <button onclick="addToCart('${prodId}', '${safeName}', ${numericPrice}, '${prodImg}')" class="bg-primary hover:bg-primaryHover text-white w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-md flex items-center justify-center">
                            <i class="fa-solid fa-cart-plus mr-1.5"></i> <span data-i18n="btn_add_to_cart">${btnText}</span>
                        </button>
                    </div>
                </div>
                <div class="p-4 flex flex-col flex-grow text-center">
                    <h3 onclick="openProductQuickDetail('${prodId}')" class="font-bold text-gray-800 text-sm md:text-base mb-2 flex-grow hover:text-primary cursor-pointer line-clamp-2">${product.name}</h3>
                    <div class="mt-auto">
                        ${priceHtml}
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

/**
 * Mở Modal Xem Chi Tiết Sản Phẩm (Lazy Load on-demand từ /api/products/<id>)
 */
export async function openProductQuickDetail(productId) {
    const modal = document.getElementById("productQuickDetailModal");
    const spinner = document.getElementById("detailLoadingSpinner");
    const body = document.getElementById("detailContentBody");
    if (!modal) return;

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    // Reset spinner loading state mỗi lần mở
    if (spinner) {
        spinner.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin text-primary text-3xl"></i>
            <span class="text-xs text-gray-400 font-medium">Đang tải chi tiết & album ảnh...</span>
        `;
        spinner.classList.remove("hidden");
    }
    if (body) body.classList.add("hidden");

    // Nạp chi tiết sản phẩm qua hàm getProductById (gọi API /api/products/<id> hoặc cache)
    let prod = await getProductById(productId);

    if (!prod && Array.isArray(allStorefrontProducts) && allStorefrontProducts.length > 0) {
        prod = allStorefrontProducts.find(p => p && (p.id === productId || p.name === productId));
    }

    if (prod) {
        const numericPrice = prod.priceNumber || parseInt((prod.salePrice || "420000").replace(/[^\d]/g, ''), 10) || 420000;
        const safeName = (prod.name || "").replace(/'/g, "\\'");
        const prodImg = prod.image || "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=500";

        // Điền thông tin vào modal
        const nameEl = document.getElementById("detailProdName");
        if (nameEl) nameEl.textContent = prod.name;

        const badgeEl = document.getElementById("detailBadge");
        if (badgeEl) badgeEl.textContent = prod.badge || "Mẫu Mới";

        const salePriceEl = document.getElementById("detailSalePrice");
        if (salePriceEl) salePriceEl.textContent = prod.salePrice || `${numericPrice.toLocaleString()}₫`;

        const origPriceEl = document.getElementById("detailOrigPrice");
        if (origPriceEl) origPriceEl.textContent = prod.originalPrice && prod.originalPrice !== prod.salePrice ? prod.originalPrice : "";

        const catLabelEl = document.getElementById("detailCategoryLabel");
        if (catLabelEl) {
            const catObj = (activeStorefrontCategories || []).find(c => c && c.id === prod.category);
            catLabelEl.textContent = catObj ? catObj.name.toUpperCase() : (prod.category ? prod.category.toUpperCase().replace("_", " ") : "HOA TƯƠI CAO CẤP");
        }

        const descEl = document.getElementById("detailDescription");
        if (descEl) descEl.textContent = prod.description || "Mẫu hoa tươi thiết kế độc quyền tại Nở Hoa Thả Bình với sự kết hợp hài hòa giữa màu sắc và hương thơm.";

        const compEl = document.getElementById("detailComposition");
        if (compEl) compEl.textContent = prod.flowerComposition || "Hoa tươi tự nhiên chọn lọc loại 1, giấy gói cao cấp chuẩn showroom.";

        const dimEl = document.getElementById("detailDimension");
        if (dimEl) dimEl.textContent = prod.dimension || "Kích thước tiêu chuẩn";

        const careEl = document.getElementById("detailCareTips");
        if (careEl) careEl.textContent = prod.careTips || "Cắt vát gốc 45 độ, phun sương nhẹ cánh hoa và giữ nước sạch mỗi ngày.";

        const mainImgEl = document.getElementById("detailMainImg");
        if (mainImgEl) {
            mainImgEl.src = prodImg;
            mainImgEl.alt = prod.name || "Hoa tươi";
        }

        // Gallery thumbnails
        const galleryContainer = document.getElementById("detailGalleryThumbnails");
        if (galleryContainer) {
            const galleryList = Array.isArray(prod.gallery) && prod.gallery.length > 0 ? prod.gallery : [prodImg];
            let galHtml = '';
            galleryList.forEach(imgUrl => {
                galHtml += `
                    <div onclick="document.getElementById('detailMainImg').src='${imgUrl}'" class="w-12 h-12 rounded-lg overflow-hidden border-2 border-gray-200 cursor-pointer hover:border-primary flex-shrink-0 transition">
                        <img src="${imgUrl}" class="w-full h-full object-cover">
                    </div>
                `;
            });
            galleryContainer.innerHTML = galHtml;
        }

        // Tồn kho tại showroom
        const stockContainer = document.getElementById("detailStockGrid");
        if (stockContainer) {
            const stock = prod.stockByBranch || { "branch_q10": 10, "branch_q1": 5, "branch_thao_dien": 4 };
            let stockHtml = `
                <span class="bg-gray-100 px-2.5 py-1 rounded-lg text-gray-700 font-medium text-[11px]">Q.10: <b class="text-primary">${stock.branch_q10 ?? 0}</b></span>
                <span class="bg-gray-100 px-2.5 py-1 rounded-lg text-gray-700 font-medium text-[11px]">Q.1: <b class="text-primary">${stock.branch_q1 ?? 0}</b></span>
                <span class="bg-gray-100 px-2.5 py-1 rounded-lg text-gray-700 font-medium text-[11px]">Thảo Điền: <b class="text-primary">${stock.branch_thao_dien ?? 0}</b></span>
            `;
            stockContainer.innerHTML = stockHtml;
        }

        // Gắn sự kiện nút Thêm Giỏ Hàng
        const btnAdd = document.getElementById("btnQuickAddToCart");
        if (btnAdd) {
            btnAdd.onclick = () => {
                if (typeof addToCart === "function") {
                    addToCart(prod.id || productId, safeName, numericPrice, prodImg);
                }
                closeProductQuickDetail();
            };
        }

        if (spinner) spinner.classList.add("hidden");
        if (body) body.classList.remove("hidden");
    } else {
        if (spinner) spinner.innerHTML = `<span class="text-red-500 font-bold text-xs">Không tìm thấy thông tin sản phẩm này.</span>`;
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

    activeCats.forEach((cat, index) => {
        const isEven = index % 2 === 0;
        const bgClass = cat.id === 'hoa_cuoi' 
            ? 'bg-pink-50/40 border-t border-pink-100' 
            : (isEven ? 'bg-white' : 'bg-gray-50');

        // Section Danh mục Động
        html += `
            <section id="cat-${cat.id}" class="py-12 md:py-16 ${bgClass} scroll-mt-20">
                <div class="container mx-auto max-w-7xl px-4">
                    <div class="text-center mb-8">
                        <h2 class="font-serif text-3xl md:text-4xl font-bold text-gray-900 inline-block relative pb-3">
                            ${cat.name}
                            <div class="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-primary rounded"></div>
                        </h2>
                        ${cat.description ? `<p class="text-gray-500 mt-3 text-sm md:text-base max-w-2xl mx-auto">${cat.description}</p>` : ''}
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6" id="dyn-grid-${cat.id}">
                        <!-- Products rendered dynamically -->
                    </div>
                </div>
            </section>
        `;

        // Chèn Promo Banner ở vị trí hài hòa sau danh mục thứ 2
        if (index === 1 || cat.id === 'bo_hoa') {
            html += `
                <section class="py-8 bg-white">
                    <div class="container mx-auto max-w-7xl px-4">
                        <div class="relative rounded-2xl overflow-hidden h-48 md:h-60 shadow-md group img-skeleton">
                            <img src="https://images.unsplash.com/photo-1561181286-d3fee7d55364?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
                                alt="Banner Hoa Chúc Mừng" loading="lazy" decoding="async" onload="this.classList.add('loaded'); this.parentElement.classList.remove('img-skeleton');"
                                class="w-full h-full object-cover group-hover:scale-105 transition duration-700">
                            <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <div class="text-center text-white p-4">
                                    <h3 class="font-serif text-2xl md:text-4xl font-bold mb-2 shadow-sm" data-i18n="banner_promo_title">Kệ Hoa Chúc Mừng & Khai Trương</h3>
                                    <p class="mb-4 text-sm md:text-base hidden md:block" data-i18n="banner_promo_desc">Mang thịnh vượng, tài lộc đến đối tác và bạn bè</p>
                                    <a href="#cat-ke_hoa" onclick="scrollToCategory('ke_hoa'); return false;"
                                        class="bg-white text-gray-900 hover:bg-primary hover:text-white px-6 py-2 rounded-full font-bold text-sm transition inline-block shadow-md">
                                        <span data-i18n="banner_promo_btn">Khám Phá Kệ Hoa</span>
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
 * Render toàn bộ danh mục sản phẩm từ API Backend vào từng Section
 */
export async function renderAllProducts() {
    try {
        const [prods, cats] = await Promise.all([
            getProducts(true),
            getCategories(true)
        ]);

        if (Array.isArray(cats) && cats.length > 0) {
            activeStorefrontCategories = cats;
            populateCategoryDropdowns(cats);
        }
        if (Array.isArray(prods) && prods.length > 0) {
            allStorefrontProducts = prods;
        }

        renderDynamicStorefrontSections(activeStorefrontCategories, allStorefrontProducts);
    } catch (e) {
        console.warn("Lỗi nạp danh mục/sản phẩm:", e);
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
 * Tìm kiếm sản phẩm theo tên / mô tả / thành phần trên Storefront
 * Hỗ trợ tìm kiếm cả tiếng Việt CÓ DẤU và KHÔNG DẤU (vd: 'hoa hong' -> khớp 'Hoa hồng')
 * Hỗ trợ đồng bộ Hash URL dạng: /#/search?q=tên_hoa
 * Tự động cuộn trang (scroll) tới danh sách kết quả để người dùng thấy ngay
 */
export function searchStorefrontProducts(query, updateUrl = true, autoScroll = true) {
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

    // Tự động cuộn mượt mà tới phần danh sách kết quả tìm kiếm (tương tự như bấm tab danh mục)
    if (autoScroll && typeof document !== 'undefined') {
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
                html += `
                    <div onclick="scrollToCategory('${cat.id}')" class="flex flex-col items-center group cursor-pointer w-24 md:w-32 transition transform hover:-translate-y-1">
                        <div class="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-pink-100 group-hover:border-primary transition p-1 shadow-sm bg-white">
                            <img src="${img}" alt="${cat.name}" loading="lazy" decoding="async" onload="this.classList.add('loaded')" class="product-img w-full h-full object-cover rounded-full">
                        </div>
                        <span class="mt-2.5 font-bold text-gray-800 group-hover:text-primary transition text-xs md:text-sm text-center line-clamp-1">${cat.name}</span>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        // 2. Desktop Header Navigation (Các Tab Danh Mục trên Header)
        if (desktopDynamicNav) {
            let navHtml = '';
            activeCats.forEach((cat) => {
                navHtml += `
                    <a href="#cat-${cat.id}" onclick="scrollToCategory('${cat.id}'); return false;" class="hover:text-primary transition whitespace-nowrap text-sm font-bold text-gray-700 uppercase tracking-wide">${cat.name}</a>
                `;
            });
            desktopDynamicNav.innerHTML = navHtml;
        }

        // 3. Mobile Menu Navigation (Các Tab Danh Mục trên Mobile)
        if (mobileDynamicNav) {
            let mobHtml = '';
            activeCats.forEach((cat) => {
                mobHtml += `
                    <li><a href="#cat-${cat.id}" onclick="scrollToCategory('${cat.id}'); if(typeof closeMenu==='function')closeMenu(); return false;" class="block">${cat.name}</a></li>
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
        setText('footerPhone', phone);
        setHref('footerPhone', `tel:${cleanPhone}`);
        setText('storeHotlineLink', phone);
        setHref('storeHotlineLink', `tel:${cleanPhone}`);
        setHref('floatingHotlineLink', `tel:${cleanPhone}`);
        setText('floatingHotlineText', phone);
    }

    if (info.email) {
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
            }
        }
    } catch (e) {
        console.log("Using local company info default.");
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

// 4. Khởi chạy khi tải xong trang (DOM Content Loaded)
async function initApp() {
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
    window.renderStorefrontCategories = renderStorefrontCategories;
    window.populateCategoryDropdowns = populateCategoryDropdowns;
    window.renderDynamicStorefrontSections = renderDynamicStorefrontSections;
    window.searchStorefrontProducts = searchStorefrontProducts;
    window.debouncedSearchStorefrontProducts = debouncedSearchStorefrontProducts;
    window.clearStorefrontSearch = clearStorefrontSearch;
    window.updateSearchClearButtonVisibility = updateSearchClearButtonVisibility;
    window.removeVietnameseTones = removeVietnameseTones;
    window.initMobileMenu = initMobileMenu;
    window.openProductQuickDetail = openProductQuickDetail;
    window.closeProductQuickDetail = closeProductQuickDetail;
    window.applyStorefrontCompanyInfo = applyStorefrontCompanyInfo;
    window.loadStorefrontCompanyInfo = loadStorefrontCompanyInfo;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
}
