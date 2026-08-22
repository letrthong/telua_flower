# Task 07: Hàng Rào Giá An Toàn (Price Levels), CMS Sửa Hoa, Khuyến Mãi & Biên Dịch Đa Ngôn Ngữ Động
## Mã Task: `TASK_07_PRODUCT_CMS_AND_PRICE_GOVERNANCE`

---

## 1. Mục Tiêu (Objective)
1. Xây dựng phân hệ **Quản Lý Sản Phẩm (Product CMS)**: Áp dụng 4 tầng mức giá chuẩn (Price Levels) kèm hàng rào kiểm soát giá sàn/giá trần (Price Guardrails) để ngăn nhân viên phá giá hoặc gõ nhầm số 0.
2. Xây dựng phân hệ **Quản Lý Khuyến Mãi (Promotions)**: Quản lý Voucher, Top Bar, Hero Banner với cơ chế Bật/Tắt 1-chạm (ON/OFF Toggle).
3. Xây dựng phân hệ **Biên Dịch Đa Ngôn Ngữ & Quản Trị Nội Dung Động (Dynamic i18n & Content CMS)**: Cho phép Admin/Quản lý trực tiếp chỉnh sửa câu chữ của 5 ngôn ngữ (Việt, Anh, Nhật, Hàn, Trung) và lưu xuống `config/translations.json` thay vì code cố định.

---

## 2. Tài Liệu Tham Khảo (References)
- 📐 [docs/design/DYNAMIC_I18N_CONTENT_CMS_DESIGN.md](file:///d:/code/telua_flower/docs/design/DYNAMIC_I18N_CONTENT_CMS_DESIGN.md)
- 📐 [docs/design/PRICE_LEVEL_GOVERNANCE_DESIGN.md](file:///d:/code/telua_flower/docs/design/PRICE_LEVEL_GOVERNANCE_DESIGN.md)
- 📐 [docs/design/PRODUCT_CONTENT_MANAGEMENT_DESIGN.md](file:///d:/code/telua_flower/docs/design/PRODUCT_CONTENT_MANAGEMENT_DESIGN.md)
- 📐 [docs/design/PROMOTION_CAMPAIGN_DESIGN.md](file:///d:/code/telua_flower/docs/design/PROMOTION_CAMPAIGN_DESIGN.md)

---

## 3. Danh Sách File Cần Tạo / Sửa

### Frontend Giao Diện:
1. `src/templates/portal_products.html`: Quản lý danh sách hoa, sửa nhanh giá bán, modal tải ảnh, sửa thành phần hoa và mẹo chăm sóc.
2. `src/templates/portal_promotions.html`: Quản lý danh sách Voucher, công tắc Bật/Tắt (ON/OFF), và cấu hình banner ngày lễ.
3. `src/templates/portal_translations.html`: **Bảng ma trận chỉnh sửa bản dịch 5 ngôn ngữ (Việt, Anh, Nhật, Hàn, Trung)** và sửa nội dung các khối trang (Slogan, Hotline, Showroom, Giờ mở cửa, Chính sách).
4. `js/portal_products.js`, `js/portal_promotions.js`, `js/portal_translations.js`: Xử lý tương tác giao diện CMS.
5. `js/i18n.js`: Nâng cấp hàm nạp từ điển động qua API `/api/translations` và lưu cache `localStorage`.

### Backend Python Flask:
1. `src/services/product_service.py`: CRUD sản phẩm, kiểm tra `minPrice` - `maxPrice` theo phân tầng Level, upload ảnh nén WebP.
2. `src/services/promotion_service.py`: Kiểm tra tính hợp lệ của mã Voucher, tính toán số tiền giảm giá, bật/tắt chiến dịch.
3. `src/services/translation_service.py`: Đọc/Ghi từ điển `config/translations.json`, kiểm tra tính toàn vẹn 5 ngôn ngữ.
4. `src/app.py`: Đăng ký endpoint `/api/admin/products`, `/api/price-levels`, `/api/promotions`, `/api/translations`, `PUT /api/admin/translations`.

### Unit Test:
- `src/unittest/test_price_governance.py`: Kiểm thử chặn thành công khi nhân viên nhập giá ngoài khoảng `[minPrice, maxPrice]`.
- `src/unittest/test_promotions.py`: Kiểm thử tính đúng % giảm giá và hết hạn voucher.
- `src/unittest/test_translation_service.py`: Kiểm thử API đọc và cập nhật bản dịch động lưu vào file JSON.

---

## 4. Tiêu Chuẩn Nghiệm Thu (Acceptance Criteria)
- [ ] Nhân viên sửa giá trong khoảng Level $\rightarrow$ Lưu thành công.
- [ ] Nhân viên nhập giá ngoài khoảng Level (quá cao hoặc quá thấp) $\rightarrow$ Bị chặn lại và báo lỗi đỏ.
- [ ] Admin/Quản lý gạt nút ON/OFF Khuyến mãi $\rightarrow$ Banner và Voucher lập tức kích hoạt/tắt trên website.
- [ ] **Admin/Quản lý chỉnh sửa câu chữ bản dịch trên giao diện $\rightarrow$ Website lập tức hiển thị nội dung mới cho cả 5 ngôn ngữ (không cần sửa code JS hay reload server)**.
