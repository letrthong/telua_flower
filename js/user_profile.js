/**
 * TELUA FLOWER CONNECT - USER PROFILE & SECURITY MANAGEMENT
 * Phân hệ Quản Lý Hồ Sơ Cá Nhân & Đổi Mật Khẩu (Dùng chung cho toàn bộ vai trò)
 */

import { getCurrentUser, getAuthToken, openAuthModal, logout } from './auth.js';
import { API_BASE, showToast } from './utils.js';
import { ROLES, ROLE_DISPLAY_MAP } from './roles_const.js';

let currentProfileData = null;

/**
 * Mở modal Hồ Sơ Cá Nhân
 */
export async function openUserProfileModal(initialTab = "info") {
    const user = (typeof getCurrentUser === "function") ? getCurrentUser() : null;
    if (!user) {
        if (typeof openAuthModal === "function") openAuthModal("login");
        return;
    }

    const modal = document.getElementById("userProfileModal");
    if (!modal) return;

    // Đóng dropdown menu tài khoản nếu đang mở
    const dropdown = document.getElementById("userDropdownMenu");
    if (dropdown) dropdown.classList.add("hidden");

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    switchProfileTab(initialTab);
    await loadUserProfileData();
}

/**
 * Đóng modal Hồ Sơ Cá Nhân
 */
export function closeUserProfileModal() {
    const modal = document.getElementById("userProfileModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

/**
 * Chuyển tab trong modal Hồ Sơ (Thông tin cá nhân / Đổi mật khẩu)
 */
export function switchProfileTab(tabName = "info") {
    const btnInfo = document.getElementById("tabProfileBtnInfo");
    const btnPassword = document.getElementById("tabProfileBtnPassword");
    const contentInfo = document.getElementById("tabProfileContentInfo");
    const contentPassword = document.getElementById("tabProfileContentPassword");

    const activeCls = "py-3 font-bold text-xs sm:text-sm border-b-2 border-primary text-primary transition flex items-center";
    const idleCls = "py-3 font-bold text-xs sm:text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition flex items-center";

    if (tabName === "password") {
        if (btnPassword) btnPassword.className = activeCls;
        if (btnInfo) btnInfo.className = idleCls;
        if (contentPassword) contentPassword.classList.remove("hidden");
        if (contentInfo) contentInfo.classList.add("hidden");
    } else {
        if (btnInfo) btnInfo.className = activeCls;
        if (btnPassword) btnPassword.className = idleCls;
        if (contentInfo) contentInfo.classList.remove("hidden");
        if (contentPassword) contentPassword.classList.add("hidden");
    }
}

/**
 * Nạp dữ liệu hồ sơ cá nhân từ API /auth/me
 */
export async function loadUserProfileData() {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const userFallback = typeof getCurrentUser === "function" ? getCurrentUser() : {};

    let user = userFallback;
    try {
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success && json.data) {
            user = json.data;
            currentProfileData = json.data;
        }
    } catch (err) {
        console.warn("Không thể tải chi tiết /auth/me, sử dụng dữ liệu cục bộ:", err);
    }

    // Hiển thị Avatar & Tên Header
    const avatarBadge = document.getElementById("profileAvatarBadge");
    const headerName = document.getElementById("profileHeaderName");
    const headerRole = document.getElementById("profileHeaderRole");
    const branchBadge = document.getElementById("profileBranchBadge");

    const displayName = user.fullName || user.phone || "Người dùng";
    if (avatarBadge) avatarBadge.textContent = displayName.charAt(0).toUpperCase();
    if (headerName) headerName.textContent = displayName;

    // Role display meta
    const roleMeta = ROLE_DISPLAY_MAP[user.role] || { label: user.role || "Thành viên", badge: "bg-gray-100 text-gray-700" };
    if (headerRole) {
        headerRole.textContent = roleMeta.label;
        headerRole.className = `px-2.5 py-0.5 rounded-full text-xs font-bold ${roleMeta.badge}`;
    }

    // Chi nhánh công tác
    if (branchBadge) {
        if (user.role === ROLES.SUPER_ADMIN) {
            branchBadge.textContent = "Toàn hệ thống";
            branchBadge.className = "text-xs text-purple-700 font-semibold";
        } else if (user.branchId) {
            branchBadge.textContent = `Chi nhánh: ${user.branchId.toUpperCase()}`;
            branchBadge.className = "text-xs text-blue-700 font-semibold";
        } else {
            branchBadge.textContent = user.role === ROLES.CUSTOMER ? "Khách hàng thân thiết" : "Văn phòng trung tâm";
            branchBadge.className = "text-xs text-gray-500";
        }
    }

    // Điền form thông tin
    const nameInput = document.getElementById("profileFullNameInput");
    const phoneInput = document.getElementById("profilePhoneInput");
    const emailInput = document.getElementById("profileEmailInput");

    if (nameInput) nameInput.value = user.fullName || "";
    if (phoneInput) phoneInput.value = user.phone || "";
    if (emailInput) emailInput.value = user.email || "";
}

/**
 * Xử lý submit cập nhật thông tin cá nhân
 */
export async function handleProfileFormSubmit(event) {
    if (event) event.preventDefault();

    const nameInput = document.getElementById("profileFullNameInput");
    const phoneInput = document.getElementById("profilePhoneInput");
    const emailInput = document.getElementById("profileEmailInput");
    const btnSubmit = document.getElementById("btnSubmitProfile");

    const fullName = nameInput ? nameInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim() : "";

    if (!fullName) {
        if (typeof showToast === "function") showToast("Vui lòng nhập họ và tên của bạn", "warning");
        return;
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Đang lưu...`;
    }

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/auth/profile`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ fullName, phone, email })
        });

        const json = await res.json();
        if (json.success && json.data) {
            // Cập nhật lại localStorage user
            const currentStored = typeof getCurrentUser === "function" ? getCurrentUser() : {};
            const updated = { ...currentStored, ...json.data };
            if (typeof localStorage !== "undefined") {
                localStorage.setItem("user", JSON.stringify(updated));
            }

            // Đồng bộ hiển thị lại Header Admin
            const adminUserName = document.getElementById("adminUserName");
            if (adminUserName) adminUserName.textContent = updated.fullName;

            if (typeof showToast === "function") showToast("Cập nhật hồ sơ thành công!", "success");
            await loadUserProfileData();
        } else {
            if (typeof showToast === "function") showToast(json.message || "Cập nhật thất bại", "error");
        }
    } catch (err) {
        console.error("Lỗi khi cập nhật hồ sơ:", err);
        if (typeof showToast === "function") showToast("Lỗi kết nối máy chủ", "error");
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<i class="fa-solid fa-check mr-1.5"></i> Lưu Thay Đổi`;
        }
    }
}

/**
 * Xử lý submit đổi mật khẩu
 */
export async function handlePasswordChangeSubmit(event) {
    if (event) event.preventDefault();

    const currentPwdInput = document.getElementById("profileCurrentPasswordInput");
    const newPwdInput = document.getElementById("profileNewPasswordInput");
    const confirmPwdInput = document.getElementById("profileConfirmPasswordInput");
    const btnSubmit = document.getElementById("btnSubmitPassword");

    const currentPassword = currentPwdInput ? currentPwdInput.value : "";
    const newPassword = newPwdInput ? newPwdInput.value : "";
    const confirmPassword = confirmPwdInput ? confirmPwdInput.value : "";

    if (!currentPassword || !newPassword) {
        if (typeof showToast === "function") showToast("Vui lòng nhập mật khẩu hiện tại và mật khẩu mới", "warning");
        return;
    }

    if (newPassword.length < 6) {
        if (typeof showToast === "function") showToast("Mật khẩu mới phải có tối thiểu 6 ký tự", "warning");
        return;
    }

    if (newPassword !== confirmPassword) {
        if (typeof showToast === "function") showToast("Xác nhận mật khẩu mới không khớp", "warning");
        return;
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Đang đổi mật khẩu...`;
    }

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/auth/change-password`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const json = await res.json();
        if (json.success) {
            if (typeof showToast === "function") showToast("Đổi mật khẩu thành công! Vui lòng ghi nhớ mật khẩu mới.", "success");
            // Reset form
            if (currentPwdInput) currentPwdInput.value = "";
            if (newPwdInput) newPwdInput.value = "";
            if (confirmPwdInput) confirmPwdInput.value = "";
            switchProfileTab("info");
        } else {
            if (typeof showToast === "function") showToast(json.message || "Đổi mật khẩu thất bại", "error");
        }
    } catch (err) {
        console.error("Lỗi khi đổi mật khẩu:", err);
        if (typeof showToast === "function") showToast("Lỗi kết nối máy chủ", "error");
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<i class="fa-solid fa-key mr-1.5"></i> Cập Nhật Mật Khẩu`;
        }
    }
}

// Global window bindings
if (typeof window !== "undefined") {
    window.openUserProfileModal = openUserProfileModal;
    window.closeUserProfileModal = closeUserProfileModal;
    window.switchProfileTab = switchProfileTab;
    window.handleProfileFormSubmit = handleProfileFormSubmit;
    window.handlePasswordChangeSubmit = handlePasswordChangeSubmit;
}

export default {
    openUserProfileModal,
    closeUserProfileModal,
    switchProfileTab,
    handleProfileFormSubmit,
    handlePasswordChangeSubmit
};
