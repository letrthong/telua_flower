# Task 06: Quản Lý Tồn Kho Theo Ngày, Ma Trận 🟢/🟠/🔴, Báo Hủy & Điều Phối Đơn Đa Chi Nhánh
## Mã Task: `TASK_06_INVENTORY_AND_MULTI_BRANCH_ROUTING`

---

## 1. Mục Tiêu (Objective)
1. **Khắc phục lỗi hardcode danh sách chi nhánh và số lượng cố định** trong Modal "Thêm Mẫu Hoa Mới Vào Catalogue" (`#productModal`), thay bằng container động lấy trực tiếp từ `branches.json`.
2. **Xây dựng phân hệ quản lý vòng đời tồn kho hoa tươi theo 4 chỉ số thời gian thực**:
   $$\text{Tồn khả dụng (Available)} = \text{Hàng nhập (Daily Quota)} - \text{Đã bán (Sold)} - \text{Hao hụt (Wastage)}$$
3. **Phát triển Tab Quản Trị Kho & Hao Hụt trên Admin Portal (`/portal/admin`)**:
   - Bảng Ma trận tồn kho thời gian thực đa chi nhánh (Live Inventory Matrix 🟢 Còn nhiều, 🟠 Sắp hết, 🔴 Hết hàng).
   - Ô nhập nhanh hạn mức hàng bán hôm nay hàng loạt (**Batch Quick Stock Update**).
   - Phân hệ Báo hủy hoa hỏng cuối ca (lưu trữ `wastage_reports.json`), tự động trừ kho thành phẩm hoặc ghi nhận thất thoát vốn nguyên liệu cành.
4. **Phân quyền vai trò (RBAC)**: Super Admin quản lý toàn chuỗi; Quản lý chi nhánh chỉ được sửa kho của chi nhánh mình phụ trách (`user.branchId`); Thợ cắm hoa được tạo phiếu báo hủy hoa hỏng.
5. **Thuật toán tự động điều phối đơn hàng thông minh (Smart Order Routing)**: Tự động trừ kho khi có đơn, gán đơn cho chi nhánh gần khách nhất còn hàng.

---

## 2. Tài Liệu Tham Khảo (References)
- 📐 [docs/design/INVENTORY_AND_WASTAGE_LIFECYCLE_DESIGN.md](file:///d:/wmshare/telua_flower/docs/design/INVENTORY_AND_WASTAGE_LIFECYCLE_DESIGN.md) *(Thiết kế kỹ thuật cốt lõi: Vòng đời Nhập - Bán - Tồn - Hủy, RBAC & Động hóa chi nhánh Catalogue)*
- 📐 [docs/design/INVENTORY_MANAGEMENT_DESIGN.md](file:///d:/wmshare/telua_flower/docs/design/INVENTORY_MANAGEMENT_DESIGN.md)
- 📐 [docs/design/MULTI_BRANCH_INVENTORY_TRACKING.md](file:///d:/wmshare/telua_flower/docs/design/MULTI_BRANCH_INVENTORY_TRACKING.md)

---

## 3. Danh Sách File Cần Tạo / Sửa

### Frontend Giao Diện (SPA Architecture):
1. `index.html` & `config/index.html`:
   - Xóa bỏ khối HTML hardcode `prodStockQ10`, `prodStockQ1`, `prodStockTD` trong `#productModal`, thay bằng container động `#productStockByBranchDynamicContainer`.
   - Thêm nút chuyển Tab `Kho & Hao Hụt` (`tabBtnInventory`) trên thanh tab Admin.
   - Thêm màn hình `viewInventory` chứa: 5 thẻ KPI thống kê tổng quan, Bảng ma trận tồn kho toàn chuỗi (Live Inventory Matrix kèm ô nhập batch), và Phân hệ Báo hủy hoa hỏng.
   - Thêm Modal Báo Hủy Hoa Hỏng Cuối Ca (`#wastageModal`).
   - Cập nhật thẻ sản phẩm Storefront hiển thị đèn tín hiệu 🟢/🟠/🔴 hoặc nhãn "Hết hàng hôm nay" theo showroom khách đang chọn.
2. Tái cấu trúc Module Quản Trị Admin (`js/portal_admin_*.js`):
   - `js/portal_admin_products.js`:
     - Hàm `renderProductModalStockFields()`: Render động các ô nhập tồn kho theo từng chi nhánh hoạt động (`isActive: true` từ `branches.json`).
     - Cập nhật `handleProductSubmit()`: Quét và thu thập `stockByBranch: { [b.id]: stockVal }` động.
   - `js/portal_admin_inventory.js`:
     - Hàm `renderAdminInventoryTab()`: Tải và hiển thị Ma trận kho, tính toán 4 chỉ số (Nhập, Bán, Tồn, Hủy).
     - Hàm `handleSaveBatchInventory()`: Gửi request lưu hạn mức tồn kho hàng loạt.
     - Hàm `handleWastageSubmit()`: Xử lý tạo phiếu báo hủy hoa hỏng, trừ kho và tải lại bảng báo cáo.
     - Áp dụng kiểm tra phân quyền RBAC: Quản lý chi nhánh chỉ được sửa kho của chi nhánh mình (`user.branchId`).
   - `js/portal_admin.js`: Bộ điều phối trung tâm (Shell Orchestrator) quản lý chuyển tab, mở modal và re-export ra `window.*`.
3. `scripts/build_bundle.py`: Tích hợp 10 sub-modules theo thứ tự phụ thuộc, đóng gói thành công `js/bundle.js`.

### Backend Python Flask:
1. `src/inventory_service.py` (Mới):
   - Hàm `get_inventory_matrix()`: Tính toán ma trận tồn kho toàn chuỗi thời gian thực (tổng hợp từ `products.json`, `orders/`, `wastage_reports.json` trong ngày hiện tại GMT+7).
   - Hàm `update_batch_inventory(updates, user_branch_id, is_super_admin)`: Cập nhật hạn mức tồn kho hàng loạt có kiểm tra quyền chi nhánh.
   - Hàm `create_wastage_report(data, reporter_id)`: Lưu phiếu báo hủy hoa hỏng vào `wastage_reports.json` và tự động trừ kho khả dụng của sản phẩm (nếu là thành phẩm).
   - Hàm `get_wastage_reports(branch_id, limit)`: Lấy danh sách lịch sử phiếu báo hủy.
   - Hàm `deduct_order_stock(order)`: Trừ kho tự động khi đơn hàng mới được tạo hoặc duyệt cắm hoa.
   - Hàm `find_best_routing_branch(customer_lat, customer_lng, district, product_quantities)`: Thuật toán điều phối đơn hàng sang chi nhánh gần nhất còn hàng.
2. `src/restful_blueprint_flower_connect.py`:
   - Đăng ký các endpoints:
     - `GET /admin/inventory/matrix`
     - `PUT /admin/inventory/batch`
     - `GET /admin/inventory/wastage`
     - `POST /admin/inventory/wastage`
     - `GET /products/<product_id>/stock`
3. `src/order_service.py`: Tích hợp hook trừ kho tự động khi tạo đơn hàng.

### Unit Test:
- `src/unittest/test_inventory_service.py`: Kiểm thử toàn diện:
  - Động hóa chi nhánh trong sản phẩm không bị giới hạn 3 kho.
  - Tính toán chính xác ma trận tồn kho 4 chỉ số (Nhập, Bán, Tồn, Hủy).
  - Tự động trừ kho khi bán hàng và khi lập phiếu báo hủy hoa thành phẩm.
  - Kiểm tra hàng rào phân quyền RBAC (quản lý chi nhánh không sửa được chi nhánh khác).
  - Thuật toán điều phối đơn hàng sang chi nhánh gần nhất còn hàng.

---

## 4. Tiêu Chuẩn Nghiệm Thu (Acceptance Criteria)
- [ ] **Xóa bỏ triệt để hardcode Catalogue:** Khi mở Modal Thêm Mẫu Hoa Mới, các chi nhánh được render động 100% từ `branches.json`. Khi lưu, dữ liệu `stockByBranch` chứa đầy đủ các chi nhánh hoạt động.
- [ ] **Bảng Ma Trận Tồn Kho Toàn Chuỗi (Live Matrix):** Hiển thị đúng 4 chỉ số theo ngày: $\text{Tồn khả dụng} = \text{Nhập} - \text{Đã bán} - \text{Hao hụt}$.
- [ ] **Cập nhật nhanh hàng loạt (Batch Quick Update):** Quản lý nhập nhanh số lượng cắm hoa trong ngày tại các ô input và bấm *"Lưu Toàn Bộ Hạn Mức Tồn Kho"* thành công.
- [ ] **Phân quyền vai trò (RBAC):**
  - Super Admin sửa được kho tất cả chi nhánh.
  - Quản lý chi nhánh (`branch_manager`) chỉ sửa được kho tại chi nhánh mình quản lý, các chi nhánh khác bị khóa (disabled).
  - Thợ cắm hoa (`florist`) tạo được phiếu báo hủy hoa hỏng cho chi nhánh mình.
- [ ] **Phân hệ Báo Hủy Hoa Hỏng (Wastage):**
  - Tạo phiếu báo hủy thành công lưu vào `config/anne/wastage_reports.json`.
  - Hủy mẫu hoa thành phẩm: Tự động trừ tồn kho khả dụng của mẫu hoa đó tại chi nhánh.
  - Hủy hoa cành nguyên liệu: Ghi nhận tổng thất thoát chi phí vốn vào sổ kế toán.
- [ ] **Storefront UX:** Website hiển thị chính xác trạng thái 🟢 Còn nhiều ($\ge 5$) / 🟠 Sắp hết ($1 - 4$) / 🔴 Hết hàng ($0$) theo từng showroom khách đang chọn.
- [ ] **Điều phối thông minh (Smart Order Routing):** Khi chi nhánh gần nhất hết hàng, hệ thống tự động gán đơn sang chi nhánh gần thứ nhì còn hàng.
- [ ] **Chất lượng code & Kiểm thử:** Chạy `python -m unittest discover -s src/unittest` vượt qua 100% các bài test (Pass 100%).
