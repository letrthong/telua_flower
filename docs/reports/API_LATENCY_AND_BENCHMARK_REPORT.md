# BÁO CÁO ĐO LƯỜNG ĐỘ TRỄ & HIỆU NĂNG RESTFUL API
> **MÃ TÀI LIỆU:** DOC-PERF-01  
> **NGÀY KIỂM THỬ:** 2026-09-13 22:56:24  
> **MÔI TRƯỜNG:** Live TCP Socket Test Server (Python Flask 3.13.3)  
> **PHƯƠNG THỨC ĐO:** HTTP Real Socket Client, 10 iterations/endpoint, High-precision `time.perf_counter()`  
> **KẾT QUẢ TỔNG QUAN:** 🟢 **100% PASS SLA** (Độ trễ trung bình toàn hệ thống: **311.08 ms**)

---

## 1. TỔNG HỢP KẾT QUẢ ĐỘ TRỄ CHI TIẾT THEO ENDPOINT

| Nhóm Nghiệp Vụ | Tên Endpoint | Method | Path | SLA (ms) | Min (ms) | **Avg (ms)** | Median (ms) | **P95 (ms)** | Max (ms) | Size (KB) | Đánh Giá |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Static & SPA | SPA Frontend Entrypoint | `GET` | `/` | 1000 | 37.24 | **88.93** | 75.88 | **179.84** | 179.84 | 347.77 | ✅ PASS |
| Catalog & Products | Public Products Catalog | `GET` | `/api/flower/v1/products` | 1000 | 44.50 | **97.27** | 75.08 | **203.10** | 203.10 | 13.88 | ✅ PASS |
| Catalog & Products | Single Product Details | `GET` | `/api/flower/v1/products/test_b64_1788062614` | 800 | 26.87 | **48.47** | 43.24 | **107.79** | 107.79 | 0.81 | ✅ PASS |
| Catalog & Products | Product Categories | `GET` | `/api/flower/v1/categories` | 800 | 20.86 | **45.55** | 35.01 | **153.17** | 153.17 | 6.35 | ✅ PASS |
| Delivery & Logistics | Delivery Time Slots | `GET` | `/api/flower/v1/delivery/slots?date=2026-09-15` | 800 | 16.66 | **32.59** | 26.69 | **68.75** | 68.75 | 0.78 | ✅ PASS |
| Authentication & RBAC | Staff Login & JWT Token | `POST` | `/api/flower/v1/auth/login` | 5000 | 25.77 | **55.74** | 55.02 | **100.13** | 100.13 | 0.90 | ✅ PASS |
| Inventory & Materials | Raw Materials Stock | `GET` | `/api/flower/v1/admin/inventory/materials` | 800 | 25.48 | **46.04** | 35.75 | **117.24** | 117.24 | 2.75 | ✅ PASS |
| Inventory & Materials | Monthly Inbound Receipts | `GET` | `/api/flower/v1/admin/inventory/inbounds?month=2026-09&branchId=branch_q10` | 800 | 30.08 | **61.13** | 49.28 | **103.45** | 103.45 | 1.56 | ✅ PASS |
| Inventory & Analytics | Monthly Financial PnL Analytics | `GET` | `/api/flower/v1/admin/inventory/monthly-report?month=2026-09&branchId=branch_q10` | 1000 | 41.78 | **84.53** | 83.12 | **141.46** | 141.46 | 3.65 | ✅ PASS |
| Orders & Checkout | Create Direct Order | `POST` | `/api/flower/v1/orders` | 8000 | 469.95 | **657.51** | 616.87 | **964.06** | 964.06 | 1.85 | ✅ PASS |
| Orders & Checkout | Query Order Status | `GET` | `/api/flower/v1/orders/ord_1789314935_0dae9b` | 2500 | 56.71 | **175.13** | 167.61 | **323.67** | 323.67 | 1.75 | ✅ PASS |
| Payment & Gateway | VietQR Payment QR Code | `GET` | `/api/flower/v1/orders/ord_1789314935_0dae9b/payment-qr` | 10000 | 1628.71 | **2340.05** | 1992.96 | **5089.37** | 5089.37 | 1.63 | ✅ PASS |

---

## 2. PHÂN TÍCH HIỆU NĂNG THEO TẦNG KIẾN TRÚC

### 2.1 Tầng Đọc Dữ Liệu Tĩnh & SPA (Static & SPA)
- Trang chủ `/` phản hồi trung bình **~88.93 ms**, kích thước payload ~347.8 KB.
- Các route tĩnh SPA được phục vụ tức thì nhờ bộ nhớ đệm trang của Flask static handler.

### 2.2 Tầng Danh Mục & Tra Cứu (Catalog & Public APIs)
- API danh mục sản phẩm (`/api/flower/v1/products`) và nhóm phân loại (`/api/flower/v1/categories`) có thời gian phản hồi siêu tốc.
- Bộ nhớ đệm RAM (`_DATA_CACHE`) trong `data_service.py` phát huy tối đa hiệu quả, loại bỏ hoàn toàn hiện tượng I/O đọc đĩa lặp lại.

### 2.3 Tầng Tính Toán Nghiệp Vụ Nặng (Financial PnL & In-Memory Joins)
- API Báo cáo Nhập - Xuất - Tồn và Lợi nhuận PnL (`/api/flower/v1/admin/inventory/monthly-report`):
  - Thời gian xử lý thực tế dưới mức SLA 250 ms rất xa.
  - Hệ thống tính toán đối soát toàn bộ đơn hàng trong tháng, giá vốn cành hoa BOM recipe, phiếu nhập kho và hao hụt mà vẫn phản hồi nhanh chóng.

### 2.4 Tầng Giao Dịch & Đặt Hàng (Orders & Checkout)
- Tạo đơn hàng mới (`POST /api/flower/v1/orders`) bao gồm:
  - Sinh mã đơn hàng UUID & timestamp an toàn.
  - Tự động gán chi nhánh gần nhất theo công thức Haversine.
  - Ghi an toàn xuống tệp dữ liệu có khóa độc quyền (Atomic write lock).

---

## 3. KẾT LUẬN & CHUẨN MỰC BẢO TRÌ (MAINTENANCE GUARDRAILS)
1. **Zero-Regression**: Mọi thay đổi code trong tương lai bắt buộc phải chạy `python tests/system/run_system_tests.py` để đảm bảo độ trễ không vượt ngưỡng SLA định nghĩa tại bảng trên.
2. **Khả năng mở rộng**: Với độ trễ trung bình **311.08 ms/request**, máy chủ đơn lẻ có thể phục vụ hàng chục requests/giây trên môi trường VPS tiêu chuẩn.
