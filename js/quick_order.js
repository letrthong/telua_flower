import { API_BASE, formatVND } from './utils.js';
import { notifyUser } from './portal_admin_state.js';

let selectedProofFile = null;
let cachedStorefrontProducts = [];
let currentLiveConfig = null;

/**
 * Mở modal Đặt Hàng Nhanh Live Stream:
 * Tự động kiểm tra cờ enableQuickOrder từ máy chủ.
 */
export async function openQuickOrderModal() {
    const modal = document.getElementById("quickOrderModal");
    if (!modal) return;

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    const loadingState = document.getElementById("quickOrderLoadingState");
    const formContainer = document.getElementById("quickOrderFormContainer");
    const closedContainer = document.getElementById("quickOrderClosedContainer");
    const successContainer = document.getElementById("quickOrderSuccessContainer");

    if (loadingState) loadingState.classList.remove("hidden");
    if (formContainer) formContainer.classList.add("hidden");
    if (closedContainer) closedContainer.classList.add("hidden");
    if (successContainer) successContainer.classList.add("hidden");

    try {
        const res = await fetch(`${API_BASE}/livestream-config?_t=${Date.now()}`);
        const json = await res.json();
        const config = (json && json.data) ? json.data : {};
        currentLiveConfig = config;
        const isEnabled = !!(config.enableQuickOrder || config.enabled);

        if (loadingState) loadingState.classList.add("hidden");

        if (!isEnabled) {
            // Cờ chưa bật: hiển thị thông báo tạm đóng & gỡ bỏ hash #quick-order khỏi thanh địa chỉ để không tự động mở lại
            if (typeof window !== "undefined" && window.location.hash) {
                const h = window.location.hash.toLowerCase();
                if (h === "#quick-order" || h === "#livestream" || h === "#live-stream") {
                    try {
                        history.replaceState(null, document.title, window.location.pathname + window.location.search);
                    } catch (_) { }
                }
            }
            if (closedContainer) closedContainer.classList.remove("hidden");
        } else {
            // Cờ đang bật: hiển thị form đặt hàng nhanh
            if (formContainer) formContainer.classList.remove("hidden");

            // Nạp thông tin tiêu đề & lời dặn
            const titleEl = document.getElementById("quickOrderDisplayTitle");
            const descEl = document.getElementById("quickOrderDisplayDesc");
            if (titleEl && config.title) titleEl.textContent = config.title;
            if (descEl && config.description) descEl.textContent = config.description;

            // Nạp thông tin tài khoản ngân hàng
            const bInfo = config.bankInfo || {};
            const bNameEl = document.getElementById("quickOrderBankName");
            const bAccEl = document.getElementById("quickOrderBankAccount");
            const bOwnerEl = document.getElementById("quickOrderBankOwner");
            if (bNameEl) bNameEl.textContent = bInfo.bankName || "Vietcombank";
            if (bAccEl) bAccEl.textContent = bInfo.accountNumber || "0976491322";
            if (bOwnerEl) bOwnerEl.textContent = bInfo.accountName || "NO HOA THA BINH";

            // Reset form
            resetQuickOrderForm();

            // Nạp danh sách các bó hoa / mẫu hoa vào dropdown và tự động chọn mẫu đầu tiên
            await loadProductsForQuickOrder(config.featuredProductIds || []);

            // Cập nhật mã QR hiển thị
            updateQuickOrderQrCode();
        }
    } catch (e) {
        if (loadingState) loadingState.classList.add("hidden");
        if (closedContainer) closedContainer.classList.remove("hidden");
        console.warn("[QUICK_ORDER] Lỗi kiểm tra cấu hình livestream:", e.message);
    }
}

/**
 * Tải danh mục các mẫu hoa / bó hoa cho Quick Order
 */
async function loadProductsForQuickOrder(featuredIds = []) {
    try {
        if (!cachedStorefrontProducts || cachedStorefrontProducts.length === 0) {
            if (typeof window !== "undefined" && Array.isArray(window.allStorefrontProducts) && window.allStorefrontProducts.length > 0) {
                cachedStorefrontProducts = window.allStorefrontProducts;
            } else {
                const res = await fetch(`${API_BASE}/products?_t=${Date.now()}`);
                if (res.ok) {
                    const json = await res.json();
                    if (json && Array.isArray(json.data)) {
                        cachedStorefrontProducts = json.data;
                    }
                }
            }
        }
    } catch (e) {
        console.warn("[QUICK_ORDER] Lỗi tải sản phẩm:", e.message);
    }

    populateQuickOrderProductSelect(cachedStorefrontProducts, featuredIds);
}

/**
 * Đổ danh sách bó hoa vào dropdown select
 */
export function populateQuickOrderProductSelect(products = [], featuredIds = []) {
    const select = document.getElementById("quickOrderProductSelect");
    if (!select) return;

    let html = "";
    const activeProds = Array.isArray(products) ? products.filter(p => p && p.isActive !== false) : [];

    // Phân loại: Các mẫu được ghim trong phiên live (featured)
    const featuredSet = new Set(Array.isArray(featuredIds) ? featuredIds : []);
    const featuredList = activeProds.filter(p => featuredSet.has(p.id) || featuredSet.has(p.uuid));

    if (featuredList.length > 0) {
        // Phiên live có ghim mẫu hoa cụ thể (1, 2 hoặc nhiều mẫu) -> CHỈ hiển thị đúng các mẫu được ghim này
        featuredList.forEach(p => {
            const price = p.priceNumber || (p.salePrice ? parseInt(String(p.salePrice).replace(/\D/g, ''), 10) : 0);
            const priceFormatted = price > 0 ? (typeof formatVND === 'function' ? formatVND(price) : `${price.toLocaleString('vi-VN')}₫`) : 'Liên hệ';
            html += `<option value="${p.id}" data-price="${price}" data-name="${encodeURIComponent(p.name || '')}" data-img="${p.image || ''}">🌸 ${p.name} - ${priceFormatted}</option>`;
        });
    } else {
        // Nếu admin chưa ghim mẫu nào trong cấu hình, hiển thị tùy chọn tự chọn và toàn bộ sản phẩm của shop
        html += `<option value="livestream_custom" data-price="0" data-name="Hoa tươi chốt trực tiếp trên Live Stream" data-img="">💐 [Tự Chọn] Bó hoa chốt giá trực tiếp trên Live Stream</option>`;
        if (activeProds.length > 0) {
            html += `<optgroup label="🌺 Tất Cả Các Mẫu Hoa Của Cửa Hàng">`;
            activeProds.forEach(p => {
                const price = p.priceNumber || (p.salePrice ? parseInt(String(p.salePrice).replace(/\D/g, ''), 10) : 0);
                const priceFormatted = price > 0 ? (typeof formatVND === 'function' ? formatVND(price) : `${price.toLocaleString('vi-VN')}₫`) : 'Liên hệ';
                html += `<option value="${p.id}" data-price="${price}" data-name="${encodeURIComponent(p.name || '')}" data-img="${p.image || ''}">${p.name} - ${priceFormatted}</option>`;
            });
            html += `</optgroup>`;
        }
    }

    select.innerHTML = html;
    if (select.options.length > 0) {
        select.selectedIndex = 0;
    }
    handleQuickOrderProductSelect(select);
}

/**
 * Xử lý khi khách chọn bó hoa trong dropdown
 */
export function handleQuickOrderProductSelect(selectEl) {
    if (!selectEl) selectEl = document.getElementById("quickOrderProductSelect");
    if (!selectEl) return;

    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const previewCard = document.getElementById("quickOrderSelectedProductCard");
    const previewImg = document.getElementById("quickOrderSelectedProductImg");
    const previewName = document.getElementById("quickOrderSelectedProductName");
    const previewPrice = document.getElementById("quickOrderSelectedProductPrice");
    const amountInput = document.getElementById("quickOrderAmount");

    const val = selectEl.value;

    if (!selectedOption || val === "livestream_custom") {
        if (previewCard) previewCard.classList.add("hidden");
        // Giữ nguyên số tiền khách đang nhập hoặc để trống
        return;
    }

    const price = parseInt(selectedOption.getAttribute("data-price") || "0", 10);
    const rawName = selectedOption.getAttribute("data-name") || "";
    const name = decodeURIComponent(rawName);
    const imgUrl = selectedOption.getAttribute("data-img") || "";

    // Hiển thị Card xem trước bó hoa được chọn
    if (previewCard) {
        previewCard.classList.remove("hidden");
        if (previewName) previewName.textContent = name;
        if (previewPrice) {
            previewPrice.textContent = price > 0 ? (typeof formatVND === 'function' ? formatVND(price) : `${price.toLocaleString('vi-VN')}₫`) : 'Chốt giá trên Live';
        }
        if (previewImg) {
            previewImg.src = imgUrl || 'https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=300';
        }
    }

    // Tự động điền giá của bó hoa vào ô Số tiền đã chuyển (nếu giá > 0)
    if (amountInput && price > 0) {
        amountInput.value = price.toLocaleString("vi-VN");
    }

    // Cập nhật lại mã QR tương ứng
    updateQuickOrderQrCode();
}

/**
 * Cập nhật mã QR chuyển khoản hiển thị cho khách
 */
export function updateQuickOrderQrCode() {
    const qrImg = document.getElementById("quickOrderQrImage");
    if (!qrImg) return;

    const bInfo = (currentLiveConfig && currentLiveConfig.bankInfo) || {};
    const customQr = (currentLiveConfig && currentLiveConfig.qrCodeImage) || bInfo.qrCodeImage || "";

    // Chỉ hiển thị ảnh mã QR khi admin đã cung cấp/tải ảnh lên cấu hình
    if (customQr) {
        qrImg.src = customQr;
        qrImg.classList.remove("hidden");
        if (qrEmpty) qrEmpty.classList.add("hidden");
    } else {
        // Nếu không có mã QR: TUYỆT ĐỐI KHÔNG tự ý sinh/tạo hình ảnh mã QR
        qrImg.removeAttribute("src");
        qrImg.classList.add("hidden");
        if (qrEmpty) qrEmpty.classList.remove("hidden");
    }
}

/**
 * Đóng modal Đặt Hàng Nhanh
 */
export function closeQuickOrderModal() {
    const modal = document.getElementById("quickOrderModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }

    // Gỡ bỏ hash #quick-order khỏi thanh địa chỉ nếu có
    if (typeof window !== "undefined" && window.location.hash) {
        const h = window.location.hash.toLowerCase();
        if (h === "#quick-order" || h === "#livestream" || h === "#live-stream") {
            try {
                history.replaceState(null, document.title, window.location.pathname + window.location.search);
            } catch (_) { }
        }
    }
}

/**
 * Reset dữ liệu form đặt hàng nhanh
 */
function resetQuickOrderForm() {
    const form = document.getElementById("quickOrderForm");
    if (form) form.reset();
    selectedProofFile = null;

    const previewContainer = document.getElementById("quickOrderProofPreviewContainer");
    const uploadPlaceholder = document.getElementById("quickOrderUploadPlaceholder");
    if (previewContainer) previewContainer.classList.add("hidden");
    if (uploadPlaceholder) uploadPlaceholder.classList.remove("hidden");

    const errBox = document.getElementById("quickOrderErrorBox");
    if (errBox) errBox.classList.add("hidden");

    const selectEl = document.getElementById("quickOrderProductSelect");
    if (selectEl && selectEl.options.length > 0) {
        selectEl.selectedIndex = 0;
        handleQuickOrderProductSelect(selectEl);
    }
}

/**
 * Định dạng tiền tệ khi người dùng gõ số tiền
 */
export function formatQuickOrderAmountInput(input) {
    if (!input) return;
    const rawVal = input.value.replace(/\D/g, "");
    if (!rawVal) {
        input.value = "";
        updateQuickOrderQrCode();
        return;
    }
    const num = parseInt(rawVal, 10);
    input.value = num.toLocaleString("vi-VN");
    updateQuickOrderQrCode();
}

/**
 * Xử lý khi chọn file ảnh chuyển khoản
 */
export function handleQuickOrderProofSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Vui lòng chọn tệp hình ảnh (JPG, PNG, WEBP, HEIC...)");
        event.target.value = "";
        return;
    }

    selectedProofFile = file;

    const previewImg = document.getElementById("quickOrderProofImg");
    const previewContainer = document.getElementById("quickOrderProofPreviewContainer");
    const uploadPlaceholder = document.getElementById("quickOrderUploadPlaceholder");
    const fileNameEl = document.getElementById("quickOrderProofFileName");

    const reader = new FileReader();
    reader.onload = (e) => {
        if (previewImg) previewImg.src = e.target.result;
        if (fileNameEl) fileNameEl.textContent = file.name;
        if (previewContainer) previewContainer.classList.remove("hidden");
        if (uploadPlaceholder) uploadPlaceholder.classList.add("hidden");
    };
    reader.readAsDataURL(file);
}

/**
 * Xóa ảnh chuyển khoản đã chọn
 */
export function removeQuickOrderProof() {
    selectedProofFile = null;
    const fileInput = document.getElementById("quickOrderProofInput");
    if (fileInput) fileInput.value = "";

    const previewContainer = document.getElementById("quickOrderProofPreviewContainer");
    const uploadPlaceholder = document.getElementById("quickOrderUploadPlaceholder");
    if (previewContainer) previewContainer.classList.add("hidden");
    if (uploadPlaceholder) uploadPlaceholder.classList.remove("hidden");
}

/**
 * Copy số tài khoản ngân hàng nhanh
 */
export function copyQuickOrderBankAccount() {
    const accEl = document.getElementById("quickOrderBankAccount");
    const accNumber = accEl ? accEl.textContent.trim() : "";
    if (!accNumber) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(accNumber).then(() => {
            if (typeof notifyUser === "function") {
                notifyUser("Đã sao chép số tài khoản: " + accNumber, "success");
            } else {
                alert("Đã sao chép số tài khoản: " + accNumber);
            }
        });
    } else {
        alert("Số tài khoản: " + accNumber);
    }
}

/**
 * Gửi đơn hàng nhanh lên máy chủ
 */
export async function handleQuickOrderSubmit(event) {
    if (event) event.preventDefault();

    const nameInput = document.getElementById("quickOrderRecipientName");
    const phoneInput = document.getElementById("quickOrderRecipientPhone");
    const addressInput = document.getElementById("quickOrderRecipientAddress");
    const amountInput = document.getElementById("quickOrderAmount");
    const notesInput = document.getElementById("quickOrderNotes");
    const productSelect = document.getElementById("quickOrderProductSelect");
    const errBox = document.getElementById("quickOrderErrorBox");
    const submitBtn = document.getElementById("btnSubmitQuickOrder");

    if (errBox) errBox.classList.add("hidden");

    const name = nameInput ? nameInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const address = addressInput ? addressInput.value.trim() : "";
    const rawAmount = amountInput ? amountInput.value.replace(/\D/g, "") : "";
    const amount = rawAmount ? parseInt(rawAmount, 10) : 0;
    const notes = notesInput ? notesInput.value.trim() : "";

    // Lấy thông tin bó hoa đã chọn
    const selectedProductId = productSelect ? productSelect.value : "livestream_custom";
    let selectedProductName = "Hoa tươi đặt nhanh qua Live Stream";
    let selectedProductImage = "";

    if (productSelect && productSelect.selectedIndex >= 0) {
        const opt = productSelect.options[productSelect.selectedIndex];
        const rawOptName = opt.getAttribute("data-name") || "";
        if (rawOptName) selectedProductName = decodeURIComponent(rawOptName);
        selectedProductImage = opt.getAttribute("data-img") || "";
    }

    // Validation
    if (!name) {
        showQuickOrderError("Vui lòng điền họ và tên người nhận hoa.");
        if (nameInput) nameInput.focus();
        return;
    }
    if (!phone || phone.length < 9) {
        showQuickOrderError("Vui lòng điền số điện thoại hợp lệ (tối thiểu 9 chữ số).");
        if (phoneInput) phoneInput.focus();
        return;
    }
    if (!address) {
        showQuickOrderError("Vui lòng điền địa chỉ nhận hoa chi tiết.");
        if (addressInput) addressInput.focus();
        return;
    }
    if (!amount || amount <= 0) {
        showQuickOrderError("Vui lòng nhập số tiền đã chuyển khoản (VNĐ).");
        if (amountInput) amountInput.focus();
        return;
    }
    if (!selectedProofFile) {
        showQuickOrderError("Vui lòng tải lên hình ảnh biên lai / ảnh chụp màn hình chuyển khoản.");
        return;
    }

    // Chuẩn bị FormData
    const formData = new FormData();
    formData.append("recipientName", name);
    formData.append("phone", phone);
    formData.append("address", address);
    formData.append("transferredAmount", amount.toString());
    formData.append("notes", notes);
    formData.append("paymentProof", selectedProofFile);
    formData.append("productId", selectedProductId);
    formData.append("productName", selectedProductName);
    if (selectedProductImage) {
        formData.append("productImage", selectedProductImage);
    }

    // Disable button & hiện loading
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Đang gửi đơn hàng...`;
    }

    try {
        const res = await fetch(`${API_BASE}/orders/quick-order`, {
            method: "POST",
            body: formData
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
            throw new Error(json.message || "Không thể gửi đơn hàng nhanh");
        }

        const newOrder = json.data || {};

        // Hiển thị màn hình thành công
        const formContainer = document.getElementById("quickOrderFormContainer");
        const successContainer = document.getElementById("quickOrderSuccessContainer");
        if (formContainer) formContainer.classList.add("hidden");
        if (successContainer) successContainer.classList.remove("hidden");

        const codeEl = document.getElementById("quickOrderSuccessCode");
        const nameEl = document.getElementById("quickOrderSuccessName");
        const phoneEl = document.getElementById("quickOrderSuccessPhone");
        const addrEl = document.getElementById("quickOrderSuccessAddress");
        const amtEl = document.getElementById("quickOrderSuccessAmount");
        const flowerEl = document.getElementById("quickOrderSuccessFlower");

        if (codeEl) codeEl.textContent = newOrder.orderCode || newOrder.id || "";
        if (nameEl) nameEl.textContent = name;
        if (phoneEl) phoneEl.textContent = phone;
        if (addrEl) addrEl.textContent = address;
        if (amtEl) amtEl.textContent = typeof formatVND === "function" ? formatVND(amount) : `${amount.toLocaleString("vi-VN")}₫`;
        if (flowerEl) flowerEl.textContent = selectedProductName;

        if (typeof notifyUser === "function") {
            notifyUser(`🎉 Đặt đơn nhanh thành công! Mã đơn: ${newOrder.orderCode || ""}`, "success");
        }
    } catch (e) {
        showQuickOrderError(e.message || "Đã xảy ra lỗi trong quá trình gửi đơn.");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane mr-2"></i> Xác Nhận Đặt Đơn Nhanh`;
        }
    }
}

function showQuickOrderError(msg) {
    const errBox = document.getElementById("quickOrderErrorBox");
    if (errBox) {
        errBox.textContent = msg;
        errBox.classList.remove("hidden");
        errBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
        alert(msg);
    }
}

/**
 * -----------------------------------------------------------------------------
 * PHÂN HỆ TRA CỨU ĐƠN HÀNG CÔNG KHAI QUA SỐ ĐIỆN THOẠI (ORDER LOOKUP / TRACKING)
 * -----------------------------------------------------------------------------
 */

/**
 * Mở modal Tra Cứu Đơn Hàng:
 * Hỗ trợ điền sẵn SĐT nếu có (prefillPhone).
 */
export function openOrderLookupModal(prefillPhone = "") {
    const modal = document.getElementById("orderLookupModal");
    if (!modal) return;

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    const phoneInput = document.getElementById("lookupPhoneInput");
    const errorBox = document.getElementById("lookupErrorBox");
    const resultsContainer = document.getElementById("lookupResultsContainer");
    const emptyState = document.getElementById("lookupEmptyState");
    const initialGuide = document.getElementById("lookupInitialGuide");

    if (errorBox) errorBox.classList.add("hidden");
    if (resultsContainer) resultsContainer.innerHTML = "";
    if (emptyState) emptyState.classList.add("hidden");
    if (initialGuide) initialGuide.classList.remove("hidden");

    if (phoneInput) {
        const val = prefillPhone || localStorage.getItem("telua_last_lookup_phone") || "";
        phoneInput.value = val;
        phoneInput.focus();
        if (val && val.length >= 9) {
            handleOrderLookup();
        }
    }
}

/**
 * Đóng modal Tra Cứu Đơn Hàng
 */
export function closeOrderLookupModal() {
    const modal = document.getElementById("orderLookupModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
    const currentHash = (window.location.hash || "").replace(/^#\/?/, "").trim();
    if (currentHash === "tra-cuu" || currentHash === "tracking" || currentHash === "lookup" || currentHash.startsWith("tra-cuu")) {
        try {
            history.replaceState(null, "", window.location.pathname + window.location.search);
        } catch (_) {}
    }
}

/**
 * Xử lý sự kiện tìm kiếm đơn hàng theo Số Điện Thoại hoặc Mã Đơn
 */
export async function handleOrderLookup(e) {
    if (e && typeof e.preventDefault === "function") {
        e.preventDefault();
    }

    const phoneInput = document.getElementById("lookupPhoneInput");
    const errorBox = document.getElementById("lookupErrorBox");
    const resultsContainer = document.getElementById("lookupResultsContainer");
    const emptyState = document.getElementById("lookupEmptyState");
    const initialGuide = document.getElementById("lookupInitialGuide");
    const submitBtn = document.getElementById("btnSubmitLookup");

    const query = phoneInput ? phoneInput.value.trim() : "";
    if (!query) {
        if (errorBox) {
            errorBox.textContent = "Vui lòng nhập Số Điện Thoại bạn đã dùng khi đặt hoa.";
            errorBox.classList.remove("hidden");
        }
        return;
    }

    if (errorBox) errorBox.classList.add("hidden");
    if (initialGuide) initialGuide.classList.add("hidden");
    if (emptyState) emptyState.classList.add("hidden");
    if (resultsContainer) {
        resultsContainer.innerHTML = `
            <div class="py-10 text-center">
                <i class="fa-solid fa-circle-notch fa-spin text-3xl text-primary mb-2"></i>
                <p class="text-xs font-bold text-gray-600">Đang tra cứu đơn hàng của bạn...</p>
            </div>
        `;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Đang tìm...`;
    }

    try {
        localStorage.setItem("telua_last_lookup_phone", query);
        const res = await fetch(`${API_BASE}/orders/lookup?query=${encodeURIComponent(query)}&_t=${Date.now()}`);
        const json = await res.json();

        const orders = (json && json.data && Array.isArray(json.data)) ? json.data : [];
        if (orders.length === 0) {
            if (resultsContainer) resultsContainer.innerHTML = "";
            if (emptyState) {
                emptyState.classList.remove("hidden");
                const emptyPhoneEl = document.getElementById("lookupEmptyPhone");
                if (emptyPhoneEl) emptyPhoneEl.textContent = query;
            }
        } else {
            renderOrderLookupResults(orders, query);
        }
    } catch (err) {
        if (errorBox) {
            errorBox.textContent = `Lỗi kết nối máy chủ: ${err.message || "Không thể nạp dữ liệu"}`;
            errorBox.classList.remove("hidden");
        }
        if (resultsContainer) resultsContainer.innerHTML = "";
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass mr-1.5"></i> Tra Cứu`;
        }
    }
}

/**
 * Render danh sách đơn hàng tìm được
 */
function renderOrderLookupResults(orders, query) {
    const resultsContainer = document.getElementById("lookupResultsContainer");
    if (!resultsContainer) return;

    const statusBadgeMap = {
        pending: { label: "Chờ xác nhận thanh toán", class: "bg-amber-50 text-amber-700 border-amber-200", icon: "fa-clock", step: 1 },
        confirmed: { label: "Đã xác nhận thanh toán", class: "bg-blue-50 text-blue-700 border-blue-200", icon: "fa-circle-check", step: 2 },
        arranging: { label: "Thợ đang cắm hoa", class: "bg-pink-50 text-pink-700 border-pink-200", icon: "fa-seedling", step: 2 },
        shipping: { label: "Đang giao hoa đến bạn", class: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: "fa-motorcycle", step: 3 },
        delivered: { label: "Đã giao thành công", class: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "fa-champagne-glasses", step: 4 },
        cancelled: { label: "Đã hủy đơn", class: "bg-red-50 text-red-600 border-red-200", icon: "fa-ban", step: 0 }
    };

    let html = `
        <div class="space-y-4">
            <div class="flex items-center justify-between pb-1 border-b border-gray-100">
                <p class="text-xs font-bold text-gray-700">Tìm thấy <span class="text-rose-600 font-extrabold">${orders.length}</span> đơn hàng cho: <span class="font-mono text-gray-900">${query}</span></p>
                <span class="text-[10px] text-gray-400">Thời gian thực</span>
            </div>
    `;

    orders.forEach((ord) => {
        const badge = statusBadgeMap[ord.status] || { label: ord.statusText || ord.status, class: "bg-gray-50 text-gray-600 border-gray-200", icon: "fa-info-circle", step: 1 };
        const stepNum = badge.step;
        const items = ord.items || [];
        const isLive = ord.source === "livestream_quick_order";

        html += `
            <div class="bg-white rounded-2xl border border-gray-200/90 shadow-2xs hover:shadow-md transition overflow-hidden">
                <!-- Card Header -->
                <div class="p-4 bg-gradient-to-r from-gray-50 to-rose-50/20 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-mono font-bold text-gray-900 bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs flex items-center gap-1.5">
                            <i class="fa-solid fa-receipt text-rose-500"></i> ${ord.orderCode || ord.id}
                        </span>
                        ${isLive ? `<span class="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1"><i class="fa-solid fa-video text-[8px]"></i> Live Stream</span>` : ""}
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${badge.class}">
                            <i class="fa-solid ${badge.icon}"></i> ${badge.label}
                        </span>
                    </div>
                </div>

                <!-- Tracker Steps (Progress Bar) -->
                ${ord.status !== 'cancelled' ? `
                <div class="p-4 bg-gray-50/50 border-b border-gray-100">
                    <div class="grid grid-cols-4 gap-1 text-center">
                        <div class="${stepNum >= 1 ? 'text-rose-600 font-bold' : 'text-gray-400'}">
                            <div class="w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs mb-1 ${stepNum >= 1 ? 'bg-rose-600 text-white shadow-2xs' : 'bg-gray-200 text-gray-500'}">1</div>
                            <span class="text-[10px] block leading-tight">Tiếp Nhận</span>
                        </div>
                        <div class="${stepNum >= 2 ? 'text-rose-600 font-bold' : 'text-gray-400'}">
                            <div class="w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs mb-1 ${stepNum >= 2 ? 'bg-rose-600 text-white shadow-2xs' : 'bg-gray-200 text-gray-500'}">2</div>
                            <span class="text-[10px] block leading-tight">Cắm Hoa</span>
                        </div>
                        <div class="${stepNum >= 3 ? 'text-rose-600 font-bold' : 'text-gray-400'}">
                            <div class="w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs mb-1 ${stepNum >= 3 ? 'bg-rose-600 text-white shadow-2xs' : 'bg-gray-200 text-gray-500'}">3</div>
                            <span class="text-[10px] block leading-tight">Đang Giao</span>
                        </div>
                        <div class="${stepNum >= 4 ? 'text-emerald-600 font-bold' : 'text-gray-400'}">
                            <div class="w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs mb-1 ${stepNum >= 4 ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-gray-200 text-gray-500'}">4</div>
                            <span class="text-[10px] block leading-tight">Hoàn Tất</span>
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- Body Details -->
                <div class="p-4 space-y-3 text-xs">
                    <!-- Sản phẩm đã chọn -->
                    <div class="space-y-2">
                        ${items.map(it => `
                            <div class="flex items-center gap-3 p-2 bg-gray-50 rounded-xl border border-gray-100">
                                <img src="${it.image || '/images/default_flower.webp'}" alt="${it.productName || 'Hoa'}" class="w-12 h-12 object-cover rounded-lg border border-gray-200 flex-shrink-0" onerror="this.src='/images/default_flower.webp'">
                                <div class="min-w-0 flex-1">
                                    <p class="font-bold text-gray-800 line-clamp-1">${it.productName || 'Hoa tươi'}</p>
                                    <div class="flex items-center justify-between text-[11px] text-gray-500 mt-0.5">
                                        <span>SL: x${it.quantity || 1}</span>
                                        <span class="font-bold text-rose-600">${formatVND(it.price || it.itemTotal || 0)}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <!-- Người nhận & Địa chỉ -->
                    <div class="bg-gray-50/70 p-3 rounded-xl border border-gray-100 space-y-1.5 text-[11px]">
                        <div class="flex justify-between">
                            <span class="text-gray-500">Người nhận:</span>
                            <span class="font-bold text-gray-800">${ord.recipientName || 'Quý khách'} (${ord.maskedPhone || ord.recipientPhone || ''})</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500 flex-shrink-0 mr-2">Địa chỉ giao:</span>
                            <span class="font-medium text-gray-700 text-right line-clamp-2">${ord.deliveryAddress || 'Nhận tại tiệm'}</span>
                        </div>
                        <div class="flex justify-between pt-1 border-t border-gray-200/60 font-bold">
                            <span class="text-gray-600">Tổng thanh toán:</span>
                            <span class="text-rose-600 text-xs">${formatVND(ord.totalAmount || ord.transferredAmount || 0)}</span>
                        </div>
                    </div>

                    <!-- Bill Chuyển Khoản & Ảnh Thật Florist Chụp -->
                    <div class="flex flex-wrap items-center gap-2 pt-1">
                        ${ord.paymentProofImage ? `
                            <a href="${ord.paymentProofImage}" target="_blank" rel="noopener noreferrer"
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-200 text-[11px] transition">
                                <i class="fa-solid fa-receipt"></i> Xem Ảnh Bill Đã Chuyển
                            </a>
                        ` : ''}

                        ${(ord.flowerPhotos && ord.flowerPhotos.length > 0) ? `
                            <a href="${ord.flowerPhotos[0]}" target="_blank" rel="noopener noreferrer"
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-200 text-[11px] transition">
                                <i class="fa-solid fa-camera"></i> Xem Ảnh Hoa Thực Tế Đã Cắm
                            </a>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    resultsContainer.innerHTML = html;
}

if (typeof window !== "undefined") {
    window.openQuickOrderModal = openQuickOrderModal;
    window.closeQuickOrderModal = closeQuickOrderModal;
    window.formatQuickOrderAmountInput = formatQuickOrderAmountInput;
    window.handleQuickOrderProofSelect = handleQuickOrderProofSelect;
    window.removeQuickOrderProof = removeQuickOrderProof;
    window.copyQuickOrderBankAccount = copyQuickOrderBankAccount;
    window.handleQuickOrderSubmit = handleQuickOrderSubmit;
    window.handleQuickOrderProductSelect = handleQuickOrderProductSelect;
    window.populateQuickOrderProductSelect = populateQuickOrderProductSelect;
    window.updateQuickOrderQrCode = updateQuickOrderQrCode;
    window.openOrderLookupModal = openOrderLookupModal;
    window.closeOrderLookupModal = closeOrderLookupModal;
    window.handleOrderLookup = handleOrderLookup;
}

