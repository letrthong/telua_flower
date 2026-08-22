# Task 07: Hàng Rào Giá An Toàn (Price Levels), CMS Sửa Hoa & Voucher
## Mã Task: `TASK_07_PRODUCT_CMS_AND_PRICE_GOVERNANCE`

---

## 1. Mục Tiêu (Objective)
Xây dựng phân hệ Quản Lý Sản Phẩm (Product CMS), áp dụng 4 tầng mức giá chuẩn (Price Levels) kèm hàng rào kiểm soát giá sàn/giá trần (Price Guardrails) để ngăn nhân viên phá giá hoặc gõ nhầm số 0, và phân hệ Quản Lý Khuyến Mãi (Voucher, Top Bar, Hero Banner) với cơ chế Bật/Tắt 1-chạm (ON/OFF Toggle).

---

## 2. Tài Liệu Tham Khảo (References)
- 📐 [docs/design/PRICE_LEVEL_GOVERNANCE_DESIGN.md](file:///d:/code/telua_flower/docs/design/PRICE_LEVEL_GOVERNANCE_DESIGN.md)
- 📐 [docs/design/PRODUCT_CONTENT_MANAGEMENT_DESIGN.md](file:///d:/code/telua_flower/docs/design/PRODUCT_CONTENT_MANAGEMENT_DESIGN.md)
- 📐 [docs/design/PROMOTION_CAMPAIGN_DESIGN.md](file:///d:/code/telua_flower/docs/design/PROMOTION_CAMPAIGN_DESIGN.md)

---

## 3. Danh Sách File Cần Tạo / Sửa

### Frontend Giao Diện:
1. `src/templates/portal_products.html`: Quản lý danh sách hoa, sửa nhanh giá bán, modal tải ảnh, sửa thành phần hoa và mẹo chăm sóc.
2. `src/templates/portal_promotions.html`: Quản lý danh sách Voucher, công tắc Bật/Tắt (ON/OFF), và cấu hình banner ngày lễ.
3. `js/portal_products.js` & `js/portal_promotions.js`: Xử lý tương tác giao diện và kiểm tra ràng buộc giá.

### Backend Python Flask:
1. `src/services/product_service.py`: CRUD sản phẩm, kiểm tra `minPrice` - `maxPrice` theo phân tầng Level, upload ảnh nén WebP.
2. `src/services/promotion_service.py`: Kiểm tra tính hợp lệ của mã Voucher, tính toán số tiền giảm giá, bật/tắt chiến dịch.
3. `src/app.py`: Đăng ký endpoint `/api/admin/products`, `/api/price-levels`, `/api/promotions`.

### Unit Test:
- `src/unittest/test_price_governance.py`: Kiểm thử chặn thành công khi nhân viên nhập giá ngoài khoảng `[minPrice, maxPrice]`.
- `src/unittest/test_promotions.py`: Kiểm thử tính đúng % giảm giá và hết hạn voucher.

---

## 4. Tiêu Chuẩn Nghiệm Thu (Acceptance Criteria)
- [ ] Nhân viên sửa giá trong khoảng Level $\rightarrow$ Lưu thành công.
- [ ] Nhân viên nhập giá ngoài khoảng Level (quá cao hoặc quá thấp) $\rightarrow$ Bị chặn lại và báo lỗi đỏ.
- [ ] Admin/Quản lý gạt nút ON/OFF Khuyến mãi $\rightarrow$ Banner và Voucher lập tức kích hoạt/tắt trên website.
