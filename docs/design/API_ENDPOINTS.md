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

### 🌸 2. Nhóm Sản Phẩm & Danh Mục (`/api/products` & `/api/categories`)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/categories` | Public | Lấy danh sách danh mục hoa đang Bật hiển thị trên Frontend (`isActive=true`) |
| `GET` | `/api/admin/categories` | Admin, Manager | Xem toàn bộ danh mục (cả đang hiện và đang ẩn) |
| `POST` | `/api/admin/categories` | Admin, Manager | Thêm mới danh mục hoa tươi |
| `PUT` | `/api/admin/categories/<id>` | Admin, Manager | Sửa tên, icon, thứ tự sắp xếp và mô tả danh mục |
| `PATCH`| `/api/admin/categories/<id>/toggle` | Admin, Manager | **Bật/Tắt hiển thị danh mục 1-chạm trên Frontend** |
| `DELETE`| `/api/admin/categories/<id>` | `super_admin` | Xóa danh mục hoa tươi |
| `GET` | `/api/products` | Public | Lấy danh sách sản phẩm (hỗ trợ lọc theo `category`, `search`, `badge`) |
| `GET` | `/api/products/<id>` | Public | Lấy chi tiết sản phẩm |
| `GET` | `/api/products/<id>/stock` | Public | Xem số lượng tồn kho của sản phẩm tại từng showroom (🟢/🟠/🔴) |
| `POST` | `/api/admin/products` | Admin, Manager | Đăng mẫu hoa mới lên website |
| `PUT` | `/api/admin/products/<id>` | Admin, Manager | Cập nhật thông tin, giá bán, hình ảnh |
| `DELETE`| `/api/admin/products/<id>` | Admin, Manager | Ẩn hoặc xóa sản phẩm |

---

### 🖼️ 3. Nhóm Phục Vụ & Quản Lý Hình Ảnh (`/api/flower/v1/images` & `/api/flower/v1/admin/upload-image`)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/flower/v1/images/<path:filename>` | Public | Phục vụ file ảnh tĩnh hoa tươi kèm HTTP Cache-Control Header `max-age=604800, immutable` (Nạp 0ms) |
| `GET` | `/api/flower/v1/images/products/<path:filename>` | Public | Alias phục vụ ảnh trong thư mục con `products/images/` |
| `POST` | `/api/flower/v1/admin/upload-image` | Staff, Manager, Admin | Upload file ảnh nhị phân (Multipart Form-Data) hoặc chuỗi Base64 -> Tự động tối ưu và lưu vào thư mục tĩnh |

---

### ⏰ 4. Nhóm Khung Giờ & Đặt Hàng (`/api/orders`, `/api/user/orders`, `/api/delivery`)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/delivery/slots` | Public | Lấy danh sách khung giờ giao hàng còn trống theo ngày đã chọn |
| `POST` | `/api/orders` | Public / Customer | Tạo đơn hàng (Bao gồm Ngày/Giờ giao, Lời chúc thiệp, In banner, Gửi ẩn danh, tự động gắn VietQR và đồng bộ vào `users/{phone}/orders.json`) |
| `GET` | `/api/orders/<id>/payment-qr` | Public / Customer | **Lấy chi tiết mã QR VietQR (chuẩn Napas EMVCo + QuickLink URL)** để thanh toán đơn hàng |
| `GET` | `/api/user/orders` | Customer | **Xem lịch sử đơn hàng cá nhân (nạp trực tiếp từ `users/{user_id}/orders.json` siêu tốc)** |
| `GET` | `/api/customers/<user_id>/orders` | Admin, Manager | **Admin/CRM tra cứu sổ đơn hàng cá nhân của 1 khách hàng cụ thể** |
| `GET` | `/api/branch/<branch_id>/orders` | Staff / Manager | Lấy danh sách đơn hàng được gán cho chi nhánh |
| `PUT` | `/api/orders/<id>/status` | Staff / Manager | Cập nhật tiến độ đơn (`pending` $\rightarrow$ `confirmed` $\rightarrow$ `arranging` $\rightarrow$ `shipping` $\rightarrow$ `delivered`; pickup: `ready_for_pickup` $\rightarrow$ `completed`) |
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
    "address": "123 Cách Mạng Tháng 8, P.5, Q.3, TP.HCM",
    "deliveryNotes": "Tòa nhà Bitexco, Tầng 12 - Công ty FPT, gọi trước khi đến 15 phút hoặc gửi lễ tân"
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
