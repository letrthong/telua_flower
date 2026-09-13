# BÁO CÁO ĐO LƯỜNG ĐỘ TRỄ & HIỆU NĂNG RESTFUL API
> **MÃ TÀI LIỆU:** DOC-PERF-01  
> **NGÀY KIỂM THỬ:** 2026-09-13 14:01:51  
> **MÔI TRƯỜNG:** Live TCP Socket Test Server (Python Flask 3.13.3)  
> **PHƯƠNG THỨC ĐO:** HTTP Real Socket Client, 10 iterations/endpoint, High-precision `time.perf_counter()`  
> **KẾT QUẢ TỔNG QUAN:** 🟢 **100% PASS SLA** (Độ trễ trung bình toàn hệ thống: **57.39 ms**)

---

## 1. TỔNG HỢP KẾT QUẢ ĐỘ TRỄ CHI TIẾT THEO ENDPOINT

| Nhóm Nghiệp Vụ | Tên Endpoint | Method | Path | SLA (ms) | Min (ms) | **Avg (ms)** | Median (ms) | **P95 (ms)** | Max (ms) | Size (KB) | Đánh Giá |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Static & SPA | SPA Frontend Entrypoint | `GET` | `/` | 250 | 12.35 | **16.02** | 15.90 | **25.40** | 25.40 | 339.36 | ✅ PASS |
| Catalog & Products | Public Products Catalog | `GET` | `/api/flower/v1/products` | 250 | 14.66 | **37.86** | 44.52 | **67.64** | 67.64 | 13.88 | ✅ PASS |
| Catalog & Products | Single Product Details | `GET` | `/api/flower/v1/products/test_b64_1788062614` | 200 | 7.89 | **12.58** | 9.62 | **22.46** | 22.46 | 0.81 | ✅ PASS |
| Catalog & Products | Product Categories | `GET` | `/api/flower/v1/categories` | 200 | 8.82 | **9.64** | 9.67 | **10.38** | 10.38 | 6.35 | ✅ PASS |
| Delivery & Logistics | Delivery Time Slots | `GET` | `/api/flower/v1/delivery/slots?date=2026-09-15` | 200 | 7.65 | **11.22** | 9.25 | **29.45** | 29.45 | 0.78 | ✅ PASS |
| Authentication & RBAC | Staff Login & JWT Token | `POST` | `/api/flower/v1/auth/login` | 2500 | 340.76 | **366.15** | 377.23 | **391.74** | 391.74 | 0.90 | ✅ PASS |
| Inventory & Materials | Raw Materials Stock | `GET` | `/api/flower/v1/admin/inventory/materials` | 200 | 6.85 | **8.09** | 8.44 | **9.63** | 9.63 | 2.75 | ✅ PASS |
| Inventory & Materials | Monthly Inbound Receipts | `GET` | `/api/flower/v1/admin/inventory/inbounds?month=2026-09&branchId=branch_q10` | 200 | 8.75 | **11.04** | 11.07 | **16.92** | 16.92 | 1.52 | ✅ PASS |
| Inventory & Analytics | Monthly Financial PnL Analytics | `GET` | `/api/flower/v1/admin/inventory/monthly-report?month=2026-09&branchId=branch_q10` | 350 | 14.86 | **18.43** | 18.13 | **25.30** | 25.30 | 3.65 | ✅ PASS |
| Orders & Checkout | Create Direct Order | `POST` | `/api/flower/v1/orders` | 350 | 79.55 | **95.50** | 97.99 | **135.68** | 135.68 | 1.85 | ✅ PASS |
| Orders & Checkout | Query Order Status | `GET` | `/api/flower/v1/orders/ord_1789282903_024ef9` | 200 | 10.36 | **13.45** | 13.78 | **17.87** | 17.87 | 1.75 | ✅ PASS |
| Payment & Gateway | VietQR Payment QR Code | `GET` | `/api/flower/v1/orders/ord_1789282903_024ef9/payment-qr` | 400 | 73.94 | **88.67** | 90.12 | **105.83** | 105.83 | 1.64 | ✅ PASS |

---

## 2. PHÂN TÍCH HIỆU NĂNG THEO TẦNG KIẾN TRÚC

### 2.1 Tầng Đọc Dữ Liệu Tĩnh & SPA (Static & SPA)
- Trang chủ `/` phản hồi trung bình **~16.02 ms**, kích thước payload ~339.4 KB.
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
2. **Khả năng mở rộng**: Với độ trễ trung bình **57.39 ms/request**, máy chủ đơn lẻ có thể phục vụ hàng chục requests/giây trên môi trường VPS tiêu chuẩn.
