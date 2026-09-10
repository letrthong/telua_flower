/**
 * TELUA FLOWER CONNECT - ADMIN PORTAL ORCHESTRATOR
 * Phân hệ Quản Trị Hệ Thống (TASK 07 - Admin Portal, Product CMS & Price Governance)
 * Modular Architecture: Extracted into specialized sub-modules:
 *  - portal_admin_state.js
 *  - portal_admin_categories.js
 *  - portal_admin_branches.js
 *  - portal_admin_users.js
 *  - portal_admin_products.js
 *  - portal_admin_promotions.js
 *  - portal_admin_translations.js
 *  - portal_admin_sysconfig.js
 *  - portal_admin_orders.js
 *  - portal_admin_inventory.js
 */

import { getCurrentUser, getAuthToken, openAuthModal, logout } from './auth.js';
import { API_BASE, showToast, showConfirmDialog, showScreenLock, hideScreenLock, removeVietnameseTones } from './utils.js';
import { CONFIG_LAYOUT, isTabAllowed, getDefaultTabForRole, getTabConfig } from './config_layout.js';

// Re-export state & helpers
export {
    lockScreen,
    unlockScreen,
    notifyUser,
    PRICE_LEVEL_CONFIG,
    allAdminCategories,
    allAdminProducts,
    allAdminPromotions,
    allAdminAddons,
    allAdminTranslations,
    allAdminUsers,
    allAdminBranches
} from './portal_admin_state.js';

// Re-export Categories
export {
    loadAdminCategories,
    openCategoryModal,
    closeCategoryModal,
    onCategoryTextIdChange,
    onCategoryDescTextIdChange,
    switchCategoryLangTab,
    saveCurrentCatI18nDraft,
    editCategory,
    handleCategorySubmit,
    toggleCategory,
    deleteCategory,
    restoreCategory,
    moveCategory,
    populateCategoryDropdowns
} from './portal_admin_categories.js';

// Re-export Branches
export {
    BRANCH_NAME_MAP,
    populateBranchDropdowns,
    loadAdminBranches,
    openBranchModal,
    closeBranchModal,
    editBranch,
    handleBranchSubmit,
    toggleBranch
} from './portal_admin_branches.js';

// Re-export Users & Customers
export {
    ROLE_DISPLAY_MAP,
    allAdminCustomers,
    TIER_DISPLAY_MAP,
    loadAdminUsers,
    renderUsersTable,
    loadAdminCustomers,
    renderCustomersTable,
    openUserModal,
    closeUserModal,
    editUser,
    handleUserSubmit,
    deleteUser
} from './portal_admin_users.js';

// Re-export Products
export {
    loadAdminProducts,
    onPriceLevelChange,
    validateLivePrice,
    compressAndConvertToBase64,
    switchProductLangTab,
    saveCurrentProdI18nDraft,
    handleImageFileUpload,
    renderEditingProductGallery,
    addProductGalleryImage,
    addProductGalleryImageFromInput,
    removeProductGalleryImage,
    handleGalleryFileUpload,
    openProductModal,
    updateProductModalTotalQuota,
    renderProductModalStockFields,
    populateProductTextIdDropdowns,
    onProductTextIdChange,
    closeProductModal,
    editProduct,
    handleProductSubmit,
    toggleProduct
} from './portal_admin_products.js';

// Re-export Promotions & Addons
export {
    loadAdminPromotions,
    renderPromotionsTable,
    openPromoModal,
    closePromoModal,
    editPromo,
    handlePromoSubmit,
    togglePromo,
    deletePromo,
    restorePromo,
    loadAdminAddons,
    renderAddonsTable,
    openAddonModal,
    closeAddonModal,
    editAddon,
    handleAddonSubmit,
    handleAddonImageFileUpload,
    toggleAddon,
    deleteAddon,
    restoreAddon
} from './portal_admin_promotions.js';

// Re-export Translations
export {
    currentSelectedTransKey,
    currentFilteredTransKeys,
    loadAdminTranslations,
    populateTranslationKeyDropdown,
    onSelectTranslationKeyChange,
    onFilterTransKeyDropdown,
    navigateTransKey,
    syncSingleKeyInputToDictionary,
    saveCurrentSingleTranslationKey,
    openAddNewTranslationKeyModal,
    closeAddNewTranslationKeyModal,
    handleAddNewTranslationKeySubmit,
    deleteCurrentTranslationKey,
    filterTranslations,
    switchTransViewMode,
    saveAllTranslations
} from './portal_admin_translations.js';

// Re-export Sysconfig
export {
    DEFAULT_STATIC_COMPANY_INFO,
    adminCompanyInfo,
    adminPaymentConfig,
    loadAdminPaymentConfig,
    onPaymentMethodToggle,
    savePaymentConfig,
    adminAddonConfig,
    loadAdminAddonConfig,
    saveAddonConfig,
    adminBannersConfig,
    loadAdminBanners,
    renderAdminBanners,
    updateAdminBannerField,
    addAdminBannerItem,
    removeAdminBannerItem,
    saveAdminBanners,
    loadAdminCompanyInfo,
    handleCompanyInfoSubmit
} from './portal_admin_sysconfig.js';

// Re-export Orders
export {
    ADMIN_ORDER_STATUS_META,
    ADMIN_PAYMENT_STATUS_META,
    loadAdminOrders,
    updateAdminOrderStatus
} from './portal_admin_orders.js';

// Re-export Inventory & Wastage
export {
    currentInventoryData,
    currentInventoryBranches,
    allAdminWastageReports,
    loadAdminInventory,
    renderInventoryKPIs,
    renderInventoryMatrixTable,
    saveBatchInventory,
    switchInventorySubView,
    loadAdminWastageHistory,
    renderAdminWastageTable,
    openWastageModal,
    closeWastageModal,
    addWastageItemRow,
    onWastageProductSelect,
    removeWastageItemRow,
    recalculateWastageTotals,
    handleWastageSubmit,
    filterInventoryMatrixTable
} from './portal_admin_inventory.js';

// Import local references for shell functions
import { loadAdminCompanyInfo, loadAdminPaymentConfig, loadAdminAddonConfig, loadAdminBanners, openSystemConfigModal, closeSystemConfigModal, switchSystemConfigTab } from './portal_admin_sysconfig.js';
import { loadAdminCategories, saveCurrentCatI18nDraft } from './portal_admin_categories.js';
import { loadAdminProducts, onPriceLevelChange, saveCurrentProdI18nDraft, openProductModal, closeProductModal } from './portal_admin_products.js';
import { loadAdminBranches } from './portal_admin_branches.js';
import { loadAdminUsers, loadAdminCustomers } from './portal_admin_users.js';
import { loadAdminPromotions, loadAdminAddons } from './portal_admin_promotions.js';
import { loadAdminTranslations, syncSingleKeyInputToDictionary } from './portal_admin_translations.js';
import { loadAdminOrders } from './portal_admin_orders.js';
import { loadAdminInventory } from './portal_admin_inventory.js';

document.addEventListener("DOMContentLoaded", () => {
    loadAdminCompanyInfo();
    const path = (window.location.pathname || "").toLowerCase();
    const hash = (window.location.hash || "").toLowerCase();
    if (path.includes("/portal/admin") || path.includes("/portal/manager") || hash === "#admin") {
        const user = typeof getCurrentUser === "function" ? getCurrentUser() : null;
        if (user && (user.role === "super_admin" || user.role === "branch_manager")) {
            setTimeout(() => openAdminPortalModal(), 100);
        } else {
            if (typeof openAuthModal === "function") {
                setTimeout(() => openAuthModal("login"), 100);
            }
        }
    }
});

if (typeof document !== "undefined" && document.readyState !== "loading") {
    loadAdminCompanyInfo();
}

export function openAdminPortalModal(initialTab = null) {
    // Nếu yêu cầu tab cấu hình hệ thống, chuyển hướng trực tiếp sang modal Cấu Hình Hệ Thống
    if (initialTab === "company" || initialTab === "translations" || initialTab === "banners") {
        openSystemConfigModal(initialTab);
        return;
    }

    const dropdown = document.getElementById("userDropdownMenu");
    if (dropdown) dropdown.classList.add("hidden");

    const user = (typeof getCurrentUser === "function") 
        ? getCurrentUser() 
        : ((typeof window !== "undefined" && typeof window.getCurrentUser === "function") ? window.getCurrentUser() : null);

    if (!user || (user.role !== "super_admin" && user.role !== "branch_manager")) {
        alert("Vui lòng đăng nhập bằng tài khoản Super Admin hoặc Quản Lý Chi Nhánh để truy cập Cổng Quản Trị!");
        if (typeof openAuthModal === "function") openAuthModal("login");
        else if (typeof window !== "undefined" && typeof window.openAuthModal === "function") window.openAuthModal("login");
        return;
    }

    const modal = document.getElementById("adminPortalModal");
    if (!modal) return;

    const nameEl = document.getElementById("adminUserName");
    const roleEl = document.getElementById("adminUserRole");
    if (nameEl) nameEl.textContent = user.fullName || user.phone || "Quản trị viên";
    if (roleEl) roleEl.textContent = user.role;

    // Đồng bộ phân quyền hiển thị các Tab trong Admin CMS theo config_layout.js
    const optSuperAdmin = document.getElementById("optRoleSuperAdmin");
    const optBranchManager = document.getElementById("optRoleBranchManager");
    const filterBranchSelect = document.getElementById("filterUserBranch");

    const cmsGroup = (typeof CONFIG_LAYOUT !== "undefined" ? CONFIG_LAYOUT : (typeof window !== "undefined" ? window.CONFIG_LAYOUT : null))?.find(g => g.groupId === "cms");
    if (cmsGroup && Array.isArray(cmsGroup.children)) {
        cmsGroup.children.forEach(t => {
            const btn = document.getElementById(`tabBtn${t.tabKey.charAt(0).toUpperCase() + t.tabKey.slice(1)}`);
            if (btn) {
                const checkAllowed = (typeof isTabAllowed === "function") 
                    ? isTabAllowed 
                    : ((typeof window !== "undefined" && typeof window.isTabAllowed === "function") ? window.isTabAllowed : null);
                const allowed = checkAllowed ? checkAllowed(t.tabKey, user.role) : true;
                if (allowed) {
                    btn.classList.remove("hidden");
                } else {
                    btn.classList.add("hidden");
                }
            }
        });
    }

    if (user.role === "branch_manager") {
        if (optSuperAdmin) optSuperAdmin.classList.add("hidden");
        if (optBranchManager) optBranchManager.classList.add("hidden");
        if (filterBranchSelect) {
            filterBranchSelect.value = user.branchId;
            filterBranchSelect.disabled = true;
        }
    } else {
        if (optSuperAdmin) optSuperAdmin.classList.remove("hidden");
        if (optBranchManager) optBranchManager.classList.remove("hidden");
        if (filterBranchSelect) filterBranchSelect.disabled = false;
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    loadAdminCategories();
    loadAdminProducts();
    loadAdminBranches();
    onPriceLevelChange();

    const targetTab = initialTab || ((typeof getDefaultTabForRole === "function") ? getDefaultTabForRole(user.role, "cms") : "orders");
    switchAdminTab(targetTab);

}

export function closeAdminPortalModal() {
    const modal = document.getElementById("adminPortalModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

// ==========================================
// MODAL CẤU HÌNH HỆ THỐNG (DOANH NGHIỆP & ĐA NGÔN NGỮ)
// ==========================================

export function openSystemConfigModal(initialTab = "company") {
    const dropdown = document.getElementById("userDropdownMenu");
    if (dropdown) dropdown.classList.add("hidden");

    const user = (typeof getCurrentUser === "function") 
        ? getCurrentUser() 
        : ((typeof window !== "undefined" && typeof window.getCurrentUser === "function") ? window.getCurrentUser() : null);

    if (!user || user.role !== "super_admin") {
        alert("Chức năng Cấu Hình Hệ Thống chỉ dành cho Tổng Quản Trị Viên (Super Admin)!");
        if (!user && typeof openAuthModal === "function") openAuthModal("login");
        return;
    }

    const modal = document.getElementById("systemConfigModal");
    if (!modal) return;

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    switchSystemConfigTab(initialTab);
}

export function closeSystemConfigModal() {
    const modal = document.getElementById("systemConfigModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export function switchSystemConfigTab(tabName) {
    if (tabName !== "company" && tabName !== "translations" && tabName !== "payment" && tabName !== "addonvis" && tabName !== "banners") tabName = "company";

    const btnCompany = document.getElementById("tabSysBtnCompany");
    const btnTranslations = document.getElementById("tabSysBtnTranslations");
    const btnPayment = document.getElementById("tabSysBtnPayment");
    const btnAddonVis = document.getElementById("tabSysBtnAddonVis");
    const btnBanners = document.getElementById("tabSysBtnBanners");
    const contentCompany = document.getElementById("tabSysContentCompany");
    const contentTranslations = document.getElementById("tabSysContentTranslations");
    const contentPayment = document.getElementById("tabSysContentPayment");
    const contentAddonVis = document.getElementById("tabSysContentAddonVis");
    const contentBanners = document.getElementById("tabSysContentBanners");

    const activeCls = "py-3 font-bold text-xs sm:text-sm border-b-2 border-primary text-primary transition flex items-center flex-shrink-0";
    const idleCls = "py-3 font-bold text-xs sm:text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition flex items-center flex-shrink-0";

    // Ẩn toàn bộ, reset trạng thái nút
    if (btnCompany) btnCompany.className = idleCls;
    if (btnTranslations) btnTranslations.className = idleCls;
    if (btnPayment) btnPayment.className = idleCls;
    if (btnAddonVis) btnAddonVis.className = idleCls;
    if (btnBanners) btnBanners.className = idleCls;
    if (contentCompany) contentCompany.classList.add("hidden");
    if (contentTranslations) contentTranslations.classList.add("hidden");
    if (contentPayment) contentPayment.classList.add("hidden");
    if (contentAddonVis) contentAddonVis.classList.add("hidden");
    if (contentBanners) contentBanners.classList.add("hidden");

    if (tabName === "company") {
        if (btnCompany) btnCompany.className = activeCls;
        if (contentCompany) contentCompany.classList.remove("hidden");
        loadAdminCompanyInfo();
    } else if (tabName === "payment") {
        if (btnPayment) btnPayment.className = activeCls;
        if (contentPayment) contentPayment.classList.remove("hidden");
        loadAdminPaymentConfig();
    } else if (tabName === "addonvis") {
        if (btnAddonVis) btnAddonVis.className = activeCls;
        if (contentAddonVis) contentAddonVis.classList.remove("hidden");
        loadAdminAddonConfig();
    } else if (tabName === "banners") {
        if (btnBanners) btnBanners.className = activeCls;
        if (contentBanners) contentBanners.classList.remove("hidden");
        loadAdminBanners();
    } else {
        if (btnTranslations) btnTranslations.className = activeCls;
        if (contentTranslations) contentTranslations.classList.remove("hidden");
        loadAdminTranslations();
    }
}

export function checkAdminAccess() {
    if (typeof getCurrentUser !== "function" || typeof getAuthToken !== "function") return;
    const user = getCurrentUser();
    const nameEl = document.getElementById("adminUserName");
    const roleEl = document.getElementById("adminUserRole");
    if (nameEl && user) nameEl.textContent = user.fullName || "Quản trị viên";
    if (roleEl && user) roleEl.textContent = user.role;
}

export function switchAdminTab(tabName) {
    // Nếu gọi tab cấu hình hệ thống, tự động mở System Config Dialog
    if (tabName === "company" || tabName === "translations" || tabName === "banners") {
        closeAdminPortalModal();
        openSystemConfigModal(tabName);
        return;
    }

    // Chuẩn hóa tên tab (hỗ trợ alias 'users' -> 'staff')
    if (tabName === "users") tabName = "staff";

    // Kiểm tra quyền truy cập tab theo config_layout.js
    const currentUser = (typeof getCurrentUser === "function") ? getCurrentUser() : ((typeof window !== "undefined" && typeof window.getCurrentUser === "function") ? window.getCurrentUser() : null);
    const checkFn = (typeof isTabAllowed === "function") ? isTabAllowed : (typeof window !== "undefined" ? window.isTabAllowed : null);
    if (currentUser && typeof checkFn === "function" && !checkFn(tabName, currentUser.role)) {
        console.warn(`[RBAC] Vai trò '${currentUser.role}' không có quyền truy cập tab '${tabName}'`);
        if (typeof showToast === "function") showToast("Bạn không có quyền truy cập phân hệ này!", "warning");
        return;
    }

    const tabTitles = {
        orders: "Đơn Hàng",
        products: "Mẫu Hoa & Bảng Giá",
        inventory: "Kho & Hao Hụt",
        categories: "Danh Mục Hoa",
        staff: "Nhân Sự Nội Bộ",
        customers: "Khách Hàng & CRM",
        branches: "Chuỗi Showroom",
        promotions: "Khuyến Mãi & Voucher",
        addons: "Sản Phẩm Kèm Theo"
    };

    console.group(`%c🖥️ [GUI_VIEW] Đang hiển thị Tab: "${tabTitles[tabName] || tabName}" (#tabContent${tabName.charAt(0).toUpperCase() + tabName.slice(1)})`, "color: #0288d1; font-weight: bold; font-size: 12px;");
    console.log("⏱️ Thời điểm:", new Date().toLocaleTimeString());
    console.log("📂 Tab Identifier:", tabName);

    const tabs = ["orders", "products", "inventory", "categories", "staff", "customers", "branches", "promotions", "addons"];
    tabs.forEach((t) => {
        const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const content = document.getElementById(`tabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (btn && content) {
            if (t === tabName) {
                btn.className = "py-3 font-bold text-xs sm:text-sm border-b-2 border-primary text-primary transition flex items-center flex-shrink-0";
                content.classList.remove("hidden");
                console.log(`  👁️ [GUI Hiển Thị] Element #${content.id} -> visible (class 'hidden' removed)`);
                try {
                    btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                } catch (e) {}
            } else {
                btn.className = "py-3 font-bold text-xs sm:text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition flex items-center flex-shrink-0";
                content.classList.add("hidden");
            }
        }
    });

    console.log(`  🚀 Bắt đầu nạp/đồng bộ dữ liệu phân hệ: ${tabTitles[tabName] || tabName}`);
    if (tabName === "orders") loadAdminOrders();
    if (tabName === "products") loadAdminProducts();
    if (tabName === "inventory") loadAdminInventory();
    if (tabName === "categories") loadAdminCategories();
    if (tabName === "staff") loadAdminUsers();
    if (tabName === "customers") loadAdminCustomers();
    if (tabName === "branches") loadAdminBranches();
    if (tabName === "promotions") loadAdminPromotions();
    if (tabName === "addons") loadAdminAddons();

    console.groupEnd();
}

// Global window binding
if (typeof window !== "undefined") {
    window.openAdminPortalModal = openAdminPortalModal;
    window.closeAdminPortalModal = closeAdminPortalModal;
    window.switchAdminTab = switchAdminTab;
    window.openSystemConfigModal = openSystemConfigModal;
    window.closeSystemConfigModal = closeSystemConfigModal;
    window.switchSystemConfigTab = switchSystemConfigTab;
    window.checkAdminAccess = checkAdminAccess;
    window.saveCurrentProdI18nDraft = saveCurrentProdI18nDraft;
    window.syncSingleKeyInputToDictionary = syncSingleKeyInputToDictionary;
    window.saveCurrentCatI18nDraft = saveCurrentCatI18nDraft;
}
