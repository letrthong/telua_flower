import { API_BASE } from './utils.js';
import { 
    products_gio_hoa,
    products_bo_hoa, 
    products_ke_hoa, 
    products_binh_hoa, 
    products_lan_ho_diep,
    products_hoa_cuoi, 
    default_categories 
} from './products.js';
import { translations } from './translations.js';
import { setLanguage } from './i18n.js';
import { addToCart } from './checkout.js';

// Gắn dữ liệu và hàm vào window cho toàn bộ trang
if (typeof window !== 'undefined') {
    window.products_gio_hoa = products_gio_hoa;
    window.products_bo_hoa = products_bo_hoa;
    window.products_ke_hoa = products_ke_hoa;
    window.products_binh_hoa = products_binh_hoa;
    window.products_lan_ho_diep = products_lan_ho_diep;
    window.products_hoa_cuoi = products_hoa_cuoi;
    window.default_categories = default_categories;
    window.translations = translations;
    window.setLanguage = setLanguage;
    window.addToCart = addToCart;
}

/**
 * 1. Hàm Render sản phẩm HTML (Tối ưu Lazy Loading & i18n)
 */
export function renderProducts(products, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !Array.isArray(products) || products.length === 0) return;
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

    let prod = null;

    // 1. Thử gọi API /api/products/<productId>
    try {
        const res = await fetch(`${API_BASE}/products/${productId}`);
        if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
                prod = json.data;
            }
        }
    } catch (e) {
        console.log("Fetching API failed, using fallback mock product.");
    }

    // 2. Nếu không có từ API -> Tìm trong mock lists
    if (!prod) {
        const allMocks = [
            ...(window.products_bo_hoa || products_bo_hoa || []),
            ...(window.products_ke_hoa || products_ke_hoa || []),
            ...(window.products_binh_hoa || products_binh_hoa || [])
        ];
        prod = allMocks.find(p => p && (p.id === productId || p.name === productId || `prod_${(p.name || '').toLowerCase().replace(/\s+/g, '_')}` === productId));
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
        if (catLabelEl) catLabelEl.textContent = prod.category ? prod.category.toUpperCase().replace("_", " ") : "HOA TƯƠI CAO CẤP";

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
 * Render toàn bộ danh mục sản phẩm từ Local JS hoặc API Backend vào từng Section riêng biệt
 */
export async function renderAllProducts() {
    // 1. Render ngay lập tức từ bộ dữ liệu mock cục bộ
    const gioHoa = (typeof window !== 'undefined' && window.products_gio_hoa) ? window.products_gio_hoa : products_gio_hoa;
    const boHoa = (typeof window !== 'undefined' && window.products_bo_hoa) ? window.products_bo_hoa : products_bo_hoa;
    const keHoa = (typeof window !== 'undefined' && window.products_ke_hoa) ? window.products_ke_hoa : products_ke_hoa;
    const binhHoa = (typeof window !== 'undefined' && window.products_binh_hoa) ? window.products_binh_hoa : products_binh_hoa;
    const lanHoDiep = (typeof window !== 'undefined' && window.products_lan_ho_diep) ? window.products_lan_ho_diep : products_lan_ho_diep;
    const hoaCuoi = (typeof window !== 'undefined' && window.products_hoa_cuoi) ? window.products_hoa_cuoi : products_hoa_cuoi;

    if (Array.isArray(gioHoa) && gioHoa.length > 0) renderProducts(gioHoa, 'gio-hoa-grid');
    if (Array.isArray(boHoa) && boHoa.length > 0) renderProducts(boHoa, 'bo-hoa-grid');
    if (Array.isArray(keHoa) && keHoa.length > 0) renderProducts(keHoa, 'ke-hoa-grid');
    if (Array.isArray(binhHoa) && binhHoa.length > 0) renderProducts(binhHoa, 'binh-hoa-grid');
    if (Array.isArray(lanHoDiep) && lanHoDiep.length > 0) renderProducts(lanHoDiep, 'lan-ho-diep-grid');
    if (Array.isArray(hoaCuoi) && hoaCuoi.length > 0) renderProducts(hoaCuoi, 'hoa-cuoi-grid');

    // 2. Nạp thêm danh mục động từ Backend API /api/flower/v1/products
    try {
        const res = await fetch(`${API_BASE}/products?active=true`);
        if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                allStorefrontProducts = json.data;

                const apiGioHoa = json.data.filter(p => p.category === 'gio_hoa');
                const apiBoHoa = json.data.filter(p => p.category === 'bo_hoa');
                const apiKeHoa = json.data.filter(p => p.category === 'ke_hoa');
                const apiBinhHoa = json.data.filter(p => p.category === 'binh_hoa');
                const apiLanHoDiep = json.data.filter(p => p.category === 'lan_ho_diep');
                const apiHoaCuoi = json.data.filter(p => p.category === 'hoa_cuoi');

                if (apiGioHoa.length > 0) renderProducts(apiGioHoa, 'gio-hoa-grid');
                if (apiBoHoa.length > 0) renderProducts(apiBoHoa, 'bo-hoa-grid');
                if (apiKeHoa.length > 0) renderProducts(apiKeHoa, 'ke-hoa-grid');
                if (apiBinhHoa.length > 0) renderProducts(apiBinhHoa, 'binh-hoa-grid');
                if (apiLanHoDiep.length > 0) renderProducts(apiLanHoDiep, 'lan-ho-diep-grid');
                if (apiHoaCuoi.length > 0) renderProducts(apiHoaCuoi, 'hoa-cuoi-grid');
            }
        }
    } catch (e) {
        console.log("Using static catalogue products.");
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
 * Render danh mục nhanh trên Storefront & Navigation từ API /api/categories hoặc categories.json
 */
export async function renderStorefrontCategories() {
    const container = document.getElementById('storefrontQuickCategories');
    const desktopDynamicNav = document.getElementById('dynamicNavItems');
    const mobileDynamicNav = document.getElementById('mobileDynamicNavItems');

    const defaultCats = (typeof window !== 'undefined' && window.default_categories) ? window.default_categories : default_categories;

    // Helper render categories lên UI
    function applyCategories(cats) {
        if (!Array.isArray(cats) || cats.length === 0) return;
        const activeCats = cats.filter(c => c && c.isActive !== false && c.status !== 'deleted' && !c.isDeleted);
        activeCats.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));

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

        // 4. Tự động Ẩn/Hiện toàn bộ Section của danh mục theo trạng thái Bật/Ẩn của Admin
        const allPossibleCatIds = ['gio_hoa', 'bo_hoa', 'ke_hoa', 'binh_hoa', 'lan_ho_diep', 'hoa_cuoi'];
        allPossibleCatIds.forEach(id => {
            const sec = document.getElementById(`cat-${id}`);
            const isActive = activeCats.some(c => c && c.id === id);
            if (sec) {
                sec.style.display = isActive ? '' : 'none';
            }
        });
    }

    // Nạp danh mục mặc định từ categories.json
    applyCategories(defaultCats);

    // Nạp đồng bộ từ API backend /api/flower/v1/categories
    try {
        const res = await fetch(`${API_BASE}/categories?active=true`);
        if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                if (typeof window !== 'undefined') window.default_categories = json.data;
                applyCategories(json.data);
            }
        }
    } catch (e) {
        console.log("Using static categories from categories.json.");
    }
}

// 3. Khởi chạy khi tải xong trang (DOM Content Loaded)
function initApp() {
    initMobileMenu();
    renderStorefrontCategories();
    renderAllProducts();
    
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

    // 1. Đọc ngôn ngữ từ Cache
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
    window.initMobileMenu = initMobileMenu;
    window.openProductQuickDetail = openProductQuickDetail;
    window.closeProductQuickDetail = closeProductQuickDetail;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
}
