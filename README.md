# 🌸 Nở Hoa Thả Bình (`telua_flower`) - Đặt Hoa Tươi Online Giao Tận Nơi

**Nở Hoa Thả Bình** là nền tảng thương mại điện tử chuyên cung cấp hoa tươi thiết kế độc bản, kệ hoa chúc mừng/khai trương và các mẫu bình cắm hoa nghệ thuật cao cấp ("Thả Bình"), kết hợp dịch vụ giao hoa hỏa tốc 2H tại TP. Hồ Chí Minh.

- **Slogan:** *Trao gửi yêu thương*
- **Showroom:** 183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP. Hồ Chí Minh
- **Hotline:** 0976.491.322 | **Email:** cskh@nohoathabinh.vn

---

## ✨ Tính Năng Nổi Bật

- **Trưng bày sản phẩm đa dạng:** Danh mục Bó hoa tươi, Kệ hoa khai trương/chúc mừng, Bình cắm hoa nghệ thuật cao cấp kèm nhãn nổi bật (`Hot`, `Mới`, `Bán chạy`, Giảm giá).
- **Hệ thống đa ngôn ngữ tự động (i18n):** Hỗ trợ đầy đủ 5 ngôn ngữ (🇻🇳 Tiếng Việt, 🇬🇧 English, 🇯🇵 日本語, 🇰🇷 한국어, 🇨🇳 中文) với cơ chế lưu ngôn ngữ vào `localStorage` của trình duyệt.
- **Giỏ hàng & Đặt mua tiện lợi:** Thêm sản phẩm nhanh, huy hiệu giỏ hàng động (Mini Cart animation), thông báo Toast đa ngữ tức thì.
- **Định vị Showroom (Store Locator):** Bản đồ Google Maps nhúng trực tiếp, nút chỉ đường và tính năng **"Sao chép địa chỉ"** 1-chạm vào clipboard.
- **Tương tác đa kênh:** Nút Hotline nổi với hiệu ứng rung chuông (`pulse-hotline`) và nút Chat Zalo Official Account (`pulse-zalo`) hỗ trợ 24/7.
- **Tối ưu hiệu năng vượt trội:** Lazy Loading cho toàn bộ hình ảnh kết hợp hiệu ứng Skeleton Shimmer Loader chống giật layout (CLS).
- **Thiết kế Responsive hoàn hảo:** Tương thích mượt mà trên mọi thiết bị: Mobile (iOS/Android), Tablet và Desktop.

---

## 🛠 Công Nghệ Sử Dụng (Tech Stack)

- **Frontend:**
  - HTML5 Semantic & [Tailwind CSS](https://tailwindcss.com/)
  - JavaScript Module hóa (Vanilla ES6+ trong thư mục `js/`)
  - Icons: [FontAwesome 6](https://fontawesome.com/)
  - Typography: Google Fonts ([Quicksand](https://fonts.google.com/specimen/Quicksand), [Playfair Display](https://fonts.google.com/specimen/Playfair+Display), Noto Sans đa ngữ)
- **Frontend Tooling:** [Vite](https://vitejs.dev/) + `vite-plugin-singlefile`
- **Backend:** Python 3.11, [Flask](https://flask.palletsprojects.com/), `Flask-CORS`
- **Đóng gói & Triển khai:** [Docker](https://www.docker.com/), Docker Compose, Bash Script (`cli_docker.sh`)

---

## 📂 Cấu Trúc Thư Mục (Project Structure)

```text
telua_flower/
│
├── index.html                   # Giao diện Web chính của Nở Hoa Thả Bình
├── package.json                 # Cấu hình frontend dependencies & Vite scripts
├── vite.config.js               # Cấu hình Vite build bundle
├── tailwind.config.js           # Cấu hình bảng màu & font chữ Tailwind
├── postcss.config.js            # Cấu hình PostCSS
├── requirements.txt             # Python backend dependencies (Flask, Flask-CORS...)
├── Dockerfile                   # Docker build (Python + Node.js + Vite build)
├── docker-compose.yml           # Docker Compose service cấu hình container
├── cli_docker.sh                # Script CLI quản lý build, chạy, test trên Ubuntu/Docker
│
├── js/                          # Mã nguồn JavaScript module hóa
│   ├── products.js              # Dữ liệu mock danh mục sản phẩm hoa & bình
│   ├── translations.js          # Từ điển đa ngôn ngữ (vi, en, ja, ko, zh)
│   ├── i18n.js                  # Logic chuyển đổi ngôn ngữ & Web Cache
│   ├── utils.js                 # Tiện ích: Lazy loading, Toast, Google Maps, Clipboard
│   └── flower_app.js            # Ứng dụng chính: Render sản phẩm, giỏ hàng, menu mobile
│
├── src/                         # Backend Flask
│   ├── app.py                   # Flask server phục vụ index.html & static files
│   └── unittest/                # Bộ kiểm thử tự động
│       └── test_app_routing.py  # Unit test kiểm tra routing, root discovery & static assets
│
├── config/                      # Thư mục cấu hình & backup
│   └── index.html               # Bản sao index.html dự phòng
│
└── docs/                        # Tài liệu kỹ thuật chi tiết
    ├── README.md                # Mục lục tài liệu kỹ thuật
    ├── DOCKER_UBUNTU_GUIDE.md   # Hướng dẫn build & chạy Docker trên Ubuntu
    └── requirements/            # Tài liệu phân tích yêu cầu nghiệp vụ
        ├── README.md
        └── PRODUCT_REQUIREMENTS.md  # Đặc tả yêu cầu sản phẩm (PRD), CRM, nhân sự, chi nhánh
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### Cách 1: Chạy bằng Docker trên Ubuntu (Khuyên dùng)
Toàn bộ môi trường build Vite và Flask backend đều được đóng gói tự động bên trong Docker. Bạn chỉ cần:

```bash
# 1. Cấp quyền thực thi cho script
chmod +x cli_docker.sh

# 2. Khởi động và build container
./cli_docker.sh start
```
Mở trình duyệt truy cập: `http://localhost:5000` (hoặc `http://<IP_UBUNTU>:5000`).

---

### Cách 2: Chạy trực tiếp với Python Flask (Local)
Yêu cầu máy đã cài Python 3.9 trở lên:

```bash
# 1. Cài đặt các thư viện phụ thuộc
pip install -r requirements.txt

# 2. Khởi chạy Flask server
python src/app.py
```
Mở trình duyệt truy cập: `http://localhost:5000`.

---

### Cách 3: Chạy Frontend với Vite (Hot Reload Development)
Yêu cầu máy đã cài Node.js 18 trở lên:

```bash
# 1. Cài đặt npm packages
npm install --legacy-peer-deps

# 2. Chạy dev server
npm run dev

# 3. Build bundle sản phẩm
npm run build
```

---

## 🧪 Quy Chuẩn Kiểm Thử Bắt Buộc (Mandatory Unit Tests)

> **Quy định bắt buộc:** Mọi thay đổi mã nguồn trước khi bàn giao đều phải chạy thành công **100%** cả 2 bộ test suite của hệ thống. Xem chi tiết tại: [Quy chuẩn kiểm thử & Unit Test Mandate](docs/design/TESTING_AND_UNIT_TEST_MANDATE.md).

### 1. Chạy Toàn Bộ Unit Test JavaScript (Frontend & Business Logic):
```bash
# Cách 1: npm test chuẩn
npm test

# Cách 2: Node.js test runner
node --test js/unittest/*.js
```
*(Bao gồm 27 bài test: Tìm kiếm tiếng Việt không dấu, URL Hash Router, Phân quyền RBAC, Tầng giá, Chiết khấu Voucher, i18n)*

### 2. Chạy Toàn Bộ Unit Test Python (Backend REST API & Data Protection):
```powershell
# Windows PowerShell
$env:PYTHONPATH="src"
python -m unittest discover -s src/unittest -p "test_*.py"
```
```bash
# Linux / Ubuntu / Docker
export PYTHONPATH="src"
python3 -m unittest discover -s src/unittest -p "test_*.py"
```
*(Bao gồm 79 bài test qua 9 test suites: Cấu trúc tệp, File I/O Cache mtime, JWT Auth, Đơn hàng & Ẩn danh, Price Governance, Product CRUD, Voucher & Báo cáo hỏng, Quản trị chi nhánh, Bảo vệ dữ liệu RBAC)*

---

## 📖 Tài Liệu Tham Khảo Thêm

- 📋 [Quy Chuẩn Kiểm Thử & Unit Test Mandate](docs/design/TESTING_AND_UNIT_TEST_MANDATE.md)
- ⚡ [Kiến Trúc Bộ Nhớ Đệm 4 Tầng & Hiệu Năng](docs/design/PERFORMANCE_AND_CACHING_ARCHITECTURE.md)
- 📋 [Tài Liệu Yêu Cầu Sản Phẩm (PRD)](docs/requirements/PRODUCT_REQUIREMENTS.md)
- 🐳 [Hướng Dẫn Triển Khai Docker Trên Ubuntu (English Guide)](docs/DOCKER_UBUNTU_GUIDE.md)

---
*© 2026 Bản quyền thuộc về Nở Hoa Thả Bình - Trao gửi yêu thương.*
