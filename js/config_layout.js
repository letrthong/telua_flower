/**
 * TELUA FLOWER CONNECT - ADMIN NAVIGATION & LAYOUT CONFIG
 * Cấu trúc định nghĩa menu điều hướng đa cấp, ánh xạ modal/tab, module JS phụ trách và phân quyền người dùng.
 */

import { ROLES, hasPermission } from './roles_const.js';

export const ADMIN_NAVIGATION_CONFIG = [
  {
    groupId: "workspace",
    title: "Công Việc Của Tôi",
    icon: "fa-solid fa-briefcase",
    targetModal: "staffPortalModal",
    action: "openMyWorkspace",
    roles: [ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER, ROLES.FLORIST, ROLES.SALES_CONSULTANT],
    children: [
      {
        tabKey: "my_tasks",
        label: "Nhiệm Vụ Trong Ca",
        icon: "fa-solid fa-list-check",
        module: "staff_portal.js",
        loadFn: "openStaffPortalModal",
        action: "openStaffPortalModal()",
        roles: [ROLES.FLORIST, ROLES.SALES_CONSULTANT]
      },
      {
        tabKey: "dispatch_orders",
        label: "Điều Phối & Xử Lý Đơn",
        icon: "fa-solid fa-clipboard-check",
        module: "portal_admin_orders.js",
        loadFn: "loadAdminOrders",
        action: "openAdminPortalModal('orders')",
        roles: [ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER]
      }
    ]
  },
  {
    groupId: "cms",
    title: "CMS (Hàng Hóa & Vận Hành)",
    icon: "fa-solid fa-gauge-high",
    targetModal: "adminPortalModal",
    action: "openAdminPortalModal",
    roles: [ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER],
    children: [
      {
        tabKey: "orders",
        label: "Đơn Hàng",
        icon: "fa-solid fa-box-open",
        module: "portal_admin_orders.js",
        loadFn: "loadAdminOrders",
        action: "switchAdminTab('orders')",
        roles: [ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER, ROLES.FLORIST, ROLES.SALES_CONSULTANT]
      },
      {
        tabKey: "products",
        label: "Mẫu Hoa & Bảng Giá",
        icon: "fa-solid fa-spa",
        module: "portal_admin_products.js",
        loadFn: "loadAdminProducts",
        action: "switchAdminTab('products')",
        roles: [ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER]
      },
      {
        tabKey: "inventory",
        label: "Kho & Hao Hụt",
        icon: "fa-solid fa-boxes-stacked",
        module: "portal_admin_inventory.js",
        loadFn: "loadAdminInventory",
        action: "switchAdminTab('inventory')",
        roles: [ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER, ROLES.FLORIST]
      },
      {
        tabKey: "categories",
        label: "Danh Mục Hoa",
        icon: "fa-solid fa-layer-group",
        module: "portal_admin_categories.js",
        loadFn: "loadAdminCategories",
        action: "switchAdminTab('categories')",
        roles: [ROLES.SUPER_ADMIN]
      },
      {
        tabKey: "branches",
        label: "Chuỗi Showroom",
        icon: "fa-solid fa-store",
        module: "portal_admin_branches.js",
        loadFn: "loadAdminBranches",
        action: "switchAdminTab('branches')",
        roles: [ROLES.SUPER_ADMIN]
      },
      {
        tabKey: "promotions",
        label: "Khuyến Mãi & Voucher",
        icon: "fa-solid fa-ticket-simple",
        module: "portal_admin_promotions.js",
        loadFn: "loadAdminPromotions",
        action: "switchAdminTab('promotions')",
        roles: [ROLES.SUPER_ADMIN]
      },
      {
        tabKey: "addons",
        label: "Sản Phẩm Kèm Theo",
        icon: "fa-solid fa-gift",
        module: "portal_admin_promotions.js",
        loadFn: "loadAdminAddons",
        action: "switchAdminTab('addons')",
        roles: [ROLES.SUPER_ADMIN]
      },
      {
        tabKey: "banners",
        label: "Banner Trang Chủ",
        icon: "fa-solid fa-images",
        module: "portal_admin_sysconfig.js",
        loadFn: "loadAdminBanners",
        action: "switchAdminTab('banners')",
        roles: [ROLES.SUPER_ADMIN]
      }
    ]
  },
  {
    groupId: "user_management",
    title: "Quản Lý Người Dùng",
    icon: "fa-solid fa-users-gear",
    targetModal: "adminPortalModal",
    action: "openAdminPortalModal",
    roles: [ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER, ROLES.SALES_CONSULTANT],
    children: [
      {
        tabKey: "staff",
        label: "Nhân Sự Nội Bộ",
        icon: "fa-solid fa-user-tie",
        module: "portal_admin_users.js",
        loadFn: "loadAdminUsers",
        action: "switchAdminTab('staff')",
        roles: [ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER]
      },
      {
        tabKey: "customers",
        label: "Khách Hàng & CRM",
        icon: "fa-solid fa-crown",
        module: "portal_admin_users.js",
        loadFn: "loadAdminCustomers",
        action: "switchAdminTab('customers')",
        roles: [ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER, ROLES.SALES_CONSULTANT]
      }
    ]
  },
  {
    groupId: "order_dashboard",
    title: "Bảng Điều Khiển Đơn Hàng",
    icon: "fa-solid fa-chart-line",
    targetModal: "orderDashboardModal",
    action: "openOrderDashboardModal",
    roles: [ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER, ROLES.FLORIST, ROLES.SALES_CONSULTANT],
    children: [
      {
        tabKey: "order_dashboard_view",
        label: "Tổng Quan Đơn Hàng",
        icon: "fa-solid fa-table-columns",
        module: "order_dashboard.js",
        loadFn: "openOrderDashboardModal",
        action: "openOrderDashboardModal()",
        roles: [ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER, ROLES.FLORIST, ROLES.SALES_CONSULTANT]
      }
    ]
  },
  {
    groupId: "system_config",
    title: "Cấu Hình Hệ Thống",
    icon: "fa-solid fa-sliders",
    targetModal: "systemConfigModal",
    action: "openSystemConfigModal",
    roles: [ROLES.SUPER_ADMIN],
    children: [
      {
        tabKey: "company",
        label: "Thông Tin Doanh Nghiệp",
        icon: "fa-solid fa-building",
        module: "portal_admin_sysconfig.js",
        loadFn: "loadCompanyInfo",
        action: "switchSystemConfigTab('company')",
        roles: [ROLES.SUPER_ADMIN]
      },
      {
        tabKey: "translations",
        label: "Biên Dịch Đa Ngôn Ngữ",
        icon: "fa-solid fa-language",
        module: "portal_admin_translations.js",
        loadFn: "loadAdminTranslations",
        action: "switchSystemConfigTab('translations')",
        roles: [ROLES.SUPER_ADMIN]
      },
      {
        tabKey: "payment",
        label: "Phương Thức Thanh Toán",
        icon: "fa-solid fa-credit-card",
        module: "portal_admin_sysconfig.js",
        loadFn: "loadPaymentGateways",
        action: "switchSystemConfigTab('payment')",
        roles: [ROLES.SUPER_ADMIN]
      },
      {
        tabKey: "addonvis",
        label: "Hiển Thị Phụ Kiện Giỏ Hàng",
        icon: "fa-solid fa-eye",
        module: "portal_admin_sysconfig.js",
        loadFn: "loadAddonVisibility",
        action: "switchSystemConfigTab('addonvis')",
        roles: [ROLES.SUPER_ADMIN]
      },
      {
        tabKey: "banners",
        label: "Banner Trình Chiếu",
        icon: "fa-solid fa-images",
        module: "portal_admin_sysconfig.js",
        loadFn: "loadAdminBanners",
        action: "switchSystemConfigTab('banners')",
        roles: [ROLES.SUPER_ADMIN]
      }
    ]
  },
  {
    groupId: "profile",
    title: "Hồ Sơ & Bảo Mật",
    icon: "fa-solid fa-user-gear",
    targetModal: "userProfileModal",
    action: "openUserProfileModal",
    roles: ["all"],
    children: [
      {
        tabKey: "profile_info",
        label: "Thông Tin Cá Nhân",
        icon: "fa-solid fa-id-card",
        module: "user_profile.js",
        loadFn: "openUserProfileModal",
        action: "openUserProfileModal('info')",
        roles: ["all"]
      },
      {
        tabKey: "profile_password",
        label: "Đổi Mật Khẩu",
        icon: "fa-solid fa-key",
        module: "user_profile.js",
        loadFn: "openUserProfileModal",
        action: "openUserProfileModal('password')",
        roles: ["all"]
      }
    ]
  },
  {
    groupId: "customer_portal",
    title: "Đơn Hàng Của Tôi",
    icon: "fa-solid fa-clock-rotate-left",
    targetModal: "customerPortalModal",
    action: "openCustomerPortalModal",
    roles: [ROLES.CUSTOMER],
    children: [
      {
        tabKey: "my_orders",
        label: "Lịch Sử Mua Hàng",
        icon: "fa-solid fa-box-open",
        module: "customer_portal.js",
        loadFn: "openCustomerPortalModal",
        action: "openCustomerPortalModal()",
        roles: [ROLES.CUSTOMER]
      }
    ]
  }
];

/**
 * Lọc cây menu điều hướng dựa trên vai trò của người dùng hiện tại
 * @param {string} userRole - Vai trò của người dùng (ví dụ: 'super_admin', 'branch_manager', 'florist')
 * @returns {Array} - Cây menu đã được lọc quyền
 */
export function getAuthorizedAdminLayout(userRole) {
  return ADMIN_NAVIGATION_CONFIG
    .filter(group => !group.roles || hasPermission(userRole, group.roles))
    .map(group => ({
      ...group,
      children: group.children.filter(child => hasPermission(userRole, child.roles))
    }))
    .filter(group => group.children.length > 0);
}

/**
 * Tìm cấu hình chi tiết của một tabKey cụ thể
 * @param {string} tabKey 
 * @returns {Object|null}
 */
export function getTabConfig(tabKey) {
  for (const group of ADMIN_NAVIGATION_CONFIG) {
    const found = group.children.find(c => c.tabKey === tabKey);
    if (found) return { ...found, groupId: group.groupId, targetModal: group.targetModal };
  }
  return null;
}

/**
 * Kiểm tra xem người dùng có vai trò userRole có quyền truy cập tabKey hay không
 * @param {string} tabKey
 * @param {string} userRole
 * @returns {boolean}
 */
export function isTabAllowed(tabKey, userRole) {
  const config = getTabConfig(tabKey);
  if (!config) return true;
  return hasPermission(userRole, config.roles);
}

/**
 * Lấy tabKey mặc định đầu tiên mà vai trò userRole được phép truy cập trong nhóm groupId
 * @param {string} userRole
 * @param {string} groupId
 * @returns {string}
 */
export function getDefaultTabForRole(userRole, groupId = "cms") {
  const group = ADMIN_NAVIGATION_CONFIG.find(g => g.groupId === groupId);
  if (!group || !Array.isArray(group.children)) return "orders";
  const allowedTab = group.children.find(c => hasPermission(userRole, c.roles));
  return allowedTab ? allowedTab.tabKey : (group.children[0]?.tabKey || "orders");
}

/**
 * Điều hướng thông minh đến Bàn Làm Việc / Công Việc Của Tôi dựa trên vai trò
 */
export function openMyWorkspace() {
  const user = (typeof window !== "undefined" && typeof window.getCurrentUser === "function") 
    ? window.getCurrentUser() 
    : null;
  if (!user) return;
  if (user.role === "florist" || user.role === "sales_consultant") {
    if (typeof window.openStaffPortalModal === "function") {
      window.openStaffPortalModal();
    }
  } else if (user.role === "super_admin" || user.role === "branch_manager") {
    if (typeof window.openAdminPortalModal === "function") {
      window.openAdminPortalModal("orders");
    }
  }
}

// Aliases tương thích với tên file config_layout.js
export const CONFIG_LAYOUT = ADMIN_NAVIGATION_CONFIG;
export const getAuthorizedLayout = getAuthorizedAdminLayout;

// Global window binding for browser compatibility
if (typeof window !== "undefined") {
  window.ADMIN_NAVIGATION_CONFIG = ADMIN_NAVIGATION_CONFIG;
  window.CONFIG_LAYOUT = CONFIG_LAYOUT;
  window.getAuthorizedAdminLayout = getAuthorizedAdminLayout;
  window.getAuthorizedLayout = getAuthorizedLayout;
  window.getTabConfig = getTabConfig;
  window.isTabAllowed = isTabAllowed;
  window.getDefaultTabForRole = getDefaultTabForRole;
  window.openMyWorkspace = openMyWorkspace;
}

export default ADMIN_NAVIGATION_CONFIG;

