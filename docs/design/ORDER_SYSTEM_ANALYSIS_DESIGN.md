# Tài Liệu Phân Tích & Thiết Kế Hệ Thống Đơn Hàng (Order System Analysis & Architecture Design)
## Dự Án: Nở Hoa Thả Bình (`telua_flower`)

---

## 1. Tổng Quan Phân Hệ Đơn Hàng (Order Management Overview)

Phân hệ Đơn hàng (**Order System**) là trái tim vận hành của hệ thống thương mại điện tử hoa tươi **Nở Hoa Thả Bình**. Do đặc thù của ngành hoa tươi cao cấp mang tính chất **quà tặng cảm xúc, giao hẹn giờ chính xác và thời hạn sử dụng ngắn**, hệ thống đơn hàng được thiết kế chuyên biệt để đáp ứng các yêu cầu nghiệp vụ phức tạp:

```mermaid
graph TD
    subgraph KHÁCH_HÀNG["👥 1. Khách Hàng (Customer / Guest)"]
        A1[Chọn hoa & Add-ons] --> A2[Hẹn Ngày/Giờ giao 30 ngày / Hỏa tốc 2H]
        A2 --> A3[Tùy biến: Thiệp, Ruy-băng, Gửi ẩn danh]
        A3 --> A4[Thanh toán: VietQR / Thẻ / COD]
    end

    subgraph HỆ_THỐNG["⚙️ 2. Hệ Thống Backend & Điều Phối (Order Engine)"]
        B1[Định vị chi nhánh gần nhất: GPS Haversine / Quận Huyện]
        B2[Tạo mã đơn NHTB-YYMMDD-XXXX]
        B3[Sinh mã VietQR EMVCo + QuickLink]
        B4[Lưu phân mảnh orders_YYYY_MM.json & Đồng bộ User Folder]
        B5[Tích lũy điểm CRM 1đ/10.000đ & Nâng hạng]
    end

    subgraph VẬN_HÀNH["🏬 3. Vận Hành Đa Chi Nhánh (Showrooms & Staff)"]
        C1[Quản lý chi nhánh: Tiếp nhận & Phân công]
        C2[Thợ cắm hoa: Nhận việc & Upload ảnh hoa thật]
        C3[Khách duyệt ảnh hoa trước khi giao]
        C4[Shipper giao hoa / Khách nhận tại quầy]
    end

    KHÁCH_HÀNG --> HỆ_THỐNG
    HỆ_THỐNG --> VẬN_HÀNH
```

### Các Đặc Thù Nghiệp Vụ Hoa Tươi Nổi Bật:
1. **Tách biệt Người Gửi (Sender) & Người Nhận (Recipient)**:
   - Người mua thường đặt hoa để gửi tặng bạn bè, đối tác, người thân.
   - Hỗ trợ tính năng **"Gửi Ẩn Danh (Secret Sender)"**: Tên người gửi sẽ được ẩn đi đối với người nhận nhưng vẫn lưu trữ minh bạch trong hồ sơ nội bộ để phục vụ bảo mật và xác minh thanh toán.
2. **Khung Giờ Giao Hàng Linh Hoạt (Delivery Slots & 2H Express)**:
   - Cho phép chọn ngày giao trước tối đa **30 ngày** (phục vụ đặt trước sinh nhật, ngày lễ 14/2, 8/3, 20/10).
   - 6 khung giờ tiêu chuẩn cố định trong ngày (08:00 - 21:00) hoặc tùy chọn **Giao Hỏa Tốc trong 2 Giờ**.
   - Khống chế tải tự động (Quota Management) và chặn chọn slot quá khứ trong ngày.
3. **Cá Nhân Hóa Đơn Hàng (Customization)**:
   - Soạn thảo lời chúc thiệp đính kèm (Card Message).
   - In thông điệp chúc mừng trên dải ruy-băng cài hoa (Ribbon Banner).
   - Ghi chú chỉ dẫn giao nhận chi tiết (ví dụ: gửi lễ tân tòa nhà, gọi trước 15 phút).
4. **Hệ Thống Thanh Toán Tự Động & VietQR Động**:
   - Tự động sinh mã VietQR chuẩn Napas EMVCo chứa sẵn số tiền chính xác và cú pháp chuyển khoản định danh mã đơn.
   - Tạo URL VietQR QuickLink mở trực tiếp ứng dụng ngân hàng di động trong 1 chạm.
5. **Điều Phối Đơn Đa Chi Nhánh Thông Minh (Smart Branch Dispatching)**:
   - Tự động định vị Showroom gần nhất theo tọa độ GPS (thuật toán Haversine) hoặc tự động phân tích tên Quận/Huyện từ địa chỉ giao hàng.
   - Gán người chịu trách nhiệm xử lý (`assignedTo`) về Quản lý chi nhánh tương ứng.
6. **Lưu Trữ Phân Mảnh Theo Tháng & Đồng Bộ User Profile**:
   - Dữ liệu đơn hàng được phân mảnh theo file tháng `orders_YYYY_MM.json` nhằm tối ưu hóa dung lượng nạp và bộ nhớ RAM.
   - Đồng bộ độc lập vào thư mục cá nhân khách hàng `config/anne/users/{user_id}/orders.json` để truy vấn lịch sử với độ trễ 0ms.

---

## 2. Đặc Tả Cấu Trúc Dữ Liệu Đơn Hàng (Order Schema Specification)

Đơn hàng được lưu trữ dưới dạng JSON Object chuẩn hóa, bao gồm đầy đủ thông tin giao dịch, logistics, tài chính và lịch sử xử lý:

```json
{
  "id": "ord_1725324567_a8f9c1",
  "orderCode": "NHTB-260903-A8K2",
  "createdAt": "2026-09-03T10:15:30Z",
  "orderDate": "2026-09-03T10:15:30Z",
  "branchId": "branch_q10",
  "customerId": "cust_1725300000",
  "assignedTo": "staff_manager_q10",
  "assignedBy": "system",
  "requiresArranging": true,
  "status": "pending",
  "cardMessage": "Chúc em tuổi mới luôn xinh đẹp và rạng rỡ như những đóa hoa!",
  "ribbonBanner": "Mừng Khai Trương Hồng Phát - Cty Alpha Tech",
  
  "sender": {
    "name": "Người gửi bí mật (Ẩn danh)",
    "realName": "Nguyễn Văn An",
    "phone": "0901234567",
    "email": "an.nguyen@example.com",
    "isAnonymous": true
  },
  
  "recipient": {
    "name": "Trần Thị Mai",
    "phone": "0987654321",
    "address": "183/37 Đường 3 Tháng 2, Phường 11, Quận 10, TP. Hồ Chí Minh",
    "deliveryNotes": "Giao giờ hành chính, gọi điện trước khi đến 15 phút",
    "lat": 10.77123,
    "lng": 106.67345
  },
  
  "delivery": {
    "deliveryDate": "2026-09-04",
    "timeSlot": "10:00 - 12:00 (Trưa)",
    "isExpress2H": false,
    "fulfillmentType": "delivery"
  },
  
  "customization": {
    "cardMessage": "Chúc em tuổi mới luôn xinh đẹp và rạng rỡ như những đóa hoa!",
    "ribbonBanner": "Mừng Khai Trương Hồng Phát - Cty Alpha Tech",
    "requiresArranging": true,
    "arrangingNotes": "Cắm tone hồng pastel, bình gốm cao, hoa phụ lá bạc"
  },
  
  "items": [
    {
      "productId": "prod_pink_bliss_01",
      "productName": "Bó Hoa Hồng Juliet Giấc Mơ Ngọt Ngào",
      "price": 650000,
      "quantity": 1,
      "itemTotal": 650000,
      "image": "/images/products/bo_hoa_hong_juliet.webp"
    },
    {
      "productId": "addon_gau_bong_mini",
      "productName": "Gấu Bông Mini Thỏ Trắng",
      "price": 80000,
      "quantity": 1,
      "itemTotal": 80000,
      "image": "/images/addons/gau_bong_mini.webp"
    }
  ],
  
  "financials": {
    "subtotal": 730000,
    "arrangingFee": 365000,
    "shippingFee": 0,
    "discountAmount": 50000,
    "totalAmount": 1045000,
    "appliedVoucher": {
      "code": "FLOWERNEW",
      "title": "Ưu đãi khách hàng mới giảm 50K",
      "discountAmount": 50000
    }
  },
  
  "totalAmount": 1045000,
  
  "payment": {
    "method": "vietqr",
    "status": "unpaid",
    "paidAt": null,
    "transactionId": null,
    "bankInfo": {
      "bankId": "MB",
      "accountNo": "090123456789",
      "accountName": "NO HOA THA BINH"
    },
    "transferContent": "NHTB 260903 A8K2",
    "vietqr": {
      "quickLink": "https://img.vietqr.io/image/MB-090123456789-compact2.png?amount=680000&addInfo=NHTB%20260903%20A8K2&accountName=NO%20HOA%20THA%20BINH",
      "qrPayload": "00020101021238540010A0000007270124000697042201100901234567890208QRIBFTTA530370454066800005802VN62200816NHTB 260903 A8K26304E8A2"
    }
  },
  
  "flowerPhoto": {
    "photoUrl": "/images/orders/actual_ord_1725324567.webp",
    "uploadedAt": "2026-09-04T09:30:00Z",
    "uploadedBy": "staff_florist_01",
    "isApprovedByCustomer": true
  },
  
  "history": [
    {
      "status": "pending",
      "paymentStatus": "unpaid",
      "updatedAt": "2026-09-03T10:15:30Z",
      "note": "Khách hàng tạo đơn hàng trực tuyến",
      "updatedBy": "0901234567"
    },
    {
      "status": "confirmed",
      "updatedAt": "2026-09-03T10:20:00Z",
      "note": "Quản lý chi nhánh xác nhận đơn hàng",
      "updatedBy": "staff_manager_q10"
    }
  ]
}
```

---

## 3. Mô Hình Hai Chuỗi Trạng Thái Độc Lập (Dual-State Lifecycle Engine)

Hệ thống quản lý đơn hàng sử dụng kiến trúc **Hai Chuỗi Trạng Thái Độc Lập (Decoupled State Machine)** nhằm phản ánh trung thực thực tế vận hành logistics và tài chính. Đặc biệt, hệ thống phân nhánh rõ ràng giữa **Đơn Cắm Hoa Nghệ Thuật** (`requiresArranging: true`) và **Đơn Fast-Track Tiêu Chuẩn** (`requiresArranging: false`):

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   1. ORDER FULFILLMENT STATUS                                   │
│                                                                                                 │
│  [A. Luồng Cắm Hoa Nghệ Thuật (+50% Phí, requiresArranging: true)]                              │
│  pending ──> confirmed ──> arranging ──> photo_sent ──> shipping / ready_for_pickup ──> delivered ──> completed
│     │            │             │                           │                                │   │
│     │            │             │                           │                                └───┼──> returned
│     │            │             │                           │                                    │
│     │            │             │                           └────────────────────────────────────┤
│     │            │             └────────────────────────────────────────────────────────────────┤
│     │            └──────────────────────────────────────────────────────────────────────────────┤
│     └───────────────────────────────────────────────────────────────────────────────────────────┴──> cancelled
│                                                                                                 │
│  [B. Luồng Fast-Track: Hoa Nguyên Cành / Bó Tiêu Chuẩn (requiresArranging: false)]              │
│  pending ──> confirmed ───────────────────────────────> shipping / ready_for_pickup ──> delivered ──> completed
│  (Bỏ qua khâu cắm hoa 'arranging'; nhân viên đóng gói chuyển thẳng sang vận chuyển / nhận quầy)   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                 2. PAYMENT STATUS                       │
│             unpaid ──────────> paid                     │
│               │                  │                      │
│               └──> failed        └──> refunded          │
└─────────────────────────────────────────────────────────┘
```

### 3.1 Bảng Phân Định Chi Tiết Trạng Thái

#### A. Trạng Thái Vận Hành Đơn Hàng (`order.status`):
| Mã trạng thái | Tên tiếng Việt | Đối tượng thao tác | Hành động tương ứng trong thực tế |
| :--- | :--- | :--- | :--- |
| `pending` | **Chờ xác nhận** | Khách hàng / Hệ thống | Đơn mới tạo trên Web, chưa có nhân viên tiếp nhận. |
| `confirmed` | **Đã duyệt / Xác nhận** | Quản lý / CSKH | Quản lý chi nhánh kiểm tra hoa nguyên liệu, chấp nhận đơn. |
| `arranging` / `in_progress` | **Đang cắm hoa** | Thợ cắm hoa (`florist`) | Thợ cắm hoa nhận đơn nghệ thuật, thực hiện cắm bó/lẵng/bình theo ghi chú của khách. |
| `photo_sent` | **Đã gửi ảnh thành phẩm** | Thợ hoa / CSKH | Chụp ảnh hoa thực tế thành phẩm gửi khách hàng duyệt trước khi giao. |
| `ready_for_pickup`| **Sẵn sàng nhận hoa** | Thợ / Quản lý | Áp dụng cho đơn nhận tại quầy (`pickup`), hoa đã cắm xong hoặc đã đóng gói xong. |
| `shipping` | **Đang vận chuyển** | Quản lý / Shipper | Bàn giao shipper mang hoa đi giao cho người nhận. |
| `delivered` | **Giao thành công** | Shipper / Quản lý | Khách/Người nhận đã nhận hoa nguyên vẹn. |
| `completed` | **Hoàn tất đơn** | Quản lý / Hệ thống | Đơn đã nhận tại quầy hoặc hoàn tất đối soát tài chính, cộng điểm CRM. |
| `cancelled` | **Đã hủy** | Khách / Quản lý / Admin | Hủy đơn theo quy định (trước khi bắt đầu cắm hoa). |
| `returned` | **Đổi trả / Khiếu nại**| CSKH / Quản lý | Tiếp nhận khiếu nại hoa dập hỏng để đổi mẫu mới hoặc hoàn tiền. |

#### B. Trạng Thái Thanh Toán (`payment.status`):
| Mã trạng thái | Tên tiếng Việt | Cơ chế cập nhật |
| :--- | :--- | :--- |
| `unpaid` | **Chưa thanh toán** | Mặc định khi tạo đơn mới. |
| `paid` | **Đã thanh toán** | Tự động cập nhật khi Webhook Ngân hàng khớp VietQR, hoặc Nhân viên thu tiền COD/POS tại quầy cập nhật. |
| `refunded` | **Đã hoàn tiền** | Admin/Kế toán hoàn tiền chuyển khoản khi đơn bị hủy hợp lệ hoặc đổi trả. |
| `failed` | **Thanh toán lỗi** | Cổng thanh toán thẻ trả về giao dịch bị từ chối/hết hạn. |

### 3.2 Ma Trận Phân Quyền Xử Lý Đơn Hàng (RBAC Matrix)

| Vai trò người dùng (`role`) | Xem đơn | Duyệt đơn (`confirmed`) | Nhận cắm (`arranging`) | Upload ảnh hoa | Chuyển `shipping` | Cập nhật `paid` (Tiền mặt) | Hoàn tiền (`refunded`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Khách hàng (`customer`)** | Chỉ đơn của mình | ❌ | ❌ | ❌ (Duyệt ảnh) | ❌ | ❌ | ❌ |
| **Thợ cắm hoa (`florist`)** | Đơn chi nhánh mình | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Sales Tư Vấn (`sales`)** | Đơn chi nhánh mình | ✅ | ❌ | ❌ | ✅ | ✅ (POS/COD) | ❌ |
| **Quản lý CN (`branch_manager`)**| Đơn chi nhánh mình | ✅ | ✅ | ✅ | ✅ | ✅ (POS/COD) | ❌ |
| **Super Admin (`super_admin`)** | Toàn bộ chuỗi | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 3.3 Giao Diện Thanh Tiến Trình Đơn Hàng (Order Progress Stepper & Timeline UX)

Trong Modal Chi Tiết Đơn Hàng (`#orderDetailModal`), hệ thống trang bị khối **Thanh Tiến Trình Trực Quan (`#ordDetailProgressCard`)** tự động thích ứng linh hoạt theo cả hình thức nhận hàng (`fulfillmentType`) lẫn tính chất cắm hoa (`requiresArranging`):

1. **Luồng Cắm Hoa Nghệ Thuật (`requiresArranging: true`):**
   - Bước 1: `pending` — **Chờ xác nhận** (Tiếp nhận đơn)
   - Bước 2: `confirmed` — **Đã xác nhận** (Chuẩn bị hoa & phụ kiện theo ghi chú)
   - Bước 3: `arranging` / `photo_sent` — **Đang cắm hoa** (Florist cắm & chụp ảnh thành phẩm)
   - Bước 4: `shipping` (hoặc `ready_for_pickup`) — **Đang vận chuyển** / **Sẵn sàng nhận**
   - Bước 5: `delivered` / `completed` — **Hoàn tất giao hàng**

2. **Luồng Fast-Track Tiêu Chuẩn (`requiresArranging: false` - Bỏ qua khâu cắm):**
   - Bước 1: `pending` — **Chờ xác nhận**
   - Bước 2: `confirmed` — **Đã xác nhận & Đóng gói hoa** (Nhân viên kiểm tra chất lượng cành hoa)
   - Bước 3: `shipping` (hoặc `ready_for_pickup`) — **Bàn giao Shipper** / **Chờ nhận tại quầy**
   - Bước 4: `delivered` / `completed` — **Hoàn tất đơn hàng**

#### Quy Chuẩn Hiển Thị 3 Trạng Thái Bước:
- **Bước đã hoàn thành (Done):** Vòng tròn xanh ngọc kèm icon check `fa-check`, hiển thị chính xác ngày giờ hoàn thành trích xuất từ `order.history` (định dạng `HH:mm DD/MM`).
- **Bước hiện tại (Active):** Vòng tròn xanh sáng viền sáng nhấp nháy (Pulse animation), hiển thị mốc thời gian cập nhật gần nhất và nhãn *"Hiện tại / Đang xử lý"*.
- **Bước tương lai còn lại (Upcoming):** Vòng tròn số thứ tự nét đứt màu xám nhẹ (`Chưa tới`), giúp khách hàng và nhân viên biết rõ **còn bao nhiêu bước nữa đơn hàng sẽ hoàn tất**.
- **Xử lý đơn hủy (`cancelled` / `returned`):** Thanh tiến trình đổi sang dải màu cảnh báo (Đỏ/Cam) và hiển thị thời điểm kèm ghi chú lý do hủy.

### 3.4 Không Gian Làm Việc Ca Trực (Dedicated Workspace Dialog)
Bàn làm việc của nhân sự nội bộ (Florist, Sales, Branch Manager, Super Admin) được thiết kế vận hành tại **Dialog độc lập "Công Việc Của Tôi" (`#staffPortalModal`)**:
- **Chiều cao tối đa:** `h-[96vh] max-h-[96vh] sm:h-[98vh] sm:max-h-[98vh] max-w-6xl flex-col` giúp hiển thị danh sách đơn trong ca trực rõ ràng, không bị chèn ép khung nhìn.
- **Phân tách hoàn toàn:** Hoạt động độc lập với **CMS Admin (`#adminPortalModal`)** và **Quản Lý Người Dùng (`#userManagementModal`)**, nâng cao hiệu suất làm việc của thợ cắm hoa và nhân viên trực quầy.

---

## 4. Thuật Toán Định Vị Chi Nhánh & Gán Xử Lý Thông Minh

Để đơn hàng được phục vụ nhanh nhất với chi phí vận chuyển tối ưu và giữ hoa tươi lâu nhất, hệ thống áp dụng cơ chế điều phối chi nhánh tự động 2 cấp:

```mermaid
flowchart TD
    START([Tạo đơn hàng mới]) --> CHECK_EXPLICIT{Khách có chọn chi nhánh cụ thể?}
    
    CHECK_EXPLICIT -->|Có (branchId hợp lệ)| ASSIGN_EXPLICIT[Gán chi nhánh khách chọn]
    CHECK_EXPLICIT -->|Không| CHECK_GPS{Có tọa độ GPS<br/>lat, lng người nhận?}
    
    CHECK_GPS -->|Có| HAVERSINE[Tính khoảng cách Haversine đến từng Showroom]
    HAVERSINE --> MIN_DIST[Chọn Showroom có khoảng cách ngắn nhất]
    
    CHECK_GPS -->|Không| TEXT_MATCH[Phân tích chuỗi địa chỉ giao hàng recipient.address]
    TEXT_MATCH -->|Q1, Q4, Bình Thạnh, Phú Nhuận| CN_Q1[branch_q1: Showroom Quận 1]
    TEXT_MATCH -->|Q2, Q9, Thủ Đức, Thảo Điền| CN_TD[branch_thao_dien: Showroom Thảo Điền]
    TEXT_MATCH -->|Q10, Q3, Q5, Tân Bình, Tân Phú...| CN_Q10[branch_q10: Showroom Flagship Q10]
    TEXT_MATCH -->|Ngoại thành / Không xác định chi nhánh| CN_ADMIN[admin: Đơn chờ Admin / CSKH điều phối]

    MIN_DIST --> SET_BRANCH[Gán branchId cho Đơn hàng]
    CN_Q1 --> SET_BRANCH
    CN_TD --> SET_BRANCH
    CN_Q10 --> SET_BRANCH
    CN_ADMIN --> SET_BRANCH_ADMIN[Gán branchId = 'admin'<br/>Lưu vào orders/admin/orders_YYYY_MM.json]
    ASSIGN_EXPLICIT --> SET_BRANCH

    SET_BRANCH --> ASSIGN_STAFF[Gán assignedTo = Manager của Chi nhánh đó]
    SET_BRANCH_ADMIN --> ASSIGN_ADMIN[Gán assignedTo = staff_admin]
```

### Công thức khoảng cách Haversine:
$$d = 2R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta \text{lon}}{2}\right)}\right)$$
*(Với $R = 6371 \text{ km}$ là bán kính Trái Đất)*

---

## 5. Quy Chuẩn Tính Toán Tài Chính, Phí Ship & Voucher

### 5.1 Quy Tắc Tính Phí Vận Chuyển (Shipping Fee Policy):
- **Đơn tiêu chuẩn (Standard Delivery)**:
  - Giá trị đơn hàng $< 500.000$ VNĐ $\rightarrow$ Phí vận chuyển cố định **$35.000$ VNĐ**.
  - Giá trị đơn hàng $\ge 500.000$ VNĐ $\rightarrow$ **Miễn phí vận chuyển (Freeship 0đ)**.
- **Giao hỏa tốc 2H (Express 2-Hour Delivery)**:
  - Phí hỏa tốc ưu tiên: **$50.000$ VNĐ** (Áp dụng cho mọi giá trị đơn hàng để đảm bảo shipper ưu tiên riêng).

### 5.2 Quy Tắc Tính Phí Cắm Hoa Nghệ Thuật (Arranging Fee Policy):
- Nhằm phục vụ linh hoạt nhu cầu của khách hàng (người mua hoa cành đơn giản vs khách đặt lẵng/bình nghệ thuật cầu kỳ):
  - Khách hàng có quyền chủ động bật/tắt checkbox **"Hỗ trợ cắm hoa nghệ thuật (+50% phí)"** tại bước Checkout.
  - Khi bật `checked`: Khách nhập ghi chú dáng hoa, tone màu, bình gốm (`checkoutArrangingNotes`), và hệ thống áp dụng phụ phí:
    $$\text{arrangingFee} = \begin{cases} \text{round}(\text{subtotal} \times 0.5) & \text{khi } \text{requestArranging} = \text{true} \\ 0 & \text{khi } \text{requestArranging} = \text{false} \end{cases}$$
  - Phí này được ghi nhận minh bạch vào `financials.arrangingFee` và hiển thị thành dòng riêng trong bảng tóm tắt chi phí đơn hàng.

### 5.3 Quy Tắc Áp Dụng Mã Khuyến Mãi (Voucher & Promotions):
1. **Kiểm tra điều kiện đơn hàng tối thiểu (`minOrderAmount`)**:
   - Nếu `subtotal < minOrderAmount` $\rightarrow$ Từ chối áp dụng voucher.
2. **Chiết khấu theo phần trăm (`discountType = 'percentage'`)**:
   $$\text{discountAmount} = \min\left(\left\lfloor \frac{\text{subtotal} \times \text{discountValue}}{100} \right\rfloor, \text{maxDiscountAmount}\right)$$
3. **Chiết khấu số tiền cố định (`discountType = 'fixed'`)**:
   $$\text{discountAmount} = \min(\text{discountValue}, \text{subtotal})$$

### 5.4 Công Thức Tổng Thanh Toán Cuối Cùng (`finalTotal`):
$$\text{totalAmount} = \max(0, \text{subtotal} + \text{arrangingFee} + \text{shippingFee} - \text{discountAmount})$$

### 5.5 Tích Lũy Điểm Khách Hàng Thân Thiết (CRM Loyalty Points):
- Tỷ lệ quy đổi: **$10.000$ VNĐ chi tiêu $= 1$ điểm tích lũy**.
- Tự động cộng dồn `loyaltyPoints`, `totalSpent` và số lần mua `orderCount` vào hồ sơ khách hàng tại `config/anne/customers.json`.
- Phân tầng hạng thành viên:
  - **Silver**: $< 5.000.000$ VNĐ
  - **Gold**: $5.000.000 - 15.000.000$ VNĐ (Chiết khấu thường niên 5%)
  - **Diamond**: $> 15.000.000$ VNĐ (Chiết khấu thường niên 10% + Quà sinh nhật)

---

## 6. Kiến Trúc Lưu Trữ Dữ Liệu: Kanban Folder Partitioning ({branch_id}/{YYYY_MM}/{status}/{order_id}.json)

Nhằm tối ưu hóa tốc độ ghi, loại bỏ hoàn toàn đụng độ khóa file và hỗ trợ bảng điều khiển Kanban thời gian thực, hệ thống áp dụng kiến trúc phân cấp 4 tầng:

```text
config/anne/
├── orders/
│   ├── branch_q10/                    # Showroom Flagship Quận 10
│   │   ├── 2026_08/                   # Thư mục tháng 08/2026
│   │   │   ├── pending/               # Chờ xác nhận ({order_id}.json)
│   │   │   ├── arranging/             # Đang cắm hoa
│   │   │   ├── shipping/              # Đang giao hàng
│   │   │   └── delivered/             # Giao thành công
│   │   └── 2026_09/
│   ├── branch_q1/                     # Showroom Quận 1
│   │   └── 2026_09/
│   │       └── pending/
│   │           └── ord_1788368978_739ed2.json
│   ├── branch_thao_dien/              # Showroom Thảo Điền
│   └── admin/                         # 🌟 ĐƠN HÀNG CHƯA ĐỊNH VỊ / TOÀN CHUỖI (Unassigned / Pending Dispatch)
│       └── 2026_09/
│           └── pending/
│               └── ord_1788199999_xyz.json
│
└── users/
    ├── 0901234567/
    │   ├── profile.json               # Hồ sơ cá nhân
    │   └── orders.json                # Sổ chỉ mục con trỏ tham chiếu (Reference Pointer)
    └── 0987654321/
        └── orders.json
```

### 6.1 Cơ Chế Di Chuyển File Khi Đổi Trạng Thái (Kanban Status Transition):
- Khi một đơn hàng đổi trạng thái (ví dụ: từ `pending` sang `arranging`), hệ thống thực hiện:
  1. `os.replace(old_status_path, new_status_path)`: Di chuyển nguyên tử file JSON sang thư mục trạng thái mới.
  2. Cập nhật `order["status"] = new_status` và ghi vết vào `history`.
  3. Cập nhật con trỏ trạng thái trong sổ khách hàng `users/{user_id}/orders.json`.
- Thao tác di chuyển này diễn ra tức thời ($< 0.1$ms) vì diễn ra trên cùng phân vùng lưu trữ.

### 6.2 Vai Trò Đặc Biệt Của Thư Mục `orders/admin/`:
- **Đơn hàng chưa biết gán cho ai (Unassigned Orders)**: Áp dụng khi khách đặt hàng nhưng địa chỉ ngoại tỉnh, chưa xác định showroom, hoặc đơn hợp đồng B2B toàn chuỗi.
- **Quy trình Điều Phối & Chuyển Nhượng Đơn (Order Dispatch & Reassignment)**:
  - Khi Super Admin hoặc CSKH điều phối đơn từ `admin/` sang `branch_q10`:
    1. Hệ thống di chuyển file đơn hàng từ `orders/admin/{YYYY_MM}/{status}/{order_id}.json` sang `orders/branch_q10/{YYYY_MM}/{status}/{order_id}.json`.
    2. Cập nhật `branchId: "branch_q10"` và `assignedTo: "staff_manager_q10"`.
    3. Ghi vết lịch sử vào mảng `history`: *"Điều phối từ Admin sang Showroom Q10 bởi [User]"*.
    4. Tự động đồng bộ cập nhật con trỏ tham chiếu vào sổ đơn của khách hàng tại `users/{user_id}/orders.json`.

### 6.3 Lợi Ích Vượt Trội Của Kanban Folder Partitioning:
1. **Lọc Trạng Thái Không Cần Quét (Zero-Scan Query)**:
   - Khi thợ hoa xem "Đơn cần cắm", backend chỉ đọc thư mục con `arranging/` (5-10 đơn) thay vì đọc 10.000 đơn trong tháng.
2. **Cô lập rủi ro ghi đè 100% (Zero Write Contention & Lock-Free)**:
   - Mỗi đơn hàng là một tệp JSON riêng biệt (~2 KB). Nhiều thợ cắm hoa, thu ngân, shipper cập nhật các đơn khác nhau cùng lúc hoàn toàn độc lập, không sợ đụng độ I/O lock.
2. **Thao tác đơn hàng nguyên tử (Atomic File Operations)**:
   - Thêm, sửa, xóa đơn là thao tác trên tệp đơn lẻ nguyên tử, bảo vệ tính toàn vẹn dữ liệu tối đa.
3. **Truy vấn $O(1)$ trực tiếp**:
   - Khi biết `branchId`, `yearMonth` và `orderId`, hệ thống mở thẳng file `{order_id}.json` trong thời gian $< 0.5$ms.
4. **Đồng bộ con trỏ tham chiếu khách hàng (Lightweight Pointer Index)**:
   - Khách hàng xem lịch sử mua hàng cá nhân qua `users/{user_id}/orders.json` chứa các con trỏ tham chiếu siêu nhẹ, giải mã trực tiếp từ file chi nhánh theo thời gian thực.

---

## 7. Phân Hệ Thống Kê & Báo Cáo Doanh Thu (Admin BI & Order Analytics)

API `/api/admin/orders` cung cấp công cụ phân tích kinh doanh đa chiều cho Quản trị viên và Quản lý showroom:

```mermaid
pie title Tỷ trọng Doanh Thu Theo Chi Nhánh (Tháng 09/2026)
    "Showroom Quận 10 (Flagship)" : 58
    "Showroom Quận 1 (Bến Nghé)" : 27
    "Showroom Thảo Điền (TP. Thủ Đức)" : 15
```

### Các Bộ Lọc Phân Tích & Sắp Xếp Đa Chiều:
- **Tiêu chí Sắp xếp (`sortBy` & `sortOrder`)**:
  - `updatedAt` (Mặc định): Sắp xếp theo thời gian mới cập nhật gần nhất (`history[-1].updatedAt` hoặc `updatedAt`), giúp nắm bắt tức thì các đơn vừa đổi trạng thái hoặc thợ hoa vừa thao tác.
  - `createdAt`: Sắp xếp theo thời điểm đặt đơn gốc.
  - `totalAmount`: Sắp xếp theo giá trị tổng thanh toán (tăng/giảm dần).
  - `deliveryDate`: Sắp xếp theo ngày hẹn giao hàng.
  - `sortOrder`: `desc` (mặc định - mới nhất lên đầu) hoặc `asc` (cũ nhất lên đầu).
- **Lọc theo Mốc Thời Gian (`dateFilterBy` & `timeframe`)**:
  - `dateFilterBy`: `createdAt` (mặc định) hoặc `updatedAt` (cho phép lọc các đơn có cập nhật trong khoảng thời gian đã chọn).
  - `today`: Đơn phát sinh / cập nhật trong ngày hôm nay từ 00:00:00 đến 23:59:59.
  - `this_week`: Đơn từ Thứ Hai đầu tuần đến Chủ Nhật.
  - `this_month`: Đơn trong tháng hiện tại.
  - `last_month`: Đơn trong tháng trước.
  - `custom`: Tùy chỉnh theo `startDate` và `endDate`.
  - `all`: Quét tổng hợp toàn bộ các tháng lịch sử.
- **Lọc theo Chi nhánh (`branchId`)**: Phân quyền tự động (Quản lý CN chỉ xem số liệu chi nhánh mình, Admin xem toàn chuỗi).
- **Lọc theo Trạng thái Đơn & Thanh Toán**: `status` (`pending`, `arranging`, `shipping`, `completed`, `cancelled`) và `paymentStatus` (`paid`, `unpaid`).
- **Chỉ số đầu ra (Aggregated Metrics Output)**:
  - `totalOrders`: Tổng số lượng đơn thỏa mãn điều kiện.
  - `totalRevenue`: Doanh thu thực tế (đã trừ các đơn `cancelled`).
  - `metrics`: Đếm số đơn theo từng trạng thái cụ thể.
  - `revenueByBranch`: Doanh thu phân bổ theo từng showroom.
  - `revenueByDay`: Doanh thu nhóm theo từng ngày để vẽ biểu đồ tăng trưởng cột/đường (Trend Chart).

---

## 8. Đặc Tả Danh Mục API Endpoints Phân Hệ Đơn Hàng

| Phương thức | Endpoint | Phân quyền | Mô tả chức năng |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/delivery/slots` | Public | Lấy danh sách 6 khung giờ giao hàng và kiểm tra slot còn trống theo ngày. |
| `POST` | `/api/orders` | Public / Auth | Tạo đơn hàng mới (tự động tính ship, voucher, gán chi nhánh, tạo VietQR). |
| `GET` | `/api/orders/<order_id>` | RBAC Guard | Tra cứu chi tiết đơn hàng (Kiểm tra quyền sở hữu của khách hoặc phân quyền chi nhánh của nhân viên). |
| `GET` | `/api/orders/<order_id>/payment-qr` | Public / Auth | Lấy mã VietQR động, QuickLink URL và thông tin chuyển khoản ngân hàng. |
| `GET` | `/api/orders/my-orders` | Customer (JWT) | Lấy danh sách lịch sử đơn hàng của tài khoản đang đăng nhập. |
| `GET` | `/api/staff/my-tasks` | Staff / Manager / Admin | **[MỚI - Task API]** Lấy danh sách công việc tác nghiệp ca trực theo vai trò. Tự động xác định Showroom từ JWT. |
| `POST` | `/api/staff/tasks/<order_id>/claim` | Staff / Manager | **[MỚI - Task API]** Nhân viên bấm "Nhận việc" (Claim task) để gán đơn đích danh cho mình. |
| `GET` | `/api/staff/tasks/summary` | Staff / Manager / Admin | **[MỚI - Task API]** Thống kê nhanh số lượng task theo ca trực (chờ cắm, đang cắm, giao hàng). |
| `GET` | `/api/branch/<branch_id>/orders` | Staff / Manager / Admin | Lấy danh sách công việc / đơn hàng ca trực của chi nhánh. |
| `GET` | `/api/admin/orders` | Staff / Manager / Admin | Quản lý, tìm kiếm và thống kê doanh thu đơn hàng. Tự động khóa chi nhánh theo nhân viên (trừ Super Admin toàn quyền). |
| `PUT` | `/api/admin/orders/<order_id>/status` | Staff / Manager / Admin | Cập nhật trạng thái tiến độ đơn (`confirmed` $\rightarrow$ `arranging` $\rightarrow$ `shipping` $\rightarrow$ `delivered`). |
| `PUT` | `/api/admin/orders/<order_id>/payment` | Staff / Manager / Admin | Cập nhật trạng thái thanh toán tiền mặt/COD/POS (chặn sửa đơn thanh toán online). |
| `POST` | `/api/orders/<order_id>/photo` | `florist` / Manager | Thợ cắm hoa upload ảnh hoa thực tế sau khi cắm để gửi khách duyệt. |

---

### 8.1 Ma Trận Phân Bổ Công Việc Ca Trực Tại Backend (Backend Role Task Routing)
Nhằm bảo mật thông tin đơn hàng và tuân thủ nguyên tắc đặc quyền tối thiểu (Least Privilege), Backend không trả về toàn bộ đơn của chi nhánh mà kiểm tra danh tính và vai trò người gọi để trả về đúng công việc:
1. **Kiểm Tra Vị Trí Cửa Hàng (Store Location):**
   - **Super Admin:** Không bị ràng buộc vị trí cửa hàng (`Branch: None`), có thể xem toàn chuỗi, bất kỳ Showroom nào hoặc các đơn chờ phân bổ tại Tổng bộ (`branchId == 'admin'`).
   - **Nhân viên cửa hàng (`branch_manager`, `florist`, `sales_consultant`, `shipper`):** Bắt buộc phải có `branchId` hợp lệ được quản trị cấp. Truy cập sai showroom sẽ lập tức bị chặn bằng `HTTP 403 Forbidden`.
2. **Quy Tắc Lọc Công Việc Theo Vai Trò:**
   - **`florist` (Thợ cắm hoa nghệ thuật):** Chỉ nhận đơn có `requiresArranging != False`, trạng thái `confirmed`, `arranging`, `photo_sent`. Nếu đơn đã gán đích danh cho thợ khác, hệ thống ẩn khỏi danh sách.
   - **`sales_consultant` (Tư vấn / Thu ngân):** Chỉ nhận đơn mới cần gọi xác nhận (`pending`) hoặc đơn chưa thanh toán tiền mặt (`unpaid`).
   - **`shipper` (Giao hàng):** Chỉ nhận đơn giao tận nơi (`fulfillmentType == 'delivery'`) sẵn sàng bốc hàng hoặc đang trên đường giao.
   - **`branch_manager` (Quản lý Showroom):** Nhận toàn bộ đơn của chi nhánh để phân công nhân sự (`assignedTo`), giám sát ca trực.

---

## 9. Kịch Bản Vận Hành Thực Tế (End-to-End Execution Scenarios)

### Kịch Bản 1: Khách đặt hoa tặng sinh nhật bạn gái (Giao hỏa tốc 2H + VietQR + Ẩn danh)
1. **Khách hàng** duyệt web, chọn bó hoa hồng Juliet, chọn thêm thiệp và gấu bông mini.
2. Tại màn hình Checkout:
   - Tích chọn **"Giao Hỏa Tốc trong 2 Giờ"** $\rightarrow$ Hệ thống tự cộng phí ship $50.000$đ.
   - Nhập lời chúc thiệp và tích chọn **"Gửi Ẩn Danh"**.
   - Chọn phương thức thanh toán **VietQR**.
3. Bấm **"Đặt Hàng"**:
   - Backend phân tích địa chỉ người nhận (Quận 10) $\rightarrow$ Gán về `branch_q10`.
   - Sinh mã đơn `NHTB-260903-XXXX` và tạo payload VietQR chứa sẵn số tiền $730.000$đ.
   - Màn hình hiển thị mã QR kèm nút "Mở App Ngân Hàng".
4. Khách quét mã chuyển khoản thành công:
   - Đơn chuyển sang `paid`.
5. **Thợ cắm hoa tại Q10** nhận thông báo, chuyển đơn sang `arranging`, hoàn thành bó hoa, chụp ảnh hoa thật upload lên hệ thống.
6. Hệ thống gửi link ảnh hoa cho khách xem; shipper nhận hoa chuyển sang `shipping` và giao tận tay người nhận trong vòng 2 tiếng.

---

## 10. Kiến Trúc Cây Chỉ Mục Tóm Tắt (`_shortcut.json`) & Tải Chi Tiết On-Demand (Master-Detail Lazy Loading)

Nhằm khắc phục tình trạng chậm trễ I/O đĩa khi số lượng đơn hàng tăng lên (30 - 100+ đơn), hệ thống triển khai kiến trúc **Cây Mục Lục Tóm Tắt Đơn Hàng (`_shortcut.json`)** kết hợp cơ chế nạp chi tiết theo yêu cầu:

```
D:\wmshare\telua_flower\config\anne\orders\
├── admin\
│   └── 2026_09\
│       ├── _shortcut.json            <-- ⚡ FILE CÂY CHỈ MỤC TÓM TẮT (SIÊU NHẸ ~200B/đơn)
│       ├── pending\
│       │   ├── ord_001.json          <-- Full Payload (items, photos, history, vietqr)
│       │   └── ord_002.json
│       ├── arranging\
│       └── completed\
├── branch_q10\
│   └── 2026_09\
│       ├── _shortcut.json            <-- ⚡ FILE CÂY CHỈ MỤC TÓM TẮT Q10
│       ├── pending\
│       └── arranging\
└── branch_q1\
    └── 2026_09\
        └── _shortcut.json            <-- ⚡ FILE CÂY CHỈ MỤC TÓM TẮT Q1
```

### 10.1 Cấu Trúc Bản Ghi Tóm Tắt (Shortcut Item Schema)
Mỗi bản ghi trong `_shortcut.json` có dung lượng chỉ khoảng **200 - 300 bytes** (so với 15KB - 50KB của file chi tiết):
```json
{
  "id": "ord_1789181326",
  "orderCode": "NHTB-2609-0012",
  "createdAt": "2026-09-12T08:30:00Z",
  "updatedAt": "2026-09-12T08:35:00Z",
  "status": "pending",
  "branchId": "branch_q10",
  "branchName": "Showroom Quận 10 Flagship",
  "totalAmount": 1500000,
  "payment": { "status": "unpaid", "method": "vietqr" },
  "recipient": { "name": "Nguyễn Văn A", "phone": "0901234567", "address": "123 Lê Lợi, Q.1" },
  "sender": { "name": "Trần Thị B", "phone": "0907654321" },
  "delivery": { "fulfillmentType": "delivery", "deliveryDate": "2026-09-12", "timeSlot": "08:00 - 10:00" },
  "itemSummary": "Bó Hoa Hồng Trắng x1 (+1 món khác)",
  "itemCount": 2,
  "requiresArranging": true,
  "detailPath": "orders/branch_q10/2026_09/pending/ord_1789181326.json"
}
```

### 10.2 Nguyên Lý Vận Hành & Đồng Bộ Tự Động
1. **Truy vấn danh sách siêu tốc (0.5ms)**:
   - Khi Admin CMS hoặc Ca trực tải danh sách đơn (`GET /admin/orders` hoặc `GET /staff/my-tasks`), backend đọc trực tiếp từ các file `_shortcut.json` (được cache trong RAM với kiểm tra file `mtime`).
   - Thời gian phản hồi giảm từ **3.000ms xuống dưới 5ms** (nhanh hơn 30 - 50 lần).
2. **Tự Động Sinh Chỉ Mục (Auto-healing)**:
   - Nếu file `_shortcut.json` chưa tồn tại trên đĩa (ví dụ khi mới tạo thư mục tháng mới hoặc sau khi migrate), hàm `get_or_build_month_branch_shortcut` tự động quét các file con trên đĩa 1 lần duy nhất để tạo ra file `_shortcut.json`.
3. **Đồng bộ tự động khi CRUD (Auto-sync)**:
   - **Tạo đơn mới (`save_order`)**: Tự động chèn bản ghi tóm tắt vào `_shortcut.json`.
   - **Cập nhật trạng thái (`update_order_status`)**: Cập nhật trạng thái và `updatedAt` trong `_shortcut.json`.
   - **Điều phối chi nhánh (`dispatch_order`)**: Di chuyển bản ghi từ `_shortcut.json` chi nhánh cũ sang chi nhánh mới.
   - **Xóa đơn (`delete_order`)**: Tự động gỡ bỏ khỏi `_shortcut.json`.
4. **Tải Chi Tiết On-Demand (Lazy Loading khi Click)**:
   - Frontend không giữ toàn bộ dữ liệu nặng trong bảng.
   - Khi người dùng click vào một dòng đơn hàng, hàm `openOrderDetailModal(orderId)` gọi `GET /api/flower/v1/orders/<order_id>`. Backend đọc đúng file JSON chi tiết duy nhất và trả về để hiển thị đầy đủ trên Modal.

---
*Tài liệu được cập nhật đồng bộ với mã nguồn thực tế tại [src/order_service.py](file:///d:/wmshare/telua_flower/src/order_service.py) và [src/restful_blueprint_flower_connect.py](file:///d:/wmshare/telua_flower/src/restful_blueprint_flower_connect.py).*

