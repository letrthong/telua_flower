# Task 08: Kiểm Thử Toàn Diện, Tối Ưu RAM < 150MB & Docker Ubuntu
## Mã Task: `TASK_08_TESTING_DOCKER_AND_DEPLOYMENT`

---

## 1. Mục Tiêu (Objective)
Tổng kết toàn bộ hệ thống, hoàn thiện bộ kiểm thử tự động (Python Unit Tests & JS Native Tests), đo lường mức tiêu thụ bộ nhớ RAM (đảm bảo luôn < 150MB RAM), tối ưu hóa bundle frontend với Vite, và xác nhận khởi chạy 1-lệnh bằng Docker trên môi trường Ubuntu Linux (`./cli_docker.sh start`).

---

## 2. Tài Liệu Tham Khảo (References)
- 🐳 [docs/DOCKER_UBUNTU_GUIDE.md](file:///d:/code/telua_flower/docs/DOCKER_UBUNTU_GUIDE.md)
- 📐 [docs/design/MEMORY_OPTIMIZATION_DESIGN.md](file:///d:/code/telua_flower/docs/design/MEMORY_OPTIMIZATION_DESIGN.md)

---

## 3. Danh Sách File Cần Hoàn Thiện / Kiểm Tra

### Kiểm thử tự động (Test Suites):
1. `src/unittest/`:
   - `test_file_structure.py`
   - `test_data_service.py`
   - `test_auth_service.py`
   - `test_payment_service.py`
   - `test_inventory_service.py`
   - `test_price_governance.py`
2. `js/unittest/`:
   - `test-products.js`
   - `test-translations.js`
   - `test-checkout.js`

### Cấu hình Docker & Build:
1. `Dockerfile`: Đảm bảo cài đặt Python 3.11, Node.js 20, build Vite frontend và chạy Flask backend.
2. `docker-compose.yml`: Cấu hình container `telua_python_flower`, port `5000:5000`.
3. `cli_docker.sh`: Cung cấp đầy đủ các lệnh `start`, `start --no-cache`, `stop`, `run_unittest`, `js_unittest`, `access`.

---

## 4. Tiêu Chuẩn Nghiệm Thu (Acceptance Criteria)
- [ ] Chạy `./cli_docker.sh run_unittest` trên Ubuntu $\rightarrow$ Toàn bộ bài test Python Backend đạt 100% Pass.
- [ ] Chạy `./cli_docker.sh js_unittest` trên Ubuntu $\rightarrow$ Toàn bộ bài test JS Frontend đạt 100% Pass.
- [ ] Mức tiêu thụ bộ nhớ RAM của container dưới 150 MB.
- [ ] Truy cập `http://<SERVER_IP>:5000` duyệt web nhanh, mượt mà và không có lỗi Console.
