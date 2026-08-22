import os
import sys
import math
import uuid
import random
import string
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

from services.data_service import (
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
    update_order_status
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
    addr_lower = (address or "").lower()
    if any(q in addr_lower for q in ["quận 2", "q.2", "q2", "thảo điền", "thao dien", "thủ đức", "thu duc", "quận 9", "q.9"]):
        return "branch_thao_dien"
    elif any(q in addr_lower for q in ["quận 1", "q.1", "q1", "quận 4", "q.4", "bình thạnh", "binh thanh", "phú nhuận", "phu nhuan"]):
        return "branch_q1"
    else:
        # Mặc định về Flagship Q10 (phục vụ Q10, Q3, Q5, Q6, Q11, Tân Bình, Tân Phú...)
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

    final_total = max(0, subtotal + shipping_fee - discount_amount)

    # 6. Tự động gán chi nhánh gần nhất
    recipient_lat = recipient.get("lat")
    recipient_lng = recipient.get("lng")
    assigned_branch_id = assign_nearest_branch(recipient_address, recipient_lat, recipient_lng)

    # 7. Khởi tạo đối tượng đơn hàng chuẩn
    order_id = f"ord_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:6]}"
    order_code = generate_order_code()
    created_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")

    customer_id = (authenticated_user.get("id") or authenticated_user.get("userId")) if authenticated_user else None

    is_anonymous = bool(sender.get("isAnonymous", False))

    new_order = {
        "id": order_id,
        "orderCode": order_code,
        "createdAt": created_at,
        "orderDate": created_at,
        "branchId": assigned_branch_id,
        "customerId": customer_id,
        "status": "pending",
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
            "isExpress2H": is_express
        },
        "customization": {
            "cardMessage": customization.get("cardMessage", ""),
            "ribbonBanner": customization.get("ribbonBanner", "")
        },
        "items": valid_items,
        "financials": {
            "subtotal": subtotal,
            "shippingFee": shipping_fee,
            "discountAmount": discount_amount,
            "totalAmount": final_total,
            "appliedVoucher": applied_voucher
        },
        "totalAmount": final_total,
        "payment": {
            "method": order_data.get("paymentMethod", "vietqr"),
            "status": "unpaid",
            "transactionId": None,
            "paidAt": None
        },
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

    # 9. Tích lũy điểm CRM cho khách hàng (1 điểm mỗi 10,000 VND)
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
