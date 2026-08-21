# Tài Liệu Yêu Cầu Sản Phẩm (Product Requirements Document - PRD)
## Dự Án: Nở Hoa Thả Bình (`telua_flower`)

---

## 1. Tổng Quan Dự Án (Project Overview)

**Nở Hoa Thả Bình** là nền tảng thương mại điện tử và quản lý chuỗi cửa hàng hoa tươi chuyên cung cấp các sản phẩm hoa thiết kế độc bản, kệ hoa sự kiện/khai trương và bình cắm hoa nghệ thuật ("Thả Bình"), kết hợp dịch vụ giao hoa hỏa tốc 2H tại TP. Hồ Chí Minh.

- **Tên thương hiệu:** NỞ HOA THẢ BÌNH
- **Slogan:** Trao gửi yêu thương
- **Showroom chính:** 183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP. Hồ Chí Minh
- **Hotline đặt hoa:** 0976.491.322

---

## 2. Mục Tiêu Ứng Dụng (Business & Product Goals)

1. **Thương mại điện tử tinh gọn:** Cung cấp trải nghiệm chọn mẫu hoa và đặt mua online nhanh chóng, trực quan, mượt mà trên cả điện thoại di động và máy tính.
2. **Tiếp cận khách hàng quốc tế:** Hệ thống đa ngôn ngữ (5 ngôn ngữ) giúp du khách, người nước ngoài và đối tác quốc tế dễ dàng xem sản phẩm và đặt hoa tại Việt Nam.
3. **Quản trị vận hành chuỗi chi nhánh:** Hỗ trợ đăng nhập phân quyền đa cấp để quản lý khách hàng (CRM), quản lý nhân sự từng chi nhánh và theo dõi hoạt động toàn hệ thống showroom.
4. **Chuyển đổi khách hàng đa kênh:** Kết nối tức thì khách hàng với tư vấn viên qua Hotline, Zalo OA và các kênh trực tiếp tại chi nhánh.

---

## 3. Đối Tượng Người Dùng & Phân Quyền (User Roles & Personas)

| Vai trò (Role) | Mô tả & Trách nhiệm | Chức năng chính được cấp quyền |
| :--- | :--- | :--- |
| **Khách hàng (Customer)** | Người mua hoa cá nhân, doanh nghiệp B2B, khách quốc tế | Xem sản phẩm, đặt hàng, quản lý lịch sử mua hàng, tích điểm, sổ địa chỉ |
| **Nhân viên (Staff / Florist / Sales)** | Thợ cắm hoa, nhân viên tư vấn bán hàng tại chi nhánh | Tiếp nhận đơn hàng, cập nhật tiến độ cắm hoa, chụp ảnh hoa thực tế trước khi giao, báo cáo tồn kho hoa tươi |
| **Quản lý chi nhánh (Branch Manager)** | Trưởng showroom / Quản lý từng chi nhánh | Quản lý nhân viên chi nhánh, giám sát tiến độ giao hàng 2H, quản lý tồn kho tại điểm bán, báo cáo doanh số chi nhánh |
| **Quản trị viên cấp cao (Admin / Owner)** | Chủ chuỗi cửa hàng, Quản lý toàn hệ thống | Quản lý toàn bộ chi nhánh, quản lý danh sách nhân sự toàn hệ thống, quản lý cơ sở dữ liệu khách hàng (CRM), cấu hình hệ thống |

---

## 4. Yêu Cầu Chức Năng (Functional Requirements)

### 🌸 FR-1: Danh Mục & Trưng Bày Sản Phẩm (Product Catalog)
- **Hiển thị sản phẩm theo nhóm:**
  - *Bó Hoa Tươi*: Các mẫu hoa thiết kế dạng bó sang trọng.
  - *Kệ Hoa Tươi*: Kệ hoa chúc mừng, khai trương phát tài phát lộc.
  - *Bình Cắm Hoa ("Thả Bình")*: Các mẫu bình thủy tinh, gốm sứ nghệ thuật cao cấp.
- **Chi tiết thẻ sản phẩm (Product Card):**
  - Hình ảnh sản phẩm chất lượng cao kèm hiệu ứng zoom hover.
  - Nhãn trạng thái nổi bật (Badge): `Hot`, `Mới`, `-7%`, `Bán chạy`.
  - Giá gốc (gạch ngang) và giá khuyến mãi nổi bật.
  - Nút **"Thêm giỏ hàng"** xuất hiện mượt mà khi di chuột hoặc tương tác trên mobile.

### 🌐 FR-2: Hệ Thống Đa Ngôn Ngữ Tự Động (i18n & Web Cache)
- Hỗ trợ đầy đủ **5 ngôn ngữ**:
  - 🇻🇳 Tiếng Việt (`vi` - Mặc định)
  - 🇬🇧 English (`en`)
  - 🇯🇵 日本語 (`ja`)
  - 🇰🇷 한국어 (`ko`)
  - 🇨🇳 中文 (`zh`)
- **Cơ chế hoạt động:**
  - Chuyển đổi tức thì không cần reload trang (Client-side translation).
  - Tự động lưu ngôn ngữ đã chọn vào `localStorage` (`anne_flower_lang`) để ghi nhớ cho các lần truy cập sau.
  - SelectBox chọn ngôn ngữ đồng bộ trên cả thanh Header Desktop và Menu Mobile.

### 🛒 FR-3: Giỏ Hàng & Tương Tác Đặt Hàng (Shopping Cart)
- **Thêm sản phẩm nhanh:** Nhấn nút trên thẻ sản phẩm để tăng số lượng giỏ hàng.
- **Biểu tượng giỏ hàng (Mini Cart):** Hiển thị số lượng sản phẩm trên header kèm animation nhấp nháy (`animate-bounce`).
- **Thông báo Toast:** Hiển thị thông báo góc dưới màn hình ("Đã thêm vào giỏ hàng thành công!") được dịch theo ngôn ngữ hiện tại.
- **Kiểm tra giỏ hàng:** Xem tổng số lượng hoặc cảnh báo khi giỏ hàng trống.

### 📍 FR-4: Định Vị Showroom & Bản Đồ (Store Locator)
- **Thông tin cửa hàng:**
  - Địa chỉ: `183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP. Hồ Chí Minh`.
  - Giờ mở cửa: `07:00 - 21:00` (Tất cả các ngày trong tuần, kể cả ngày lễ).
  - Tiện ích: Chỗ đậu ô tô/xe máy miễn phí, thiết kế hoa theo yêu cầu, tặng thiệp cao cấp.
- **Chức năng tương tác:**
  - Nút **"Chỉ Đường Đến Shop"**: Mở trực tiếp Google Maps với tọa độ chính xác.
  - Nút **"Sao Chép Địa Chỉ"**: Tự động copy địa chỉ vào clipboard và hiện Toast thông báo.
  - Bản đồ Google Maps nhúng trực tiếp trên trang.

### 📞 FR-5: Kênh Liên Hệ Nhanh (Contact & Engagement)
- **Floating Contact Bar:**
  - Nút gọi Hotline (`0976.491.322`) với hiệu ứng rung chuông nổi bật (`pulse-hotline`).
  - Nút chat Zalo Official Account (`pulse-zalo`) hỗ trợ khách hàng tức thì.
- **Form đăng ký nhận tin (Newsletter):** Nhập email nhận voucher giảm giá 10%.

### 📱 FR-6: Menu Di Động & Tìm Kiếm (Mobile Menu & Search)
- Menu Sidebar trượt từ cạnh trái màn hình cho người dùng điện thoại.
- Thanh tìm kiếm sản phẩm nhanh chóng (Desktop & Mobile).

---

### 🔐 FR-7: Hệ Thống Đăng Nhập & Xác Thực Phân Quyền (Authentication & RBAC)
- **Phương thức đăng nhập:**
  - Đăng nhập dành cho Khách hàng: Qua Số điện thoại / Email + Mật khẩu (hoặc OTP / Social Login).
  - Đăng nhập dành cho Quản trị / Nhân viên: Tài khoản nội bộ được cấp phép theo Chi nhánh.
- **Tính năng bảo mật:**
  - JWT / Session Token an toàn, mã hóa mật khẩu (Bcrypt / Argon2).
  - Kiểm soát phiên đăng nhập, tự động đăng xuất khi hết hạn token.
  - Phân quyền động theo Role: Khách hàng, Nhân viên (Staff), Quản lý chi nhánh (Branch Manager), Quản trị viên (Super Admin).

---

### 👥 FR-8: Quản Lý Khách Hàng (Customer Management - CRM)
- **Hồ sơ khách hàng:**
  - Thông tin liên hệ: Họ tên, Số điện thoại, Email, Ngày sinh nhật (tự động kích hoạt ưu đãi hoa sinh nhật).
  - Sổ địa chỉ giao hàng: Lưu nhiều địa chỉ nhận hoa thường dùng (nhà riêng, công ty, địa chỉ người nhận tặng).
- **Phân loại & Chăm sóc khách hàng:**
  - Nhóm khách: Khách hàng lẻ, Khách hàng thân thiết (VIP), Khách hàng doanh nghiệp (B2B - lưu mã số thuế và thông tin xuất hóa đơn đỏ).
  - Lịch sử đơn hàng và tổng giá trị chi tiêu (LTV - Lifetime Value).
  - Ghi chú sở thích của khách hàng (loại hoa yêu thích, màu sắc kiêng kỵ, phong cách cắm ưa thích).
- **Chương trình tích điểm & Tri ân:**
  - Hạng thành viên: Bạc (Silver), Vàng (Gold), Kim Cương (Diamond).
  - Mã giảm giá và voucher quà tặng cá nhân hóa theo từng tài khoản.

---

### 👔 FR-9: Quản Lý Nhân Viên (Staff Management)
- **Quản lý danh sách nhân sự theo Chi nhánh:**
  - Thông tin nhân viên: Mã nhân viên, Họ tên, Số điện thoại, Email, Chi nhánh trực thuộc, Chức danh (Thợ cắm hoa / Tư vấn bán hàng / Thu ngân / Giao hàng).
  - Trạng thái làm việc: Đang làm việc, Nghỉ phép, Đã nghỉ việc.
- **Phân quyền và phân công nhiệm vụ:**
  - Phân công ca làm việc và gán đơn hàng cho nhân viên xử lý.
  - Quyền cập nhật trạng thái đơn: *Đã tiếp nhận -> Đang cắm hoa -> Đã chụp ảnh xác nhận -> Đang giao hàng -> Hoàn tất*.
- **Theo dõi hiệu suất (KPI):**
  - Số lượng đơn hoa hoàn thành theo ca/tháng.
  - Tỷ lệ hài lòng và phản hồi đánh giá từ khách hàng.

---

### 🏢 FR-10: Quản Lý Chuỗi Chi Nhánh & Showroom (Branch Management)
- **Thông tin chi nhánh:**
  - Mã chi nhánh, Tên chi nhánh (VD: *Chi nhánh Q.10*, *Chi nhánh Q.1*, *Chi nhánh Thảo Điền*).
  - Địa chỉ chi tiết và tọa độ định vị GPS (Lat, Lng) phục vụ điều phối đơn hàng gần nhất.
  - Hotline và giờ hoạt động riêng của từng chi nhánh.
  - Người quản lý phụ trách chi nhánh (Branch Manager).
- **Bán kính và khu vực phục vụ:**
  - Thiết lập bán kính giao hàng hỏa tốc 2H cho từng chi nhánh.
  - Tự động định tuyến gán đơn hàng mới cho chi nhánh gần địa chỉ người nhận nhất để tối ưu thời gian giao.
- **Quản lý kho hàng & Báo cáo chi nhánh:**
  - Quản lý số lượng hoa tươi nhập mới mỗi ngày tại chi nhánh.
  - Báo cáo doanh số bán hàng, tỷ lệ hủy đơn, báo cáo doanh thu theo chi nhánh.

---

## 5. Yêu Cầu Phi Chức Năng (Non-Functional Requirements)

### ⚡ NFR-1: Hiệu Năng & Tải Trang (Performance)
- **Lazy Loading:** Tất cả ảnh sản phẩm được gắn thuộc tính `loading="lazy"` kết hợp giải mã bất đồng bộ `decoding="async"`.
- **Skeleton Shimmer Loader:** Hiển thị khung chờ gradient lấp lánh trong lúc ảnh tải từ mạng về, chống vỡ giao diện (CLS - Cumulative Layout Shift).

### 🎨 NFR-2: Giao Diện & Trải Nghiệm (Design & Aesthetics)
- **Bảng màu:**
  - Màu chủ đạo (`primary`): Hồng sen sang trọng (`#d81b60`).
  - Màu nhấn (`accent`): Hồng phấn ngọt ngào (`#ff4081`).
  - Màu nền (`light`): Trắng ngọc trai tinh khôi (`#fdfbfb`).
- **Typography:**
  - Font nội dung chính: `Quicksand`, `Noto Sans JP/KR/SC` (đa ngữ, mềm mại).
  - Font tiêu đề: `Playfair Display` (serif sang trọng, quý phái).
- **Thiết kế Responsive:** Tương thích chuẩn xác trên Mobile (iOS/Android), Tablet và Desktop.

### 🏗️ NFR-3: Kiến Trúc Hệ Thống (System Architecture)
- **Frontend:** HTML5, Tailwind CSS, Modular JavaScript trong thư mục `js/` (`products.js`, `translations.js`, `i18n.js`, `utils.js`, `flower_app.js`).
- **Backend:** Python Flask phục vụ giao diện, API xác thực và quản lý dữ liệu.
- **Triển khai:** Đóng gói container Docker, build và khởi chạy 1-lệnh qua `cli_docker.sh` trên Ubuntu Linux.
