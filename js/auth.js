/**
 * Hệ thống Quản lý Xác thực & Phân quyền Client (Authentication & Route Guard)
 * Hỗ trợ lưu trữ JWT Token, tự động điều hướng theo Role và chặn truy cập trái phép.
 */

const AUTH_TOKEN_KEY = "telua_auth_token";
const AUTH_USER_KEY = "telua_auth_user";

/**
 * Lưu Token và thông tin User vào localStorage
 */
export function saveAuthToken(token, user) {
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
export function getAuthToken() {
    if (typeof localStorage !== "undefined") {
        return localStorage.getItem(AUTH_TOKEN_KEY);
    }
    return null;
}

/**
 * Lấy thông tin user hiện tại
 */
export function getCurrentUser() {
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
export function clearAuth() {
    if (typeof localStorage !== "undefined") {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
    }
}

/**
 * Kiểm tra xem người dùng đã đăng nhập chưa
 */
export function isLoggedIn() {
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
export function decodeJWTPayload(token) {
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
export async function login(identifier, password) {
    try {
        const response = await fetch("/api/auth/login", {
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
export async function register(phone, fullName, password, email = "") {
    try {
        const response = await fetch("/api/auth/register", {
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
export async function logout() {
    try {
        await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
        // bỏ qua lỗi network khi logout
    }
    clearAuth();
    if (typeof window !== "undefined") {
        window.location.href = "/";
    }
}

/**
 * Helper gửi request kèm Header Authorization Bearer
 */
export async function fetchWithAuth(url, options = {}) {
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
export function checkRoutePermission(allowedRoles = []) {
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

// Gắn vào window global để dùng trực tiếp trong script tag của các trang portal
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
        checkRoutePermission
    };
}
