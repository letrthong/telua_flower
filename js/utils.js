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

let storefrontBranches = [];
let currentSelectedBranch = null;

// Tải và hiển thị danh sách chuỗi cửa hàng động
export async function loadAndRenderStorefrontBranches() {
    const navContainer = document.getElementById("storeBranchNav");
    if (!navContainer) return;

    try {
        const res = await fetch("/api/flower/v1/branches");
        const json = await res.json();

        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            storefrontBranches = json.data.filter((b) => b.isActive !== false);
        } else {
            // Fallback nếu API chưa trả về
            storefrontBranches = [
                {
                    id: "branch_q10",
                    code: "CN_Q10",
                    name: "Nở Hoa Thả Bình - Showroom Quận 10 (Flagship)",
                    address: "183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP. Hồ Chí Minh",
                    phone: "0976.491.322",
                    openHours: "07:00 - 21:00 (Thứ 2 - Chủ Nhật)",
                    amenities: "Đậu xe ô tô/xe máy miễn phí • Cắm hoa nghệ thuật tại chỗ • Phòng lạnh bảo quản hoa",
                    lat: 10.7725,
                    lng: 106.6698
                },
                {
                    id: "branch_q1",
                    code: "CN_Q1",
                    name: "Nở Hoa Thả Bình - Showroom Bến Nghé Quận 1",
                    address: "Số 2 Hải Triều, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
                    phone: "0976.491.323",
                    openHours: "08:00 - 21:30 (Thứ 2 - Chủ Nhật)",
                    amenities: "Giao hoa hỏa tốc văn phòng Bitexco • Gói quà cao cấp",
                    lat: 10.7715,
                    lng: 106.7042
                },
                {
                    id: "branch_thao_dien",
                    code: "CN_Q2",
                    name: "Nở Hoa Thả Bình - Showroom Thảo Điền",
                    address: "68 Xuân Thủy, Phường Thảo Điền, TP. Thủ Đức, TP. Hồ Chí Minh",
                    phone: "0976.491.324",
                    openHours: "07:30 - 21:00 (Thứ 2 - Chủ Nhật)",
                    amenities: "Không gian workshop cắm hoa • Hoa nhập khẩu cao cấp Hà Lan & Ecuador",
                    lat: 10.8035,
                    lng: 106.7328
                }
            ];
        }

        renderStorefrontBranchButtons();
        if (storefrontBranches.length > 0) {
            selectShowroomBranch(storefrontBranches[0].id);
        }
    } catch (e) {
        console.warn("Lỗi tải chuỗi showroom:", e);
    }
}

function renderStorefrontBranchButtons() {
    const navContainer = document.getElementById("storeBranchNav");
    if (!navContainer) return;

    let html = "";
    storefrontBranches.forEach((b, idx) => {
        const isSelected = currentSelectedBranch && currentSelectedBranch.id === b.id;
        const btnClass = isSelected
            ? "px-4 py-2 bg-primary text-white font-bold text-xs sm:text-sm rounded-full shadow-md shadow-pink-200 border border-primary transition flex items-center"
            : "px-4 py-2 bg-white text-gray-700 hover:text-primary hover:bg-pink-50 font-bold text-xs sm:text-sm rounded-full shadow-xs border border-gray-200 transition flex items-center";

        html += `
            <button onclick="selectShowroomBranch('${b.id}')" class="${btnClass}">
                <i class="fa-solid fa-store mr-1.5 ${isSelected ? 'text-white' : 'text-primary'}"></i>
                <span>${b.name.replace("Nở Hoa Thả Bình - ", "")}</span>
            </button>
        `;
    });

    navContainer.innerHTML = html;
}

export function selectShowroomBranch(branchId) {
    const b = storefrontBranches.find((item) => item.id === branchId) || storefrontBranches[0];
    if (!b) return;

    currentSelectedBranch = b;
    renderStorefrontBranchButtons();

    // Cập nhật thẻ thông tin
    const nameEl = document.getElementById("storeNameVal");
    const addrEl = document.getElementById("storeAddressVal");
    const hoursEl = document.getElementById("storeHoursVal");
    const hotlineLink = document.getElementById("storeHotlineLink");
    const amenitiesEl = document.getElementById("storeAmenitiesVal");
    const mapIframe = document.getElementById("storeMapIframe");
    const directionsLink = document.getElementById("storeDirectionsLink");
    const largerMapLink = document.getElementById("storeLargerMapLink");

    if (nameEl) nameEl.textContent = b.name;
    if (addrEl) addrEl.textContent = b.address;
    if (hoursEl) hoursEl.textContent = b.openHours || "07:30 - 21:00 (Thứ 2 - Chủ Nhật)";
    if (hotlineLink) {
        hotlineLink.textContent = b.phone || "0976.491.322";
        hotlineLink.href = `tel:${(b.phone || "").replace(/\./g, "")}`;
    }
    if (amenitiesEl) amenitiesEl.textContent = b.amenities || "Đậu xe ô tô/xe máy miễn phí, cắm hoa nghệ thuật theo yêu cầu";

    // Cập nhật iframe Google Maps và Link chỉ đường
    const query = encodeURIComponent(b.address);
    if (mapIframe) {
        mapIframe.src = `https://maps.google.com/maps?q=${query}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
    }
    if (directionsLink) {
        directionsLink.href = `https://www.google.com/maps/dir/?api=1&destination=${query}`;
    }
    if (largerMapLink) {
        largerMapLink.href = `https://maps.google.com/?q=${query}`;
    }
}

// Điều hướng tới bản đồ showroom
export function openStoreMap(e) {
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
export function copyStoreAddress() {
    const addressText = currentSelectedBranch 
        ? currentSelectedBranch.address 
        : (document.getElementById("storeAddressVal") ? document.getElementById("storeAddressVal").textContent : "183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP. Hồ Chí Minh");
        
    const copiedMsg = "Đã sao chép địa chỉ showroom vào clipboard!";

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

// Tự động khởi chạy khi DOM sẵn sàng
document.addEventListener("DOMContentLoaded", () => {
    loadAndRenderStorefrontBranches();
});

// Global binding
if (typeof window !== "undefined") {
    window.openStoreMap = openStoreMap;
    window.copyStoreAddress = copyStoreAddress;
    window.selectShowroomBranch = selectShowroomBranch;
    window.loadAndRenderStorefrontBranches = loadAndRenderStorefrontBranches;
}
