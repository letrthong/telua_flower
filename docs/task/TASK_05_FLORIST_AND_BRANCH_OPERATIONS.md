# Task 05: Cổng Thợ Cắm Hoa, Upload Ảnh Thật & In Phiếu Giao K80
## Mã Task: `TASK_05_FLORIST_AND_BRANCH_OPERATIONS`

---

## 1. Mục Tiêu (Objective)
Xây dựng giao diện cổng làm việc dành cho Thợ cắm hoa và Nhân viên chi nhánh (`/portal/staff`): Tiếp nhận đơn hoa theo ca, cập nhật trạng thái tiến độ cắm hoa, **chụp ảnh hoa thực tế tải lên gửi khách duyệt**, và bấm in phiếu giao hàng nhiệt K80/A5 dán lên bó hoa.

---

## 2. Tài Liệu Tham Khảo (References)
- 📐 [docs/design/OPERATIONAL_EXTENSIONS_DESIGN.md](file:///d:/code/telua_flower/docs/design/OPERATIONAL_EXTENSIONS_DESIGN.md)
- 📋 [docs/requirements/BRANCH_STAFF_MANAGEMENT_GUIDE.md](file:///d:/code/telua_flower/docs/requirements/BRANCH_STAFF_MANAGEMENT_GUIDE.md)

---

## 3. Danh Sách File Cần Tạo / Sửa

### Frontend Giao Diện:
1. `src/templates/portal_staff.html` (hoặc `portal/staff.html`): Màn hình làm việc của Thợ cắm hoa:
   - Danh sách đơn cần cắm trong ca trực.
   - Nút chụp ảnh / tải ảnh hoa thật từ điện thoại lên hệ thống.
   - Nút **"In Phiếu Giao Hàng K80"** (mở cửa sổ in nhiệt với đầy đủ địa chỉ, ghi chú và lời chúc thiệp).
2. `js/portal_staff.js`: Logic gọi API cập nhật trạng thái đơn (*Đang cắm $\rightarrow$ Đã cắm xong $\rightarrow$ Đang giao*).

### Backend Python Flask:
1. `src/app.py`: Đăng ký endpoint `GET /api/branch/<branch_id>/orders`, `POST /api/orders/<id>/photo`, `GET /api/orders/<id>/print-slip`.
2. `src/services/image_service.py`: Tự động nén ảnh chụp hoa thực tế sang `.webp` (giải phóng RAM ngay lập tức).

### Unit Test:
- `src/unittest/test_image_service.py`: Kiểm thử upload và nén ảnh thành công.

---

## 4. Tiêu Chuẩn Nghiệm Thu (Acceptance Criteria)
- [ ] Thợ cắm hoa xem được danh sách đơn hàng được gán cho chi nhánh của mình.
- [ ] Tải được ảnh chụp hoa thật lên đơn hàng, hệ thống nén WebP dưới 150KB.
- [ ] Bấm in phiếu giao hàng K80 hiển thị đúng đầy đủ thông tin người nhận, ghi chú chỉ dẫn địa chỉ và lời chúc thiệp.
