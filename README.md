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
├── index.html                   # Giao diện Web chính của Nở Hoa Thả Bình (gốc phát triển)
├── package.json                 # Cấu hình frontend dependencies & Vite scripts
├── vite.config.js               # Cấu hình Vite build bundle (SingleFile)
├── tailwind.config.js           # Cấu hình bảng màu & font chữ Tailwind
├── postcss.config.js            # Cấu hình PostCSS
├── requirements.txt             # Python backend dependencies (Flask, Flask-CORS...)
├── Dockerfile                   # Docker build (Python + Node.js + Vite build)
├── docker-compose.yml           # Docker Compose service cấu hình container
├── cli_docker.sh                # Script CLI quản lý build, chạy, test trên Ubuntu/Docker
│
├── scripts/                     # Scripts tự động hóa & đóng gói
│   └── build_bundle.py          # Trình đóng gói 20 modular JS thành file duy nhất js/bundle.js
│
├── js/                          # Mã nguồn JavaScript module hóa (Domain-Driven)
│   ├── bundle.js                # [Generated Artifact] File bundle JS duy nhất phục vụ Production/SPA
│   ├── flower_app.js            # Ứng dụng Storefront: Render sản phẩm, giỏ hàng, menu mobile
│   ├── portal_admin.js          # Shell Orchestrator điều phối toàn bộ Cổng Quản Trị
│   ├── portal_admin_*.js        # 10 sub-modules quản trị: products, categories, branches, users...
│   ├── products.js              # Quản lý catalogue sản phẩm Storefront & Cache RAM
│   ├── i18n.js                  # Logic chuyển đổi đa ngôn ngữ (VI, EN, JA, KO, ZH)
│   ├── checkout.js              # Giỏ hàng & luồng thanh toán VietQR
│   ├── auth.js                  # Xác thực người dùng, JWT & phân quyền RBAC
│   └── utils.js                 # Tiện ích: Lazy loading, Toast, Google Maps, ScreenLock
│
├── src/                         # Backend Flask
│   ├── app.py                   # Flask server phục vụ index.html & static files (no-cache in dev)
│   └── unittest/                # Bộ kiểm thử tự động Python
│
├── config/                      # Thư mục cấu hình dữ liệu & backup artifacts
│   ├── index.html               # [Generated Artifact] Bản sao index.html trích xuất từ container (cli_docker.sh)
│   └── anne/                    # Dữ liệu JSON tĩnh: products, branches, categories, users...
│
└── docs/                        # Tài liệu kỹ thuật chi tiết
    ├── README.md                # Mục lục tài liệu kỹ thuật
    ├── DOCKER_UBUNTU_GUIDE.md   # Hướng dẫn build & chạy Docker trên Ubuntu
    ├── design/                  # Tài liệu phân tích kiến trúc & thiết kế hệ thống
    │   └── FRONTEND_LAYOUT_DESIGN.md # Kiến trúc layout, sub-modules & quy chuẩn bundle
    └── requirements/            # Đặc tả yêu cầu nghiệp vụ
        └── PRODUCT_REQUIREMENTS.md
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

# 3. Build bundle sản phẩm (tự động chạy python scripts/build_bundle.py trước khi build Vite)
npm run build
```

---

### 📦 Quy Trình Đóng Gói JavaScript Bundle (`scripts/build_bundle.py`)

Khi phát triển giao diện hoặc chỉnh sửa các module JavaScript trong thư mục `js/` (ví dụ: `portal_admin_products.js`, `portal_admin_translations.js`, `portal_admin.js`...):

1. **Sinh file bundle:** Hệ thống sử dụng script [`scripts/build_bundle.py`](file:///d:/wmshare/telua_flower/scripts/build_bundle.py) để gộp 20 sub-modules thành file [`js/bundle.js`](file:///d:/wmshare/telua_flower/js/bundle.js).
   ```bash
   # Chạy thủ công khi chỉnh sửa file modular js/:
   python scripts/build_bundle.py
   ```
2. **Gắn hàm ra `window.*`:** Mọi hàm được gọi trực tiếp từ thuộc tính HTML (`onclick`, `oninput`, `onchange`... như `saveCurrentProdI18nDraft()`, `syncSingleKeyInputToDictionary()`) đều được gắn vào `window.*` trong từng module và re-export tại `portal_admin.js`.
3. **Cơ chế chống cache trình duyệt:**
   - Trong `index.html`: Gắn version `js/bundle.js?v=...`.
   - Trong Flask (`src/app.py`): Tự động đính kèm header `Cache-Control: no-cache, no-store, must-revalidate` đối với `.js` và `.html` khi chạy server local/LAN.
4. **Về file `config/index.html`:** Đây là artifact trích xuất tự động từ container Docker (`cli_docker.sh start`), dùng làm bản sao lưu dự phòng. Trong quá trình phát triển code, lập trình viên chỉnh sửa trực tiếp trên file gốc [`index.html`](file:///d:/wmshare/telua_flower/index.html).

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
