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

1. **Thương mại điện tử tinh gọn & Trải nghiệm quà tặng hoàn hảo:** Cung cấp trải nghiệm chọn mẫu hoa, hẹn giờ giao, viết thiệp/in banner, ghi chú chỉ dẫn địa chỉ chi tiết và đặt mua online nhanh chóng trên cả điện thoại di động và máy tính.
2. **Tiếp cận khách hàng quốc tế & Kiều bào:** Hệ thống 5 ngôn ngữ kết hợp cổng thanh toán quốc tế và chuyển khoản tự động (VietQR, Visa/Mastercard) giúp khách nước ngoài dễ dàng đặt hoa tặng đối tác tại Việt Nam.
3. **Quản trị vận hành chuỗi chi nhánh:** Hỗ trợ phân quyền đăng nhập đa cấp để quản lý khách hàng (CRM), phân ca nhân sự, quản lý tồn kho theo ngày và báo cáo hao hụt hoa tươi.
4. **Chuyển đổi khách hàng đa kênh:** Kết nối tức thì khách hàng với tư vấn viên qua Hotline, Zalo OA và các kênh trực tiếp tại chi nhánh.

---

## 3. Đối Tượng Người Dùng & Phân Quyền (User Roles & Personas)

| Vai trò (Role) | Mô tả & Trách nhiệm | Chức năng chính được cấp quyền |
| :--- | :--- | :--- |
| **Khách hàng (Customer)** | Người mua hoa cá nhân, doanh nghiệp B2B, khách quốc tế | Đặt hoa, chọn ngày giờ giao, ghi chú chỉ dẫn địa chỉ, viết thiệp, thanh toán online, quản lý đơn hàng |
| **Nhân viên (Staff / Florist / Sales)** | Thợ cắm hoa, nhân viên tư vấn bán hàng tại chi nhánh | Tiếp nhận đơn, cập nhật tiến độ cắm hoa, **chụp ảnh hoa thực tế tải lên gửi khách**, báo cáo hao hụt hoa |
| **Quản lý chi nhánh (Branch Manager)** | Trưởng showroom / Quản lý từng chi nhánh | Phân ca nhân viên, duyệt ảnh hoa, quản lý kho hoa chi nhánh, báo cáo doanh thu & hủy hoa cuối ngày |
| **Quản trị viên cấp cao (Admin / Owner)** | Chủ chuỗi cửa hàng, Quản lý toàn hệ thống | Quản lý toàn bộ chi nhánh, quản trị nhân sự toàn chuỗi, CRM khách hàng, cấu hình cổng thanh toán |

---

## 4. Danh Sách Yêu Cầu Chức Năng (Functional Requirements)

### 🌸 FR-1: Danh Mục & Trưng Bày Sản Phẩm (Product Catalog)
- **Hiển thị sản phẩm theo nhóm:** Bó hoa tươi, Kệ hoa khai trương/chúc mừng, Bình cắm hoa nghệ thuật ("Thả Bình").
- **Chi tiết thẻ sản phẩm (Product Card):**
  - Hình ảnh độ phân giải cao kèm hiệu ứng zoom hover.
  - Nhãn trạng thái nổi bật (Badge): `Hot`, `Mới`, `-7%`, `Bán chạy`.
  - Giá gốc (gạch ngang) và giá khuyến mãi nổi bật.
  - Trạng thái tồn kho tại showroom: 🟢 Còn nhiều (Giao 2H) / 🟠 Sắp hết / 🔴 Hết hàng.
  - Nút **"Thêm giỏ hàng"** xuất hiện mượt mà.

### 🌐 FR-2: Hệ Thống Đa Ngôn Ngữ Tự Động (i18n & Web Cache)
- Hỗ trợ đầy đủ **5 ngôn ngữ**: 🇻🇳 Tiếng Việt (`vi`), 🇬🇧 English (`en`), 🇯🇵 日本語 (`ja`), 🇰🇷 한국어 (`ko`), 🇨🇳 中文 (`zh`).
- Chuyển đổi tức thì phía Client (không reload trang) và lưu ngôn ngữ vào `localStorage` (`anne_flower_lang`).

### 🛒 FR-3: Giỏ Hàng & Tương Tác Đặt Hàng (Shopping Cart)
- Thêm sản phẩm nhanh 1-chạm, Mini-cart badge thời gian thực kèm hiệu ứng `animate-bounce`.
- Toast thông báo đa ngôn ngữ khi thêm sản phẩm thành công.

### 📍 FR-4: Định Vị Showroom & Bản Đồ (Store Locator)
- Hiển thị thông tin Showroom (Địa chỉ, giờ mở cửa, tiện ích đậu xe, hotline).
- Nút **"Chỉ Đường Đến Shop"** mở Google Maps và nút **"Sao Chép Địa Chỉ"** 1-chạm vào clipboard.

### 📞 FR-5: Kênh Liên Hệ Nhanh (Contact & Engagement)
- Nút gọi Hotline nổi với hiệu ứng rung chuông (`pulse-hotline`) và nút Chat Zalo OA (`pulse-zalo`).
- Form đăng ký email nhận ưu đãi 10%.

### 📱 FR-6: Menu Di Động & Tìm Kiếm (Mobile Menu & Search)
- Menu Sidebar trượt từ cạnh trái cho điện thoại, thanh tìm kiếm sản phẩm nhanh.

---

### ⏰ FR-7: Đặt Lịch Giao Hoa Theo Ngày & Khung Giờ (Scheduled Delivery & Time Slots)
- **Chọn ngày giao hàng (Date Picker):** Cho phép khách đặt trước hoa tối đa 30 ngày.
- **Chọn khung giờ giao hàng (Time Slots):**
  - Khung giờ tiêu chuẩn: `07:00 - 09:00`, `09:00 - 11:00`, `11:00 - 13:00`, `13:00 - 15:00`, `15:00 - 17:00`, `17:00 - 19:00`, `19:00 - 21:00`.
  - Tùy chọn **"Giao Hỏa Tốc trong 2H"**.
- **Hạn mức khung giờ (Slot Capacity):** Giới hạn tối đa số đơn trong mỗi khung giờ.

---

### 💌 FR-8: Cá Nhân Hóa Thiệp, Băng Rôn & Ghi Chú Địa Chỉ Chi Tiết (Custom Card & Delivery Notes)
- **Ghi chú chỉ dẫn địa chỉ người nhận (Delivery Location Notes):**
  - Hỗ trợ ô ghi chú chi tiết: Tên tòa nhà/chung cư, số tầng, số phòng, tên công ty (VD: *Tòa Landmark 81, Tầng 18, Phòng 18.02*).
  - Hướng dẫn tìm nhà trong hẻm/ngõ hoặc ghi chú giao nhận: *Gửi lễ tân nếu người nhận đang bận*, *Gọi trước 15 phút để xuống sảnh nhận hoa*.
- **Nhập nội dung Thiệp chúc mừng & Băng rôn / Banner:**
  - Lời chúc viết thiệp (Font chữ tay hoặc in máy sang trọng).
  - Nội dung in dải ruy-băng / Banner kệ hoa khai trương (VD: *"Công ty ABC Kính Chúc"*).
- **Phân tách Người Tặng & Người Nhận:**
  - Tùy chọn 1: *Tôi là người nhận hoa* (tự mua hoa).
  - Tùy chọn 2: *Gửi tặng người khác* (Nhập riêng SĐT/Tên người nhận và người tặng).
- **Tùy chọn "Gửi hoa ẩn danh (Bí mật người gửi)":** Shipper trao hoa mà không tiết lộ danh tính người đặt.

---

### 💳 FR-9: Cổng Thanh Toán Trực Tuyến Tự Động (Payment Gateway Integration)
- **VietQR chuyển khoản tự động:** Mã QR động tự động xác nhận đơn sau 5 giây.
- **Thẻ Quốc Tế (Visa / MasterCard / JCB) & Ví Điện Tử (MoMo / ZaloPay).**
- **Tiền mặt COD:** Áp dụng khi Người đặt là Người nhận hoa (đơn dưới 1 triệu).

---

### 🔐 FR-10: Cổng Đăng Nhập Đơn Nhất & Phân Quyền Động (Single Login & RBAC)
- **Cổng đăng nhập duy nhất:** Tất cả người dùng đăng nhập tại cùng một điểm truy cập bằng SĐT/Email + Mật khẩu.
- **Tự động nhận diện Role & Điều hướng:** `customer` $\rightarrow$ `/account`, `florist` $\rightarrow$ `/portal/staff`, `sales_consultant` $\rightarrow$ `/portal/sales`, `branch_manager` $\rightarrow$ `/portal/branch-manager`, `super_admin` $\rightarrow$ `/portal/admin`.

---

### 👥 FR-11: Quản Lý Khách Hàng - CRM & Hạng Thành Viên
- Lưu ngày sinh nhật (tự tặng mã giảm giá), lịch sử đơn, tích điểm thẻ Bạc / Vàng / Kim Cương.

---

### 👔 FR-12: Quản Lý Nhân Viên & Quy Trình Cắm Hoa Thực Tế
- Thợ cắm hoa **chụp ảnh hoa thật tải lên gửi khách duyệt trước khi xuất xưởng**.

---

### 🏬 FR-13: Quản Lý Chuỗi Chi Nhánh & Điều Phối Đơn Hàng Thông Minh
- Quản lý danh sách chi nhánh kèm tọa độ GPS, tự động điều phối đơn sang chi nhánh gần nhất còn hàng.

---

### 🥀 FR-14: Quản Lý Hao Hụt & Báo Cáo Hủy Hoa Tươi Cuối Ngày (Spoilage & Wastage)
- Phiếu kiểm kê cành hoa hỏng cuối ca giúp hạch toán chi phí và điều chỉnh lượng nhập hàng ngày hôm sau.

---

### 📲 FR-15: Hệ Thống Thông Báo Tự Động Đa Kênh (Zalo ZNS / SMS / Email)
- Tự động gửi tin nhắn Zalo/SMS/Email kèm link ảnh chụp hoa thực tế khi thợ cắm hoa hoàn thành.
- Tự động thông báo khi Shipper bắt đầu giao và khi người nhận đã nhận hoa thành công.

---

### 🧾 FR-16: Hỗ Trợ Xuất Hóa Đơn Điện Tử VAT Doanh Nghiệp (B2B E-Invoice)
- Form nhập Mã số thuế (MST), Tên công ty, Địa chỉ và Email nhận hóa đơn đỏ điện tử (tự động tra cứu MST từ cổng Tổng cục Thuế).

---

### 🖨️ FR-17: Mẫu In Phiếu Giao Hàng & Tem Dán Bó Hoa (Print Slip Template)
- Nút in phiếu giao hàng chuẩn khổ in nhiệt K80 và khổ A5 dán lên bó hoa/kệ hoa với đầy đủ thông tin người nhận, ghi chú chỉ dẫn địa chỉ và lời chúc thiệp/banner.

---

### 🌐 FR-18: Quản Trị Nội Dung & Biên Dịch Đa Ngôn Ngữ Động (Dynamic i18n & Content CMS)
- Giao diện ma trận cho Admin/Quản lý chỉnh sửa trực tiếp nội dung từng câu/chữ của cả 5 ngôn ngữ (Việt, Anh, Nhật, Hàn, Trung) và lưu xuống `config/translations.json` thay vì viết code cố định.
- Cho phép cập nhật linh hoạt nội dung các khối trang (Slogan, Hotline, Giờ hoạt động, Giới thiệu Showroom, Chính sách) và tự động đồng bộ trên toàn bộ website.

---

## 5. Yêu Cầu Phi Chức Năng (Non-Functional Requirements)

### ⚡ NFR-1: Hiệu Năng & Tải Trang (Performance)
- Lazy Loading toàn bộ ảnh sản phẩm, Skeleton Shimmer Loader chống vỡ layout (CLS).

### 🎨 NFR-2: Giao Diện & Thẩm Mỹ (Design & Aesthetics)
- Tông màu chủ đạo hồng sen sang trọng (`#d81b60`), font Quicksand & Playfair Display mềm mại, quý phái.

### 🛡️ NFR-3: Bảo Mật & Phân Lập Dữ Liệu (Security & Data Isolation)
- Bảo vệ đa tầng: Frontend Route Guards + Backend Flask `@require_role` Decorators.

### 🏗️ NFR-4: Kiến Trúc Hệ Thống & Triển Khai (Architecture & Deployment)
- Frontend: HTML5, Tailwind CSS, Modular JS (`products.js`, `translations.js`, `i18n.js`, `utils.js`, `flower_app.js`).
- Backend: Python Flask RESTful API, đóng gói Docker trên Ubuntu Linux.
