# Task 03: Nâng Cấp Giao Diện Bán Hàng, Hẹn Giờ, Thiệp & Banner
## Mã Task: `TASK_03_STOREFRONT_AND_ORDERING_EXPERIENCE`

---

## 1. Mục Tiêu (Objective)
Nâng cấp giao diện đặt hoa online trên `index.html` và module `js/flower_app.js`: Thêm Modal Đặt Hàng hỗ trợ chọn ngày hẹn trước (30 ngày), chọn khung giờ giao (hoặc Hỏa tốc 2H), ô ghi chú chỉ dẫn địa chỉ (`deliveryNotes`), viết lời chúc thiệp, in banner ruy-băng kệ hoa, và tùy chọn gửi hoa ẩn danh.

---

## 2. Tài Liệu Tham Khảo (References)
- 📋 [docs/requirements/PRODUCT_REQUIREMENTS.md](file:///d:/code/telua_flower/docs/requirements/PRODUCT_REQUIREMENTS.md) (FR-1, FR-3, FR-7, FR-8)
- 📐 [docs/design/API_ENDPOINTS.md](file:///d:/code/telua_flower/docs/design/API_ENDPOINTS.md)

---

## 3. Danh Sách File Cần Tạo / Sửa

### Frontend HTML & CSS:
1. `index.html`: Thêm Modal Checkout / Form Đặt Hoa thông minh có Date Picker, Time Slots Dropdown, ô Thiệp/Banner, và ô Ghi chú địa chỉ người nhận.
2. `js/checkout.js` (hoặc mở rộng `js/flower_app.js`): Xử lý tính toán tổng tiền, kiểm tra dữ liệu form hợp lệ, và gửi `POST /api/orders`.
3. `js/translations.js`: Bổ sung bản dịch 5 ngôn ngữ cho các nhãn form hẹn giờ, thiệp, banner và chỉ dẫn địa chỉ.

### Backend Python Flask:
1. `src/services/order_service.py`: Xử lý tạo đơn hàng, tự động định vị GPS gán chi nhánh gần nhất.
2. `src/app.py`: Đăng ký endpoint `POST /api/orders` và `GET /api/delivery/slots`.

### Unit Test:
- `js/unittest/test-checkout.js`: Kiểm thử kiểm tra hợp lệ dữ liệu form đặt hàng và tính toán tiền đơn hàng.

---

## 4. Tiêu Chuẩn Nghiệm Thu (Acceptance Criteria)
- [ ] Khách hàng chọn được Ngày giao và Khung giờ giao (hoặc Giao hỏa tốc 2H).
- [ ] Nhập được lời chúc thiệp, in dải ruy-băng/banner và ghi chú chỉ dẫn địa chỉ (`deliveryNotes`).
- [ ] Tùy chọn "Gửi hoa ẩn danh (Bí mật người gửi)" hoạt động chính xác.
- [ ] Giao diện responsive 100% trên điện thoại di động và máy tính.
