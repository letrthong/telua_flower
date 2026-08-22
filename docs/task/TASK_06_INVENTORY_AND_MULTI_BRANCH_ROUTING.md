# Task 06: Quản Lý Tồn Kho Theo Ngày, Ma Trận 🟢/🟠/🔴 & Điều Phối Đơn
## Mã Task: `TASK_06_INVENTORY_AND_MULTI_BRANCH_ROUTING`

---

## 1. Mục Tiêu (Objective)
Xây dựng phân hệ quản lý tồn kho hoa tươi theo hạn mức ngày (Daily Quota), hiển thị ma trận tồn kho thời gian thực đa chi nhánh (🟢 Còn nhiều, 🟠 Sắp hết, 🔴 Hết hàng), tự động điều phối đơn hàng thông minh sang chi nhánh lân cận còn hàng, và phiếu báo hủy hoa dập hỏng cuối ngày.

---

## 2. Tài Liệu Tham Khảo (References)
- 📐 [docs/design/INVENTORY_MANAGEMENT_DESIGN.md](file:///d:/code/telua_flower/docs/design/INVENTORY_MANAGEMENT_DESIGN.md)
- 📐 [docs/design/MULTI_BRANCH_INVENTORY_TRACKING.md](file:///d:/code/telua_flower/docs/design/MULTI_BRANCH_INVENTORY_TRACKING.md)

---

## 3. Danh Sách File Cần Tạo / Sửa

### Frontend Giao Diện:
1. `src/templates/portal_inventory.html`: Bảng ma trận tồn kho đa chi nhánh (Live Inventory Matrix), ô nhập nhanh số lượng hoa bán hôm nay, và form báo hủy hoa hỏng cuối ca.
2. `js/portal_inventory.js`: Xử lý lưu số lượng hàng loạt (`batch update`) và tính toán tổng hao hụt.
3. `index.html`: Cập nhật thẻ sản phẩm hiển thị đèn tín hiệu 🟢/🟠/🔴 theo tồn kho chi nhánh.

### Backend Python Flask:
1. `src/services/inventory_service.py`: Cập nhật tồn kho theo chi nhánh, tự động trừ kho khi có đơn, thuật toán điều phối đơn hàng gần nhất (Haversine distance).
2. `src/app.py`: Đăng ký endpoint `GET /api/products/<id>/stock`, `GET /api/admin/inventory/matrix`, `PUT /api/branch/<id>/inventory`, `POST /api/branch/<id>/wastage`.

### Unit Test:
- `src/unittest/test_inventory_service.py`: Kiểm thử trừ tồn kho chính xác và thuật toán tìm chi nhánh gần nhất.

---

## 4. Tiêu Chuẩn Nghiệm Thu (Acceptance Criteria)
- [ ] Nhân viên nhập nhanh được số lượng hoa bán trong ngày tại chi nhánh.
- [ ] Website hiển thị chính xác trạng thái 🟢 Còn nhiều / 🟠 Sắp hết / 🔴 Hết hàng theo từng showroom.
- [ ] Khi chi nhánh gần nhất hết hàng, hệ thống tự động gán đơn sang chi nhánh gần thứ nhì còn hàng.
- [ ] Quản lý lưu được phiếu báo hủy hoa hỏng cuối ngày.
