# Architecture & Interface Design Documentation (`telua_flower`)

Thư mục `docs/design/` chứa các tài liệu thiết kế giao diện, kiến trúc hệ thống và đặc tả kỹ thuật:

1. **[MULTI_BRANCH_INVENTORY_TRACKING.md](file:///d:/code/telua_flower/docs/design/MULTI_BRANCH_INVENTORY_TRACKING.md)**: Thiết kế hệ thống theo dõi tồn kho hoa tươi đa chi nhánh theo thời gian thực (Multi-Branch Real-Time Inventory Matrix), hiển thị trạng thái còn nhiều 🟢 / sắp hết 🟠 / hết hàng 🔴 và tự động điều phối đơn hàng thông minh.
2. **[INVENTORY_MANAGEMENT_DESIGN.md](file:///d:/code/telua_flower/docs/design/INVENTORY_MANAGEMENT_DESIGN.md)**: Thiết kế quy trình nhân viên đăng sản phẩm hoa mới và cập nhật số lượng tồn kho hoa tươi theo ngày (Daily Quota), cơ chế tự động trừ kho và cảnh báo hết hàng trên website.
3. **[AUTHENTICATION_DESIGN.md](file:///d:/code/telua_flower/docs/design/AUTHENTICATION_DESIGN.md)**: Thiết kế kiến trúc **Cổng đăng nhập duy nhất (Single Login Portal)** và cơ chế tự động nhận diện vai trò (Dynamic Role-Based Redirection), cấu trúc JWT Payload, phân tầng bảo vệ Route Guard và API Decorator.
4. **[API_ENDPOINTS.md](file:///d:/code/telua_flower/docs/design/API_ENDPOINTS.md)**: Đặc tả chi tiết toàn bộ các RESTful API Endpoints của hệ thống: Xác thực & Đăng nhập (`/api/auth`), Sản phẩm (`/api/products`), Đơn hàng (`/api/orders`), Chi nhánh (`/api/branches`), Nhân sự & Phân quyền (`/api/staff`), Quản lý khách hàng CRM (`/api/customers`).
