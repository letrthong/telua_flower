# Đặc Tả Giao Diện API Endpoints (API Specification & Interface Design)
## Dự Án: Nở Hoa Thả Bình (`telua_flower`)

---

## 1. Tổng Quan Kiến Trúc API (API Architecture Overview)

- **Base URL:** `/api` (Ví dụ: `http://localhost:5000/api`)
- **Định dạng dữ liệu:** `application/json; charset=utf-8`
- **Cơ chế xác thực (Authentication):** JSON Web Token (JWT) gửi qua HTTP Header:
  ```http
  Authorization: Bearer <JWT_TOKEN>
  ```

### Cấu trúc phản hồi chuẩn (Standard JSON Response):
```json
{
  "success": true,
  "message": "Thao tác thành công",
  "data": {},
  "error": null
}
```

---

## 2. Danh Sách Các Nhóm API Chi Tiết

### 🔐 1. Nhóm Xác Thực & Đăng Nhập (`/api/auth`)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/login` | Public | Đăng nhập đơn nhất (Tự động nhận diện Role & Redirect URL) |
| `POST` | `/api/auth/register` | Public | Đăng ký tài khoản khách hàng mới |
| `GET` | `/api/auth/me` | Logged In | Lấy thông tin tài khoản hiện tại từ JWT Token |
| `POST` | `/api/auth/logout` | Logged In | Đăng xuất và hủy phiên làm việc |

---

### 🌸 2. Nhóm Sản Phẩm & Danh Mục (`/api/products`)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/products` | Public | Lấy danh sách sản phẩm (hỗ trợ lọc theo `category`, `search`, `badge`) |
| `GET` | `/api/products/<id>` | Public | Lấy chi tiết sản phẩm |
| `GET` | `/api/products/<id>/stock` | Public | Xem số lượng tồn kho của sản phẩm tại từng showroom (🟢/🟠/🔴) |
| `POST` | `/api/admin/products` | Admin, Manager | Đăng mẫu hoa mới lên website |
| `PUT` | `/api/admin/products/<id>` | Admin, Manager | Cập nhật thông tin, giá bán, hình ảnh |
| `DELETE`| `/api/admin/products/<id>` | Admin, Manager | Ẩn hoặc xóa sản phẩm |

---

### ⏰ 3. Nhóm Khung Giờ & Đặt Hàng (`/api/orders` & `/api/delivery`)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/delivery/slots` | Public | Lấy danh sách khung giờ giao hàng còn trống theo ngày đã chọn |
| `POST` | `/api/orders` | Public / Customer | Tạo đơn hàng (Bao gồm Ngày/Giờ giao, Lời chúc thiệp, In banner, Gửi ẩn danh) |
| `GET` | `/api/orders/my-orders` | Customer | Xem lịch sử đơn hàng của chính mình |
| `GET` | `/api/branch/<branch_id>/orders` | Staff / Manager | Lấy danh sách đơn hàng được gán cho chi nhánh |
| `PUT` | `/api/orders/<id>/status` | Staff / Manager | Cập nhật tiến độ đơn (`pending` $\rightarrow$ `arranging` $\rightarrow$ `shipping` $\rightarrow$ `completed`) |
| `POST` | `/api/orders/<id>/photo` | `florist` / Manager | **Thợ cắm hoa upload ảnh hoa thực tế** để gửi khách duyệt |

#### Request mẫu `POST /api/orders` đầy đủ tính năng:
```json
{
  "sender": {
    "name": "Nguyễn Văn A",
    "phone": "0987654321",
    "email": "nva@gmail.com",
    "isAnonymous": false
  },
  "recipient": {
    "name": "Trần Thị B",
    "phone": "0911223344",
    "address": "123 Cách Mạng Tháng 8, P.5, Q.3, TP.HCM"
  },
  "delivery": {
    "deliveryDate": "2026-08-25",
    "timeSlot": "09:00 - 11:00",
    "isExpress2H": false
  },
  "customization": {
    "cardMessage": "Chúc em sinh nhật vui vẻ và luôn rạng ngời như những đóa hoa này!",
    "ribbonBanner": "Công ty ABC Kính Chúc"
  },
  "items": [
    { "productId": "bo_hoa_01", "quantity": 1, "price": 420000 }
  ],
  "paymentMethod": "vietqr"
}
```

---

### 💳 4. Nhóm Cổng Thanh Toán Trực Tuyến (`/api/payments`)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/payments/create-qr` | Public | Tạo mã thanh toán VietQR động có sẵn số tiền & mã đơn |
| `GET` | `/api/payments/check-status/<order_id>` | Public | Kiểm tra trạng thái thanh toán đơn hàng (polling) |
| `POST` | `/api/payments/webhook` | System | Webhook nhận thông báo thanh toán tự động từ ngân hàng / MoMo / VNPay |

---

### 🏬 5. Nhóm Quản Lý Chi Nhánh & Tồn Kho (`/api/branches` & `/api/inventory`)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/branches` | Public | Lấy danh sách showroom kèm tọa độ GPS và Hotline |
| `GET` | `/api/branches/nearest` | Public | Tìm chi nhánh gần nhất theo tọa độ người nhận |
| `POST` | `/api/admin/branches` | `super_admin` | Tạo chi nhánh mới |
| `PUT` | `/api/admin/branches/<id>` | `super_admin` | Cập nhật thông tin chi nhánh, bán kính giao 2H |
| `GET` | `/api/admin/inventory/matrix` | Manager / Admin | Xem ma trận tồn kho toàn chuỗi theo thời gian thực |
| `PUT` | `/api/branch/<branch_id>/inventory` | Staff / Manager | Cập nhật số lượng hoa bán trong ngày (Daily Quota) |
| `POST` | `/api/branch/<branch_id>/wastage` | Manager / Admin | **Nhập phiếu báo hủy/hao hụt hoa tươi cuối ngày** |

---

### 👥 6. Nhóm Quản Lý Nhân Sự & CRM Khách Hàng (`/api/staff` & `/api/customers`)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/branch/<branch_id>/staff` | Manager / Admin | Danh sách nhân viên chi nhánh |
| `POST` | `/api/branch/<branch_id>/staff` | Manager / Admin | Thêm nhân viên mới vào chi nhánh |
| `PUT` | `/api/staff/<id>/role` | Manager / Admin | Phân vai trò (`florist`, `sales_consultant`, `shipper`, `branch_manager`) |
| `GET` | `/api/admin/customers` | `super_admin` | Danh sách CRM khách hàng toàn chuỗi kèm bộ lọc LTV |
| `GET` | `/api/customers/<id>` | Manager / Admin | Xem chi tiết khách, ngày sinh nhật, sở thích hoa |
| `PUT` | `/api/customers/<id>/tier` | `super_admin` | Cập nhật hạng thành viên (Bạc, Vàng, Kim Cương) |

---

## 3. Bảng Mã Lỗi Chuẩn HTTP

| Mã lỗi | Trạng thái | Ý nghĩa |
| :--- | :--- | :--- |
| `200` | `OK` | Thành công |
| `201` | `Created` | Tạo mới thành công |
| `400` | `Bad Request` | Dữ liệu không hợp lệ |
| `401` | `Unauthorized` | Chưa đăng nhập hoặc Token hết hạn |
| `403` | `Forbidden` | Không có quyền truy cập |
| `404` | `Not Found` | Không tìm thấy tài nguyên |
| `500` | `Internal Server Error` | Lỗi máy chủ nội bộ |
