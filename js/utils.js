// Các tiện ích (Utils): Lazy Loading hình ảnh, Thông báo Toast, Bản đồ showroom, Sao chép clipboard

// Tối ưu hóa Lazy Loading cho hình ảnh toàn trang
function initLazyLoadingImages() {
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    lazyImages.forEach(img => {
        const markLoaded = () => {
            img.classList.add('loaded');
            if (img.parentElement && img.parentElement.classList.contains('img-skeleton')) {
                img.parentElement.classList.remove('img-skeleton');
            }
        };

        if (img.complete && img.naturalWidth > 0) {
            markLoaded();
        } else {
            img.addEventListener('load', markLoaded);
            img.addEventListener('error', markLoaded);
        }
    });
}

// Hiển thị thông báo Toast
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    if (message && toast.querySelector('span')) {
        toast.querySelector('span').textContent = message;
    }
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

// Điều hướng tới bản đồ showroom
function openStoreMap(e) {
    if (e) e.preventDefault();
    const storeSection = document.getElementById('tim-cua-hang');
    const storeCard = document.getElementById('storeInfoCard');

    if (storeSection) {
        storeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Hiệu ứng highlight thẻ thông tin showroom
        if (storeCard) {
            storeCard.classList.add('ring-4', 'ring-primary', 'shadow-2xl', 'scale-[1.01]');
            setTimeout(() => {
                storeCard.classList.remove('ring-4', 'ring-primary', 'shadow-2xl', 'scale-[1.01]');
            }, 2000);
        }
    }
}

// Sao chép địa chỉ showroom vào clipboard
function copyStoreAddress() {
    const addressText = (typeof translations !== 'undefined' && translations[currentLang] && translations[currentLang].store_address_val)
        ? translations[currentLang].store_address_val
        : "183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP. Hồ Chí Minh";
    const copiedMsg = (typeof translations !== 'undefined' && translations[currentLang] && translations[currentLang].store_copied_toast)
        ? translations[currentLang].store_copied_toast
        : "Đã sao chép địa chỉ cửa hàng!";

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(addressText).then(() => {
            showToast(copiedMsg);
        }).catch(() => {
            showToast(addressText);
        });
    } else {
        showToast(addressText);
    }
}
