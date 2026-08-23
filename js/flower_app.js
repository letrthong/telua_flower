import { products_bo_hoa, products_ke_hoa, products_binh_hoa } from './products.js';
import { translations } from './translations.js';
import { setLanguage } from './i18n.js';
import { addToCart } from './checkout.js';

// Gắn dữ liệu và hàm vào window cho toàn bộ trang
if (typeof window !== 'undefined') {
    window.products_bo_hoa = products_bo_hoa;
    window.products_ke_hoa = products_ke_hoa;
    window.products_binh_hoa = products_binh_hoa;
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
                <div class="relative h-48 md:h-64 overflow-hidden cursor-pointer">
                    <img src="${prodImg}" alt="${product.name}" loading="lazy" decoding="async" onload="this.classList.add('loaded')" onerror="this.classList.add('loaded')" class="product-img w-full h-full object-cover">
                    
                    <!-- Nút Thêm vào giỏ hàng (Hiển thị khi hover) -->
                    <div class="absolute inset-0 bg-black/30 flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4">
                        <button onclick="addToCart('${prodId}', '${safeName}', ${numericPrice}, '${prodImg}')" class="bg-primary hover:bg-primaryHover text-white w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-md flex items-center justify-center">
                            <i class="fa-solid fa-cart-plus mr-1.5"></i> <span data-i18n="btn_add_to_cart">${btnText}</span>
                        </button>
                    </div>
                </div>
                <div class="p-4 flex flex-col flex-grow text-center">
                    <h3 class="font-bold text-gray-800 text-sm md:text-base mb-2 flex-grow hover:text-primary cursor-pointer line-clamp-2">${product.name}</h3>
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
 * Render toàn bộ danh mục sản phẩm từ Local JS hoặc API Backend
 */
export async function renderAllProducts() {
    // 1. Render ngay lập tức từ bộ dữ liệu mock cục bộ
    const boHoa = (typeof window !== 'undefined' && window.products_bo_hoa) ? window.products_bo_hoa : products_bo_hoa;
    const keHoa = (typeof window !== 'undefined' && window.products_ke_hoa) ? window.products_ke_hoa : products_ke_hoa;
    const binhHoa = (typeof window !== 'undefined' && window.products_binh_hoa) ? window.products_binh_hoa : products_binh_hoa;

    if (Array.isArray(boHoa) && boHoa.length > 0) renderProducts(boHoa, 'bo-hoa-grid');
    if (Array.isArray(keHoa) && keHoa.length > 0) renderProducts(keHoa, 'ke-hoa-grid');
    if (Array.isArray(binhHoa) && binhHoa.length > 0) renderProducts(binhHoa, 'binh-hoa-grid');

    // 2. Nạp thêm danh mục động từ Backend API (/api/products)
    try {
        const res = await fetch('/api/products?active=true');
        if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                const apiBoHoa = json.data.filter(p => p.category === 'bo_hoa');
                const apiKeHoa = json.data.filter(p => p.category === 'ke_hoa');
                const apiBinhHoa = json.data.filter(p => p.category === 'binh_hoa' || p.category === 'gio_hoa' || p.category === 'lan_ho_diep');

                if (apiBoHoa.length > 0) renderProducts(apiBoHoa, 'bo-hoa-grid');
                if (apiKeHoa.length > 0) renderProducts(apiKeHoa, 'ke-hoa-grid');
                if (apiBinhHoa.length > 0) renderProducts(apiBinhHoa, 'binh-hoa-grid');
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

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            if (mobileMenu) mobileMenu.classList.remove('hidden');
            setTimeout(() => {
                if (mobileMenuContent) mobileMenuContent.classList.remove('-translate-x-full');
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

// 3. Khởi chạy khi tải xong trang (DOM Content Loaded)
function initApp() {
    // 1. Đọc ngôn ngữ từ Cache
    let cachedLang = 'vi';
    try {
        if (typeof localStorage !== 'undefined') {
            cachedLang = localStorage.getItem('anne_flower_lang') || 'vi';
        }
    } catch (e) {
        cachedLang = 'vi';
    }

    // 2. Render sản phẩm ngay lập tức
    renderAllProducts();

    // 3. Thiết lập ngôn ngữ
    if (typeof setLanguage === 'function') {
        setLanguage(cachedLang);
    }

    // 4. Gắn các sự kiện menu mobile
    initMobileMenu();
}

if (typeof window !== 'undefined') {
    window.renderProducts = renderProducts;
    window.renderAllProducts = renderAllProducts;
    window.initMobileMenu = initMobileMenu;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
}
