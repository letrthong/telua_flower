import os
import sys
import math
import uuid
import random
import string
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_service import (
    get_branches,
    get_branch_by_id,
    get_products,
    get_product_by_id,
    get_promotions,
    get_promotion_by_code,
    get_customer_by_phone,
    save_customers,
    get_customers,
    save_order,
    get_order_by_id,
    read_orders_by_month,
    update_order_status,
    sync_order_to_user_folder,
    get_user_orders,
    get_system_current_and_prev_ym,
    enrich_order_display_names
)
from vietqr_service import (
    build_order_payment_info,
    generate_vietqr_payload,
    get_vietqr_quicklink,
    get_default_bank_config
)

STANDARD_TIME_SLOTS = [
    {"id": "slot_08_10", "name": "08:00 - 10:00 (Sáng sớm)", "start": "08:00", "end": "10:00"},
    {"id": "slot_10_12", "name": "10:00 - 12:00 (Trưa)", "start": "10:00", "end": "12:00"},
    {"id": "slot_13_15", "name": "13:00 - 15:00 (Đầu giờ chiều)", "start": "13:00", "end": "15:00"},
    {"id": "slot_15_17", "name": "15:00 - 17:00 (Xế chiều)", "start": "15:00", "end": "17:00"},
    {"id": "slot_17_19", "name": "17:00 - 19:00 (Tan tầm)", "start": "17:00", "end": "19:00"},
    {"id": "slot_19_21", "name": "19:00 - 21:00 (Tối)", "start": "19:00", "end": "21:00"}
]


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Tính khoảng cách đường chim bay (km) giữa 2 tọa độ GPS bằng công thức Haversine."""
    R = 6371.0  # Bán kính Trái Đất theo km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def assign_nearest_branch(
    address: str = "",
    lat: Optional[float] = None,
    lng: Optional[float] = None
) -> str:
    """
    Tự động điều phối đơn hàng đến Showroom gần nhất theo tọa độ GPS hoặc tên Quận/Huyện.
    """
    branches = get_branches()
    active_branches = [b for b in branches if b.get("isActive", True)]
    if not active_branches:
        return "branch_q10"

    # 1. Nếu có tọa độ GPS hợp lệ -> tính khoảng cách chính xác
    if lat is not None and lng is not None:
        best_branch = active_branches[0]
        min_dist = float("inf")
        for b in active_branches:
            b_lat = b.get("lat")
            b_lng = b.get("lng")
            if b_lat is not None and b_lng is not None:
                dist = calculate_haversine_distance(lat, lng, b_lat, b_lng)
                if dist < min_dist:
                    min_dist = dist
                    best_branch = b
        return best_branch.get("id", "branch_q10")

    # 2. Định vị thông minh dựa theo tên Quận/Huyện trong địa chỉ
    addr_lower = (address or "").lower().strip()
    
    # Kiểm tra Q10 / Q3 / Q5 / Q11 trước (tránh 'quận 10' bị match nhầm bởi 'quận 1')
    if any(q in addr_lower for q in ["quận 10", "q.10", "q10", "quận 3", "q.3", "q3", "quận 5", "q.5", "q5", "quận 11", "q.11", "q11", "tân bình", "tan binh", "tân phú", "tan phu"]):
        return "branch_q10"
    elif any(q in addr_lower for q in ["quận 2", "q.2", "q2", "thảo điền", "thao dien", "thủ đức", "thu duc", "quận 9", "q.9"]):
        return "branch_thao_dien"
    elif any(q in addr_lower for q in ["quận 1", "q.1", "q1", "quận 4", "q.4", "q4", "bình thạnh", "binh thanh", "phú nhuận", "phu nhuan"]):
        return "branch_q1"
    elif any(q in addr_lower for q in ["ngoại tỉnh", "tỉnh", "hà nội", "ha noi", "đà nẵng", "da nang", "hải phòng", "cần thơ", "bình dương", "đồng nai"]):
        return "admin"
    else:
        # Nếu địa chỉ không xác định được hoặc quá ngắn -> đưa về admin
        if not addr_lower or len(addr_lower) < 5:
            return "admin"
        return "branch_q10"


def get_available_delivery_slots(delivery_date_str: str) -> List[Dict[str, Any]]:
    """
    Trả về danh sách khung giờ giao hàng còn trống cho một ngày cụ thể (trong vòng 30 ngày).
    """
    try:
        req_date = datetime.strptime(delivery_date_str, "%Y-%m-%d").date()
    except Exception:
        req_date = datetime.now().date()

    today = datetime.now().date()
    now_hour = datetime.now().hour

    slots_result = []
    is_today = (req_date == today)

    for slot in STANDARD_TIME_SLOTS:
        slot_end_hour = int(slot["end"].split(":")[0])
        # Nếu giao trong ngày hôm nay, chỉ hiển thị các slot cách giờ hiện tại ít nhất 2 tiếng
        available = True
        if is_today and (now_hour + 2 >= slot_end_hour):
            available = False

        slots_result.append({
            "id": slot["id"],
            "name": slot["name"],
            "start": slot["start"],
            "end": slot["end"],
            "available": available,
            "quotaLeft": 8 if available else 0
        })

    return slots_result


def generate_order_code() -> str:
    """Sinh mã đơn hàng thân thiện cho người dùng, ví dụ: NHTB-260822-A8K2"""
    date_part = datetime.now().strftime("%y%m%d")
    random_part = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"NHTB-{date_part}-{random_part}"


def create_order(
    order_data: Dict[str, Any],
    authenticated_user: Optional[Dict[str, Any]] = None
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Tạo đơn hàng mới với đầy đủ tính năng:
    - Hẹn ngày (30 ngày), Khung giờ / Giao hỏa tốc 2H
    - Lời chúc viết thiệp & In banner ruy-băng
    - Chỉ dẫn địa chỉ giao hàng (deliveryNotes)
    - Tùy chọn gửi hoa ẩn danh
    - Áp dụng Voucher & Tích lũy điểm CRM
    """
    if not order_data or not isinstance(order_data, dict):
        return False, None, "Dữ liệu đơn hàng không hợp lệ"

    sender = order_data.get("sender") or {}
    recipient = order_data.get("recipient") or {}
    delivery = order_data.get("delivery") or {}
    customization = order_data.get("customization") or {}
    items = order_data.get("items") or []

    # 1. Kiểm tra thông tin người gửi & người nhận
    sender_name = (sender.get("name") or "").strip()
    sender_phone = (sender.get("phone") or "").strip()
    recipient_name = (recipient.get("name") or "").strip()
    recipient_phone = (recipient.get("phone") or "").strip()
    recipient_address = (recipient.get("address") or "").strip()

    if not sender_phone:
        return False, None, "Vui lòng nhập số điện thoại người gửi"
    if not recipient_name or not recipient_phone or not recipient_address:
        return False, None, "Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ người nhận"

    # 2. Kiểm tra danh sách sản phẩm
    if not items or not isinstance(items, list):
        return False, None, "Giỏ hàng của bạn đang trống"

    valid_items = []
    subtotal = 0

    for itm in items:
        p_id = itm.get("productId") or itm.get("id")
        qty = int(itm.get("quantity") or 1)
        if qty <= 0:
            qty = 1

        product = get_product_by_id(p_id)
        if product:
            p_name = product.get("name")
            p_price = int(product.get("priceNumber") or 0)
            p_img = product.get("image") or ""
        else:
            p_name = itm.get("name") or "Sản phẩm hoa tươi"
            p_price = int(itm.get("price") or 0)
            p_img = itm.get("image") or ""

        item_total = p_price * qty
        subtotal += item_total
        valid_items.append({
            "productId": p_id,
            "productName": p_name,
            "price": p_price,
            "quantity": qty,
            "itemTotal": item_total,
            "image": p_img
        })

    # 3. Tính toán ngày giờ giao hàng
    today = datetime.now().date()
    delivery_date_str = delivery.get("deliveryDate") or today.strftime("%Y-%m-%d")
    try:
        del_date = datetime.strptime(delivery_date_str, "%Y-%m-%d").date()
    except Exception:
        del_date = today
        delivery_date_str = today.strftime("%Y-%m-%d")

    # Giới hạn chọn trước tối đa 30 ngày
    if del_date < today or (del_date - today).days > 30:
        return False, None, "Ngày giao hoa phải nằm trong khoảng từ hôm nay đến 30 ngày tới"

    is_express = bool(delivery.get("isExpress2H", False))
    time_slot = delivery.get("timeSlot") or ("Giao Hỏa Tốc 2H" if is_express else "09:00 - 11:00")

    # 4. Tính phí vận chuyển (Shipping Fee)
    shipping_fee = 0
    if is_express:
        shipping_fee = 50000
    elif subtotal < 500000:
        shipping_fee = 35000
    else:
        shipping_fee = 0  # Freeship cho đơn từ 500K

    # 5. Áp dụng mã giảm giá (Voucher)
    voucher_code = (order_data.get("voucherCode") or "").strip().upper()
    discount_amount = 0
    applied_voucher = None

    if voucher_code:
        promo = get_promotion_by_code(voucher_code)
        if promo and promo.get("isActive", True):
            min_amt = promo.get("minOrderAmount", 0)
            if subtotal >= min_amt:
                disc_type = promo.get("discountType", "percentage")
                disc_val = promo.get("discountValue", 0)
                max_disc = promo.get("maxDiscountAmount", 999999999)

                if disc_type == "percentage":
                    discount_amount = min(int(subtotal * disc_val / 100), max_disc)
                else:
                    discount_amount = min(disc_val, max_disc)

                applied_voucher = {
                    "code": voucher_code,
                    "title": promo.get("title", ""),
                    "discountAmount": discount_amount
                }

    # 5b. Tính phí dịch vụ cắm hoa nghệ thuật nếu khách yêu cầu (+50% trên tổng tiền hoa)
    customization = order_data.get("customization") or {}
    request_arranging = bool(
        order_data.get("requestArranging")
        or (customization.get("requestArranging") if isinstance(customization, dict) else False)
        or order_data.get("requiresArranging")
    )
    arranging_notes = (
        order_data.get("arrangingNotes")
        or (customization.get("arrangingNotes") if isinstance(customization, dict) else "")
        or ""
    ).strip()
    arranging_fee = int(round(subtotal * 0.5)) if request_arranging else 0

    final_total = max(0, subtotal + arranging_fee + shipping_fee - discount_amount)

    # 6. Xác định chi nhánh xử lý đơn hàng
    #    - Nếu khách chọn chi nhánh cụ thể (pickup hoặc giao từ chi nhánh hợp lệ) -> dùng chi nhánh đó.
    #    - Nếu không có chi nhánh (đơn đặt online giao hàng) -> gán về 'admin' để Tổng Quản Trị tiếp nhận & điều phối sau.
    fulfillment_type = (order_data.get("fulfillmentType") or delivery.get("fulfillmentType") or "delivery").strip().lower()
    requested_branch_id = (order_data.get("branchId") or delivery.get("branchId") or "").strip()

    recipient_lat = recipient.get("lat")
    recipient_lng = recipient.get("lng")

    if requested_branch_id:
        if requested_branch_id.lower() == "admin":
            assigned_branch_id = "admin"
        else:
            requested_branch = get_branch_by_id(requested_branch_id)
            if requested_branch and requested_branch.get("isActive", True):
                assigned_branch_id = requested_branch_id
            else:
                # Không tìm thấy chi nhánh hợp lệ -> gán về Admin điều phối
                assigned_branch_id = "admin"
    else:
        # Đơn trực tuyến không chọn chi nhánh -> Tạm thời giao về cho Admin điều phối
        assigned_branch_id = "admin"

    # 6b. Gán người xử lý (assignedTo):
    #     - Nếu đơn thuộc 'admin' -> gán cho Super Admin (staff_admin).
    #     - Nếu đơn thuộc 1 chi nhánh cụ thể -> gán cho Quản lý chi nhánh đó.
    assigned_manager_id = None
    if assigned_branch_id == "admin":
        assigned_manager_id = "staff_admin"
    else:
        assigned_branch = get_branch_by_id(assigned_branch_id)
        if assigned_branch:
            assigned_manager_id = assigned_branch.get("managerId")

    if not assigned_manager_id:
        # Fallback: gán cho Admin toàn chuỗi
        assigned_manager_id = "staff_admin"

    # 6c. Kiểm tra cấu hình bật/tắt phương thức thanh toán (paymentConfig.json)
    from data_service import get_payment_config
    payment_config = get_payment_config(use_cache=False)
    methods_cfg = (payment_config.get("methods") or {}) if isinstance(payment_config, dict) else {}
    req_pay_method = (order_data.get("paymentMethod") or "vietqr").strip().lower()

    if req_pay_method in ["vietqr", "online", "bank", "transfer"]:
        online_cfg = methods_cfg.get("online") or {}
        if online_cfg and online_cfg.get("enabled") is False:
            return False, None, "Phương thức thanh toán Online (VietQR) hiện đang tạm ngưng phục vụ"
    elif req_pay_method in ["cash", "cod", "pickup"]:
        cash_cfg = methods_cfg.get("cash") or {}
        if cash_cfg and cash_cfg.get("enabled") is False:
            return False, None, "Phương thức thanh toán Tiền mặt (COD) hiện đang tạm ngưng phục vụ"

    # 7. Khởi tạo đối tượng đơn hàng chuẩn
    order_id = f"ord_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:6]}"
    order_code = generate_order_code()
    created_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")

    customer_id = (authenticated_user.get("id") or authenticated_user.get("userId")) if authenticated_user else None
    created_by_id = customer_id or sender_phone or "online_guest"

    is_anonymous = bool(sender.get("isAnonymous", False)) or bool(order_data.get("isAnonymous", False))
    card_msg = (customization.get("cardMessage") or order_data.get("cardMessage") or "").strip()
    ribbon_msg = (customization.get("ribbonBanner") or order_data.get("ribbonBanner") or "").strip()

    new_order = {
        "id": order_id,
        "orderCode": order_code,
        "createdAt": created_at,
        "orderDate": created_at,
        "updatedAt": created_at,
        "branchId": assigned_branch_id,
        "customerId": customer_id,
        "createdBy": created_by_id,
        "assignedTo": assigned_manager_id,
        "assignedBy": "system",
        "status": "pending",
        "cardMessage": card_msg,
        "ribbonBanner": ribbon_msg,
        "sender": {
            "name": "Người gửi bí mật (Ẩn danh)" if is_anonymous else sender_name,
            "realName": sender_name,
            "phone": sender_phone,
            "email": sender.get("email", ""),
            "isAnonymous": is_anonymous
        },
        "recipient": {
            "name": recipient_name,
            "phone": recipient_phone,
            "address": recipient_address,
            "deliveryNotes": recipient.get("deliveryNotes", ""),
            "lat": recipient_lat,
            "lng": recipient_lng
        },
        "delivery": {
            "deliveryDate": delivery_date_str,
            "timeSlot": time_slot,
            "isExpress2H": is_express,
            "fulfillmentType": fulfillment_type
        },
        "requiresArranging": request_arranging,
        "arrangingFee": arranging_fee,
        "arrangingNotes": arranging_notes,
        "customization": {
            "cardMessage": card_msg,
            "ribbonBanner": ribbon_msg,
            "requestArranging": request_arranging,
            "arrangingNotes": arranging_notes,
            "arrangingFee": arranging_fee
        },
        "items": valid_items,
        "financials": {
            "subtotal": subtotal,
            "arrangingFee": arranging_fee,
            "shippingFee": shipping_fee,
            "discountAmount": discount_amount,
            "totalAmount": final_total,
            "appliedVoucher": applied_voucher
        },
        "totalAmount": final_total,
        "payment": build_order_payment_info(
            order_code=order_code,
            total_amount=final_total,
            method=order_data.get("paymentMethod", "vietqr")
        ),
        "history": [
            {
                "status": "pending",
                "updatedAt": created_at,
                "note": "Khách hàng tạo đơn hàng trực tuyến",
                "updatedBy": sender_phone
            }
        ]
    }

    # 8. Lưu vào phân mảnh đơn hàng theo tháng (orders_YYYY_MM.json)
    save_success = save_order(new_order)
    if not save_success:
        return False, None, "Lỗi lưu đơn hàng vào hệ thống lưu trữ"

    # 9. Tự động đồng bộ vào thư mục cá nhân của khách hàng (config/anne/users/{user_id}/orders.json)
    sync_order_to_user_folder(new_order)

    # 10. Tích lũy điểm CRM cho khách hàng (1 điểm mỗi 10,000 VND)
    earned_points = final_total // 10000
    _update_customer_crm_after_order(sender_phone, sender_name, sender.get("email", ""), earned_points, final_total)

    return True, new_order, None


def _update_customer_crm_after_order(
    phone: str,
    full_name: str,
    email: str,
    earned_points: int,
    spent_amount: int
):
    """Cập nhật hoặc thêm mới khách hàng vào CRM và tích điểm thành viên."""
    if not phone:
        return
    customers = get_customers()
    existing = None
    for c in customers:
        if (c.get("phone") or "").strip() == phone.strip():
            existing = c
            break

    if existing:
        existing["loyaltyPoints"] = existing.get("loyaltyPoints", 0) + earned_points
        existing["totalSpent"] = existing.get("totalSpent", 0) + spent_amount
        existing["orderCount"] = existing.get("orderCount", 0) + 1
        if full_name:
            existing["fullName"] = full_name
        if email and not existing.get("email"):
            existing["email"] = email
    else:
        new_cust = {
            "id": f"cust_{int(datetime.now().timestamp())}",
            "phone": phone.strip(),
            "fullName": full_name or "Khách hàng",
            "email": email or "",
            "tier": "silver",
            "loyaltyPoints": earned_points,
            "totalSpent": spent_amount,
            "orderCount": 1,
            "flowerPreferences": "",
            "savedAddresses": [],
            "createdAt": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
        }
        customers.append(new_cust)

    save_customers(customers)


def get_order_updated_at(order: Dict[str, Any]) -> str:
    """
    Trả về timestamp ISO cập nhật mới nhất của đơn hàng:
    Ưu tiên trường updatedAt cấp 1 -> bản ghi history cuối cùng -> createdAt / orderDate.
    """
    if order.get("updatedAt"):
        return str(order["updatedAt"])
    history = order.get("history")
    if history and isinstance(history, list) and len(history) > 0:
        latest = history[-1]
        if isinstance(latest, dict) and latest.get("updatedAt"):
            return str(latest["updatedAt"])
    return str(order.get("createdAt") or order.get("orderDate") or "")


def query_admin_orders(
    current_user: Dict[str, Any],
    timeframe: str = "this_month",
    branch_id: Optional[str] = None,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    month_key: Optional[str] = None,
    sort_by: str = "updatedAt",
    sort_order: str = "desc",
    date_filter_by: str = "createdAt"
) -> Dict[str, Any]:
    """
    Quản lý & Thống kê đơn hàng chuyên sâu cho Admin / Quản lý chi nhánh theo Tuần, Tháng, Quý:
    - timeframe: 'today' (hôm nay), 'this_week' (tuần này), 'this_month' (tháng này), 'last_month' (tháng trước), 'all' (toàn thời gian), 'custom' (tùy chọn)
    - sort_by: 'updatedAt' (mặc định), 'createdAt', 'totalAmount', 'deliveryDate'
    - sort_order: 'desc' (giảm dần / mới nhất), 'asc' (tăng dần / cũ nhất)
    - date_filter_by: 'createdAt' (mặc định) hoặc 'updatedAt'
    - Tự động phân quyền: Quản lý chi nhánh chỉ xem đơn của chi nhánh mình, Super Admin xem toàn chuỗi.
    - Trả về danh sách đơn hàng đã lọc và bộ chỉ số thống kê doanh thu (Doanh thu tuần, tháng, biểu đồ theo ngày).
    """
    now = datetime.now()
    role = current_user.get("role", "staff")
    user_branch = current_user.get("branchId")
    current_ym, prev_ym = get_system_current_and_prev_ym()

    # 1. Xác định tập đơn hàng cơ sở cần nạp
    orders_pool: List[Dict[str, Any]] = []
    if month_key:
        orders_pool = read_orders_by_month(month_key)
    elif timeframe in ["this_month", "today", "this_week"]:
        orders_pool = read_orders_by_month(current_ym)
    elif timeframe == "last_month":
        orders_pool = read_orders_by_month(prev_ym)
    else:
        # 'all' hoặc 'custom' qua nhiều tháng -> đọc từ toàn bộ các file tháng
        from data_service import get_all_orders_across_all_months
        orders_pool = get_all_orders_across_all_months()

    # 2. Xác định khoảng thời gian lọc (Filter Date Range)
    filter_start = None
    filter_end = None

    if month_key:
        ym_norm = month_key.replace("_", "-")
        filter_start = f"{ym_norm}-01T00:00:00"
        filter_end = f"{ym_norm}-31T23:59:59"
    elif timeframe == "today":
        today_str = now.strftime("%Y-%m-%d")
        filter_start = today_str + "T00:00:00"
        filter_end = today_str + "T23:59:59"
    elif timeframe == "this_week":
        # Thứ 2 đầu tuần đến Chủ Nhật cuối tuần
        monday = now - timedelta(days=now.weekday())
        sunday = monday + timedelta(days=6)
        filter_start = monday.strftime("%Y-%m-%d") + "T00:00:00"
        filter_end = sunday.strftime("%Y-%m-%d") + "T23:59:59"
    elif timeframe == "this_month":
        month_prefix = current_ym.replace("_", "-")
        filter_start = f"{month_prefix}-01T00:00:00"
        filter_end = f"{month_prefix}-31T23:59:59"
    elif timeframe == "last_month":
        prev_prefix = prev_ym.replace("_", "-")
        filter_start = f"{prev_prefix}-01T00:00:00"
        filter_end = f"{prev_prefix}-31T23:59:59"
    elif timeframe == "custom":
        if start_date:
            filter_start = start_date + "T00:00:00" if "T" not in start_date else start_date
        if end_date:
            filter_end = end_date + "T23:59:59" if "T" not in end_date else end_date
    elif timeframe == "all":
        filter_start = None
        filter_end = None

    # 3. Phân quyền vị trí cửa hàng & an toàn đơn hàng:
    # - Super Admin: Không có vị trí cửa hàng cố định, xem được toàn chuỗi hoặc bất kỳ chi nhánh nào.
    # - Tất cả các vai trò khác (branch_manager, florist, sales_consultant, shipper):
    #   BẮT BUỘC bị khóa vào đúng vị trí cửa hàng trực thuộc (user_branch).
    target_branch = branch_id
    if role != "super_admin":
        if user_branch:
            target_branch = user_branch
        else:
            # Chưa phân bổ vị trí cửa hàng -> chặn hoàn toàn
            target_branch = "__STORE_LOCATION_REQUIRED__"

    # 4. Thực hiện lọc đơn hàng
    filtered_orders: List[Dict[str, Any]] = []
    clean_search = (search or "").strip().lower()

    for o in orders_pool:
        # Đồng bộ trường updatedAt cho đơn
        o_updated_at = get_order_updated_at(o)
        o["updatedAt"] = o_updated_at

        # Lọc theo chi nhánh
        o_branch = o.get("assignedBranchId") or o.get("branchId")
        if target_branch and target_branch != "all" and o_branch != target_branch:
            continue

        # Lọc theo trạng thái đơn
        if status and status != "all" and o.get("status") != status:
            continue

        # Lọc theo thanh toán
        o_payment = o.get("payment", {})
        o_pay_status = o_payment.get("status", "unpaid")
        if payment_status and payment_status != "all" and o_pay_status != payment_status:
            continue

        # Lọc theo thời gian (ngày tạo hoặc ngày mới cập nhật)
        date_target = o_updated_at if date_filter_by in ["updatedAt", "updated_at", "updated"] else (o.get("createdAt") or o.get("orderDate") or "")
        if filter_start and date_target < filter_start:
            continue
        if filter_end and date_target > filter_end:
            continue

        # Tìm kiếm theo mã đơn, SĐT hoặc Tên khách
        if clean_search:
            sender = o.get("sender") or {}
            sender_name = (sender.get("name") or "").lower()
            sender_phone = (sender.get("phone") or "").lower()
            recipient = o.get("recipient") or {}
            recipient_name = (recipient.get("name") or "").lower()
            recipient_phone = (recipient.get("phone") or "").lower()
            order_code = (o.get("orderCode") or o.get("id") or "").lower()

            if (clean_search not in order_code and 
                clean_search not in sender_name and 
                clean_search not in sender_phone and 
                clean_search not in recipient_name and 
                clean_search not in recipient_phone):
                continue

        # Bổ sung thông tin hiển thị (tên người tạo, người thực hiện, cửa hàng xử lý)
        enrich_order_display_names(o)
        filtered_orders.append(o)

    # Sắp xếp theo tiêu chí sortBy và sortOrder
    reverse_order = (str(sort_order).lower() != "asc")
    clean_sort_by = (sort_by or "updatedAt").strip()

    if clean_sort_by in ["updatedAt", "updated_at", "updated"]:
        filtered_orders.sort(key=lambda x: get_order_updated_at(x), reverse=reverse_order)
    elif clean_sort_by in ["createdAt", "created_at", "created"]:
        filtered_orders.sort(key=lambda x: (x.get("createdAt") or x.get("orderDate") or ""), reverse=reverse_order)
    elif clean_sort_by in ["totalAmount", "total_amount", "amount"]:
        filtered_orders.sort(
            key=lambda x: float(x.get("financials", {}).get("totalAmount") or x.get("totalAmount") or 0),
            reverse=reverse_order
        )
    elif clean_sort_by in ["deliveryDate", "delivery_date"]:
        filtered_orders.sort(
            key=lambda x: str((x.get("delivery") or {}).get("deliveryDate") or ""),
            reverse=reverse_order
        )
    else:
        filtered_orders.sort(key=lambda x: get_order_updated_at(x), reverse=reverse_order)

    # 5. Tính toán bộ số liệu thống kê kinh doanh (Dashboard Metrics)
    total_revenue = 0
    total_orders = len(filtered_orders)
    completed_count = 0
    pending_count = 0
    arranging_count = 0
    shipping_count = 0
    cancelled_count = 0

    revenue_by_branch = {}
    revenue_by_day = {}

    for o in filtered_orders:
        f_amount = o.get("financials", {}).get("totalAmount") or o.get("totalAmount") or 0
        st = o.get("status", "pending")

        if st != "cancelled":
            total_revenue += f_amount

        if st == "completed":
            completed_count += 1
        elif st == "pending":
            pending_count += 1
        elif st == "arranging":
            arranging_count += 1
        elif st == "shipping":
            shipping_count += 1
        elif st == "cancelled":
            cancelled_count += 1

        # Theo chi nhánh
        b_id = o.get("assignedBranchId") or o.get("branchId") or "unknown"
        revenue_by_branch[b_id] = revenue_by_branch.get(b_id, 0) + f_amount

        # Theo ngày (để vẽ biểu đồ doanh thu theo tuần/tháng)
        day_key = (o.get("createdAt") or "")[:10]
        if day_key:
            revenue_by_day[day_key] = revenue_by_day.get(day_key, 0) + f_amount

    return {
        "timeframe": timeframe,
        "sortBy": clean_sort_by,
        "sortOrder": "desc" if reverse_order else "asc",
        "dateFilterBy": date_filter_by,
        "totalOrders": total_orders,
        "totalRevenue": total_revenue,
        "metrics": {
            "completed": completed_count,
            "pending": pending_count,
            "arranging": arranging_count,
            "shipping": shipping_count,
            "cancelled": cancelled_count
        },
        "revenueByBranch": revenue_by_branch,
        "revenueByDay": dict(sorted(revenue_by_day.items())),
        "orders": filtered_orders
    }


def dispatch_order_to_branch(
    order_id: str,
    target_branch_id: str,
    current_user: Dict[str, Any],
    note: Optional[str] = None
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Điều phối / gán đơn hàng từ Tổng Quản Trị (Admin) sang chi nhánh Showroom cụ thể:
    - Kiểm tra đơn hàng tồn tại.
    - Kiểm tra chi nhánh mục tiêu tồn tại và đang hoạt động (nếu target_branch_id != 'admin').
    - Tự động gán người thực hiện xử lý (assignedTo) là Quản lý chi nhánh mục tiêu.
    - Cập nhật branchId, assignedBranchId, assignedTo, assignedBy.
    - Di chuyển file JSON nguyên tử qua save_order sang thư mục Kanban của chi nhánh mới.
    - Ghi nhận vết lịch sử xử lý (History) và đồng bộ sổ đơn của khách.
    """
    if not order_id or not target_branch_id:
        return False, None, "Thiếu mã đơn hàng hoặc mã chi nhánh điều phối"

    order = get_order_by_id(order_id)
    if not order:
        return False, None, f"Không tìm thấy đơn hàng '{order_id}'"

    clean_target = target_branch_id.strip().lower()
    target_manager_id = "staff_admin"
    target_branch_name = "Tổng Quản Trị / Trung Tâm (Admin)"

    if clean_target != "admin":
        branch_obj = get_branch_by_id(clean_target)
        if not branch_obj:
            return False, None, f"Chi nhánh mục tiêu '{target_branch_id}' không tồn tại"
        if not branch_obj.get("isActive", True):
            return False, None, f"Chi nhánh '{branch_obj.get('name')}' hiện đang tạm ngưng hoạt động"
        target_manager_id = branch_obj.get("managerId") or "staff_admin"
        target_branch_name = branch_obj.get("name") or clean_target

    now_iso = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
    dispatcher_id = current_user.get("userId") or current_user.get("id") or "staff_admin"
    dispatcher_name = current_user.get("fullName") or current_user.get("name") or "Tổng Quản Trị"

    dispatch_note = (note or "").strip() or f"Admin điều phối đơn hàng sang '{target_branch_name}' cho quản lý phụ trách"

    # Cập nhật thông tin phân bổ
    order["branchId"] = clean_target
    order["assignedBranchId"] = clean_target
    order["assignedTo"] = target_manager_id
    order["assignedBy"] = dispatcher_id
    order["updatedAt"] = now_iso

    # Ghi nhận lịch sử điều phối
    history_entry = {
        "status": order.get("status", "pending"),
        "branchId": clean_target,
        "assignedTo": target_manager_id,
        "updatedAt": now_iso,
        "note": dispatch_note,
        "updatedBy": f"{dispatcher_name} ({dispatcher_id})"
    }
    history = order.get("history") or []
    if not isinstance(history, list):
        history = []
    history.append(history_entry)
    order["history"] = history

    # Bổ sung tên hiển thị người tạo, người thực hiện, cửa hàng
    enrich_order_display_names(order)

    # Lưu đơn hàng -> tự động di chuyển file sang thư mục chi nhánh mới
    saved = save_order(order)
    if not saved:
        return False, None, "Lỗi khi lưu đơn hàng và chuyển nhượng thư mục chi nhánh"

    return True, order, None


def filter_tasks_for_staff(
    orders: List[Dict[str, Any]],
    current_user: Dict[str, Any],
    mode: str = "auto"
) -> List[Dict[str, Any]]:
    """
    Lọc danh sách công việc chính xác theo thông tin người dùng, vai trò & vị trí cửa hàng.
    Đảm bảo an toàn đơn hàng và nguyên tắc đặc quyền tối thiểu (Least Privilege):
    - super_admin: Không bị giới hạn vị trí cửa hàng, xem được toàn bộ đơn hàng (hoặc mode='my_tasks').
    - branch_manager: Xem toàn bộ đơn hàng thuộc chi nhánh phụ trách để điều phối, phân công (assignedTo)
      và giám sát ca trực. Nếu mode='my_tasks', chỉ lọc các đơn gán trực tiếp cho quản lý.
    - florist (Thợ cắm hoa nghệ thuật):
      + Chỉ nhận các đơn CẦN CẮM HOA NGHỆ THUẬT: requiresArranging is not False.
        (Đơn hoa cành / bó sẵn fast-track requiresArranging: false được đóng gói sẵn, thợ cắm hoa không cần làm).
      + Trạng thái nằm trong tiến trình cắm hoa: ['confirmed', 'arranging', 'photo_sent'].
      + Nếu đơn đã gán đích danh cho thợ khác (assignedTo), chỉ thợ đó mới thấy;
        nếu chưa gán hoặc gán chung cho quản lý chi nhánh/admin, hiển thị để thợ có thể nhận việc.
    - sales_consultant (Nhân viên tư vấn / Thu ngân):
      + Đơn mới cần gọi điện xác nhận: status == 'pending'.
      + Đơn cần thu tiền mặt tại quầy / COD: payment.status == 'unpaid'.
    - shipper (Nhân viên giao hàng):
      + Chỉ nhận các đơn giao tận nơi: fulfillmentType == 'delivery'.
      + Đơn sẵn sàng giao: status in ['photo_sent', 'ready_for_pickup'] hoặc (status == 'confirmed' và not requiresArranging).
      + Đơn đang giao của mình: status == 'shipping' và (not assignedTo or assignedTo == userId).
    """
    if not current_user:
        return []

    role = current_user.get("role")
    user_id = current_user.get("userId") or current_user.get("id")

    # 1. Super Admin: Toàn quyền, không bị giới hạn vị trí cửa hàng
    if role == "super_admin":
        if mode == "my_tasks" and user_id:
            return [o for o in orders if o.get("assignedTo") == user_id]
        return orders

    # 2. Branch Manager: Quản lý toàn bộ đơn trong chi nhánh phụ trách
    if role == "branch_manager":
        if mode == "my_tasks" and user_id:
            return [o for o in orders if o.get("assignedTo") == user_id]
        return orders

    # 3. Florist: Thợ cắm hoa nghệ thuật
    if role == "florist":
        tasks = []
        for o in orders:
            # Loại bỏ đơn fast-track tiêu chuẩn (hoa cành/bó sẵn không cần cắm)
            if o.get("requiresArranging") is False:
                continue
            # Chỉ lấy trạng thái trong quy trình cắm hoa
            st = o.get("status")
            if st not in ["confirmed", "arranging", "photo_sent"]:
                continue
            # Kiểm tra phân công: nếu đã gán đích danh cho thợ khác -> ẩn đi
            assigned_to = o.get("assignedTo")
            if assigned_to and user_id and assigned_to != user_id:
                # Nếu được gán cho quản lý chi nhánh hoặc admin chung -> hiển thị trong pool nhận việc
                if not (assigned_to.startswith("staff_manager") or assigned_to.startswith("staff_admin")):
                    continue
            tasks.append(o)
        return tasks

    # 4. Sales Consultant: Tư vấn & Thu ngân
    if role == "sales_consultant":
        tasks = []
        for o in orders:
            st = o.get("status")
            pay_status = (o.get("payment") or {}).get("status", "unpaid")
            if st == "pending" or pay_status == "unpaid":
                tasks.append(o)
        return tasks

    # 5. Shipper: Nhân viên giao hàng
    if role == "shipper":
        tasks = []
        for o in orders:
            delivery = o.get("delivery") or {}
            fulfillment = o.get("fulfillmentType") or delivery.get("fulfillmentType")
            if fulfillment != "delivery":
                continue
            st = o.get("status")
            req_arr = o.get("requiresArranging", True)
            assigned_to = o.get("assignedTo")

            if st in ["photo_sent", "ready_for_pickup"]:
                tasks.append(o)
            elif st == "confirmed" and req_arr is False:
                tasks.append(o)
            elif st == "shipping":
                if not assigned_to or not user_id or assigned_to == user_id or assigned_to.startswith("staff_manager") or assigned_to.startswith("staff_admin"):
                    tasks.append(o)
        return tasks

    return orders

