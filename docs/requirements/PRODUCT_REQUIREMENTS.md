# Tài Liệu Yêu Cầu Sản Phẩm (Product Requirements Document - PRD)
## Dự Án: Nở Hoa Thả Bình (`telua_flower`)

---

## 1. Tổng Quan Dự Án (Project Overview)

**Nở Hoa Thả Bình** là website thương mại điện tử chuyên cung cấp hoa tươi thiết kế độc bản, kệ hoa chúc mừng - sự kiện và các mẫu bình cắm hoa nghệ thuật cao cấp ("Thả Bình"), kết hợp dịch vụ giao hoa hỏa tốc 2H tại TP. Hồ Chí Minh.

- **Tên thương hiệu:** NỞ HOA THẢ BÌNH
- **Slogan:** Trao gửi yêu thương
- **Showroom chính:** 183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP. Hồ Chí Minh
- **Hotline đặt hoa:** 0976.491.322

---

## 2. Mục Tiêu Ứng Dụng (Business & Product Goals)

1. **Thương mại điện tử tinh gọn:** Cung cấp trải nghiệm chọn mẫu hoa và đặt mua online nhanh chóng, trực quan, mượt mà trên cả điện thoại di động và máy tính.
2. **Tiếp cận khách hàng quốc tế:** Hệ thống đa ngôn ngữ (5 ngôn ngữ) giúp du khách, người nước ngoài và đối tác quốc tế dễ dàng xem sản phẩm và đặt hoa tại Việt Nam.
3. **Quảng bá Showroom trực tiếp:** Tích hợp tính năng định vị cửa hàng, bản đồ Google Maps và sao chép địa chỉ 1 chạm để khuyến khích khách hàng ghé trải nghiệm trực tiếp.
4. **Chuyển đổi khách hàng đa kênh:** Kết nối tức thì khách hàng với tư vấn viên qua Hotline và Zalo OA.

---

## 3. Đối Tượng Người Dùng (Target Audience & Personas)

| Nhóm khách hàng | Nhu cầu chính | Tính năng phục vụ |
| :--- | :--- | :--- |
| **Khách hàng cá nhân** | Mua hoa tặng sinh nhật, tình yêu, kỷ niệm, tốt nghiệp | Xem danh mục Bó Hoa Tươi, ảnh thực tế, đặt nhanh |
| **Khách hàng doanh nghiệp (B2B)** | Đặt kệ hoa chúc mừng, khai trương, hội nghị, đối tác | Xem danh mục Kệ Hoa Khai Trương, hotline tư vấn riêng |
| **Khách hàng yêu nghệ thuật** | Mua bình cắm hoa độc bản, phụ kiện trang trí nhà cửa | Danh mục Bình Cắm Hoa Nghệ Thuật |
| **Khách quốc tế (En, Ja, Ko, Zh)** | Đặt hoa gửi tặng người thân, đối tác tại TP.HCM | Chuyển đổi ngôn ngữ tức thì (Anh, Nhật, Hàn, Trung) |

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
- **Backend:** Python Flask siêu nhẹ phục vụ file tĩnh và route.
- **Triển khai:** Đóng gói container Docker, build và khởi chạy 1-lệnh qua `cli_docker.sh` trên Ubuntu Linux.
