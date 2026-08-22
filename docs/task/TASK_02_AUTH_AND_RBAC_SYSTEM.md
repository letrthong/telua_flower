# Task 02: Hệ Thống Đăng Nhập Đơn Nhất & Phân Quyền JWT (5 Roles)
## Mã Task: `TASK_02_AUTH_AND_RBAC_SYSTEM`

---

## 1. Mục Tiêu (Objective)
Xây dựng phân hệ xác thực đăng nhập đơn nhất (Single Login Entrypoint), mã hóa mật khẩu an toàn (Bcrypt), cấp phát JSON Web Token (JWT) có chữ ký số bí mật, tự động nhận diện và điều hướng 5 Roles (`customer`, `florist`, `sales_consultant`, `branch_manager`, `super_admin`), kèm tầng bảo vệ Decorator `@require_role` ở Backend và Route Guards ở Frontend.

---

## 2. Tài Liệu Tham Khảo (References)
- 📐 [docs/design/AUTHENTICATION_DESIGN.md](file:///d:/code/telua_flower/docs/design/AUTHENTICATION_DESIGN.md)
- 📐 [docs/design/API_ENDPOINTS.md](file:///d:/code/telua_flower/docs/design/API_ENDPOINTS.md)
- 📋 [docs/requirements/PRODUCT_REQUIREMENTS.md](file:///d:/code/telua_flower/docs/requirements/PRODUCT_REQUIREMENTS.md)

---

## 3. Danh Sách File Cần Tạo / Sửa

### Backend Python Flask:
1. `src/services/auth_service.py`: Xử lý băm mật khẩu (Bcrypt), sinh JWT Token, giải mã payload và kiểm tra token hết hạn.
2. `src/decorators/auth_decorator.py`: Viết `@require_role(allowed_roles)` kiểm soát quyền truy cập API và phân lập dữ liệu chi nhánh (`branchId`).
3. `src/app.py`: Đăng ký các endpoints `/api/auth/login`, `/api/auth/register`, `/api/auth/me`, `/api/auth/logout`.

### Frontend JavaScript:
1. `js/auth.js`: Quản lý Token trong `localStorage`, hàm `login()`, `logout()`, `checkRoutePermission()` và tự động điều hướng theo Role.

### Unit Test:
- `src/unittest/test_auth_service.py`: Kiểm thử tạo token, xác thực đúng/sai mật khẩu, và kiểm tra quyền chặn mã `401`/`403`.

---

## 4. Tiêu Chuẩn Nghiệm Thu (Acceptance Criteria)
- [ ] Khách hàng, Florist, Sales, Quản lý chi nhánh và Admin đều đăng nhập thành công tại 1 cổng duy nhất `/api/auth/login`.
- [ ] Trả về JWT Token hợp lệ chứa `userId`, `role`, `branchId` và thời hạn `exp`.
- [ ] Backend chặn đúng mã `401 Unauthorized` nếu chưa đăng nhập hoặc token sai.
- [ ] Backend chặn đúng mã `403 Forbidden` nếu tài khoản không đủ quyền hạn.
- [ ] Kiểm thử `test_auth_service.py` đạt 100% Pass.
