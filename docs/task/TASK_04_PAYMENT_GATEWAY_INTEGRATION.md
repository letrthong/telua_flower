# Task 04: Tích Hợp Cổng Thanh Toán VietQR Tự Động & Báo Tin Zalo
## Mã Task: `TASK_04_PAYMENT_GATEWAY_INTEGRATION`

---

## 1. Mục Tiêu (Objective)
Tích hợp cổng thanh toán chuyển khoản tự động qua mã động VietQR (tự động nhận diện thanh toán thành công sau 5 giây), hỗ trợ thanh toán Thẻ quốc tế (Visa/Mastercard) cho kiều bào/khách nước ngoài, tiền mặt COD, và cơ chế tự động gửi thông báo xác nhận đơn hàng qua Zalo ZNS / SMS.

---

## 2. Tài Liệu Tham Khảo (References)
- 📐 [docs/design/PAYMENT_CANCELLATION_RETURN_DESIGN.md](file:///d:/code/telua_flower/docs/design/PAYMENT_CANCELLATION_RETURN_DESIGN.md)
- 📐 [docs/design/OPERATIONAL_EXTENSIONS_DESIGN.md](file:///d:/code/telua_flower/docs/design/OPERATIONAL_EXTENSIONS_DESIGN.md)
- 📐 [docs/design/API_ENDPOINTS.md](file:///d:/code/telua_flower/docs/design/API_ENDPOINTS.md)

---

## 3. Danh Sách File Cần Tạo / Sửa

### Backend Python Flask:
1. `src/services/payment_service.py`: Tạo link mã QR động VietQR theo chuẩn Napas 247 (`https://img.vietqr.io/image/...`), xử lý Webhook xác nhận thanh toán.
2. `src/services/notification_service.py`: Gửi tin nhắn Zalo ZNS / SMS thông báo đơn hàng và link ảnh hoa.
3. `src/app.py`: Đăng ký endpoint `POST /api/payments/create-qr`, `GET /api/payments/check-status/<id>`, `POST /api/payments/webhook`.

### Frontend JavaScript:
1. `js/payment.js`: Modal hiển thị mã VietQR động, countdown đếm ngược và polling kiểm tra trạng thái thanh toán tự động chuyển sang trang thành công.

### Unit Test:
- `src/unittest/test_payment_service.py`: Kiểm thử tạo URL VietQR đúng định dạng và xử lý webhook cập nhật trạng thái đơn thành `paid`.

---

## 4. Tiêu Chuẩn Nghiệm Thu (Acceptance Criteria)
- [ ] Sinh mã VietQR động có đúng Số tiền và Cú pháp nội dung đơn hàng.
- [ ] Webhook hoặc Polling cập nhật trạng thái đơn sang `paid` tự động, không cần khách gửi ảnh biên lai.
- [ ] Đơn hàng gửi tặng người khác bắt buộc thanh toán online trước 100%.
