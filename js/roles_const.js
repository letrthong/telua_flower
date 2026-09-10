/**
 * TELUA FLOWER CONNECT - RBAC ROLES & PERMISSIONS CONSTANTS
 * Quản lý tập trung danh mục vai trò người dùng, metadata giao diện và logic phân quyền.
 */

// 1. Danh mục vai trò cốt lõi (Khớp 100% với Backend Flask RBAC)
export const ROLES = {
  SUPER_ADMIN: "super_admin",           // 👑 Tổng Quản Trị (Toàn quyền hệ thống)
  BRANCH_MANAGER: "branch_manager",     // 🏬 Quản Lý Chi Nhánh (Quản lý cửa hàng theo branchId)
  FLORIST: "florist",                   // 🌸 Thợ Cắm Hoa (Chế tác & cập nhật tiến độ hoa)
  SALES_CONSULTANT: "sales_consultant", // 💼 Nhân Viên Tư Vấn (Tiếp nhận & tư vấn đơn hàng)
  CUSTOMER: "customer"                  // ✨ Khách Hàng Thân Thiết (Đặt hàng & tra cứu đơn cá nhân)
};

// 2. Nhóm quyền (Role Groups) dùng để kiểm tra quyền truy cập nhanh
export const ROLE_GROUPS = {
  // Toàn bộ nhân sự nội bộ (được mở Order Dashboard & tra cứu đơn nội bộ)
  INTERNAL_STAFF: [
    ROLES.SUPER_ADMIN,
    ROLES.BRANCH_MANAGER,
    ROLES.FLORIST,
    ROLES.SALES_CONSULTANT
  ],
  // Ban quản lý (được mở Admin Portal CMS)
  ADMIN_MANAGERS: [
    ROLES.SUPER_ADMIN,
    ROLES.BRANCH_MANAGER
  ],
  // Quản trị viên cấp cao nhất (toàn quyền hệ thống & cấu hình toàn chuỗi)
  ROOT_ADMIN: [
    ROLES.SUPER_ADMIN
  ]
};

// 3. Metadata hiển thị (Nhãn tiếng Việt, Badge Tailwind CSS, Icon FontAwesome)
export const ROLE_DISPLAY_MAP = {
  [ROLES.SUPER_ADMIN]: {
    label: "👑 Tổng Quản Trị",
    title: "Tổng Quản Trị Hệ Thống",
    badge: "bg-purple-100 text-purple-800 border border-purple-200",
    icon: "fa-solid fa-crown"
  },
  [ROLES.BRANCH_MANAGER]: {
    label: "🏬 Quản Lý Chi Nhánh",
    title: "Quản Lý Showroom",
    badge: "bg-blue-100 text-blue-800 border border-blue-200",
    icon: "fa-solid fa-store"
  },
  [ROLES.FLORIST]: {
    label: "🌸 Thợ Cắm Hoa",
    title: "Thợ Cắm Hoa & Hoàn Thiện Mẫu",
    badge: "bg-pink-100 text-pink-800 border border-pink-200",
    icon: "fa-solid fa-scissors"
  },
  [ROLES.SALES_CONSULTANT]: {
    label: "💼 Tư Vấn Viên",
    title: "Tư Vấn & Tiếp Nhận Đơn",
    badge: "bg-amber-100 text-amber-800 border border-amber-200",
    icon: "fa-solid fa-headset"
  },
  [ROLES.CUSTOMER]: {
    label: "✨ Khách Hàng",
    title: "Khách Hàng Thân Thiết",
    badge: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    icon: "fa-solid fa-user"
  }
};

// 4. Các hàm tiện ích kiểm tra quyền (RBAC Helpers)
export function isSuperAdmin(role) {
  return role === ROLES.SUPER_ADMIN;
}

export function isInternalStaff(role) {
  return ROLE_GROUPS.INTERNAL_STAFF.includes(role);
}

export function isAdminOrManager(role) {
  return ROLE_GROUPS.ADMIN_MANAGERS.includes(role);
}

export function hasPermission(userRole, allowedRoles) {
  if (!userRole) return false;
  if (!allowedRoles || allowedRoles.length === 0 || allowedRoles.includes("all")) return true;
  // Super Admin luôn có toàn quyền vượt cấp
  if (userRole === ROLES.SUPER_ADMIN) return true;
  return allowedRoles.includes(userRole);
}

// 5. Global window binding cho tương thích trình duyệt khi dùng thẻ <script>
if (typeof window !== "undefined") {
  window.ROLES = ROLES;
  window.ROLE_GROUPS = ROLE_GROUPS;
  window.ROLE_DISPLAY_MAP = ROLE_DISPLAY_MAP;
  window.isSuperAdmin = isSuperAdmin;
  window.isInternalStaff = isInternalStaff;
  window.isAdminOrManager = isAdminOrManager;
  window.hasPermission = hasPermission;
}

export default ROLES;
