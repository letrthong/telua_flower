# Đặc Tả Giao Diện API Endpoints (API Specification & Interface Design)
## Dự Án: Nở Hoa Thả Bình (`telua_flower`)

---

## 1. Tổng Quan Kiến Trúc API (API Architecture Overview)

- **Base URL:** `/api` (Ví dụ: `http://localhost:5000/api`)
- **Định dạng dữ liệu:** `application/json; charset=utf-8`
- **Cơ chế xác thực (Authentication):**
  - Sử dụng JSON Web Token (JWT) gửi qua HTTP Header:
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

## 2. Danh Sách Nhóm API Chi Tiết (Endpoint Groups)

### 🔐 1. Nhóm Xác Thực & Đăng Nhập (`/api/auth`)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/login` | Public | Đăng nhập (Khách hàng, Nhân viên, Quản lý chi nhánh, Super Admin) |
| `POST` | `/api/auth/register` | Public | Đăng ký tài khoản khách hàng mới |
| `GET` | `/api/auth/me` | Logged In | Lấy thông tin tài khoản hiện tại từ Token |
| `POST` | `/api/auth/logout` | Logged In | Đăng xuất và hủy phiên làm việc |

#### Request mẫu `POST /api/auth/login`:
```json
{
  "username": "0909123456",
  "password": "Password@123"
}
```

#### Response mẫu thành công:
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "staff_001",
      "fullName": "Trần Thị Mai",
      "role": "branch_manager",
      "branchId": "branch_q10"
    }
  }
}
```

---

### 🌸 2. Nhóm Sản Phẩm & Danh Mục (`/api/products`)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/products` | Public | Lấy danh sách sản phẩm (hỗ trợ lọc theo `category`, `search`, `badge`) |
| `GET` | `/api/products/<id>` | Public | Lấy chi tiết một sản phẩm |
| `POST` | `/api/admin/products` | `super_admin` | Thêm mẫu hoa / bình hoa mới |
| `PUT` | `/api/admin/products/<id>` | `super_admin` | Cập nhật thông tin, giá bán, hình ảnh |
| `DELETE`| `/api/admin/products/<id>` | `super_admin` | Ẩn hoặc xóa sản phẩm |

---

### 🛒 3. Nhóm Đặt Hàng & Xử Lý Đơn Hàng (`/api/orders`)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/orders` | Public / Customer | Tạo đơn đặt hoa mới (Tự động tính GPS và gán chi nhánh gần nhất) |
| `GET` | `/api/orders/my-orders` | Customer | Xem lịch sử đơn hàng của chính mình |
| `GET` | `/api/branch/<branch_id>/orders` | Staff / Manager | Lấy danh sách đơn hàng được gán cho chi nhánh |
| `PUT` | `/api/orders/<id>/status` | Staff / Manager | Cập nhật tiến độ đơn (`pending` $\rightarrow$ `arranging` $\rightarrow$ `shipping` $\rightarrow$ `completed`) |
| `POST` | `/api/orders/<id>/photo` | `florist` / Manager | Upload ảnh chụp hoa thực tế trước khi gửi khách |

#### Request mẫu `POST /api/orders`:
```json
{
  "senderName": "Nguyễn Văn B",
  "senderPhone": "0987654321",
  "recipientName": "Trần Thị C",
  "recipientPhone": "0911223344",
  "recipientAddress": "123 Cách Mạng Tháng 8, P.5, Q.3, TP.HCM",
  "deliveryTime": "2026-08-22 14:00",
  "cardMessage": "Chúc mừng sinh nhật em yêu!",
  "items": [
    { "productId": "bo_hoa_01", "quantity": 1, "price": 420000 }
  ]
}
```

---

### 🏬 4. Nhóm Quản Lý Chuỗi Chi Nhánh (`/api/branches`)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/branches` | Public | Lấy danh sách toàn bộ showroom/chi nhánh kèm tọa độ GPS |
| `GET` | `/api/branches/nearest` | Public | Tìm chi nhánh gần nhất theo tọa độ người nhận (`lat`, `lng`) |
| `POST` | `/api/admin/branches` | `super_admin` | Tạo chi nhánh / Showroom mới |
| `PUT` | `/api/admin/branches/<id>` | `super_admin` | Cập nhật thông tin chi nhánh, bán kính giao 2H, Hotline |
| `DELETE`| `/api/admin/branches/<id>` | `super_admin` | Tạm ngưng hoạt động chi nhánh |

#### Request mẫu `POST /api/admin/branches`:
```json
{
  "code": "CN_Q10",
  "name": "Nở Hoa Thả Bình - Showroom Quận 10",
  "address": "183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP. Hồ Chí Minh",
  "lat": 10.7725,
  "lng": 106.6698,
  "phone": "0976.491.322",
  "openHours": "07:00 - 21:00",
  "deliveryRadiusKm": 10
}
```

---

### 👥 5. Nhóm Quản Lý Nhân Sự & Vai Trò (`/api/staff`)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/branch/<branch_id>/staff` | Manager / Admin | Lấy danh sách nhân viên thuộc chi nhánh |
| `POST` | `/api/branch/<branch_id>/staff` | Manager / Admin | Thêm nhân viên mới vào chi nhánh |
| `PUT` | `/api/staff/<id>/role` | Manager / Admin | Thay đổi vai trò nhân sự (`branch_manager`, `florist`, `sales_consultant`, `shipper`) |
| `PUT` | `/api/staff/<id>/status` | Manager / Admin | Khóa / Kích hoạt lại tài khoản nhân viên |

#### Request mẫu `POST /api/branch/<branch_id>/staff`:
```json
{
  "fullName": "Lê Ngọc Lan",
  "phone": "0909654321",
  "email": "lan.le@nohoathabinh.vn",
  "role": "florist",
  "password": "InitialPassword@123"
}
```

---

### 👑 6. Nhóm Quản Lý Khách Hàng - CRM (`/api/customers`)

| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/admin/customers` | `super_admin` | Danh sách khách hàng toàn chuỗi kèm bộ lọc LTV |
| `GET` | `/api/customers/<id>` | Manager / Admin | Xem hồ sơ chi tiết, lịch sử mua hàng, ghi chú sở thích hoa |
| `PUT` | `/api/customers/<id>/tier` | `super_admin` | Cập nhật hạng thẻ thành viên (`Silver`, `Gold`, `Diamond`) |

---

## 3. Bảng Mã Lỗi Chuẩn (HTTP Error Codes)

| Mã lỗi | Trạng thái | Ý nghĩa & Tình huống |
| :--- | :--- | :--- |
| `200` | `OK` | Yêu cầu xử lý thành công |
| `201` | `Created` | Tạo mới tài nguyên thành công |
| `400` | `Bad Request` | Dữ liệu gửi lên không hợp lệ hoặc thiếu trường bắt buộc |
| `401` | `Unauthorized` | Chưa đăng nhập hoặc Token JWT hết hạn |
| `403` | `Forbidden` | Tài khoản không đủ quyền truy cập tài nguyên (Sai Role / Sai Branch) |
| `404` | `Not Found` | Không tìm thấy tài nguyên (Sản phẩm, Đơn hàng, Chi nhánh...) |
| `500` | `Internal Server Error` | Lỗi máy chủ nội bộ |
