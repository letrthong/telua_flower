# 🏨 Lữ Quán (Luquan) - Nền tảng Kết nối & Phê duyệt Khách sạn

Một ứng dụng Web tĩnh (Single Page Application) hiện đại, mượt mà giúp quản lý, hiển thị và kết nối trực tiếp với các khách sạn trên bản đồ. Dự án được thiết kế tối ưu cho cả giao diện máy tính (Desktop) và thiết bị di động (Mobile).

## ✨ Tính năng nổi bật

- **Giao diện đa thiết bị:** Hoạt động như một App Native trên Mobile (vuốt chuyển mượt mà giữa Bản đồ & Danh sách).
- **Bản đồ tương tác (Leaflet):** Hiển thị trực quan vị trí khách sạn, hỗ trợ chọn tọa độ khi đăng ký mới.
- **Tìm kiếm & Lọc thông minh:** Tự động trích xuất danh sách Tỉnh/Thành phố từ dữ liệu địa chỉ; tìm kiếm theo tên không dấu.
- **Đăng ký Khách sạn mới:** Biểu mẫu cho phép người dùng nhập thông tin và thả ghim chọn vị trí trên bản đồ.
- **Phân hệ Admin (Quản trị):** Xác thực tài khoản Admin để duyệt/từ chối/xóa các yêu cầu đăng ký khách sạn.

## 🛠 Công nghệ sử dụng

- **Giao diện:** HTML5, CSS3, [Tailwind CSS (CDN)](https://tailwindcss.com/)
- **Logic & Trạng thái:** [React 18](https://reactjs.org/) (Sử dụng trực tiếp qua CDN với Babel transpiler)
- **Bản đồ:** [Leaflet.js](https://leafletjs.com/) & OpenStreetMap
- **Icon:** [Lucide Icons](https://lucide.dev/)
- **Lưu trữ dữ liệu:** Tệp cấu hình JSON tĩnh (`hotelInfo.json`)
- https://pypi.org/project/pygeohash/

## 📂 Cấu trúc thư mục

```text
hotel_connect/
│
├── index.html               # Chứa toàn bộ giao diện HTML và logic React (JSX)
├── js/
│   ├── api.js               # Module gọi API, quản lý endpoint động, các hàm fetch dữ liệu
│   └── hotel_connect.js     # React App chính: giao diện, logic, đồng bộ URL, quản trị, toast...
│   └── components/
│       ├── MapComponents.js # Các component bản đồ (Leaflet, marker, picker...)
│       └── Icon.js          # Component icon SVG (Lucide, custom...)
│   └── utils.js             # Hàm tiện ích chung (Base64, GPS, Haversine...)
├── config/
│   ├── hotel_schema.json    # Tệp dự phòng cấu trúc dữ liệu khách sạn (chuẩn backend Flask)
│   ├── hochiminh_hotels.json # Danh sách khách sạn Hồ Chí Minh (và các file *.json cho từng thành phố)
│   └── ...                  # Các file dữ liệu khách sạn khác
├── src/
│   └── services.py         # Flask backend: RESTful API quản lý khách sạn, schema, duyệt yêu cầu
├── README.md                # Tài liệu hướng dẫn (File này)
```

## 🚀 Hướng dẫn Cài đặt và Chạy dự án

**Lưu ý khi chạy và phát triển cục bộ:**
- Tất cả API của frontend hiện đã được cấu hình dạng **relative path** (`/api/...`).
- Khi phát triển cục bộ bằng Vite (`npm run dev`), các request `/api` sẽ được tự động proxy tới Flask Backend (mặc định cổng `5000`) thông qua cấu hình proxy trong `vite.config.js`. Do đó, bạn không cần phải cấu hình cứng địa chỉ IP nữa.


Ứng dụng sử dụng API `fetch()` của trình duyệt để đọc dữ liệu khách sạn từ các tệp JSON trong thư mục `config/` (ví dụ: `hochiminh_hotels.json`, `danang_hotels.json`, ...). Bạn **không thể** nhấp đúp để mở file `index.html` trực tiếp (giao thức `file://` sẽ bị lỗi CORS). Bạn cần chạy dự án thông qua một Local Web Server.

### Cách 1: Sử dụng VS Code (Khuyên dùng)
1. Mở thư mục chứa dự án bằng Visual Studio Code.
2. Cài đặt tiện ích mở rộng **Live Server** (Tác giả: Ritwick Dey).
3. Nhấp chuột phải vào file `index.html` và chọn **"Open with Live Server"**.
4. Trình duyệt sẽ tự động mở dự án tại `http://127.0.0.1:5500`.


### Cách 2: Sử dụng Flask Backend trên Docker (Khuyên dùng khi cần test API động)
1. Đảm bảo đã cài Docker trên máy.
2. Clone repo mẫu backend Flask hỗ trợ CORS tại: [ubuntu-python_cors](https://github.com/letrthong/docker/tree/master/ubuntu-python_cors)
3. Làm theo hướng dẫn trong repo để build và chạy container Flask backend.
4. Đảm bảo các file JSON dữ liệu khách sạn được mount vào đúng vị trí container (thường là /app/config/).
5. Truy cập frontend tại `http://localhost:8000` hoặc port bạn đã cấu hình.

  
## 🔐 Thông tin quản trị (Admin)

- Để truy cập chế độ Admin, nhấn vào biểu tượng ổ khóa (Lock) ở góc phải màn hình.
- **Mật mã mặc định:** `1234`
- *Lưu ý: Mọi thao tác Thêm/Sửa/Xóa hiện tại chỉ lưu trữ trên phiên làm việc (RAM) của trình duyệt. Dữ liệu sẽ khôi phục về ban đầu khi làm mới trang (F5).*

 
---
*Phát triển cho hệ sinh thái Lữ Quán - Vận hành bởi nongtrang.vn*



http://192.168.124.129:5000/luquan/ 
