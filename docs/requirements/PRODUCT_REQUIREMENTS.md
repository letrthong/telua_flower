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

1. **Thương mại điện tử tinh gọn & Trải nghiệm quà tặng hoàn hảo:** Cung cấp trải nghiệm chọn mẫu hoa, hẹn giờ giao, viết thiệp/in banner và đặt mua online nhanh chóng trên cả điện thoại di động và máy tính.
2. **Tiếp cận khách hàng quốc tế & Kiều bào:** Hệ thống 5 ngôn ngữ kết hợp cổng thanh toán quốc tế và chuyển khoản tự động (VietQR, Visa/Mastercard) giúp khách nước ngoài dễ dàng đặt hoa tặng đối tác tại Việt Nam.
3. **Quản trị vận hành chuỗi chi nhánh:** Hỗ trợ phân quyền đăng nhập đa cấp để quản lý khách hàng (CRM), phân ca nhân sự, quản lý tồn kho theo ngày và báo cáo hao hụt hoa tươi.
4. **Chuyển đổi khách hàng đa kênh:** Kết nối tức thì khách hàng với tư vấn viên qua Hotline, Zalo OA và các kênh trực tiếp tại chi nhánh.

---

## 3. Đối Tượng Người Dùng & Phân Quyền (User Roles & Personas)

| Vai trò (Role) | Mô tả & Trách nhiệm | Chức năng chính được cấp quyền |
| :--- | :--- | :--- |
| **Khách hàng (Customer)** | Người mua hoa cá nhân, doanh nghiệp B2B, khách quốc tế | Đặt hoa, chọn ngày giờ giao, viết thiệp, thanh toán online, quản lý đơn hàng, tích điểm |
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
- **Chọn ngày giao hàng (Date Picker):** Cho phép khách đặt trước hoa tối đa 30 ngày (sinh nhật, khai trương, 14/2, 8/3, 20/10...).
- **Chọn khung giờ giao hàng (Time Slots):**
  - Khung giờ tiêu chuẩn: `07:00 - 09:00`, `09:00 - 11:00`, `11:00 - 13:00`, `13:00 - 15:00`, `15:00 - 17:00`, `17:00 - 19:00`, `19:00 - 21:00`.
  - Tùy chọn **"Giao Hỏa Tốc trong 2H"** (Áp dụng cho các đơn cần gấp trong ngày).
- **Hạn mức khung giờ (Slot Capacity):** Giới hạn tối đa số đơn cắm hoa trong mỗi khung giờ để đảm bảo chất lượng cắm hoa và giao đúng giờ.

---

### 💌 FR-8: Cá Nhân Hóa Thiệp Chúc Mừng & In Băng Rôn (Custom Card, Banner & Sender Options)
- **Nhập nội dung Thiệp chúc mừng:** Khách nhập lời chúc để nhân viên in/viết tay lên thiệp cao cấp tặng kèm.
- **Nhập nội dung Băng rôn / Ribbon:** Dành cho Kệ hoa chúc mừng, khai trương (VD: *"Công ty CP Công Nghệ ABC Kính Chúc Khai Trương Hồng Phát"*).
- **Phân tách thông tin Người Tặng & Người Nhận:**
  - Tùy chọn 1: *Tôi là người nhận hoa* (tự động điền thông tin).
  - Tùy chọn 2: *Gửi tặng người khác* (Nhập riêng họ tên, SĐT, địa chỉ người nhận và thông tin người tặng để gửi hóa đơn).
- **Tùy chọn "Gửi hoa ẩn danh (Bí mật người gửi)":** Người giao hoa không tiết lộ danh tính người đặt khi trao hoa, tạo bất ngờ cho người nhận.

---

### 💳 FR-9: Cổng Thanh Toán Trực Tuyến Tự Động (Payment Gateway Integration)
- **Thanh toán chuyển khoản tự động (VietQR):**
  - Sinh mã QR động chứa đúng Số tiền và Mã đơn hàng.
  - Web tự động xác nhận đơn sau khi khách chuyển khoản thành công (trong 5 giây).
- **Thanh toán Thẻ Quốc Tế (Visa / MasterCard / JCB):** Dành cho khách du lịch và kiều bào ở nước ngoài gửi hoa về Việt Nam.
- **Thanh toán Ví Điện Tử (MoMo / ZaloPay).**
- **Thanh toán tiền mặt khi nhận hoa (COD):** Chỉ áp dụng cho đơn mà Người đặt chính là Người nhận.

---

### 🔐 FR-10: Cổng Đăng Nhập Đơn Nhất & Phân Quyền Động (Single Login & RBAC)
- **Cổng đăng nhập duy nhất:** Tất cả người dùng đăng nhập tại cùng một điểm truy cập bằng SĐT/Email + Mật khẩu.
- **Tự động nhận diện Role & Điều hướng:**
  - `customer` $\rightarrow$ Trang chủ / Hồ sơ cá nhân `/account`
  - `florist` $\rightarrow$ Cổng thợ cắm hoa `/portal/staff`
  - `sales_consultant` $\rightarrow$ Cổng tiếp nhận đơn `/portal/sales`
  - `branch_manager` $\rightarrow$ Dashboard chi nhánh `/portal/branch-manager`
  - `super_admin` $\rightarrow$ Bảng quản trị toàn hệ thống `/portal/admin`
- **Bảo mật JWT Token:** Token mã hóa chứa `userId`, `role`, `branchId` và thời gian hết hạn `exp`.

---

### 👥 FR-11: Quản Lý Khách Hàng - CRM & Hạng Thành Viên
- Quản lý hồ sơ, ngày sinh nhật (tự động gửi mã giảm giá hoa sinh nhật), sổ nhiều địa chỉ nhận hàng.
- Phân nhóm khách (Khách lẻ, VIP, Doanh nghiệp B2B xuất hóa đơn VAT).
- Tích điểm đổi quà: Hạng Bạc (Silver), Vàng (Gold), Kim Cương (Diamond).

---

### 👔 FR-12: Quản Lý Nhân Viên & Quy Trình Cắm Hoa Thực Tế
- Quản lý nhân sự theo chi nhánh, phân ca làm việc, đánh giá KPI.
- **Quy trình cắm hoa chuẩn:** *Nhận đơn $\rightarrow$ Thợ cắm hoa $\rightarrow$ **Chụp ảnh thật hoa gửi khách duyệt qua Web/Zalo** $\rightarrow$ Shipper giao hàng $\rightarrow$ Ký nhận*.

---

### 🏬 FR-13: Quản Lý Chuỗi Chi Nhánh & Điều Phối Đơn Hàng Thông Minh
- Quản lý danh sách chi nhánh kèm tọa độ GPS (phục vụ tự động gán đơn cho chi nhánh gần người nhận nhất).
- Thiết lập bán kính giao hàng 2H cho từng chi nhánh.
- Tự động điều phối đơn sang chi nhánh lân cận nếu chi nhánh gần nhất hết hàng.

---

### 🥀 FR-14: Quản Lý Hao Hụt & Báo Cáo Hủy Hoa Tươi Cuối Ngày (Spoilage & Wastage)
- Quản lý chi nhánh nhập phiếu kiểm kê cành hoa bị dập hỏng/héo cuối mỗi ca làm việc.
- Thống kê tỷ lệ hao hụt theo từng loại hoa (Hoa hồng, tulip, lily...) để tối ưu hóa kế hoạch nhập hàng ngày hôm sau.
- Tự động trừ chi phí hao hụt vào báo cáo tài chính chi nhánh.

---

## 5. Yêu Cầu Phi Chức Năng (Non-Functional Requirements)

### ⚡ NFR-1: Hiệu Năng & Tải Trang (Performance)
- Lazy Loading toàn bộ ảnh sản phẩm, Skeleton Shimmer Loader chống vỡ layout (CLS).
- Tốc độ tải trang dưới 1.5 giây.

### 🎨 NFR-2: Giao Diện & Thẩm Mỹ (Design & Aesthetics)
- Tông màu chủ đạo hồng sen sang trọng (`#d81b60`), font Quicksand & Playfair Display mềm mại, quý phái.
- Responsive 100% trên Mobile, Tablet, Desktop.

### 🛡️ NFR-3: Bảo Mật & Phân Lập Dữ Liệu (Security & Data Isolation)
- Bảo vệ đa tầng: Frontend Route Guards + Backend Flask `@require_role` Decorators.
- Phân lập dữ liệu: Quản lý và nhân viên chi nhánh chỉ xem và xử lý dữ liệu thuộc chi nhánh mình.

### 🏗️ NFR-4: Kiến Trúc Hệ Thống & Triển Khai (Architecture & Deployment)
- Frontend: HTML5, Tailwind CSS, Modular JS (`products.js`, `translations.js`, `i18n.js`, `utils.js`, `flower_app.js`).
- Backend: Python Flask RESTful API.
- Triển khai: Đóng gói Docker hoàn chỉnh, quản lý bằng `cli_docker.sh` trên Ubuntu Linux.
