# DANH SÁCH TÀI KHOẢN THỬ NGHIỆM & MA TRẬN PHÂN QUYỀN (TEST ACCOUNTS & CREDENTIALS)

> **MÃ TÀI LIỆU:** DOC-AUTH-TEST-01  
> **ÁP DỤNG CHO:** Toàn bộ hệ thống `telua_flower`  
> **MẬT KHẨU MẶC ĐỊNH CHO TẤT CẢ TÀI KHOẢN TEST:** `123456`

---

## 1. BẢNG THÔNG TIN TÀI KHOẢN THỬ NGHIỆM 5 NHÓM VAI TRÒ

| STT | Vai Trò (Role) | Tên Người Dùng | Số Điện Thoại / Email | Mật Khẩu | Chi Nhánh Áp Dụng | Phân Vùng Quyền Hạn Truy Cập |
| :---: | :--- | :--- | :--- | :---: | :--- | :--- |
| **1** | 👑 **Super Admin** | Tổng Quản Trị Hệ Thống | `admin@nohoathabinh.vn`<br>*(hoặc `0900000000`)* | `123456` | Toàn chuỗi (Global) | **Toàn quyền hệ thống**: Quản lý tất cả chi nhánh, nhân sự các cấp, phân tầng giá, duyệt voucher khuyến mãi, báo cáo doanh thu & hoa hỏng. |
| **2** | 🏬 **Quản Lý Chi Nhánh** *(Branch Manager)* | Trần Thị Mai | `0909123456`<br>*(hoặc `mai.tran@nohoathabinh.vn`)* | `123456` | Showroom Q.10 (`branch_q10`) | **Quản trị chi nhánh**: Xem và điều phối đơn hàng thuộc Showroom Q.10, quản lý nhân viên Thợ cắm/Sales thuộc chi nhánh của mình, nhập kho & lập biên bản hoa hỏng. |
| **3** | 🌸 **Thợ Cắm Hoa** *(Florist)* | Lê Thu Hương | `0909654321`<br>*(hoặc `huong.le@nohoathabinh.vn`)* | `123456` | Showroom Q.10 (`branch_q10`) | **Cổng Thợ Cắm Hoa Mobile-First (`/portal/staff`)**: Nhận đơn cắm hoa theo khung giờ, xem mẫu cắm & thiệp chúc, chụp & tải ảnh thực tế trước giao, in phiếu giao K80/A5. |
| **4** | 💼 **Tư Vấn Bán Hàng** *(Sales Consultant)* | Hoàng Văn Nam | `0909777888`<br>*(hoặc `nam.hoang@nohoathabinh.vn`)* | `123456` | Showroom Q.10 (`branch_q10`) | **Bán hàng & CSKH**: Tiếp nhận đơn hàng, hỗ trợ tư vấn chọn hoa, kiểm tra tồn kho hoa tươi theo chi nhánh, tạo đơn nhanh cho khách tại quầy. |
| **5** | ✨ **Khách Hàng Thân Thiết** *(Customer)* | Nguyễn Văn A | `0987654321`<br>*(hoặc `khachhang.a@gmail.com`)* | `123456` | Khách hàng vãng lai / VIP | **Giao diện Khách hàng (Storefront)**: Đặt hoa online hẹn giờ, chọn hoa ẩn danh, sử dụng mã giảm giá, theo dõi trạng thái đơn hàng và điểm tích lũy thành viên. |

---

## 2. THÔNG TIN BỔ SUNG CÁC CHI NHÁNH KHÁC

Hệ thống có sẵn các tài khoản quản lý và thợ cắm hoa cho các showroom khác trong chuỗi:

| Vai Trò | Tên Nhân Sự | Số Điện Thoại / Email | Mật Khẩu | Chi Nhánh |
| :--- | :--- | :--- | :---: | :--- |
| **Quản Lý Showroom Q.1** | Nguyễn Văn Bình | `0909111222` / `binh.nguyen@nohoathabinh.vn` | `123456` | Showroom Quận 1 (`branch_q1`) |
| **Thợ Cắm Hoa Q.1** | Phạm Thị Cúc | `0909333444` / `cuc.pham@nohoathabinh.vn` | `123456` | Showroom Quận 1 (`branch_q1`) |
| **Quản Lý Showroom Bình Thạnh** | Đỗ Minh Tuấn | `0909555666` / `tuan.do@nohoathabinh.vn` | `123456` | Showroom Bình Thạnh (`branch_binhthanh`) |

---

## 3. HƯỚNG DẪN ĐĂNG NHẬP VÀO HỆ THỐNG

1. Trên thanh tiêu đề (Header), nhấp vào biểu tượng **👤 Tài khoản** để mở cửa sổ Đăng Nhập.
2. Nhập **Số điện thoại** hoặc **Email** tương ứng từ bảng trên.
3. Nhập mật khẩu: `123456`.
4. Nhấn nút **Đăng Nhập**:
   - Tài khoản `super_admin`, `branch_manager`, `sales_consultant` $\rightarrow$ Hệ thống tự động chuyển sang trang **Dashboard Quản Trị**.
   - Tài khoản `florist` $\rightarrow$ Hệ thống tự động chuyển sang cổng **Thợ Cắm Hoa Mobile-First**.
   - Tài khoản `customer` $\rightarrow$ Đăng nhập thành công và giữ tại giao diện **Storefront** với thông tin thành viên hiển thị trên Header.
