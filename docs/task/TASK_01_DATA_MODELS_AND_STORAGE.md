# Task 01: Khởi Tạo Cấu Trúc Dữ Liệu JSON & Storage Service
## Mã Task: `TASK_01_DATA_MODELS_AND_STORAGE`

---

## 1. Mục Tiêu (Objective)
Khởi tạo toàn bộ các tệp JSON mẫu trong thư mục `config/` theo đúng thiết kế tại [JSON_DATA_SCHEMAS.md](file:///d:/code/telua_flower/docs/design/JSON_DATA_SCHEMAS.md) và xây dựng module truy xuất dữ liệu an toàn `src/services/data_service.py` hỗ trợ khóa ghi, phân trang và phân mảnh theo tháng (chống tràn RAM).

---

## 2. Tài Liệu Tham Khảo (References)
- 📐 [docs/design/JSON_DATA_SCHEMAS.md](file:///d:/code/telua_flower/docs/design/JSON_DATA_SCHEMAS.md)
- 📐 [docs/design/MEMORY_OPTIMIZATION_DESIGN.md](file:///d:/code/telua_flower/docs/design/MEMORY_OPTIMIZATION_DESIGN.md)

---

## 3. Danh Sách File Cần Tạo / Sửa

### Tạo mới các file JSON cấu hình:
1. `config/branches.json`: Dữ liệu Showroom Q.10, Q.1, Thảo Điền (kèm GPS, Hotline, Giờ mở cửa).
2. `config/users.json`: Tài khoản mẫu cho 5 Roles (Admin, Quản lý, Florist, Sales, Khách hàng).
3. `config/price_levels.json`: 4 Tầng mức giá chuẩn (`LV_01` đến `LV_04`).
4. `config/products.json`: Danh mục hoa tươi & bình cắm hoa nghệ thuật.
5. `config/promotions.json`: Danh sách mã giảm giá và banner sự kiện mẫu.
6. `config/orders/orders_2026_08.json`: File lưu đơn hàng tháng hiện tại.

### Tạo mới tầng Service Backend:
- `src/services/data_service.py`: Các hàm tiện ích đọc/ghi JSON, phân trang (`page`, `limit`), phân mảnh theo tháng, kiểm tra khóa file.

### Tạo file Unit Test:
- `src/unittest/test_data_service.py`: Kiểm thử tự động tính toàn vẹn của JSON và hàm `data_service.py`.

---

## 4. Tiêu Chuẩn Nghiệm Thu (Acceptance Criteria)
- [ ] Tất cả 8 file JSON mẫu được tạo với cú pháp JSON hợp lệ 100%.
- [ ] Hàm `read_json()` và `write_json()` hoạt động an toàn, không làm hỏng dữ liệu khi có nhiều request đồng thời.
- [ ] Phân trang hoạt động chính xác với tham số `page` và `limit`.
- [ ] Chạy lệnh `./cli_docker.sh run_unittest` kiểm thử `test_data_service.py` đạt 100% Pass.
