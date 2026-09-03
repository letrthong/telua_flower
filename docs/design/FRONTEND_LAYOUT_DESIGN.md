# Thiết Kế Bố Cục Giao Diện Frontend (Frontend UI/UX Layout Architecture)
## Dự Án: Nở Hoa Thả Bình (`telua_flower`)

---

## 1. Tổng Quan Kiến Trúc Bố Cục (Layout Architecture Overview)

Hệ thống được thiết kế với **3 Bố cục giao diện (Layouts)** chuyên biệt, tối ưu theo từng đối tượng người dùng:

```mermaid
graph TD
    A[Hệ Thống Giao Diện telua_flower] --> B[1. Layout Khách Hàng - Storefront]
    A --> C[2. Layout Thợ Cắm Hoa & Staff - Mobile First]
    A --> D[3. Layout Quản Trị - Admin & Manager Dashboard]
    
    B --> E[Giao diện bán hoa, hẹn giờ, viết thiệp, VietQR]
    C --> F[Giao diện di động cho thợ cắm: nhận đơn, chụp ảnh hoa, in bill]
    D --> G[Dashboard 2 cột: Quản lý kho, CMS hoa, sửa giá, dịch 5 thứ tiếng]
```

---

## 2. Layout 1: Giao Diện Khách Hàng (Customer / Storefront Layout)

Tối ưu cho cả máy tính (Desktop) và điện thoại (Mobile) với phong cách thiết kế sang trọng (Màu hồng sen chủ đạo `#d81b60`, font Quicksand & Playfair Display).

### Sơ Đồ Bố Cục Giao Diện Khách Hàng:

```text
+-------------------------------------------------------------------------------+
| TOP PROMO BAR: "🔥 Mừng 20/10: Nhập PHUNU15 giảm 15% + Tặng thiệp thiết kế"    |
+-------------------------------------------------------------------------------+
| [LOGO NỞ HOA THẢ BÌNH] | [Search Bar...] | [🇻🇳 VI ▾] [📍 Tìm Shop] [🛒(2)] [👤 Login] |
+-------------------------------------------------------------------------------+
| [Trang Chủ] [Bó Hoa Tươi] [Lẵng Hoa] [Kệ Khai Trương] [Bình Cắm Hoa] [Khuyến Mãi] |
+-------------------------------------------------------------------------------+
| HERO BANNER SLIDER:                                                           |
| "Gửi Trọn Vẹn Cảm Xúc" - Giao hoa hỏa tốc 2H tại TP.HCM        [ Khám Phá Ngay ] |
+-------------------------------------------------------------------------------+
| DANH MỤC NHANH: (Bó Hoa) (Lẵng Hoa) (Kệ Hoa) (Lan Hồ Điệp) (Hoa Cưới) (Bình Hoa) |
+-------------------------------------------------------------------------------+
| SẢN PHẨM BÁN CHẠY (GRID CARDS 4 CỘT):                                         |
| +----------------+ +----------------+ +----------------+ +----------------+  |
| | [Ảnh Bó Hoa 1] | | [Ảnh Bó Hoa 2] | | [Ảnh Bó Hoa 3] | | [Ảnh Kệ Hoa 4] |  |
| | Mây Trắng (-7%)| | Ohara Pink(Hot)| | Tulip Lam Tinh | | Kệ Phát Lộc   |  |
| | 420k (🟢 Còn 10)| | 880k (🟢 Còn 8) | | 1.980k(🟠Còn 1)| | 2.500k(🟢Còn 5) |  |
| | [Thêm Giỏ Hàng]| | [Thêm Giỏ Hàng]| | [Thêm Giỏ Hàng]| | [Thêm Giỏ Hàng]|  |
| +----------------+ +----------------+ +----------------+ +----------------+  |
+-------------------------------------------------------------------------------+
| BANNER QUẢNG BÁ KHAI TRƯƠNG & SỰ KIỆN                                         |
+-------------------------------------------------------------------------------+
| CAM KẾT 4 TIÊU CHUẨN: (Giao 2H) (Hoa tươi mới) (Chụp ảnh trước) (Thanh toán linh hoạt)|
+-------------------------------------------------------------------------------+
| SHOWROOM LOCATOR: Thông tin 183/37 Đ. 3/2, Q.10 | [Bản Đồ Google Maps Nhúng]  |
| [📍 Chỉ Đường Đến Shop]   [📋 Sao Chép Địa Chỉ]                               |
+-------------------------------------------------------------------------------+
| FOOTER: Giới thiệu | Thông tin liên hệ | Chính sách đổi trả 60p | Đăng ký Email (-10%) |
+-------------------------------------------------------------------------------+
| FLOATING BUTTONS: [ 📞 Hotline Rung Chuông ]          [ 💬 Chat Zalo OA 24/7 ] |
+-------------------------------------------------------------------------------+
```

### 2.1 Kiến Trúc Trải Nghiệm Tìm Kiếm Trực Tiếp Đa Nền Tảng (Unified Live Search Dropdown on PC & Mobile):

- **Trên Máy Tính (Desktop Screen `md:` >= 768px)**:
  - Khi gõ tìm kiếm, bảng kết quả trực tiếp **(Desktop Live Search Dropdown - `#desktopLiveSearchResults`)** xuất hiện ngay dưới thanh tìm kiếm ở Header.
  - Hiển thị danh sách hoa tươi khớp từ khóa với ảnh thumbnail, tên hoa, giá bán VND, nhãn khuyến mãi và nút thêm vào giỏ hàng tức thì.
  - Tích hợp nút xem chi tiết nhanh và nút *"Xem toàn bộ kết quả dạng lưới bên dưới"* (tự động cuộn trang xuống `#search-results-section`).
  - Hỗ trợ đóng nhanh bằng phím ESC, nhấp ra ngoài hoặc bấm nút đóng.
- **Trên Điện Thoại (Mobile Screen `< 768px`)**:
  - Hiển thị bảng kết quả trực tiếp **(Mobile Live Search Dropdown - `#mobileLiveSearchResults`)** ngay dưới thanh tìm kiếm mobile, tránh việc bàn phím ảo che mất kết quả.
  - Trải nghiệm đồng bộ, nhanh chóng và mượt mà trên cả máy tính lẫn điện thoại di động.
### 2.2 Cơ Chế Xử Lý Lỗi Tải Sản Phẩm Quá Hạn (5-Second Load Timeout & Graceful Recovery):

- Khi người dùng truy cập trang chủ, hệ thống hiển thị Skeleton Loader và bắt đầu nạp danh mục/sản phẩm từ Backend API.
- **Quy tắc 5 giây (5000ms Timeout Policy)**:
  - Nếu sau 5 giây việc tải sản phẩm bị thất bại hoặc không thể kết nối tới máy chủ (`allStorefrontProducts` rỗng):
    - Tự động thay thế Skeleton bằng **Khối Thông Báo Lỗi Trang Chủ (Error Recovery State)** ngay tại `#dynamicCategorySections`.
    - Hiển thị thông điệp hướng dẫn rõ ràng: *"Không thể tải danh sách hoa tươi từ máy chủ. Vui lòng kiểm tra kết nối mạng."*
    - Cung cấp nút **"Thử lại ngay" (`Tải lại sản phẩm`)** để kích hoạt nạp lại dữ liệu mà không cần tải lại toàn bộ trang web.
    - Kích hoạt thông báo cảnh báo Toast đỏ để người dùng nhận biết ngay lập tức.


## 3. Layout 2: Cổng Thợ Cắm Hoa & Nhân Viên Chi Nhánh (`/portal/staff`)

Thiết kế **Mobile-First 100%** giúp thợ cắm hoa cầm điện thoại thao tác nhanh ngay tại bàn cắm hoa:

```text
+-------------------------------------------------------------+
| 🌸 NỞ HOA THẢ BÌNH - THỢ CẮM HOA | CN Quận 10 | [👤 Lan Lê]   |
+-------------------------------------------------------------+
| TABS: [📋 Đơn Cần Cắm (3)] [📷 Đã Chụp Ảnh (5)] [🚚 Đang Giao] |
+-------------------------------------------------------------+
| CARD ĐƠN HÀNG #NHTB_001 | Hẹn giao: 09:00 - 11:00 (Còn 45p)  |
| ----------------------------------------------------------- |
| Mẫu: Bó hoa Mây Trắng Bồng Bềnh (Level 1)                   |
| Thành phần: 10 Hồng trắng Ohara, Hoa sao xanh, Lá bạc       |
| Lời chúc: "Chúc em sinh nhật vui vẻ và luôn rạng ngời!"     |
| Ghi chú: Tòa Bitexco Tầng 12 - Gửi lễ tân                   |
| ----------------------------------------------------------- |
| [ 📷 CHỤP & UPLOAD ẢNH THẬT ]       [ 🖨️ IN PHIẾU GIAO K80 ] |
| [ 🟢 HOÀN TẤT CẮM HOA -> GỬI KHÁCH DUYỆT ]                  |
+-------------------------------------------------------------+
| CARD ĐƠN HÀNG #NHTB_002 | Hẹn giao: 13:00 - 15:00           |
| ...                                                         |
+-------------------------------------------------------------+
```

---

## 4. Layout 3: Bảng Quản Trị Admin & Quản Lý Chi Nhánh (`/portal/admin`)

Thiết kế **Dashboard 2 Cột Chuẩn (Responsive Sidebar + Main Content)**:

```text
+---------------------+---------------------------------------------------------+
| [🌸 Nở Hoa Thả Bình] | 🔍 [Tìm kiếm đơn/sản phẩm...] | [CN Q.10 ▾] [🔔(3)] [👤 Admin] |
| BẢNG QUẢN TRỊ       +---------------------------------------------------------+
|                     | KPI CARDS:                                              |
| 📊 Tổng Quan        | [Doanh Thu: 18.5M] [Đơn Trong Ngày: 24] [Sắp Hết: 2 Mẫu]|
| 🌸 Quản Lý Sản Phẩm +---------------------------------------------------------+
| 🏬 Quản Lý Chi Nhánh| KHÔNG GIAN LÀM VIỆC CHÍNH (DYNAMIC WORKSPACE):          |
| 📦 Ma Trận Tồn Kho  |                                                         |
| 🏷️ Khuyến Mãi (CMS) | - Màn hình Sửa Sản Phẩm & Phân Tầng Giá (Price Levels)  |
| 🌐 Biên Dịch 5 Thứ Tiếng| - Màn hình Ma Trận Tồn Kho Đa Chi Nhánh (🟢/🟠/🔴)       |
| 👥 Quản Lý Nhân Sự  | - Màn hình Quản Lý Khuyến Mãi (Công tắc Bật/Tắt ON/OFF)  |
| 👑 Khách Hàng CRM   | - Màn hình Biên Dịch Ma Trận 5 Ngôn Ngữ (Dynamic i18n)  |
| 🥀 Báo Cáo Hao Hụt  | - Màn hình Báo Cáo Hao Hụt & Phê Duyệt Chi Phí          |
|                     |                                                         |
| [🚪 Đăng Xuất]       |                                                         |
+---------------------+---------------------------------------------------------+
```

---

## 4b. Bảng Điều Khiển Đơn Hàng Nội Bộ (`#orderDashboardModal`)

Modal tổng quan đơn hàng **read-only** dành cho toàn bộ vai trò nội bộ (super_admin, branch_manager, florist, sales_consultant), mô phỏng Dashboard "Đơn Hàng Của Tôi" của khách hàng để mọi nhân sự nắm nhanh tình hình đơn.

- **Điểm vào:** Nút "📊 Bảng Điều Khiển Đơn Hàng" trong dropdown tài khoản (cả desktop `#userDropdownMenu` và mobile `#mobileAccountBtn`), hiển thị cho mọi vai trò nội bộ.
- **Phân quyền phạm vi dữ liệu:**
  - `super_admin`: Toàn chuỗi cửa hàng.
  - `branch_manager`: Đơn của chi nhánh mình (backend `query_admin_orders` tự ép theo `branchId`).
  - `florist` / `sales_consultant`: Đơn của chi nhánh mình (frontend truyền `branchId`).
- **Nguồn dữ liệu:** `GET /api/flower/v1/admin/orders?timeframe=all[&branchId=...]` → `data.orders`.
- **Nội dung:** 4 thẻ thống kê (Tổng đơn, Đang xử lý, Hoàn thành, Doanh thu) + danh sách đơn read-only kèm bộ lọc tháng, lọc trạng thái, ô tìm kiếm tức thì và **Dropdown Sắp xếp đa tiêu chí (`#dashSortSelect`)**:
  - *Mới cập nhật gần nhất* (`updatedAt_desc` - mặc định)
  - *Mới đặt nhất* (`createdAt_desc`)
  - *Giá trị cao nhất* (`totalAmount_desc`)
  - *Giá trị thấp nhất* (`totalAmount_asc`)
- Mỗi thẻ đơn hàng hiển thị huy hiệu thời điểm cập nhật mới nhất (`<i class="fa-solid fa-clock-rotate-left"></i> Cập nhật: ...`), giúp nhân viên theo dõi sát sao đơn vừa có biến động.
- **Module:** `js/order_dashboard.js` (bundled sau `staff_portal.js`).

```text
+-------------------------------------------------------------+
| 📈 BẢNG ĐIỀU KHIỂN ĐƠN HÀNG   Phạm vi: Toàn chuỗi   [↻] [✕] |
+-------------------------------------------------------------+
| [Tổng đơn: 128] [Đang xử lý: 12] [Hoàn thành: 110] [DT: 82M]|
| [Lọc tháng ▾] [Sắp xếp: Mới cập nhật ▾] [Trạng thái ▾] [🔍] |
+-------------------------------------------------------------+
| #NHTB_128 | 12/06 | CN Q.10   [Đang cắm hoa] [Đã thanh toán]|
|  👤 Trần Hoa · Bó Mây Trắng x1               1.250.000₫     |
|  🕒 Cập nhật: 10:15 02/09                                    |
+-------------------------------------------------------------+
| #NHTB_127 | 12/06 | CN Q.1    [Giao thành công] [Đã TT]     |
|  👤 Lê An · Giỏ Tulip x2 +1 món khác          2.400.000₫    |
|  🕒 Cập nhật: 09:30 02/09                                    |
+-------------------------------------------------------------+
```

---

## 4c. Modal Chi Tiết Đơn Hàng & Thanh Tiến Trình 5 Bước (`#orderDetailModal`)

Dùng chung cho Khách Hàng (Customer Portal), Nhân Viên (Staff Portal), Quản Lý và Dashboard:

- **Thanh Tiến Trình Trực Quan (`#ordDetailProgressCard`):**
  - Thanh phần trăm tổng quan (e.g. `20%`, `40%`, `60%`, `80%`, `100% Hoàn Tất`).
  - Lưới 5 bước theo luồng `delivery` hoặc `pickup`.
  - **3 Trạng thái bước rõ rệt:**
    - `Hoàn thành`: Vòng tròn xanh ngọc kèm tích check `fa-check` và ngày giờ hoàn tất trích xuất từ `order.history`.
    - `Đang xử lý`: Vòng tròn viền phát sáng (Pulse ring) và ngày giờ cập nhật mới nhất.
    - `Chưa tới`: Vòng tròn số nét đứt xám (`Chưa tới`) hiển thị các bước tiếp theo để khách hàng và nhân viên biết còn bao nhiêu bước nữa.
- **Thanh tác vụ nghiệp vụ nội bộ (`#ordDetailStaffActions`):** Chỉ hiển thị cho nhân viên chi nhánh để Upload ảnh hoa, Thu tiền mặt (COD), và Chuyển nhanh trạng thái.

---

## 5. Bảng Màu Sắc & Typography Quy Chuẩn (Design Tokens)

- **Màu sắc chủ đạo:**
  - `primary`: `#d81b60` (Hồng cánh sen sang trọng - Màu nhận diện thương hiệu).
  - `primaryHover`: `#ad1457` (Hồng đậm khi hover).
  - `accent`: `#ff4081` (Hồng phấn tươi trẻ làm điểm nhấn).
  - `light`: `#fdfbfb` (Trắng ngọc trai nền trang nhã).
  - `dark`: `#222222` (Xám đen chữ thanh lịch).
  - `statusGreen`: `#10b981` (Đèn xanh tồn kho còn nhiều 🟢).
  - `statusOrange`: `#f59e0b` (Đèn cam tồn kho sắp hết 🟠).
  - `statusRed`: `#ef4444` (Đèn đỏ hết hàng 🔴).
- **Typography:**
  - Tiêu đề & Tên thương hiệu: **Playfair Display** (Serif quý phái, thanh lịch).
  - Nội dung & Bảng điều khiển: **Quicksand** kết hợp **Noto Sans đa ngữ** (Việt, Anh, Nhật, Hàn, Trung mềm mại, dễ đọc).
