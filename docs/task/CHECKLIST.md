# Bảng Checklist Quản Lý Tiến Độ 8 Task (Task Implementation Checklist)
## Dự Án: Nở Hoa Thả Bình (`telua_flower`)

---

## 📊 Tiến Độ Tổng Thể (Overall Progress)

```text
Tiến độ: [███████████████░] 62.5% (5/8 Task hoàn thành)
```

| Task | Tên Phân Hệ | Trạng Thái | Ngày Hoàn Thành | Kết Quả Unit Test |
| :---: | :--- | :---: | :--- | :--- |
| **01** | Khởi Tạo Dữ Liệu JSON & Storage Service | 🟢 **DONE** | 2026-08-22 | Pass 10/10 Test cases |
| **02** | Hệ Thống Đăng Nhập & Phân Quyền JWT (5 Roles) | 🟢 **DONE** | 2026-08-22 | Pass 14/14 Test cases |
| **03** | Giao Diện Bán Hàng, Hẹn Giờ, Thiệp & Banner | 🟢 **DONE** | 2026-08-22 | Pass 7 Python + 4 JS Tests |
| **04** | Cổng Thanh Toán VietQR & Báo Tin Zalo | 🔴 **TODO** | -- | Chưa chạy |
| **05** | Cổng Thợ Cắm Hoa, Upload Ảnh Thật & In Bill K80 | 🔴 **TODO** | -- | Chưa chạy |
| **06** | Quản Lý Tồn Kho Theo Ngày, Ma Trận & Điều Phối | 🟢 **DONE** | 2026-09-09 | Pass 5/5 Test cases (`test_inventory_service.py`) |
| **07** | Phân Tầng Giá (Price Levels), CMS Hoa & Voucher | 🟢 **DONE** | 2026-08-22 | Pass 7 Python + 3 JS Tests |
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

### [x] TASK 03: Nâng Cấp Giao Diện Bán Hàng, Hẹn Giờ, Thiệp & Banner
- [x] Thêm Modal Đặt Hàng trên `index.html` với Date Picker (30 ngày) và Time Slots.
- [x] Thêm ô Ghi chú chỉ dẫn địa chỉ người nhận (`deliveryNotes`).
- [x] Thêm ô Lời chúc viết thiệp và in Dải ruy-băng / Banner kệ hoa.
- [x] Thêm tùy chọn "Gửi hoa ẩn danh (Bí mật người gửi)".
- [x] Đồng bộ từ điển 5 ngôn ngữ trong `js/translations.js`.
- [x] Viết `src/services/order_service.py` (`POST /api/orders`, `GET /api/delivery/slots`).
- [x] Viết `js/checkout.js` và `js/unittest/test-checkout.js`.
- [x] Viết `src/unittest/test_order_service.py` và chạy test Pass 100%.

---

### [ ] TASK 04: Tích Hợp Cổng Thanh Toán VietQR Tự Động & Báo Tin Zalo
- [ ] Viết `src/services/payment_service.py` sinh mã VietQR động có số tiền & mã đơn.
- [ ] Xử lý Webhook / Polling tự động đổi trạng thái đơn sang `paid` trong 5 giây.
- [ ] Viết `src/services/notification_service.py` gửi tin nhắn Zalo/SMS theo dõi đơn.
- [ ] Viết `src/unittest/test_payment_service.py` và test thành công.

---

### [x] TASK 05: Cổng Thợ Cắm Hoa, Task API Ca Trực, Upload Ảnh Thật & In Phiếu Giao K80
- [x] Tạo giao diện Dialog độc lập `#staffPortalModal` ("Công Việc Của Tôi / Bàn Làm Việc Ca Trực") cho nhân viên ca trực (`h-[96vh] sm:h-[98vh]`).
- [x] Kiểm tra an toàn vị trí cửa hàng: Trừ Super Admin không ràng buộc vị trí, tất cả nhân viên khác bắt buộc kiểm tra `user.branchId == branch_id` (chặn truy cập chéo 403).
- [x] Tách biệt độc lập **Staff Task API**: `GET /api/flower/v1/staff/my-tasks` (tự nạp chi nhánh từ token, lọc theo Least Privilege), `POST /staff/tasks/<id>/claim` (nhận việc), `GET /staff/tasks/summary` (thống kê ca trực).
- [x] Hỗ trợ điều phối đơn hàng nhanh cho Super Admin (`POST /api/flower/v1/admin/orders/<id>/dispatch`) từ Bàn làm việc ca trực và Modal chi tiết đơn hàng.
- [x] Thêm chức năng chụp ảnh / upload ảnh hoa thật từ điện thoại (`POST /api/orders/<id>/photo`), tự động chuyển sang `photo_sent` để khách duyệt mẫu.
- [x] Phân biệt rõ nét Đơn Cắm Hoa Nghệ Thuật (`requiresArranging: true`, phụ phí +50%) vs Đơn Fast-Track (`requiresArranging: false`, stepper 4 bước).
- [x] Thêm nút in phiếu giao hàng nhiệt K80/A5 hiển thị đầy đủ địa chỉ, ghi chú cắm hoa & thiệp chúc mừng.
- [x] Viết `src/unittest/test_staff_portal_and_dispatch.py` (7 tests) và chạy test Pass 100%.

---

### [x] TASK 06: Quản Lý Tồn Kho Theo Ngày, Ma Trận Tồn Kho Chi Nhánh & Báo Hủy Hao Hụt
- [x] Xóa bỏ triệt để hardcode chi nhánh Catalogue (`#productModal`), tự động render động từ `branches.json`.
- [x] Xây dựng Tab `Kho & Hao Hụt` trong Admin Portal với Bảng Ma trận tồn kho thời gian thực (Live Matrix).
- [x] Tính toán chính xác 4 chỉ số tồn kho: $\text{Tồn khả dụng} = \text{Hàng nhập (Quota)} - \text{Đã bán (Sold)} - \text{Hao hụt (Wastage)}$.
- [x] Tính năng Cập nhật nhanh hạn mức hàng loạt (**Batch Quick Stock Update**) lưu vào `stockByBranch`.
- [x] Phân hệ Báo Hủy Hoa Hỏng cuối ca (`POST /api/flower/v1/admin/inventory/wastage`), hỗ trợ hủy thành phẩm (trừ kho) và hủy cành nguyên liệu (tính thất thoát vốn).
- [x] Phân quyền vai trò RBAC: Super Admin toàn chuỗi, Quản lý chi nhánh chỉ sửa kho chi nhánh mình (`user.branchId`), Thợ cắm hoa tạo phiếu báo hủy.
- [x] Cập nhật thẻ sản phẩm Storefront hiển thị đèn tín hiệu 🟢 Còn nhiều / 🟠 Sắp hết / 🔴 Hết hàng theo showroom khách chọn.
- [x] Thuật toán tự động điều phối đơn hàng thông minh (Smart Order Routing) sang chi nhánh gần nhất còn hàng.
- [x] Viết `src/inventory_service.py` và các RESTful endpoints trong `restful_blueprint_flower_connect.py`.
- [x] Viết `src/unittest/test_inventory_service.py` và chạy test Pass 100%.

---

### [x] TASK 07: Hàng Rào Giá An Toàn (Price Levels), CMS Mẫu Hoa, Phân Tách Nhân Sự & Khách Hàng CRM
- [x] Viết `src/services/product_service.py` (Kiểm soát giá theo 4 Level `minPrice`-`maxPrice`).
- [x] Viết `src/services/promotion_service.py` (Voucher ON/OFF Toggle).
- [x] Viết `src/services/translation_service.py` (Biên dịch động 5 ngôn ngữ VI, EN, JA, KO, ZH).
- [x] Cập nhật giao diện Admin Portal phân tách rõ ràng: **👔 Nhân Sự Nội Bộ** và **👑 Khách Hàng & CRM**.
- [x] Thêm API endpoint `GET /api/admin/customers` tra cứu điểm thưởng & hạng VIP.
- [x] Tạo giao diện `portal_admin.html` và tái cấu trúc `js/portal_admin.js` thành 10 sub-modules chuyên biệt (`js/portal_admin_state.js`, `_categories.js`, `_branches.js`, `_users.js`, `_products.js`, `_promotions.js`, `_translations.js`, `_sysconfig.js`, `_orders.js`, `_inventory.js`) + file điều phối `portal_admin.js`.
- [x] Tích hợp bộ đóng gói `scripts/build_bundle.py` sinh `js/bundle.js` hoàn chỉnh.
- [x] Đồng bộ hóa toàn bộ hàm HTML inline ra `window.*` trong `portal_admin.js` (`saveCurrentProdI18nDraft`, `syncSingleKeyInputToDictionary`...) và cấu hình chống cache trong `src/app.py` & `index.html`.
- [x] Cập nhật tài liệu kỹ thuật (`FRONTEND_LAYOUT_DESIGN.md`, `README.md`) về vòng đời các file sinh tự động (`scripts/build_bundle.py`, `js/bundle.js`, `config/index.html`).
- [x] Viết `src/unittest/test_price_governance.py` và `js/unittest/test-portal-governance.js`.
- [x] Bổ sung Unit Tests kiểm tra tính toàn vẹn Bundle & Global Event Bindings: `src/unittest/test_bundle_integrity.py` (Python) và `js/unittest/test-bundle-integrity.js` (JavaScript Node runner).

---

### [ ] TASK 08: Kiểm Thử Toàn Diện, Tối Ưu RAM < 150MB & Docker Ubuntu
- [ ] Chạy `./cli_docker.sh run_unittest` $\rightarrow$ Đạt 100% Pass bộ test Python Backend (121/121 tests).
- [ ] Chạy `./cli_docker.sh js_unittest` $\rightarrow$ Đạt 100% Pass bộ test JS Frontend.
- [ ] Chạy kiểm thử tải (Stress test) 100 requests đồng thời.
- [ ] Đo lường kiểm tra mức tiêu thụ RAM container luôn < 150MB.
- [ ] Tối ưu SEO (Meta Tags, Semantic HTML, Lighthouse > 90).
- [ ] Khởi chạy và kiểm thử thực tế 1-lệnh qua `./cli_docker.sh start` trên Ubuntu.
- [ ] Hoàn thiện tài liệu nghiệm thu toàn dự án.
