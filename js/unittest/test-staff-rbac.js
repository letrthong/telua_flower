import test from 'node:test';
import assert from 'node:assert';

const ROLE_DISPLAY_MAP = {
    super_admin: { label: "👑 Tổng Quản Trị", badge: "bg-purple-100 text-purple-800" },
    branch_manager: { label: "🏬 Quản Lý Chi Nhánh", badge: "bg-blue-100 text-blue-800" },
    florist: { label: "🌸 Thợ Cắm Hoa", badge: "bg-pink-100 text-pink-800" },
    sales_consultant: { label: "💼 Tư Vấn Viên", badge: "bg-amber-100 text-amber-800" },
    customer: { label: "✨ Khách Hàng", badge: "bg-gray-100 text-gray-800" }
};

// Client-side RBAC validation helper
function validateStaffCreationByRole(creatorRole, targetRole, creatorBranch, targetBranch) {
    if (creatorRole === "super_admin") {
        return { allowed: true };
    }
    if (creatorRole === "branch_manager") {
        if (targetRole !== "florist" && targetRole !== "sales_consultant") {
            return { allowed: false, reason: "MANAGER_CANNOT_ASSIGN_ROLE" };
        }
        if (targetBranch !== creatorBranch) {
            return { allowed: false, reason: "MANAGER_CANNOT_ASSIGN_OTHER_BRANCH" };
        }
        return { allowed: true };
    }
    return { allowed: false, reason: "UNAUTHORIZED_ROLE" };
}

// Client-side Branch Filter isolation
function filterUsersByBranchPermission(userList, currentUser) {
    if (currentUser.role === "super_admin") {
        return userList;
    }
    if (currentUser.role === "branch_manager") {
        return userList.filter((u) => u.branchId === currentUser.branchId);
    }
    return [];
}

test('rbac ui - role display map correctly identifies all 5 roles', (t) => {
    assert.strictEqual(ROLE_DISPLAY_MAP.super_admin.label, "👑 Tổng Quản Trị");
    assert.strictEqual(ROLE_DISPLAY_MAP.branch_manager.label, "🏬 Quản Lý Chi Nhánh");
    assert.strictEqual(ROLE_DISPLAY_MAP.florist.label, "🌸 Thợ Cắm Hoa");
    assert.strictEqual(ROLE_DISPLAY_MAP.sales_consultant.label, "💼 Tư Vấn Viên");
    assert.strictEqual(ROLE_DISPLAY_MAP.customer.label, "✨ Khách Hàng");
});

test('rbac ui - branch manager can only create florist or sales for own branch', (t) => {
    // 1. Quản lý Q10 tạo florist cho Q10 -> Thành công
    const res1 = validateStaffCreationByRole("branch_manager", "florist", "branch_q10", "branch_q10");
    assert.strictEqual(res1.allowed, true);

    // 2. Quản lý Q10 tạo sales_consultant cho Q10 -> Thành công
    const res2 = validateStaffCreationByRole("branch_manager", "sales_consultant", "branch_q10", "branch_q10");
    assert.strictEqual(res2.allowed, true);

    // 3. Quản lý Q10 cố tạo super_admin -> Bị chặn
    const res3 = validateStaffCreationByRole("branch_manager", "super_admin", "branch_q10", "branch_q10");
    assert.strictEqual(res3.allowed, false);
    assert.strictEqual(res3.reason, "MANAGER_CANNOT_ASSIGN_ROLE");

    // 4. Quản lý Q10 cố tạo florist cho branch_q1 -> Bị chặn
    const res4 = validateStaffCreationByRole("branch_manager", "florist", "branch_q10", "branch_q1");
    assert.strictEqual(res4.allowed, false);
    assert.strictEqual(res4.reason, "MANAGER_CANNOT_ASSIGN_OTHER_BRANCH");
});

test('rbac ui - super admin can create any role in any branch', (t) => {
    const resAdmin = validateStaffCreationByRole("super_admin", "branch_manager", null, "branch_thao_dien");
    assert.strictEqual(resAdmin.allowed, true);
});

test('rbac ui - branch manager user list is strictly filtered to own branch', (t) => {
    const mockUsers = [
        { id: "u1", fullName: "Admin", role: "super_admin", branchId: null },
        { id: "u2", fullName: "Quản lý Q10", role: "branch_manager", branchId: "branch_q10" },
        { id: "u3", fullName: "Thợ hoa Q10", role: "florist", branchId: "branch_q10" },
        { id: "u4", fullName: "Thợ hoa Q1", role: "florist", branchId: "branch_q1" },
        { id: "u5", fullName: "Quản lý Thảo Điền", role: "branch_manager", branchId: "branch_thao_dien" }
    ];

    // Manager Q10
    const mgrQ10 = { role: "branch_manager", branchId: "branch_q10" };
    const filteredQ10 = filterUsersByBranchPermission(mockUsers, mgrQ10);
    assert.strictEqual(filteredQ10.length, 2);
    filteredQ10.forEach((u) => {
        assert.strictEqual(u.branchId, "branch_q10");
    });

    // Super admin
    const superAdmin = { role: "super_admin" };
    const filteredAdmin = filterUsersByBranchPermission(mockUsers, superAdmin);
    assert.strictEqual(filteredAdmin.length, 5);
});
