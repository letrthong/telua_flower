import { API_BASE } from './utils.js';

/**
 * Hệ thống Quản lý Xác thực & Phân quyền Client (Authentication & Route Guard)
 * Hỗ trợ lưu trữ JWT Token, tự động điều hướng theo Role và chặn truy cập trái phép.
 */

const AUTH_TOKEN_KEY = "telua_auth_token";
const AUTH_USER_KEY = "telua_auth_user";

const ROLE_REDIRECT_MATRIX = {
    super_admin: "/portal/admin",
    branch_manager: "/portal/branch-manager",
    florist: "/portal/staff",
    sales_consultant: "/portal/sales",
    customer: "/"
};

/**
 * Lưu Token và thông tin User vào localStorage
 */
function saveAuthToken(token, user) {
    if (typeof localStorage !== "undefined") {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        if (user) {
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        }
    }
}

/**
 * Lấy JWT Token từ localStorage
 */
function getAuthToken() {
    if (typeof localStorage !== "undefined") {
        return localStorage.getItem(AUTH_TOKEN_KEY);
    }
    return null;
}

/**
 * Lấy thông tin user hiện tại
 */
function getCurrentUser() {
    if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(AUTH_USER_KEY);
        if (raw) {
            try {
                return JSON.parse(raw);
            } catch (e) {
                return null;
            }
        }
    }
    return null;
}

/**
 * Xóa thông tin đăng nhập
 */
function clearAuth() {
    if (typeof localStorage !== "undefined") {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
    }
}

/**
 * Kiểm tra xem người dùng đã đăng nhập chưa
 */
function isLoggedIn() {
    const token = getAuthToken();
    if (!token) return false;
    const payload = decodeJWTPayload(token);
    if (!payload) return false;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
        clearAuth();
        return false;
    }
    return true;
}

/**
 * Giải mã Payload từ JWT Token mà không cần thư viện nặng
 */
function decodeJWTPayload(token) {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    try {
        let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const pad = base64.length % 4;
        if (pad) {
            base64 += "=".repeat(4 - pad);
        }
        const jsonStr = decodeURIComponent(
            atob(base64)
                .split("")
                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
        return JSON.parse(jsonStr);
    } catch (e) {
        return null;
    }
}

/**
 * Gửi yêu cầu Đăng nhập đến Backend API
 */
async function login(identifier, password) {
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ identifier, password })
        });

        const resData = await response.json();
        if (response.ok && resData.success) {
            const { token, user, redirectUrl } = resData.data;
            saveAuthToken(token, user);
            return {
                success: true,
                redirectUrl: redirectUrl || "/",
                user
            };
        } else {
            return {
                success: false,
                message: resData.message || "Đăng nhập thất bại"
            };
        }
    } catch (err) {
        return {
            success: false,
            message: "Lỗi kết nối máy chủ: " + err.message
        };
    }
}

/**
 * Gửi yêu cầu Đăng ký tài khoản Khách hàng
 */
async function register(phone, fullName, password, email = "") {
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ phone, fullName, password, email })
        });

        const resData = await response.json();
        if (response.ok && resData.success) {
            const { token, user, redirectUrl } = resData.data;
            saveAuthToken(token, user);
            return {
                success: true,
                redirectUrl: redirectUrl || "/",
                user
            };
        } else {
            return {
                success: false,
                message: resData.message || "Đăng ký thất bại"
            };
        }
    } catch (err) {
        return {
            success: false,
            message: "Lỗi kết nối máy chủ: " + err.message
        };
    }
}

/**
 * Đăng xuất người dùng
 */
async function logout() {
    try {
        await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
    } catch (e) {
        // bỏ qua lỗi network khi logout
    }
    clearAuth();
    if (typeof updateAuthUI === "function") {
        updateAuthUI();
    }
    if (typeof window !== "undefined") {
        if (window.location.pathname.startsWith("/portal/")) {
            window.location.href = "/";
        } else {
            window.location.reload();
        }
    }
}

/**
 * Helper gửi request kèm Header Authorization Bearer
 */
async function fetchWithAuth(url, options = {}) {
    const token = getAuthToken();
    const headers = {
        ...(options.headers || {}),
        "Content-Type": "application/json"
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        clearAuth();
        if (typeof window !== "undefined" && !window.location.pathname.includes("login")) {
            window.location.href = "/";
        }
    }
    return response;
}

/**
 * Route Guard kiểm tra quyền truy cập trang nội bộ
 */
function checkRoutePermission(allowedRoles = []) {
    if (!isLoggedIn()) {
        alert("Vui lòng đăng nhập để truy cập trang này!");
        if (typeof window !== "undefined") {
            window.location.href = "/";
        }
        return false;
    }

    const token = getAuthToken();
    const payload = decodeJWTPayload(token);
    if (!payload || (allowedRoles.length > 0 && !allowedRoles.includes(payload.role))) {
        alert("Bạn không có quyền truy cập vào phân hệ này!");
        if (typeof window !== "undefined") {
            window.location.href = payload ? (payload.redirectUrl || "/") : "/";
        }
        return false;
    }

    return true;
}

// ==========================================
// QUẢN LÝ GIAO DIỆN MODAL ĐĂNG NHẬP (UI MODAL)
// ==========================================

function openAuthModal(tab = "login") {
    const modal = document.getElementById("authModal");
    if (!modal) return;
    modal.style.display = "flex";
    modal.classList.remove("hidden");
    
    const pwInput = document.getElementById("loginPassword");
    if (pwInput) pwInput.value = "";
    
    const regPwInput = document.getElementById("regPassword");
    if (regPwInput) regPwInput.value = "";
    
    switchAuthTab(tab);
}

function closeAuthModal() {
    const modal = document.getElementById("authModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

function switchAuthTab(tab = "login") {
    const loginTabBtn = document.getElementById("tabLoginBtn");
    const registerTabBtn = document.getElementById("tabRegisterBtn");
    const loginForm = document.getElementById("loginFormContainer");
    const registerForm = document.getElementById("registerFormContainer");
    const loginError = document.getElementById("loginError");
    const registerError = document.getElementById("registerError");

    if (loginError) loginError.classList.add("hidden");
    if (registerError) registerError.classList.add("hidden");

    if (tab === "login") {
        if (loginTabBtn) {
            loginTabBtn.className = "flex-1 py-3 text-sm font-bold text-primary border-b-2 border-primary transition";
        }
        if (registerTabBtn) {
            registerTabBtn.className = "flex-1 py-3 text-sm font-semibold text-gray-500 hover:text-gray-700 border-b-2 border-transparent transition";
        }
        if (loginForm) loginForm.classList.remove("hidden");
        if (registerForm) registerForm.classList.add("hidden");
    } else {
        if (loginTabBtn) {
            loginTabBtn.className = "flex-1 py-3 text-sm font-semibold text-gray-500 hover:text-gray-700 border-b-2 border-transparent transition";
        }
        if (registerTabBtn) {
            registerTabBtn.className = "flex-1 py-3 text-sm font-bold text-primary border-b-2 border-primary transition";
        }
        if (loginForm) loginForm.classList.add("hidden");
        if (registerForm) registerForm.classList.remove("hidden");
    }
}

function fillDemoAccount(identifier, password = "123456") {
    switchAuthTab("login");
    const idInput = document.getElementById("loginIdentifier");
    const pwInput = document.getElementById("loginPassword");
    const errorBox = document.getElementById("loginError");
    if (errorBox) errorBox.classList.add("hidden");

    if (idInput) idInput.value = identifier;
    if (pwInput) pwInput.value = password;

    // Tự động kích hoạt submit
    const submitBtn = document.getElementById("btnLoginSubmit");
    if (submitBtn) {
        submitBtn.click();
    }
}

async function handleLoginSubmit(event) {
    if (event) event.preventDefault();
    const idInput = document.getElementById("loginIdentifier");
    const pwInput = document.getElementById("loginPassword");
    const errorBox = document.getElementById("loginError");
    const submitBtn = document.getElementById("btnLoginSubmit");

    if (!idInput || !pwInput) return;

    const identifier = idInput.value.trim();
    const password = pwInput.value;

    if (!identifier) {
        if (errorBox) {
            errorBox.textContent = "Vui lòng nhập Số điện thoại hoặc Email đăng nhập!";
            errorBox.classList.remove("hidden");
        }
        idInput.focus();
        return;
    }

    if (!password) {
        if (errorBox) {
            errorBox.textContent = "Vui lòng nhập mật khẩu vào để đăng nhập!";
            errorBox.classList.remove("hidden");
        }
        pwInput.focus();
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Đang xác thực...`;
    }
    if (errorBox) errorBox.classList.add("hidden");

    const result = await login(identifier, password);

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Đăng Nhập <i class="fa-solid fa-arrow-right ml-2"></i>`;
    }

    if (result.success) {
        closeAuthModal();
        updateAuthUI();

        // Nếu trước đó user đang cố thanh toán (nhấp nút Checkout) thì quay lại mở checkout
        let pendingCheckout = false;
        if (typeof sessionStorage !== "undefined") {
            pendingCheckout = sessionStorage.getItem("telua_pending_checkout") === "1";
            sessionStorage.removeItem("telua_pending_checkout");
        }
        if (pendingCheckout && typeof openCheckoutModalAfterAuth === "function") {
            openCheckoutModalAfterAuth();
            return;
        }

        // Không tự động chuyển hướng / bật CMS, giữ admin ở trang chủ và chỉ hiển thị khi click
        if (typeof showToast === "function") {
            showToast(`Chào mừng ${result.user.fullName || "bạn"} (${result.user.role}) đã đăng nhập thành công!`);
        } else {
            alert(`Đăng nhập thành công! Chào ${result.user.fullName || ""}`);
        }
    } else {
        if (errorBox) {
            errorBox.textContent = result.message || "Đăng nhập không thành công";
            errorBox.classList.remove("hidden");
        }
    }
}

async function handleRegisterSubmit(event) {
    if (event) event.preventDefault();
    const nameInput = document.getElementById("regFullName");
    const phoneInput = document.getElementById("regPhone");
    const emailInput = document.getElementById("regEmail");
    const pwInput = document.getElementById("regPassword");
    const errorBox = document.getElementById("registerError");
    const submitBtn = document.getElementById("btnRegisterSubmit");

    if (!nameInput || !phoneInput || !pwInput) return;

    const fullName = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const email = emailInput ? emailInput.value.trim() : "";
    const password = pwInput.value;

    if (!fullName || !phone || !password) {
        if (errorBox) {
            errorBox.textContent = "Vui lòng điền họ tên, số điện thoại và mật khẩu";
            errorBox.classList.remove("hidden");
        }
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Đang tạo tài khoản...`;
    }
    if (errorBox) errorBox.classList.add("hidden");

    const result = await register(phone, fullName, password, email);

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Đăng Ký Tài Khoản <i class="fa-solid fa-gift ml-2"></i>`;
    }

    if (result.success) {
        closeAuthModal();
        updateAuthUI();
        if (typeof showToast === "function") {
            showToast(`Đăng ký thành công! Tặng bạn 50 điểm tích lũy chào mừng 🎉`);
        } else {
            alert(`Đăng ký thành công! Chào mừng ${result.user.fullName}`);
        }
    } else {
        if (errorBox) {
            errorBox.textContent = result.message || "Đăng ký không thành công";
            errorBox.classList.remove("hidden");
        }
    }
}

function togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input || !icon) return;
    if (input.type === "password") {
        input.type = "text";
        icon.className = "fa-solid fa-eye-slash text-gray-400 hover:text-gray-600";
    } else {
        input.type = "password";
        icon.className = "fa-solid fa-eye text-gray-400 hover:text-gray-600";
    }
}

function toggleUserDropdown(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById("userDropdownMenu");
    if (dropdown) {
        dropdown.classList.toggle("hidden");
    }
}

function updateAuthUI() {
    const userContainer = document.getElementById("accountBtn");
    const mobileUserContainer = document.getElementById("mobileAccountBtn");
    const user = getCurrentUser();

    const roleNameMap = {
        super_admin: "👑 Tổng Quản Trị",
        branch_manager: "🏬 Quản Lý Chi Nhánh",
        florist: "🌸 Thợ Cắm Hoa",
        sales_consultant: "💼 Tư Vấn Viên",
        customer: "✨ Khách Hàng Thân Thiết"
    };

    if (user && isLoggedIn()) {
        const displayName = user.fullName || user.phone || "Thành viên";
        const roleName = roleNameMap[user.role] || "Thành viên";
        const isAdminOrManager = user.role === "super_admin" || user.role === "branch_manager";
        const isFlorist = user.role === "florist";
        const isSales = user.role === "sales_consultant";

        const isInternalRole = isAdminOrManager || isFlorist || isSales;
        const orderDashboardBtn = isInternalRole ? `
                    <button onclick="openOrderDashboardModal()" class="w-full flex items-center px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition rounded-xl border border-emerald-200">
                        <i class="fa-solid fa-chart-line mr-2 text-emerald-600"></i> Bảng Điều Khiển Đơn Hàng
                    </button>
        ` : '';

        let portalActionBtn = "";
        if (isAdminOrManager) {
            portalActionBtn = `
                <div class="p-2 space-y-1.5 border-b border-gray-100">
                    <button onclick="openAdminPortalModal()" class="w-full flex items-center px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-primary to-accent hover:opacity-95 transition rounded-xl shadow-xs">
                        <i class="fa-solid fa-gauge-high mr-2"></i> Quản Trị Hệ Thống (CMS)
                    </button>
                    ${orderDashboardBtn}
                    ${user.role === 'super_admin' ? `
                    <button onclick="openSystemConfigModal('company')" class="w-full flex items-center px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50/80 hover:bg-blue-100 transition rounded-xl border border-blue-200">
                        <i class="fa-solid fa-sliders mr-2 text-blue-600"></i> Cấu Hình Hệ Thống
                    </button>
                    ` : ''}
                </div>
            `;
        } else if (isFlorist) {
            portalActionBtn = `
                <div class="p-1.5 border-b border-gray-100 space-y-1.5">
                    <button onclick="openStaffPortalModal()" class="w-full flex items-center px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-400 hover:opacity-95 transition rounded-lg shadow-sm">
                        <i class="fa-solid fa-scissors mr-2"></i> Cổng Thợ Cắm Hoa
                    </button>
                    ${orderDashboardBtn}
                </div>
            `;
        } else if (isSales) {
            portalActionBtn = `
                <div class="p-1.5 border-b border-gray-100 space-y-1.5">
                    <button onclick="openStaffPortalModal()" class="w-full flex items-center px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-400 hover:opacity-95 transition rounded-lg shadow-sm">
                        <i class="fa-solid fa-headset mr-2"></i> Tiếp Nhận Đơn Hàng
                    </button>
                    ${orderDashboardBtn}
                </div>
            `;
        } else {
            // Customer (Khách hàng thân thiết)
            portalActionBtn = `
                <div class="p-1.5 border-b border-gray-100 space-y-1.5">
                    <button onclick="openCustomerPortalModal()" class="w-full flex items-center px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-primary to-accent hover:opacity-95 transition rounded-xl shadow-xs">
                        <i class="fa-solid fa-box-open mr-2"></i> Đơn Hàng Của Tôi
                    </button>
                    <div class="px-3 py-2 text-xs text-gray-700 flex justify-between items-center bg-pink-50/50 rounded-lg">
                        <span>Điểm tích lũy:</span>
                        <span class="font-bold text-accent">50 điểm ⭐</span>
                    </div>
                </div>
            `;
        }

        const userHtml = `
            <div class="relative">
                <button onclick="toggleUserDropdown(event)" class="flex flex-col md:flex-row items-center text-gray-700 hover:text-primary transition group focus:outline-none">
                    <div class="w-8 h-8 rounded-full bg-pink-100 text-primary border border-pink-200 flex items-center justify-center font-bold text-xs md:mr-2 shadow-sm group-hover:scale-105 transition">
                        ${displayName.charAt(0).toUpperCase()}
                    </div>
                    <div class="hidden md:flex flex-col text-left">
                        <span class="text-xs font-bold text-gray-800 line-clamp-1">${displayName}</span>
                        <span class="text-[10px] text-primary font-semibold">${roleName}</span>
                    </div>
                    <i class="fa-solid fa-chevron-down text-[9px] text-gray-400 ml-1.5 hidden md:block"></i>
                </button>

                <!-- Dropdown Menu -->
                <div id="userDropdownMenu" class="hidden absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 animate-fadeIn">
                    <div class="px-4 py-2.5 border-b border-gray-100 bg-pink-50/50">
                        <p class="text-xs text-gray-500 font-medium">Đang đăng nhập với vai trò:</p>
                        <p class="text-xs font-bold text-primary mt-0.5">${roleName}</p>
                        <p class="text-[11px] text-gray-600 truncate mt-0.5">${user.phone || user.email || ""}</p>
                    </div>
                    
                    ${portalActionBtn}

                    <button onclick="logout()" class="w-full text-left flex items-center px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition">
                        <i class="fa-solid fa-right-from-bracket mr-2"></i> Đăng Xuất
                    </button>
                </div>
            </div>
        `;

        if (userContainer) userContainer.innerHTML = userHtml;
        if (mobileUserContainer) {
            mobileUserContainer.innerHTML = `
                <div class="bg-gradient-to-br from-pink-50/80 to-rose-50/60 p-3.5 rounded-xl border border-pink-100 space-y-3 shadow-2xs">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                            ${displayName.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-bold text-gray-900 truncate">${displayName}</div>
                            <div class="text-[11px] font-semibold text-primary">${roleName}</div>
                            <div class="text-[10px] text-gray-500 truncate">${user.phone || user.email || ""}</div>
                        </div>
                    </div>

                    ${isAdminOrManager ? `
                        <div class="space-y-2">
                            <button onclick="openAdminPortalModal(); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-primary to-accent hover:opacity-95 transition rounded-xl shadow-xs">
                                <i class="fa-solid fa-gauge-high mr-2"></i> Quản Trị Hệ Thống (CMS)
                            </button>
                            <button onclick="openOrderDashboardModal(); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition rounded-xl border border-emerald-200">
                                <i class="fa-solid fa-chart-line mr-2 text-emerald-600"></i> Bảng Điều Khiển Đơn Hàng
                            </button>
                            ${user.role === 'super_admin' ? `
                            <button onclick="openSystemConfigModal('company'); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition rounded-xl border border-blue-200">
                                <i class="fa-solid fa-sliders mr-2 text-blue-600"></i> Cấu Hình Hệ Thống
                            </button>
                            ` : ''}
                        </div>
                    ` : isFlorist ? `
                        <div class="space-y-2">
                            <button onclick="openStaffPortalModal(); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-400 hover:opacity-95 transition rounded-lg shadow-xs">
                                <i class="fa-solid fa-scissors mr-2"></i> Cổng Thợ Cắm Hoa
                            </button>
                            <button onclick="openOrderDashboardModal(); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition rounded-lg border border-emerald-200">
                                <i class="fa-solid fa-chart-line mr-2 text-emerald-600"></i> Bảng Điều Khiển Đơn Hàng
                            </button>
                        </div>
                    ` : isSales ? `
                        <div class="space-y-2">
                            <button onclick="openStaffPortalModal(); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-400 hover:opacity-95 transition rounded-lg shadow-xs">
                                <i class="fa-solid fa-headset mr-2"></i> Tiếp Nhận Đơn Hàng
                            </button>
                            <button onclick="openOrderDashboardModal(); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition rounded-lg border border-emerald-200">
                                <i class="fa-solid fa-chart-line mr-2 text-emerald-600"></i> Bảng Điều Khiển Đơn Hàng
                            </button>
                        </div>
                    ` : `
                        <button onclick="openCustomerPortalModal(); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-primary to-accent hover:opacity-95 transition rounded-xl shadow-xs">
                            <i class="fa-solid fa-box-open mr-2"></i> Đơn Hàng Của Tôi
                        </button>
                        <div class="flex items-center justify-between px-3 py-1.5 bg-white/80 rounded-lg border border-pink-100 text-xs">
                            <span class="text-gray-600 font-medium">Điểm tích lũy:</span>
                            <span class="font-bold text-accent">50 ⭐</span>
                        </div>
                    `}

                    <button onclick="logout()" class="w-full flex items-center justify-center px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 bg-white border border-red-100 rounded-lg transition shadow-2xs">
                        <i class="fa-solid fa-right-from-bracket mr-2"></i> Đăng Xuất
                    </button>
                </div>
            `;
        }
    } else {
        const guestHtml = `
            <div onclick="openAuthModal('login')" class="flex flex-col items-center text-gray-600 hover:text-primary cursor-pointer transition">
                <i class="fa-regular fa-user text-xl mb-1"></i>
                <span class="text-xs font-semibold" data-i18n="account">Tài khoản</span>
            </div>
        `;
        if (userContainer) userContainer.innerHTML = guestHtml;
        if (mobileUserContainer) {
            mobileUserContainer.innerHTML = `
                <button onclick="openAuthModal('login'); if(typeof closeMenu==='function')closeMenu();" class="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-pink-50 to-rose-50 hover:from-pink-100 hover:to-rose-100 border border-pink-200 text-sm font-bold text-primary shadow-xs transition group">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 rounded-full bg-white text-primary flex items-center justify-center shadow-xs border border-pink-200 group-hover:scale-105 transition">
                            <i class="fa-regular fa-user text-sm"></i>
                        </div>
                        <div class="text-left">
                            <div class="text-xs font-bold text-gray-800" data-i18n="account">Đăng nhập / Đăng ký</div>
                            <div class="text-[10px] font-medium text-gray-500">Tích điểm & Ưu đãi thành viên</div>
                        </div>
                    </div>
                    <i class="fa-solid fa-arrow-right text-xs text-primary group-hover:translate-x-1 transition transform"></i>
                </button>
            `;
        }
    }
}

// Đóng dropdown khi click ra ngoài
if (typeof window !== "undefined") {
    window.addEventListener("click", (e) => {
        const dropdown = document.getElementById("userDropdownMenu");
        if (dropdown && !dropdown.classList.contains("hidden")) {
            const btn = dropdown.previousElementSibling;
            if (btn && !btn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add("hidden");
            }
        }
    });

    document.addEventListener("DOMContentLoaded", () => {
        updateAuthUI();
    });
}

// Xuất các hàm ra phạm vi toàn cục (Window Global)
if (typeof window !== "undefined") {
    window.TeluaAuth = {
        saveAuthToken,
        getAuthToken,
        getCurrentUser,
        clearAuth,
        isLoggedIn,
        decodeJWTPayload,
        login,
        register,
        logout,
        fetchWithAuth,
        checkRoutePermission,
        openAuthModal,
        closeAuthModal,
        switchAuthTab,
        fillDemoAccount,
        handleLoginSubmit,
        handleRegisterSubmit,
        togglePasswordVisibility,
        toggleUserDropdown,
        updateAuthUI
    };

    window.openAuthModal = openAuthModal;
    window.closeAuthModal = closeAuthModal;
    window.switchAuthTab = switchAuthTab;
    window.fillDemoAccount = fillDemoAccount;
    window.handleLoginSubmit = handleLoginSubmit;
    window.handleRegisterSubmit = handleRegisterSubmit;
    window.togglePasswordVisibility = togglePasswordVisibility;
    window.toggleUserDropdown = toggleUserDropdown;
    window.logout = logout;
    window.getCurrentUser = getCurrentUser;
    window.getAuthToken = getAuthToken;
    window.isLoggedIn = isLoggedIn;
    window.saveAuthToken = saveAuthToken;
    window.clearAuth = clearAuth;
    window.updateAuthUI = updateAuthUI;
}

export {
    saveAuthToken,
    getAuthToken,
    getCurrentUser,
    clearAuth,
    isLoggedIn,
    decodeJWTPayload,
    login,
    register,
    logout,
    fetchWithAuth,
    checkRoutePermission,
    openAuthModal,
    closeAuthModal,
    switchAuthTab,
    fillDemoAccount,
    handleLoginSubmit,
    handleRegisterSubmit,
    togglePasswordVisibility,
    toggleUserDropdown,
    updateAuthUI
};
