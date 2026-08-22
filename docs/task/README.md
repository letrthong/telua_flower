# Kế Hoạch & Lộ Trình Phát Triển 8 Task (Implementation Roadmap)
## Dự Án: Nở Hoa Thả Bình (`telua_flower`)

---

## 📌 Bảng Master Roadmap & Checklist Tiến Độ

> [!TIP]
> Bạn có thể xem và đánh dấu hoàn thành chi tiết từng bước tại **[CHECKLIST.md](file:///d:/code/telua_flower/docs/task/CHECKLIST.md)**.

```text
Tiến độ tổng thể: [██████░░░░░░░░░░░░░░] 25.0% (2/8 Task hoàn thành)
```

| STT | Mã Task | Tên Phân Hệ & Mục Tiêu | Trạng Thái | File Đặc Tả Chi Tiết |
| :---: | :--- | :--- | :---: | :--- |
| **01** | `TASK_01` | **Khởi Tạo Cấu Trúc Dữ Liệu JSON & Storage Service** | 🟢 **DONE** | [TASK_01](file:///d:/code/telua_flower/docs/task/TASK_01_DATA_MODELS_AND_STORAGE.md) |
| **02** | `TASK_02` | **Hệ Thống Đăng Nhập Đơn Nhất & Phân Quyền JWT (5 Roles)** | 🟢 **DONE** | [TASK_02](file:///d:/code/telua_flower/docs/task/TASK_02_AUTH_AND_RBAC_SYSTEM.md) |
| **03** | `TASK_03` | **Nâng Cấp Giao Diện Bán Hàng, Hẹn Giờ, Thiệp & Banner** | 🔴 **TODO** | [TASK_03](file:///d:/code/telua_flower/docs/task/TASK_03_STOREFRONT_AND_ORDERING_EXPERIENCE.md) |
| **04** | `TASK_04` | **Tích Hợp Cổng Thanh Toán VietQR Tự Động & Báo Tin Zalo** | 🔴 **TODO** | [TASK_04](file:///d:/code/telua_flower/docs/task/TASK_04_PAYMENT_GATEWAY_INTEGRATION.md) |
| **05** | `TASK_05` | **Cổng Thợ Cắm Hoa, Upload Ảnh Thật & In Phiếu Giao K80** | 🔴 **TODO** | [TASK_05](file:///d:/code/telua_flower/docs/task/TASK_05_FLORIST_AND_BRANCH_OPERATIONS.md) |
| **06** | `TASK_06` | **Quản Lý Tồn Kho Theo Ngày, Ma Trận 🟢/🟠/🔴 & Điều Phối** | 🔴 **TODO** | [TASK_06](file:///d:/code/telua_flower/docs/task/TASK_06_INVENTORY_AND_MULTI_BRANCH_ROUTING.md) |
| **07** | `TASK_07` | **Hàng Rào Giá An Toàn (Price Levels), CMS Sửa Hoa & Voucher**| 🔴 **TODO** | [TASK_07](file:///d:/code/telua_flower/docs/task/TASK_07_PRODUCT_CMS_AND_PRICE_GOVERNANCE.md) |
| **08** | `TASK_08` | **Kiểm Thử Toàn Diện, Tối Ưu RAM < 150MB & Docker Ubuntu** | 🔴 **TODO** | [TASK_08](file:///d:/code/telua_flower/docs/task/TASK_08_TESTING_DOCKER_AND_DEPLOYMENT.md) |

---

## 🧭 Quy Trình Nghiệm Thu Mỗi Task:
1. Đọc kỹ file đặc tả task (mục tiêu, thiết kế tham chiếu, danh sách file).
2. Viết code Backend / Frontend tương ứng.
3. Chạy bài **Unit Test** của task đó.
4. Khi test Pass 100% $\rightarrow$ Chuyển trạng thái task sang **🟢 DONE** trong [CHECKLIST.md](file:///d:/code/telua_flower/docs/task/CHECKLIST.md) và cập nhật thanh tiến độ.
