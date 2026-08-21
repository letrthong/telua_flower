// Ứng dụng chính Nở Hoa Thả Bình (Rendering, Giỏ hàng, Menu di động, Khởi tạo trang)

// 1. Hàm Render sản phẩm HTML (Tối ưu Lazy Loading & i18n)
function renderProducts(products, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !Array.isArray(products)) return;
    let html = '';
    const btnText = (typeof translations !== 'undefined' && translations[currentLang] && translations[currentLang].btn_add_to_cart)
        ? translations[currentLang].btn_add_to_cart
        : "Thêm giỏ hàng";

    products.forEach(product => {
        const hasDiscount = product.originalPrice !== product.salePrice;
        const badgeHtml = product.badge
            ? `<span class="absolute top-2 left-2 bg-accent text-white text-xs font-bold px-2 py-1 rounded shadow-sm z-10">${product.badge}</span>`
            : '';
        const priceHtml = hasDiscount
            ? `<span class="text-gray-400 line-through text-xs md:text-sm mr-2">${product.originalPrice}</span>
               <span class="text-primary font-bold text-sm md:text-base">${product.salePrice}</span>`
            : `<span class="text-primary font-bold text-sm md:text-base">${product.salePrice}</span>`;

        html += `
            <div class="product-card bg-white rounded-xl shadow-sm hover:shadow-xl transition duration-300 overflow-hidden flex flex-col group relative border border-gray-100">
                ${badgeHtml}
                <div class="relative h-48 md:h-64 overflow-hidden cursor-pointer img-skeleton">
                    <img src="${product.image}" alt="${product.name}" loading="lazy" decoding="async" onload="this.classList.add('loaded'); this.parentElement.classList.remove('img-skeleton');" class="product-img w-full h-full object-cover">
                    
                    <!-- Nút Thêm vào giỏ hàng (Hiển thị khi hover) -->
                    <div class="absolute inset-0 bg-black bg-opacity-20 flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4">
                        <button onclick="addToCart()" class="bg-primary hover:bg-primaryHover text-white w-full py-2 rounded font-semibold text-sm transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-md">
                            <i class="fa-solid fa-cart-plus mr-1"></i> <span data-i18n="btn_add_to_cart">${btnText}</span>
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
    if (typeof initLazyLoadingImages === 'function') {
        initLazyLoadingImages();
    }
}

// 2. Logic Giỏ hàng
let cartItemCount = 0;

function addToCart() {
    cartItemCount++;
    const cartCountElement = document.getElementById('cartCount');
    if (cartCountElement) {
        cartCountElement.textContent = cartItemCount;
        cartCountElement.classList.add('animate-bounce');
        setTimeout(() => cartCountElement.classList.remove('animate-bounce'), 1000);
    }

    // Hiện Toast đa ngôn ngữ
    const toastMsg = (typeof translations !== 'undefined' && translations[currentLang] && translations[currentLang].toast_added_cart)
        ? translations[currentLang].toast_added_cart
        : "Đã thêm vào giỏ hàng thành công!";
    if (typeof showToast === 'function') {
        showToast(toastMsg);
    }
}

function toggleCart() {
    if (cartItemCount === 0) {
        const emptyMsg = (typeof translations !== 'undefined' && translations[currentLang] && translations[currentLang].cart_empty_alert)
            ? translations[currentLang].cart_empty_alert
            : 'Giỏ hàng của bạn đang trống. Hãy chọn sản phẩm hoa tươi hoặc bình cắm hoa nhé!';
        alert(emptyMsg);
    } else {
        let alertMsg = (typeof translations !== 'undefined' && translations[currentLang] && translations[currentLang].cart_checkout_alert)
            ? translations[currentLang].cart_checkout_alert
            : `Giỏ hàng của bạn hiện có {n} sản phẩm. Chức năng thanh toán đang được xử lý!`;
        alert(alertMsg.replace('{n}', cartItemCount));
    }
}

// 3. Logic Menu Mobile
function initMobileMenu() {
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

    window.closeMenu = function() {
        if (mobileMenuContent) mobileMenuContent.classList.add('-translate-x-full');
        setTimeout(() => {
            if (mobileMenu) mobileMenu.classList.add('hidden');
        }, 300);
    };

    if (closeMenuBtn) closeMenuBtn.addEventListener('click', window.closeMenu);
    if (mobileMenu) {
        mobileMenu.addEventListener('click', (e) => {
            if (e.target === mobileMenu) window.closeMenu();
        });
    }
}

// 4. Khởi chạy khi tải xong trang (DOM Content Loaded)
document.addEventListener('DOMContentLoaded', () => {
    // 1. Đọc ngôn ngữ từ Cache (localStorage) hoặc mặc định Tiếng Việt
    let cachedLang = 'vi';
    try {
        cachedLang = localStorage.getItem('anne_flower_lang') || 'vi';
    } catch (e) {
        cachedLang = 'vi';
    }

    // 2. Thiết lập ngôn ngữ ban đầu & render sản phẩm
    if (typeof setLanguage === 'function') {
        setLanguage(cachedLang);
    }

    // 3. Khởi tạo lazy loading cho các ảnh tĩnh khác trên trang
    if (typeof initLazyLoadingImages === 'function') {
        initLazyLoadingImages();
    }

    // 4. Gắn các sự kiện menu mobile
    initMobileMenu();
});
