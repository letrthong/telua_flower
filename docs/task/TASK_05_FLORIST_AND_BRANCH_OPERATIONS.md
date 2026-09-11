# Task 05: Cổng Thợ Cắm Hoa, Upload Ảnh Thật & In Phiếu Giao K80
## Mã Task: `TASK_05_FLORIST_AND_BRANCH_OPERATIONS`

---

## 1. Mục Tiêu (Objective)
Xây dựng không gian làm việc chuyên biệt dành cho Thợ cắm hoa, Nhân viên tư vấn, Giao hàng và Quản lý chi nhánh thông qua **Dialog độc lập "Công Việc Của Tôi (Bàn Làm Việc Ca Trực)" (`#staffPortalModal`)** với chiều cao tối đa (`h-[96vh] sm:h-[98vh] max-w-6xl`):
- **An Toàn Đơn Hàng & Xác Thực Vị Trí Cửa Hàng (Store Location Guard):**
  - **Trừ Super Admin:** Không có vị trí cửa hàng cố định (`role == 'super_admin'`), được phép xem toàn chuỗi hoặc bất kỳ chi nhánh nào (`branchId == 'all'`, `admin`, hoặc mã showroom cụ thể).
  - **Nhân viên cửa hàng (`branch_manager`, `florist`, `sales_consultant`, `shipper`):** Bắt buộc phải có `branchId` hợp lệ được phân bổ. Hệ thống chặn tuyệt đối (HTTP 403) nếu cố tình truy xuất dữ liệu của chi nhánh khác hoặc không có vị trí cửa hàng.
- **Phân Bổ & Trả Về Đúng Công Việc Tại Backend (Least Privilege Task Routing):**
  - Backend kiểm tra người gọi API (`request.current_user`) để lọc chính xác các công việc:
    - **Thợ cắm hoa (`florist`):** Chỉ trả về các đơn **cắm hoa nghệ thuật** (`requiresArranging != False`), trạng thái nằm trong quy trình cắm (`confirmed`, `arranging`, `photo_sent`), ẩn hoàn toàn đơn hoa đóng gói sẵn Fast-track và đơn đã giao xong.
    - **Tư vấn / Thu ngân (`sales_consultant`):** Chỉ trả về đơn mới cần gọi điện xác nhận (`pending`) hoặc đơn chưa thanh toán tiền mặt cần thu tiền (`unpaid`).
    - **Giao hàng (`shipper`):** Chỉ trả về đơn giao tận nơi (`fulfillmentType == 'delivery'`) sẵn sàng giao hoặc đang giao.
    - **Quản lý chi nhánh (`branch_manager`):** Xem toàn bộ đơn trong chi nhánh phụ trách để điều phối, phân công (`assignedTo`).
- Cập nhật trạng thái tiến độ đơn (*Chờ xác nhận $\rightarrow$ Đang cắm $\rightarrow$ Bàn giao vận chuyển / Nhận tại quầy*).
- **Chụp ảnh hoa thực tế tải lên gửi khách duyệt trước khi giao** (đối với hoa cắm nghệ thuật).
- Bấm **In phiếu giao hàng nhiệt K80 / A5** dán lên bó hoa với đầy đủ địa chỉ, ghi chú cắm hoa và lời chúc thiệp.

---

## 2. Tài Liệu Tham Khảo (References)
- 📐 [docs/design/ORDER_SYSTEM_ANALYSIS_DESIGN.md](file:///d:/wmshare/telua_flower/docs/design/ORDER_SYSTEM_ANALYSIS_DESIGN.md)
- 🎨 [docs/design/FRONTEND_LAYOUT_DESIGN.md](file:///d:/wmshare/telua_flower/docs/design/FRONTEND_LAYOUT_DESIGN.md)
- 📋 [docs/design/OPERATIONAL_EXTENSIONS_DESIGN.md](file:///d:/wmshare/telua_flower/docs/design/OPERATIONAL_EXTENSIONS_DESIGN.md)
- 🔐 [docs/design/AUTHENTICATION_DESIGN.md](file:///d:/wmshare/telua_flower/docs/design/AUTHENTICATION_DESIGN.md)

---

## 3. Danh Sách File Cần Tạo / Sửa

### Frontend Giao Diện (SPA Architecture):
1. [`index.html`](file:///d:/wmshare/telua_flower/index.html) & [`config/index.html`](file:///d:/wmshare/telua_flower/config/index.html):
   - **Dialog độc lập `#staffPortalModal` ("Công Việc Của Tôi"):** Chiều cao tối đa `h-[96vh] max-h-[96vh] sm:h-[98vh] sm:max-h-[98vh] max-w-6xl flex-col`, tách biệt hoàn toàn với CMS Admin (`#adminPortalModal`) và Quản Lý Người Dùng (`#userManagementModal`).
   - Danh sách đơn trong ca trực (`#staffOrdersList`), bộ lọc trạng thái và tìm kiếm nhanh.
   - Nút **"In Phiếu Giao Hàng K80"** (cửa sổ in nhiệt chứa thông tin người nhận, ghi chú cắm hoa, thiệp mừng).
   - Checkbox **"Hỗ trợ cắm hoa nghệ thuật (+50% phí)"** (`#checkoutRequestArranging`) & ô ghi chú `#checkoutArrangingNotes` trong Modal Đặt Hàng (`#checkoutModal`).
2. [`js/staff_portal.js`](file:///d:/wmshare/telua_flower/js/staff_portal.js):
   - Logic điều khiển modal: `openStaffPortalModal()`, `closeStaffPortalModal()`, `loadStaffOrders()`, `updateStaffOrderStatus()`.
   - Phân quyền động cho các vai trò nội bộ: `florist`, `sales_consultant`, `shipper`, `branch_manager`, `super_admin`.
   - Kiểm tra an toàn vị trí cửa hàng: bắt buộc người dùng có `branchId`, không fallback ngẫu nhiên.
3. [`js/checkout.js`](file:///d:/wmshare/telua_flower/js/checkout.js):
   - Logic `toggleRequestArranging()`: Bật/tắt ô nhập ghi chú và tính toán `arrangingFee = subtotal * 0.5`.
   - Gửi các trường `requestArranging`, `arrangingFee`, `arrangingNotes`, `requiresArranging` trong payload tạo đơn.
4. [`js/config_layout.js`](file:///d:/wmshare/telua_flower/js/config_layout.js) & [`js/auth.js`](file:///d:/wmshare/telua_flower/js/auth.js):
   - Nút *"Công Việc Của Tôi"* ở vị trí số 1 trong Menu tài khoản Desktop & Mobile drawer.
   - Hàm `openMyWorkspace()` gọi trực tiếp `openStaffPortalModal()`.
5. [`js/bundle.js`](file:///d:/wmshare/telua_flower/js/bundle.js) & [`scripts/build_bundle.py`](file:///d:/wmshare/telua_flower/scripts/build_bundle.py):
   - Đóng gói toàn bộ module JS vào gói duy nhất, đảm bảo tính toàn vẹn window bindings.

### Backend Python Flask:
1. [`src/auth_decorator.py`](file:///d:/wmshare/telua_flower/src/auth_decorator.py):
   - Hàm `can_access_branch(user, branch_id)`: Super Admin không giới hạn vị trí; nhân viên khác bắt buộc kiểm tra `user.branchId == branch_id`.
2. [`src/restful_blueprint_flower_connect.py`](file:///d:/wmshare/telua_flower/src/restful_blueprint_flower_connect.py):
   - `GET /api/flower/v1/branch/<branch_id>/orders`: Xác thực vị trí cửa hàng và lọc công việc đúng vai trò.
   - `GET /api/flower/v1/admin/orders`: Khóa cứng `branch_id` về chi nhánh của nhân viên nếu không phải super_admin.
   - `PUT /api/flower/v1/admin/orders/<order_id>/status`: Cập nhật trạng thái tiến độ đơn hàng (có kiểm tra chi nhánh).
   - `POST /api/flower/v1/orders/<order_id>/photo`: Upload ảnh hoa thực tế sau khi cắm.
3. [`src/order_service.py`](file:///d:/wmshare/telua_flower/src/order_service.py):
   - Hàm `filter_tasks_for_staff(orders, current_user, mode)`: Lọc công việc theo đặc quyền tối thiểu.
   - Hàm `query_admin_orders(...)`: Phân quyền chi nhánh nghiêm ngặt cho báo cáo.
   - Tự động tính toán `arrangingFee = round(subtotal * 0.5)` khi `requestArranging = True`.
4. [`src/flower_image.py`](file:///d:/wmshare/telua_flower/src/flower_image.py):
   - Tự động xử lý, lưu trữ ảnh tĩnh và nén ảnh WebP.

### Unit Test:
- [`src/unittest/test_order_service.py`](file:///d:/wmshare/telua_flower/src/unittest/test_order_service.py): Kiểm thử tính toán phụ phí cắm hoa 50% - **PASS**.
- [`src/unittest/test_staff_portal_and_dispatch.py`](file:///d:/wmshare/telua_flower/src/unittest/test_staff_portal_and_dispatch.py): Kiểm thử an toàn vị trí cửa hàng, điều phối Super Admin và phân bổ công việc theo vai trò - **PASS**.
- [`src/unittest/test_staff_and_branch_management.py`](file:///d:/wmshare/telua_flower/src/unittest/test_staff_and_branch_management.py): Kiểm thử phân quyền chi nhánh - **PASS**.

---

## 4. Tiêu Chuẩn Nghiệm Thu (Acceptance Criteria)
- [x] Khách hàng có checkbox tùy chọn "Hỗ trợ cắm hoa nghệ thuật" trong modal Checkout. Khi chọn sẽ hiển thị ghi chú cắm hoa và tính phí thêm 50% tiền hàng.
- [x] Đơn hàng lưu đầy đủ `requiresArranging`, `arrangingFee`, `arrangingNotes` trong cơ sở dữ liệu `financials` & `customization`.
- [x] Backend kiểm tra an toàn vị trí cửa hàng: Trừ Super Admin không có vị trí cửa hàng cố định, tất cả nhân viên khác chỉ được thao tác trên chi nhánh của mình.
- [x] Backend lọc và trả về đúng danh sách công việc theo vai trò: Thợ cắm hoa chỉ nhận đơn cần cắm nghệ thuật; thu ngân nhận đơn mới/chưa thu tiền; shipper nhận đơn giao hàng.
- [x] Dialog "Công Việc Của Tôi" (`#staffPortalModal`) hoạt động độc lập với chiều cao tối đa `h-[96vh] sm:h-[98vh]`, hỗ trợ các vai trò nội bộ (`florist`, `sales`, `manager`, `admin`).
- [ ] Tải được ảnh chụp hoa thật lên đơn hàng, hệ thống nén WebP dưới 150KB.
- [ ] Bấm in phiếu giao hàng K80 hiển thị đúng đầy đủ thông tin người nhận, ghi chú chỉ dẫn địa chỉ và lời chúc thiệp.
