# Bảng Checklist Quản Lý Tiến Độ 8 Task (Task Implementation Checklist)
## Dự Án: Nở Hoa Thả Bình (`telua_flower`)

---

## 📊 Tiến Độ Tổng Thể (Overall Progress)

```text
Tiến độ: [██████░░░░░░░░░░░░░░] 25.0% (2/8 Task hoàn thành)
```

| Task | Tên Phân Hệ | Trạng Thái | Ngày Hoàn Thành | Kết Quả Unit Test |
| :---: | :--- | :---: | :---: | :---: |
| **01** | Khởi Tạo Dữ Liệu JSON & Storage Service | 🟢 **DONE** | 2026-08-22 | Pass 10/10 Test cases |
| **02** | Hệ Thống Đăng Nhập & Phân Quyền JWT (5 Roles) | 🟢 **DONE** | 2026-08-22 | Pass 10/10 Test cases |
| **03** | Giao Diện Bán Hàng, Hẹn Giờ, Thiệp & Banner | 🔴 **TODO** | -- | Chưa chạy |
| **04** | Cổng Thanh Toán VietQR & Báo Tin Zalo | 🔴 **TODO** | -- | Chưa chạy |
| **05** | Cổng Thợ Cắm Hoa, Upload Ảnh Thật & In Bill K80 | 🔴 **TODO** | -- | Chưa chạy |
| **06** | Quản Lý Tồn Kho Theo Ngày, Ma Trận & Điều Phối | 🔴 **TODO** | -- | Chưa chạy |
| **07** | Phân Tầng Giá (Price Levels), CMS Hoa & Voucher | 🔴 **TODO** | -- | Chưa chạy |
| **08** | Kiểm Thử Toàn Diện, Tối Ưu RAM & Docker Ubuntu | 🔴 **TODO** | -- | Chưa chạy |

*Ký hiệu: 🔴 TODO (Chưa bắt đầu) | 🟡 IN PROGRESS (Đang code) | 🟢 DONE (Đã hoàn thành & Pass test)*

---

## 📝 Checklist Chi Tiết Từng Bước Code & Nghiệm Thu

### [x] TASK 01: Khởi Tạo Cấu Trúc Dữ Liệu JSON & Storage Service
- [x] Tạo `config/branches.json` (Showroom Q.10, Q.1, Thảo Điền).
- [x] Tạo `config/users.json` (5 tài khoản mẫu cho 5 Roles).
- [x] Tạo `config/price_levels.json` (4 Phân tầng mức giá chuẩn).
- [x] Tạo `config/products.json` (Danh mục hoa & bình cắm hoa nghệ thuật).
- [x] Tạo `config/promotions.json` (Voucher khuyến mãi mẫu).
- [x] Tạo `config/orders/orders_2026_08.json` (Phân mảnh đơn hàng theo tháng).
- [x] Viết `src/services/data_service.py` (Đọc/Ghi an toàn, phân trang `page/limit`).
- [x] Viết `src/unittest/test_data_service.py` và chạy test Pass 100%.

---

### [x] TASK 02: Hệ Thống Đăng Nhập Đơn Nhất & Phân Quyền JWT (5 Roles)
- [x] Viết `src/services/auth_service.py` (Bcrypt/PBKDF2 hash, sinh JWT Token chứa `role` & `branchId`).
- [x] Viết `src/decorators/auth_decorator.py` (`@require_role` chặn `401`/`403`).
- [x] Tạo các API endpoints: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.
- [x] Viết `js/auth.js` lưu token vào `localStorage` và tự động điều hướng theo Role.
- [x] Viết `src/unittest/test_auth_service.py` và chạy test Pass 100%.

---

### [ ] TASK 03: Nâng Cấp Giao Diện Bán Hàng, Hẹn Giờ, Thiệp & Banner
- [ ] Thêm Modal Đặt Hàng trên `index.html` với Date Picker (30 ngày) và Time Slots.
- [ ] Thêm ô Ghi chú chỉ dẫn địa chỉ người nhận (`deliveryNotes`).
- [ ] Thêm ô Lời chúc viết thiệp và in Dải ruy-băng / Banner kệ hoa.
- [ ] Thêm tùy chọn "Gửi hoa ẩn danh (Bí mật người gửi)".
- [ ] Đồng bộ từ điển 5 ngôn ngữ trong `js/translations.js`.
- [ ] Viết `src/services/order_service.py` (`POST /api/orders`).
- [ ] Viết `js/unittest/test-checkout.js` và test giao diện mượt mà trên Mobile & Desktop.

---

### [ ] TASK 04: Tích Hợp Cổng Thanh Toán VietQR Tự Động & Báo Tin Zalo
- [ ] Viết `src/services/payment_service.py` sinh mã VietQR động có số tiền & mã đơn.
- [ ] Xử lý Webhook / Polling tự động đổi trạng thái đơn sang `paid` trong 5 giây.
- [ ] Viết `src/services/notification_service.py` gửi tin nhắn Zalo/SMS theo dõi đơn.
- [ ] Viết `src/unittest/test_payment_service.py` và test thành công.

---

### [ ] TASK 05: Cổng Thợ Cắm Hoa, Upload Ảnh Thật & In Phiếu Giao K80
- [ ] Tạo giao diện `/portal/staff` cho thợ cắm hoa xem đơn theo ca.
- [ ] Thêm chức năng chụp ảnh / upload ảnh hoa thật từ điện thoại.
- [ ] Viết `src/services/image_service.py` tự động nén WebP dưới 150KB.
- [ ] Thêm nút in phiếu giao hàng nhiệt K80/A5 hiển thị đầy đủ địa chỉ, ghi chú & thiệp.
- [ ] Viết `src/unittest/test_image_service.py` và test thành công.

---

### [ ] TASK 06: Quản Lý Tồn Kho Theo Ngày, Ma Trận 🟢/🟠/🔴 & Điều Phối Đơn
- [ ] Tạo giao diện `/portal/inventory` cập nhật nhanh hạn mức bán trong ngày (Daily Quota).
- [ ] Cập nhật thẻ sản phẩm trên web hiển thị đèn 🟢 Còn nhiều / 🟠 Sắp hết / 🔴 Hết hàng.
- [ ] Viết thuật toán tự động điều phối đơn sang chi nhánh gần nhất còn hàng.
- [ ] Tạo form nhập phiếu báo hủy cành hoa hỏng cuối ca (`POST /api/branch/<id>/wastage`).
- [ ] Viết `src/unittest/test_inventory_service.py` và test thành công.

---

### [ ] TASK 07: Hàng Rào Giá An Toàn (Price Levels), CMS Sửa Hoa, Khuyến Mãi & Biên Dịch Đa Ngôn Ngữ Động
- [ ] Viết logic ràng buộc giá: $\text{minPrice} \le \text{Giá} \le \text{maxPrice}$ theo 4 Price Levels.
- [ ] Chặn báo lỗi đỏ khi nhân viên nhập giá phá giá hoặc gõ nhầm số 0.
- [ ] Tạo giao diện `/portal/products` cho nhân viên sửa nhanh giá bán & nội dung hoa.
- [ ] Tạo giao diện `/portal/promotions` với công tắc Bật/Tắt (ON/OFF) 1-chạm cho Voucher & Banner.
- [ ] **Tạo giao diện `/portal/translations` cho Admin/Quản lý chỉnh sửa trực tiếp bản dịch 5 ngôn ngữ (Việt, Anh, Nhật, Hàn, Trung) và nội dung các khối trang (Slogan, Hotline, Showroom, Giờ mở cửa, Chính sách)**.
- [ ] Viết `src/services/translation_service.py` đọc/ghi `config/translations.json` và API `PUT /api/admin/translations`.
- [ ] Viết `src/unittest/test_price_governance.py` và `src/unittest/test_translation_service.py` chạy Pass 100%.

---

### [ ] TASK 08: Kiểm Thử Toàn Diện, Tối Ưu RAM < 150MB & Docker Ubuntu
- [ ] Chạy `./cli_docker.sh run_unittest` $\rightarrow$ Đạt 100% Pass bộ test Python Backend.
- [ ] Chạy `./cli_docker.sh js_unittest` $\rightarrow$ Đạt 100% Pass bộ test JS Frontend.
- [ ] Đo lường kiểm tra mức tiêu thụ RAM container luôn < 150MB.
- [ ] Khởi chạy và kiểm thử thực tế 1-lệnh qua `./cli_docker.sh start` trên Ubuntu.
