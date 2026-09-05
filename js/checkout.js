import { API_BASE } from './utils.js';

/**
 * Phân hệ Quản Lý Giỏ Hàng & Đặt Hàng Thông Minh (TASK 03 - Checkout & Ordering Experience)
 * Hỗ trợ hẹn giờ 30 ngày, khung giờ giao 2H, viết thiệp, in ruy-băng, gửi ẩn danh & tính phí ship.
 */

const CART_STORAGE_KEY = "telua_cart_items_v2";

/**
 * Lấy danh sách sản phẩm trong giỏ hàng từ Web Storage
 */
export function getCartItems() {
    if (typeof localStorage === "undefined") return [];
    try {
        const data = localStorage.getItem(CART_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

/**
 * Lưu giỏ hàng vào Web Storage
 */
export function saveCartItems(items) {
    if (typeof localStorage !== "undefined") {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }
    updateCartBadge();
}

/**
 * Thêm sản phẩm vào giỏ hàng
 */
export function addToCart(productId, name, priceNumber, image, category = "bo_hoa", quantity = 1) {
    let items = getCartItems();
    const existingIndex = items.findIndex((i) => i.productId === productId);

    if (existingIndex > -1) {
        items[existingIndex].quantity += quantity;
    } else {
        items.push({
            productId: productId || `prod_${Date.now()}`,
            name: name || "Sản phẩm hoa tươi",
            price: parseInt(priceNumber, 10) || 420000,
            image: image || "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=400",
            category: category,
            quantity: quantity
        });
    }

    saveCartItems(items);

    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[lang]) ? trans[lang] : {};
    const toastTemplate = dict.toast_added_cart_item || 'Đã thêm "{name}" vào giỏ hàng!';
    const toastMsg = toastTemplate.replace("{name}", name || "");

    if (typeof showToast === "function") {
        showToast(toastMsg);
    } else {
        const toast = document.getElementById("toast");
        if (toast) {
            const span = toast.querySelector("span");
            if (span) span.textContent = toastMsg;
            toast.classList.remove("translate-y-20", "opacity-0");
            setTimeout(() => toast.classList.add("translate-y-20", "opacity-0"), 2500);
        }
    }
}

/**
 * Xóa một sản phẩm khỏi giỏ hàng
 */
export function removeFromCart(productId) {
    let items = getCartItems();
    items = items.filter((i) => i.productId !== productId);
    saveCartItems(items);
    renderCartDrawer();
}

/**
 * Cập nhật số lượng sản phẩm
 */
export function updateCartQuantity(productId, delta) {
    let items = getCartItems();
    const item = items.find((i) => i.productId === productId);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
            items = items.filter((i) => i.productId !== productId);
        }
    }
    saveCartItems(items);
    renderCartDrawer();
}

/**
 * Tính tổng tiền hàng trong giỏ
 */
export function calculateSubtotal(items) {
    return (items || getCartItems()).reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/**
 * Định dạng số tiền sang định dạng VND đẹp mắt
 */
export function formatVND(amount) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

/**
 * Cập nhật số lượng huy hiệu trên Header
 */
export function updateCartBadge() {
    const items = getCartItems();
    const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const badge = document.getElementById("cartCount");
    if (badge) {
        badge.textContent = totalCount;
        if (totalCount > 0) {
            badge.classList.remove("hidden");
        }
    }
}

/**
 * Mở / Đóng Drawer Giỏ hàng bên phải màn hình
 */
export function toggleCartDrawer(show = null) {
    const drawer = document.getElementById("cartDrawer");
    const overlay = document.getElementById("cartOverlay");
    if (!drawer || !overlay) return;

    const isHidden = drawer.classList.contains("translate-x-full");
    const shouldOpen = show !== null ? show : isHidden;

    if (shouldOpen) {
        renderCartDrawer();
        overlay.classList.remove("hidden");
        setTimeout(() => {
            drawer.classList.remove("translate-x-full");
        }, 10);
    } else {
        drawer.classList.add("translate-x-full");
        setTimeout(() => {
            overlay.classList.add("hidden");
        }, 300);
    }
}

/**
 * Render danh sách sản phẩm trong Cart Drawer
 */
export function renderCartDrawer() {
    const container = document.getElementById("cartDrawerItems");
    const subtotalEl = document.getElementById("cartDrawerSubtotal");
    const checkoutBtn = document.getElementById("btnDrawerCheckout");
    const items = getCartItems();

    if (!container) return;

    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[lang]) ? trans[lang] : {};

    // Cập nhật lại toàn bộ nhãn tĩnh trong Cart Drawer
    const drawer = document.getElementById("cartDrawer");
    if (drawer) {
        drawer.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) el.innerHTML = dict[key];
        });
    }

    if (items.length === 0) {
        const emptyTitle = dict.cart_empty_title || "Giỏ hàng của bạn đang trống";
        const emptyDesc = dict.cart_empty_desc || "Hãy chọn những đóa hoa tươi đẹp nhất nhé!";
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                <i class="fa-solid fa-basket-shopping text-5xl mb-4 text-pink-200"></i>
                <p class="font-medium text-sm text-gray-500" data-i18n="cart_empty_title">${emptyTitle}</p>
                <p class="text-xs text-gray-400 mt-1" data-i18n="cart_empty_desc">${emptyDesc}</p>
            </div>
        `;
        if (subtotalEl) subtotalEl.textContent = "0₫";
        if (checkoutBtn) checkoutBtn.disabled = true;
        return;
    }

    if (checkoutBtn) checkoutBtn.disabled = false;
    const subtotal = calculateSubtotal(items);
    if (subtotalEl) subtotalEl.textContent = formatVND(subtotal);

    let html = "";
    items.forEach((item) => {
        const itemDisplayName = (typeof window !== "undefined" && typeof window.getProductName === "function")
            ? window.getProductName(item)
            : (item.name || "Hoa tươi");
        html += `
            <div class="flex items-center gap-3 p-3 bg-pink-50/40 rounded-xl border border-pink-100">
                <img src="${item.image}" alt="${itemDisplayName}" class="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-white shadow-sm">
                <div class="flex-1 min-w-0">
                    <h4 class="text-xs font-bold text-gray-800 truncate">${itemDisplayName}</h4>
                    <p class="text-xs font-bold text-primary mt-0.5">${formatVND(item.price)}</p>
                    <div class="flex items-center gap-2 mt-2">
                        <button onclick="updateCartQuantity('${item.productId}', -1)" class="w-6 h-6 rounded-full bg-white text-gray-600 border border-gray-200 flex items-center justify-center text-xs hover:bg-pink-50">-</button>
                        <span class="text-xs font-bold w-6 text-center">${item.quantity}</span>
                        <button onclick="updateCartQuantity('${item.productId}', 1)" class="w-6 h-6 rounded-full bg-white text-gray-600 border border-gray-200 flex items-center justify-center text-xs hover:bg-pink-50">+</button>
                    </div>
                </div>
                <button onclick="removeFromCart('${item.productId}')" class="text-gray-400 hover:text-red-500 p-1 text-sm transition">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ==========================================
// QUẢN LÝ MODAL CHECKOUT & ĐẶT HOA 30 NGÀY
// ==========================================

let currentAppliedVoucher = null;

/**
 * Mở Modal Đặt Hàng Thông Minh (Checkout Modal)
 *
 * Chính sách đăng nhập: Khách KHÔNG bắt buộc đăng nhập khi vào giỏ hàng.
 * Chỉ khi nhấp nút "Thanh toán" (Checkout) và chưa đăng nhập, hệ thống
 * sẽ mở modal đăng nhập trước. Sau khi đăng nhập thành công, tự động
 * quay lại mở modal checkout (giữ nguyên giỏ hàng & thông tin đã nhập).
 */
export function openCheckoutModal() {
    toggleCartDrawer(false);

    // Kiểm tra đăng nhập: nếu chưa đăng nhập -> yêu cầu đăng nhập trước
    if (typeof isLoggedIn === "function" && !isLoggedIn()) {
        // Lưu intent để sau khi đăng nhập sẽ quay lại mở checkout
        if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem("telua_pending_checkout", "1");
        }
        if (typeof openAuthModal === "function") {
            openAuthModal("login");
        } else {
            alert("Vui lòng đăng nhập để thanh toán!");
        }
        return;
    }

    // Đã đăng nhập -> mở modal checkout bình thường
    openCheckoutModalAfterAuth();
}

/**
 * Mở Modal Checkout (chỉ gọi sau khi đã xác thực đăng nhập)
 */
export function openCheckoutModalAfterAuth() {
    const modal = document.getElementById("checkoutModal");
    if (!modal) return;

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[lang]) ? trans[lang] : {};

    // Cập nhật nhãn & placeholder đa ngôn ngữ trong modal
    modal.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.innerHTML = dict[key];
    });
    modal.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key]) el.setAttribute('placeholder', dict[key]);
    });

    // 1. Khởi tạo danh sách ngày (30 ngày từ hôm nay)
    initDeliveryDatePicker();

    // 2. Tự động điền thông tin nếu đã đăng nhập
    if (typeof getCurrentUser === "function") {
        const user = getCurrentUser();
        if (user) {
            const senderNameInput = document.getElementById("checkoutSenderName");
            const senderPhoneInput = document.getElementById("checkoutSenderPhone");
            const senderEmailInput = document.getElementById("checkoutSenderEmail");
            if (senderNameInput && !senderNameInput.value) senderNameInput.value = user.fullName || "";
            if (senderPhoneInput && !senderPhoneInput.value) senderPhoneInput.value = user.phone || "";
            if (senderEmailInput && !senderEmailInput.value) senderEmailInput.value = user.email || "";
        }
    }

    // 3. Cập nhật bảng tổng kết tài chính
    updateOrderSummary();

    // 4. Khởi tạo phương thức nhận hàng (mặc định delivery)
    onFulfillmentTypeChange();

    // 5. Tải & đồng bộ cấu hình phương thức thanh toán đang BẬT từ paymentConfig.json
    loadCheckoutPaymentMethods();
}

const PAYMENT_CONFIG_CACHE_KEY = 'telua_payment_config_cache_v1';
const PAYMENT_CONFIG_ETAG_KEY = 'telua_payment_config_etag_v1';
let _isSyncingPaymentConfig = false;

function applyPaymentMethodsConfig(methods) {
    if (!methods || typeof document === 'undefined') return;

    const vietqrOpt = document.getElementById("payOption_vietqr");
    const codOpt = document.getElementById("payOption_cod");
    const warningEl = document.getElementById("checkoutNoPaymentWarning");
    const submitBtn = document.getElementById("btnSubmitOrder");

    const onlineEnabled = methods.online ? methods.online.enabled !== false : true;
    const cashEnabled = methods.cash ? methods.cash.enabled !== false : true;

    if (vietqrOpt) {
        vietqrOpt.style.display = onlineEnabled ? "flex" : "none";
        const radio = vietqrOpt.querySelector("input[name='paymentMethod']");
        if (radio) radio.disabled = !onlineEnabled;
    }

    if (codOpt) {
        codOpt.style.display = cashEnabled ? "flex" : "none";
        const radio = codOpt.querySelector("input[name='paymentMethod']");
        if (radio) radio.disabled = !cashEnabled;
    }

    // Tự động chọn phương thức khả dụng đầu tiên nếu phương thức hiện tại bị tắt
    const currentChecked = document.querySelector("input[name='paymentMethod']:checked");
    const currentIsInvalid = !currentChecked || currentChecked.disabled || 
        (currentChecked.value === "vietqr" && !onlineEnabled) || 
        ((currentChecked.value === "cod" || currentChecked.value === "cash") && !cashEnabled);

    if (currentIsInvalid) {
        if (onlineEnabled && vietqrOpt) {
            const radio = vietqrOpt.querySelector("input[name='paymentMethod']");
            if (radio) radio.checked = true;
        } else if (cashEnabled && codOpt) {
            const radio = codOpt.querySelector("input[name='paymentMethod']");
            if (radio) radio.checked = true;
        }
    }

    updatePaymentOptionStyles();

    // Xử lý cảnh báo nếu toàn bộ phương thức bị tắt
    const noneEnabled = !onlineEnabled && !cashEnabled;
    if (warningEl) warningEl.classList.toggle("hidden", !noneEnabled);
    if (submitBtn) {
        if (noneEnabled) {
            submitBtn.disabled = true;
            submitBtn.classList.add("opacity-50", "cursor-not-allowed");
        } else {
            submitBtn.disabled = false;
            submitBtn.classList.remove("opacity-50", "cursor-not-allowed");
        }
    }
}

/**
 * Tải cấu hình phương thức thanh toán từ backend (/api/payment-config)
 * Áp dụng cache LocalStorage (0ms) và kiểm tra ETag 304 khi file thay đổi.
 */
export async function loadCheckoutPaymentMethods(forceRefresh = false) {
    // 1. Khởi tạo tức thì từ LocalStorage cache nếu có (0ms Instant Boot)
    let storedEtag = null;
    if (typeof localStorage !== 'undefined') {
        try {
            const cachedRaw = localStorage.getItem(PAYMENT_CONFIG_CACHE_KEY);
            storedEtag = localStorage.getItem(PAYMENT_CONFIG_ETAG_KEY);
            if (cachedRaw) {
                const parsed = JSON.parse(cachedRaw);
                if (parsed && typeof parsed === 'object') {
                    applyPaymentMethodsConfig(parsed);
                }
            }
        } catch (e) {}
    }

    if (_isSyncingPaymentConfig) return;
    _isSyncingPaymentConfig = true;

    try {
        const headers = {};
        if (storedEtag && !forceRefresh) {
            headers['If-None-Match'] = storedEtag;
        }

        const res = await fetch(`${API_BASE}/payment-config?_t=${Date.now()}`, { headers });
        if (res.status === 200) {
            const json = await res.json();
            let methods = {
                online: { enabled: true },
                cash: { enabled: true }
            };

            if (json.success && json.data && json.data.methods) {
                methods = json.data.methods;
            }

            applyPaymentMethodsConfig(methods);

            const newEtag = res.headers.get("ETag");
            if (typeof localStorage !== 'undefined') {
                try {
                    localStorage.setItem(PAYMENT_CONFIG_CACHE_KEY, JSON.stringify(methods));
                    if (newEtag) localStorage.setItem(PAYMENT_CONFIG_ETAG_KEY, newEtag);
                } catch (e) {}
            }
        } else if (res.status === 304) {
            // Không thay đổi (304 Not Modified) -> Giữ nguyên cấu hình từ cache
        }
    } catch (e) {
        console.warn("[CHECKOUT] Không thể nạp payment-config từ API:", e);
    } finally {
        _isSyncingPaymentConfig = false;
    }
}

/**
 * Cập nhật style viền và màu nền của thẻ thanh toán khi người dùng chọn
 */
export function updatePaymentOptionStyles() {
    const checked = document.querySelector("input[name='paymentMethod']:checked");
    const vietqrOpt = document.getElementById("payOption_vietqr");
    const codOpt = document.getElementById("payOption_cod");

    if (vietqrOpt) {
        const isSel = checked && checked.value === "vietqr";
        if (isSel) {
            vietqrOpt.classList.add("border-primary", "bg-pink-50/60", "font-bold", "text-gray-800", "shadow-2xs");
            vietqrOpt.classList.remove("border-gray-200", "text-gray-600");
        } else {
            vietqrOpt.classList.remove("border-primary", "bg-pink-50/60", "font-bold", "text-gray-800", "shadow-2xs");
            vietqrOpt.classList.add("border-gray-200", "text-gray-600");
        }
    }

    if (codOpt) {
        const isSel = checked && (checked.value === "cod" || checked.value === "cash");
        if (isSel) {
            codOpt.classList.add("border-primary", "bg-pink-50/60", "font-bold", "text-gray-800", "shadow-2xs");
            codOpt.classList.remove("border-gray-200", "text-gray-600");
        } else {
            codOpt.classList.remove("border-primary", "bg-pink-50/60", "font-bold", "text-gray-800", "shadow-2xs");
            codOpt.classList.add("border-gray-200", "text-gray-600");
        }
    }
}

/**
 * Xử lý khi khách đổi phương thức nhận hàng (Giao hàng / Nhận tại cửa hàng)
 */
export function onFulfillmentTypeChange() {
    const selected = document.querySelector("input[name='fulfillmentType']:checked");
    const isPickup = selected && selected.value === "pickup";

    const pickupSection = document.getElementById("pickupBranchSection");
    const addressInput = document.getElementById("checkoutRecipientAddress");
    const deliveryNotesInput = document.getElementById("checkoutDeliveryNotes");

    if (pickupSection) pickupSection.classList.toggle("hidden", !isPickup);

    // Khi pickup: không cần địa chỉ giao & ghi chú giao
    if (addressInput) addressInput.required = !isPickup;
    if (deliveryNotesInput) deliveryNotesInput.disabled = isPickup;

    if (isPickup) {
        loadPickupBranches();
    }

    // Cập nhật lại phí ship (pickup = miễn phí ship)
    updateOrderSummary();
}

/**
 * Tải danh sách cửa hàng để khách chọn nơi nhận hoa (pickup)
 */
export async function loadPickupBranches() {
    const select = document.getElementById("checkoutPickupBranch");
    if (!select) return;

    select.innerHTML = `<option value="">Đang tải danh sách cửa hàng...</option>`;

    try {
        const res = await fetch(`${API_BASE}/branches`);
        const json = await res.json();

        let branches = [];
        if (json.success && Array.isArray(json.data)) {
            branches = json.data;
        } else if (Array.isArray(json)) {
            branches = json;
        }

        const activeBranches = branches.filter(b => b && b.isActive !== false);

        if (activeBranches.length === 0) {
            select.innerHTML = `<option value="">Không có cửa hàng khả dụng</option>`;
            return;
        }

        select.innerHTML = `<option value="">-- Chọn cửa hàng nhận hoa --</option>` +
            activeBranches.map(b => `
                <option value="${b.id}">${b.name || b.id}${b.address ? " • " + b.address : ""}</option>
            `).join("");
    } catch (e) {
        select.innerHTML = `<option value="">Lỗi tải cửa hàng: ${e.message}</option>`;
    }
}

/**
 * Đóng Modal Đặt Hàng
 */
export function closeCheckoutModal() {
    const modal = document.getElementById("checkoutModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

/**
 * Khởi tạo ô chọn ngày giao hoa (Tối đa 30 ngày)
 */
export function initDeliveryDatePicker() {
    const dateSelect = document.getElementById("checkoutDeliveryDate");
    if (!dateSelect) return;

    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[lang]) ? trans[lang] : {};

    const todayWord = dict.checkout_date_today || "Hôm nay";
    const tomorrowWord = dict.checkout_date_tomorrow || "Ngày mai";

    dateSelect.innerHTML = "";
    const today = new Date();

    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(today.getDate() + i);

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const valStr = `${yyyy}-${mm}-${dd}`;

        let label = `${dd}/${mm}/${yyyy}`;
        if (i === 0) label = `${todayWord} (${dd}/${mm})`;
        else if (i === 1) label = `${tomorrowWord} (${dd}/${mm})`;

        const opt = document.createElement("option");
        opt.value = valStr;
        opt.textContent = label;
        dateSelect.appendChild(opt);
    }

    // Nạp danh sách khung giờ cho ngày đầu tiên
    onDeliveryDateChange();
}

/**
 * Khi đổi ngày giao -> nạp khung giờ tương ứng từ Backend
 */
export async function onDeliveryDateChange() {
    const dateSelect = document.getElementById("checkoutDeliveryDate");
    const slotSelect = document.getElementById("checkoutTimeSlot");
    if (!dateSelect || !slotSelect) return;

    const selectedDate = dateSelect.value;
    slotSelect.innerHTML = `<option value="">Đang tải khung giờ...</option>`;

    try {
        const res = await fetch(`${API_BASE}/delivery/slots?date=${selectedDate}`);
        const json = await res.json();
        if (json.success && json.data && json.data.slots) {
            slotSelect.innerHTML = "";
            json.data.slots.forEach((slot) => {
                const opt = document.createElement("option");
                opt.value = slot.name;
                opt.textContent = slot.name + (slot.available ? " (Còn chỗ)" : " (Đã kín chỗ)");
                if (!slot.available) opt.disabled = true;
                slotSelect.appendChild(opt);
            });
        }
    } catch (e) {
        slotSelect.innerHTML = `
            <option value="08:00 - 10:00">08:00 - 10:00 (Sáng sớm)</option>
            <option value="10:00 - 12:00">10:00 - 12:00 (Trưa)</option>
            <option value="13:00 - 15:00">13:00 - 15:00 (Đầu chiều)</option>
            <option value="15:00 - 17:00">15:00 - 17:00 (Xế chiều)</option>
            <option value="17:00 - 19:00">17:00 - 19:00 (Tan tầm)</option>
            <option value="19:00 - 21:00">19:00 - 21:00 (Tối)</option>
        `;
    }
}

/**
 * Toggle giao hỏa tốc 2H
 */
export function toggleExpress2H() {
    updateOrderSummary();
}

/**
 * Áp dụng mã Voucher
 */
export async function handleApplyVoucher() {
    const input = document.getElementById("checkoutVoucherInput");
    const msgBox = document.getElementById("checkoutVoucherMsg");
    if (!input) return;

    const code = input.value.trim().toUpperCase();
    if (!code) return;

    const subtotal = calculateSubtotal(getCartItems());

    // Kiểm tra nhanh mã voucher phổ biến hoặc gọi API
    if (code === "PHUNU15") {
        if (subtotal < 400000) {
            if (msgBox) {
                msgBox.textContent = "Mã PHUNU15 chỉ áp dụng cho đơn từ 400.000₫";
                msgBox.className = "text-xs text-red-500 mt-1 block";
            }
            return;
        }
        currentAppliedVoucher = {
            code: "PHUNU15",
            type: "percentage",
            value: 15,
            max: 150000
        };
        if (msgBox) {
            msgBox.textContent = "Áp dụng mã PHUNU15 thành công: Giảm 15%!";
            msgBox.className = "text-xs text-green-600 font-bold mt-1 block";
        }
    } else if (code === "FREESHIP") {
        currentAppliedVoucher = {
            code: "FREESHIP",
            type: "fixed",
            value: 35000,
            max: 35000
        };
        if (msgBox) {
            msgBox.textContent = "Áp dụng mã FREESHIP thành công: Giảm 35.000₫ phí giao!";
            msgBox.className = "text-xs text-green-600 font-bold mt-1 block";
        }
    } else if (code === "ANNE10") {
        currentAppliedVoucher = {
            code: "ANNE10",
            type: "percentage",
            value: 10,
            max: 100000
        };
        if (msgBox) {
            msgBox.textContent = "Áp dụng mã ANNE10 thành công: Giảm 10%!";
            msgBox.className = "text-xs text-green-600 font-bold mt-1 block";
        }
    } else {
        if (msgBox) {
            msgBox.textContent = "Mã khuyến mãi không tồn tại hoặc đã hết hạn";
            msgBox.className = "text-xs text-red-500 mt-1 block";
        }
        return;
    }

    updateOrderSummary();
}

/**
 * Cập nhật bảng tổng kết chi phí
 */
export function updateOrderSummary() {
    const items = getCartItems();
    const subtotal = calculateSubtotal(items);

    const isExpressCheckbox = document.getElementById("checkoutIsExpress2H");
    const isExpress = isExpressCheckbox ? isExpressCheckbox.checked : false;

    // Pickup (nhận tại cửa hàng) -> miễn phí vận chuyển
    const fulfillmentSelected = document.querySelector("input[name='fulfillmentType']:checked");
    const isPickup = fulfillmentSelected && fulfillmentSelected.value === "pickup";

    let shippingFee = 0;
    if (isPickup) {
        shippingFee = 0;
    } else if (isExpress) {
        shippingFee = 50000;
    } else if (subtotal < 500000 && subtotal > 0) {
        shippingFee = 35000;
    } else {
        shippingFee = 0; // Freeship từ 500K
    }

    let discount = 0;
    if (currentAppliedVoucher) {
        if (currentAppliedVoucher.type === "percentage") {
            discount = Math.min(Math.round((subtotal * currentAppliedVoucher.value) / 100), currentAppliedVoucher.max);
        } else {
            discount = Math.min(currentAppliedVoucher.value, currentAppliedVoucher.max);
        }
    }

    const finalTotal = Math.max(0, subtotal + shippingFee - discount);

    const lang = (typeof window !== "undefined" && window.currentLang) ? window.currentLang : "vi";
    const trans = (typeof window !== "undefined" && window.translations) ? window.translations : (typeof translations !== "undefined" ? translations : {});
    const dict = (trans && trans[lang]) ? trans[lang] : {};

    const subtotalEl = document.getElementById("summarySubtotal");
    const shippingEl = document.getElementById("summaryShipping");
    const discountEl = document.getElementById("summaryDiscount");
    const totalEl = document.getElementById("summaryTotal");

    const freeShippingText = dict.checkout_lbl_free_shipping || "Miễn phí";

    if (subtotalEl) subtotalEl.textContent = formatVND(subtotal);
    if (shippingEl) shippingEl.textContent = shippingFee === 0 ? freeShippingText : formatVND(shippingFee);
    if (discountEl) discountEl.textContent = discount > 0 ? `-${formatVND(discount)}` : "0₫";
    if (totalEl) totalEl.textContent = formatVND(finalTotal);
}

/**
 * Xử lý Gửi Đơn Hàng đến Backend API (POST /api/orders)
 */
export async function handleCheckoutSubmit(event) {
    if (event) event.preventDefault();

    const items = getCartItems();
    if (items.length === 0) {
        alert("Giỏ hàng của bạn đang trống. Vui lòng chọn sản phẩm!");
        return;
    }

    const senderName = document.getElementById("checkoutSenderName")?.value.trim();
    const senderPhone = document.getElementById("checkoutSenderPhone")?.value.trim();
    const senderEmail = document.getElementById("checkoutSenderEmail")?.value.trim() || "";
    const isAnonymous = document.getElementById("checkoutIsAnonymous")?.checked || false;

    const recipientName = document.getElementById("checkoutRecipientName")?.value.trim();
    const recipientPhone = document.getElementById("checkoutRecipientPhone")?.value.trim();
    const recipientAddress = document.getElementById("checkoutRecipientAddress")?.value.trim();
    const deliveryNotes = document.getElementById("checkoutDeliveryNotes")?.value.trim() || "";

    const deliveryDate = document.getElementById("checkoutDeliveryDate")?.value;
    const timeSlot = document.getElementById("checkoutTimeSlot")?.value;
    const isExpress2H = document.getElementById("checkoutIsExpress2H")?.checked || false;

    const cardMessage = document.getElementById("checkoutCardMessage")?.value.trim() || "";
    const ribbonBanner = document.getElementById("checkoutRibbonBanner")?.value.trim() || "";
    const paymentMethod = document.querySelector("input[name='paymentMethod']:checked")?.value || "vietqr";

    // Phương thức nhận hàng (delivery / pickup)
    const fulfillmentSelected = document.querySelector("input[name='fulfillmentType']:checked");
    const fulfillmentType = fulfillmentSelected ? fulfillmentSelected.value : "delivery";
    const pickupBranchId = document.getElementById("checkoutPickupBranch")?.value || "";

    const submitBtn = document.getElementById("btnSubmitOrder");
    const errorBox = document.getElementById("checkoutErrorMsg");

    // Validation theo phương thức nhận hàng
    if (!senderPhone || !recipientName || !recipientPhone) {
        if (errorBox) {
            errorBox.textContent = "Vui lòng điền đầy đủ số điện thoại người gửi và thông tin người nhận";
            errorBox.classList.remove("hidden");
        }
        return;
    }

    if (fulfillmentType === "pickup") {
        if (!pickupBranchId) {
            if (errorBox) {
                errorBox.textContent = "Vui lòng chọn cửa hàng nhận hoa";
                errorBox.classList.remove("hidden");
            }
            return;
        }
    } else if (!recipientAddress) {
        if (errorBox) {
            errorBox.textContent = "Vui lòng nhập địa chỉ giao hoa";
            errorBox.classList.remove("hidden");
        }
        return;
    }

    if (errorBox) errorBox.classList.add("hidden");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Đang tạo đơn hàng...`;
    }

    const payload = {
        sender: {
            name: senderName,
            phone: senderPhone,
            email: senderEmail,
            isAnonymous: isAnonymous
        },
        recipient: {
            name: recipientName,
            phone: recipientPhone,
            address: recipientAddress,
            deliveryNotes: deliveryNotes
        },
        delivery: {
            deliveryDate: deliveryDate,
            timeSlot: isExpress2H ? "Giao Hỏa Tốc 2H" : timeSlot,
            isExpress2H: isExpress2H,
            fulfillmentType: fulfillmentType
        },
        fulfillmentType: fulfillmentType,
        branchId: fulfillmentType === "pickup" ? pickupBranchId : "",
        customization: {
            cardMessage: cardMessage,
            ribbonBanner: ribbonBanner
        },
        items: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity
        })),
        voucherCode: currentAppliedVoucher ? currentAppliedVoucher.code : "",
        paymentMethod: paymentMethod
    };

    try {
        let authHeaders = { "Content-Type": "application/json" };
        if (typeof getAuthToken === "function") {
            const token = getAuthToken();
            if (token) authHeaders["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(`${API_BASE}/orders`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(payload)
        });

        const resData = await res.json();

        if (res.ok && resData.success) {
            const newOrder = resData.data;
            // Xóa giỏ hàng sau khi đặt thành công
            saveCartItems([]);
            closeCheckoutModal();

            // Hiển thị thông báo & mở cổng thanh toán VietQR
            if (typeof openPaymentModal === "function") {
                openPaymentModal(newOrder);
            } else {
                alert(`🎉 Đặt hàng thành công! Mã đơn: ${newOrder.orderCode}. Tổng tiền: ${formatVND(newOrder.totalAmount)}`);
                window.location.reload();
            }
        } else {
            if (errorBox) {
                errorBox.textContent = resData.message || "Đặt hàng không thành công. Vui lòng thử lại!";
                errorBox.classList.remove("hidden");
            }
        }
    } catch (err) {
        if (errorBox) {
            errorBox.textContent = "Lỗi kết nối máy chủ: " + err.message;
            errorBox.classList.remove("hidden");
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `Hoàn Tất Đặt Hoa <i class="fa-solid fa-arrow-right ml-2"></i>`;
        }
    }
}

// Global Browser Binding
if (typeof window !== "undefined") {
    window.TeluaCart = {
        getCartItems,
        saveCartItems,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        calculateSubtotal,
        formatVND,
        updateCartBadge,
        toggleCartDrawer,
        openCheckoutModal,
        openCheckoutModalAfterAuth,
        closeCheckoutModal,
        onDeliveryDateChange,
        toggleExpress2H,
        handleApplyVoucher,
        updateOrderSummary,
        handleCheckoutSubmit
    };

    window.addToCart = addToCart;
    window.removeFromCart = removeFromCart;
    window.updateCartQuantity = updateCartQuantity;
    window.toggleCart = () => toggleCartDrawer();
    window.toggleCartDrawer = toggleCartDrawer;
    window.openCheckoutModal = openCheckoutModal;
    window.openCheckoutModalAfterAuth = openCheckoutModalAfterAuth;
    window.closeCheckoutModal = closeCheckoutModal;
    window.onDeliveryDateChange = onDeliveryDateChange;
    window.toggleExpress2H = toggleExpress2H;
    window.handleApplyVoucher = handleApplyVoucher;
    window.updateOrderSummary = updateOrderSummary;
    window.handleCheckoutSubmit = handleCheckoutSubmit;
    window.onFulfillmentTypeChange = onFulfillmentTypeChange;
    window.loadPickupBranches = loadPickupBranches;
    window.loadCheckoutPaymentMethods = loadCheckoutPaymentMethods;
    window.reloadPaymentConfigIfChanged = loadCheckoutPaymentMethods;
    window.updatePaymentOptionStyles = updatePaymentOptionStyles;

    document.addEventListener("DOMContentLoaded", () => {
        updateCartBadge();
    });
}
