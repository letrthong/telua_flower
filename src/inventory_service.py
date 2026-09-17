"""
Module Dịch Vụ Quản Lý Tồn Kho & Điều Phối Đa Chi Nhánh (Inventory & Smart Routing Service)
Hỗ trợ vòng đời tồn kho hoa tươi: Nhập (Daily Quota) -> Bán (Sold) -> Hao hụt (Wastage) -> Tồn khả dụng (Available).
"""

import os
import sys
import math
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_service import (
    get_products,
    save_products,
    get_branches,
    get_branch_by_id,
    get_wastage_reports,
    save_wastage_reports,
    add_wastage_report,
    get_all_orders_across_all_months,
    get_materials,
    save_materials,
    get_material_by_id,
    update_material_stock,
    sync,
    get_config_path,
    read_json,
    write_json,
)
from order_service import calculate_haversine_distance, assign_nearest_branch

VN_TZ = timezone(timedelta(hours=7))


def get_current_vn_date_str() -> str:
    """Trả về ngày hiện tại theo múi giờ Việt Nam (GMT+7) định dạng YYYY-MM-DD."""
    return datetime.now(VN_TZ).strftime("%Y-%m-%d")


def get_product_stock_for_branch(product: Dict[str, Any], branch_id: str, date_str: Optional[str] = None) -> Dict[str, Any]:
    """
    Tính toán tồn kho hiện tại cho một sản phẩm tại một chi nhánh cụ thể:
    Available = Daily Quota - Sold - Wastage
    """
    if not date_str:
        date_str = get_current_vn_date_str()

    p_id = product.get("id")
    stock_by_branch = product.get("stockByBranch") or {}
    imported = int(stock_by_branch.get(branch_id, 0))

    # 1. Tính Sold hôm nay
    sold = 0
    orders = get_all_orders_across_all_months(branch_id=branch_id)
    for ord_dict in orders:
        if ord_dict.get("status") in ["cancelled", "returned"]:
            continue
        ord_date = ord_dict.get("createdAt", "")[:10]
        del_date = (ord_dict.get("delivery") or {}).get("deliveryDate")
        if ord_date == date_str or del_date == date_str:
            for itm in ord_dict.get("items") or []:
                if (itm.get("productId") or itm.get("id")) == p_id:
                    sold += int(itm.get("quantity") or 1)

    # 2. Tính Wastage hôm nay
    wastage = 0
    all_wastage = get_wastage_reports()
    for rep in all_wastage:
        if rep.get("branchId") != branch_id:
            continue
        rep_date = rep.get("date") or rep.get("createdAt", "")[:10]
        if rep_date == date_str:
            for item in rep.get("items") or []:
                if item.get("productId") == p_id:
                    wastage += int(item.get("damagedStems") or 0)

    available = max(0, imported - sold - wastage)
    status = "in_stock" if available >= 5 else ("low_stock" if available > 0 else "out_of_stock")

    return {
        "productId": p_id,
        "branchId": branch_id,
        "date": date_str,
        "imported": imported,
        "sold": sold,
        "wastage": wastage,
        "available": available,
        "status": status
    }


def get_inventory_matrix(date_str: Optional[str] = None, branch_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Tổng hợp Ma Trận Tồn Kho Toàn Chuỗi (Daily Inventory Matrix) cho một ngày cụ thể (mặc định hôm nay).
    Công thức: Available = Imported (Daily Quota) - Sold - Wastage
    """
    if not date_str:
        date_str = get_current_vn_date_str()

    products = get_products()
    branches = get_branches()
    active_branches = [b for b in branches if b.get("isActive", True)]

    # Tập hợp dữ liệu Đã bán (Sold) trong ngày
    orders = get_all_orders_across_all_months()
    sold_map: Dict[Tuple[str, str], int] = {}  # (productId, branchId) -> count
    total_sold_today = 0

    for ord_dict in orders:
        if ord_dict.get("status") in ["cancelled", "returned"]:
            continue
        ord_date = ord_dict.get("createdAt", "")[:10]
        del_date = (ord_dict.get("delivery") or {}).get("deliveryDate")
        if ord_date == date_str or del_date == date_str:
            o_branch = ord_dict.get("branchId") or ord_dict.get("assignedBranchId") or "branch_q10"
            for itm in ord_dict.get("items") or []:
                p_id = itm.get("productId") or itm.get("id")
                qty = int(itm.get("quantity") or 1)
                sold_map[(p_id, o_branch)] = sold_map.get((p_id, o_branch), 0) + qty
                total_sold_today += qty

    # Tập hợp dữ liệu Hao hụt (Wastage) trong ngày
    all_wastage = get_wastage_reports()
    wastage_map: Dict[Tuple[str, str], int] = {}  # (productId, branchId) -> count
    total_wastage_stems = 0
    total_wastage_amount = 0

    for rep in all_wastage:
        rep_date = rep.get("date") or rep.get("createdAt", "")[:10]
        if rep_date == date_str:
            r_branch = rep.get("branchId")
            total_wastage_amount += int(rep.get("totalLossAmount") or 0)
            for item in rep.get("items") or []:
                stems = int(item.get("damagedStems") or 0)
                total_wastage_stems += stems
                p_id = item.get("productId")
                if p_id:
                    wastage_map[(p_id, r_branch)] = wastage_map.get((p_id, r_branch), 0) + stems

    matrix_rows = []
    total_system_imported = 0
    total_system_available = 0
    low_stock_count = 0
    out_of_stock_count = 0

    for prod in products:
        p_id = prod.get("id")
        stock_by_branch = prod.get("stockByBranch") or {}

        branch_stats: Dict[str, Dict[str, Any]] = {}
        prod_total_imported = 0
        prod_total_sold = 0
        prod_total_wastage = 0
        prod_total_available = 0

        has_low_stock = False
        all_branches_out = True

        for b in active_branches:
            b_id = b["id"]
            imported = int(stock_by_branch.get(b_id, 0))
            sold = sold_map.get((p_id, b_id), 0)
            wastage = wastage_map.get((p_id, b_id), 0)
            avail = max(0, imported - sold - wastage)

            if avail >= 5:
                b_status = "in_stock"
                all_branches_out = False
            elif avail > 0:
                b_status = "low_stock"
                has_low_stock = True
                all_branches_out = False
            else:
                b_status = "out_of_stock"

            branch_stats[b_id] = {
                "branchId": b_id,
                "branchName": b.get("name"),
                "imported": imported,
                "sold": sold,
                "wastage": wastage,
                "available": avail,
                "status": b_status
            }

            prod_total_imported += imported
            prod_total_sold += sold
            prod_total_wastage += wastage
            prod_total_available += avail

        if has_low_stock:
            low_stock_count += 1
        if all_branches_out:
            out_of_stock_count += 1

        total_system_imported += prod_total_imported
        total_system_available += prod_total_available

        prod_status = "in_stock" if prod_total_available >= 5 else ("low_stock" if prod_total_available > 0 else "out_of_stock")

        matrix_rows.append({
            "id": p_id,
            "name": prod.get("name"),
            "category": prod.get("category"),
            "priceNumber": prod.get("priceNumber"),
            "salePrice": prod.get("salePrice"),
            "image": prod.get("image"),
            "dailyQuota": prod.get("dailyQuota", prod_total_imported),
            "stockByBranch": stock_by_branch,
            "branches": branch_stats,
            "totalImported": prod_total_imported,
            "totalSold": prod_total_sold,
            "totalWastage": prod_total_wastage,
            "totalAvailable": prod_total_available,
            "status": prod_status,
            "isActive": prod.get("isActive", True)
        })

    # Lọc theo branch_id nếu được yêu cầu
    filtered_rows = matrix_rows
    if branch_id and branch_id != "all":
        # Giữ matrix_rows nhưng đánh dấu highlight cho branch
        for r in filtered_rows:
            target_branch = r["branches"].get(branch_id)
            if target_branch:
                r["targetBranch"] = target_branch

    return {
        "date": date_str,
        "branches": [
            {
                "id": b["id"],
                "code": b.get("code"),
                "name": b.get("name"),
                "phone": b.get("phone")
            } for b in active_branches
        ],
        "summary": {
            "totalProducts": len(products),
            "totalImported": total_system_imported,
            "totalSold": total_sold_today,
            "totalWastageStems": total_wastage_stems,
            "totalWastageLossAmount": total_wastage_amount,
            "totalAvailable": total_system_available,
            "lowStockCount": low_stock_count,
            "outOfStockCount": out_of_stock_count
        },
        "matrix": filtered_rows
    }


def update_batch_inventory(
    updates: List[Dict[str, Any]],
    user_branch_id: Optional[str] = None,
    is_super_admin: bool = False
) -> Tuple[bool, Union[Dict[str, Any], str]]:
    """
    Cập nhật nhanh hạn mức nhập (Daily Quota) theo chi nhánh (Batch Update).
    Kiểm tra RBAC:
    - Super Admin được sửa mọi chi nhánh.
    - Quản lý chi nhánh (Branch Manager) chỉ được sửa chi nhánh của mình (`user_branch_id`).
    """
    if not isinstance(updates, list) or not updates:
        return False, "Dữ liệu cập nhật trống"

    products = get_products()
    prod_map = {p.get("id"): p for p in products}
    updated_count = 0
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    for item in updates:
        p_id = item.get("productId") or item.get("id")
        if not p_id or p_id not in prod_map:
            continue

        target_prod = prod_map[p_id]
        if "stockByBranch" not in target_prod or not isinstance(target_prod["stockByBranch"], dict):
            target_prod["stockByBranch"] = {}

        # Dạng 1: item có branchId và quota/stock
        if "branchId" in item:
            b_id = item["branchId"]
            quota = int(item.get("quota") if "quota" in item else item.get("stock", 0))
            if quota < 0:
                quota = 0

            # Kiểm tra RBAC
            if not is_super_admin and user_branch_id and b_id != user_branch_id:
                return False, f"Bạn chỉ có quyền chỉnh sửa tồn kho của chi nhánh {user_branch_id}"

            target_prod["stockByBranch"][b_id] = quota
            updated_count += 1

        # Dạng 2: item có object stockByBranch: { [branchId]: quota }
        elif "stockByBranch" in item and isinstance(item["stockByBranch"], dict):
            for b_id, quota_val in item["stockByBranch"].items():
                quota = max(0, int(quota_val or 0))
                # Kiểm tra RBAC
                if not is_super_admin and user_branch_id and b_id != user_branch_id:
                    return False, f"Bạn chỉ có quyền chỉnh sửa tồn kho của chi nhánh {user_branch_id}"
                target_prod["stockByBranch"][b_id] = quota
                updated_count += 1

        # Tự động cập nhật tổng dailyQuota = sum(stockByBranch.values())
        target_prod["dailyQuota"] = sum(int(v or 0) for v in target_prod["stockByBranch"].values())
        target_prod["updatedAt"] = now_iso

    success = save_products(products)
    if not success:
        return False, "Lỗi khi lưu dữ liệu tồn kho vào products.json"

    return True, {"updatedCount": updated_count, "productsAffected": len(updates)}


def create_wastage_report(
    data: Dict[str, Any],
    user_dict: Optional[Dict[str, Any]] = None
) -> Tuple[bool, Union[Dict[str, Any], str]]:
    """
    Lập phiếu báo hủy hoa hỏng / hao hụt nguyên vật liệu.
    """
    if not data or not isinstance(data, dict):
        return False, "Dữ liệu phiếu báo hủy không hợp lệ"

    branch_id = data.get("branchId")
    if not branch_id:
        return False, "Vui lòng chọn chi nhánh phát sinh hao hụt"

    # Kiểm tra RBAC nếu có user
    if user_dict:
        user_role = user_dict.get("role")
        user_branch = user_dict.get("branchId")
        if user_role not in ["super_admin", "admin"] and user_branch and branch_id != user_branch:
            return False, f"Bạn chỉ có quyền lập phiếu hủy cho chi nhánh {user_branch}"

    # Kiểm tra liên kết đợt nhập kho (Inbound-Linked Wastage)
    inbound_id = data.get("inboundId")
    inbound_code = data.get("inboundCode")
    inbound_obj = None
    if inbound_id:
        inbound_obj = get_inbound_receipt_by_id(inbound_id)
        if inbound_obj:
            inbound_code = inbound_obj.get("inboundCode") or inbound_id
            if inbound_obj.get("branchId") and inbound_obj.get("branchId") != branch_id:
                return False, f"Chi nhánh báo hủy không khớp với chi nhánh của đợt nhập {inbound_code}"
            
            # Kiểm tra xem đợt nhập này có gắn với đơn đề xuất đã đóng (closed) hay không
            req_file = get_config_path("purchase_requests.json")
            reqs = read_json(req_file, default=[])
            req_ref = inbound_obj.get("purchaseRequestId") or inbound_obj.get("requestCode")
            matched_req = next((r for r in reqs if (req_ref and (r.get("id") == req_ref or r.get("requestCode") == req_ref)) 
                                or r.get("fulfilledInboundId") == inbound_id 
                                or r.get("fulfilledInboundCode") == inbound_id
                                or (inbound_code and r.get("fulfilledInboundCode") == inbound_code)), None)
            if matched_req and (matched_req.get("status") or "").lower() == "closed":
                return False, "Đợt nhập hàng này thuộc đơn đề xuất đã được Admin đóng chốt sổ (closed), không thể báo hoa hỏng thêm"

    raw_items = data.get("items")
    if not raw_items or not isinstance(raw_items, list):
        if data.get("materialId") or data.get("productId") or data.get("flowerType") or data.get("productName"):
            raw_items = [data]
        else:
            return False, "Phiếu báo hủy phải có ít nhất 1 loại hoa hư hỏng"

    parsed_items = []
    total_loss_amount = 0

    # Lập bản đồ số lượng nhận của đợt nhập nếu có
    inbound_items_map = {}
    if inbound_obj and isinstance(inbound_obj.get("items"), list):
        for inb_it in inbound_obj["items"]:
            m_id = inb_it.get("materialId") or inb_it.get("productId") or ""
            clean_m_id = str(m_id).replace("mat:", "").replace("prod:", "")
            name_key = (inb_it.get("name") or inb_it.get("materialName") or "").strip().lower()
            rec_qty = int(inb_it.get("quantity") or 0)
            if clean_m_id:
                inbound_items_map[clean_m_id] = inbound_items_map.get(clean_m_id, 0) + rec_qty
            if name_key:
                inbound_items_map[name_key] = inbound_items_map.get(name_key, 0) + rec_qty

    for itm in raw_items:
        flower_type = (itm.get("flowerType") or itm.get("productName") or "").strip()
        damaged_stems = int(itm.get("damagedStems") or itm.get("quantity") or 0)
        if damaged_stems <= 0:
            continue

        mat_id = itm.get("materialId")
        clean_mat_id = str(mat_id).replace("mat:", "").replace("prod:", "") if mat_id else ""
        name_key = flower_type.lower()

        # Nếu có đợt nhập, kiểm tra số lượng hỏng không vượt quá số thực nhận
        if inbound_items_map:
            allowed_qty = inbound_items_map.get(clean_mat_id) or inbound_items_map.get(name_key)
            if allowed_qty is not None and damaged_stems > allowed_qty:
                return False, f"Số lượng báo hỏng ({damaged_stems} cành) vượt quá số lượng thực nhận ({allowed_qty} cành) của '{flower_type}' trong đợt nhập {inbound_code or inbound_id}"

        unit_cost = int(itm.get("unitCost") or itm.get("costPrice") or 0)
        item_loss = damaged_stems * unit_cost
        total_loss_amount += item_loss

        # Tự động trừ kho hoa cành nếu có materialId
        if mat_id:
            update_material_stock(clean_mat_id or mat_id, branch_id, delta=-damaged_stems)

        parsed_items.append({
            "productId": itm.get("productId") or None,
            "materialId": mat_id or None,
            "flowerType": flower_type or "Hoa tươi",
            "damagedStems": damaged_stems,
            "reason": (itm.get("reason") or "Hoa dập/gãy cành do vận chuyển").strip(),
            "unitCost": unit_cost,
            "totalLoss": item_loss
        })

    if not parsed_items:
        return False, "Số lượng cành hoa báo hủy phải lớn hơn 0"

    now_dt = datetime.now(VN_TZ)
    date_str = data.get("date") or now_dt.strftime("%Y-%m-%d")
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    report_id = f"wastage_{now_dt.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:4]}"
    reported_by = (user_dict.get("id") or user_dict.get("userId") or user_dict.get("fullName")) if user_dict else data.get("reportedBy", "staff")

    month_key = date_str[:7].replace("-", "_")
    proof_images = data.get("proofImages") or []
    if isinstance(proof_images, str):
        proof_images = [proof_images]

    supplier = data.get("supplier") or (inbound_obj.get("supplier") if inbound_obj else None)
    request_code = data.get("requestCode") or (inbound_obj.get("requestCode") if inbound_obj else None)

    total_damaged_stems = sum(x.get("damagedStems", 0) for x in parsed_items)

    new_report = {
        "id": report_id,
        "inboundId": inbound_id,
        "inboundCode": inbound_code,
        "requestCode": request_code,
        "supplier": supplier,
        "branchId": branch_id,
        "date": date_str,
        "reportedBy": reported_by,
        "items": parsed_items,
        "proofImages": proof_images,
        "totalDamagedStems": total_damaged_stems,
        "totalLossAmount": total_loss_amount,
        "notes": (data.get("notes") or "").strip(),
        "createdAt": now_iso
    }

    # 1. Lưu phiếu báo hủy chi tiết vào inventory/wastage/{YYYY_MM}/
    try:
        wastage_dir = os.path.join(get_config_path("inventory"), "wastage", month_key)
        os.makedirs(wastage_dir, exist_ok=True)
        rep_file_path = os.path.join(wastage_dir, f"{report_id}.json")
        write_json(rep_file_path, new_report)
    except Exception as e:
        print(f"[WASTAGE_SAVE_WARNING] Không thể lưu file riêng lẻ vào {wastage_dir}: {e}")

    # 2. Đồng bộ vào wastage_reports.json trung tâm
    success = add_wastage_report(new_report)
    if not success:
        return False, "Không thể lưu phiếu báo hủy vào hệ thống"

    return True, new_report


def get_wastage_reports_list(
    branch_id: Optional[str] = None,
    date_str: Optional[str] = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """Lấy danh sách các phiếu báo hủy hoa hỏng có bộ lọc theo chi nhánh và ngày."""
    reports = get_wastage_reports()
    results = []

    for r in reports:
        if branch_id and branch_id != "all" and r.get("branchId") != branch_id:
            continue
        if date_str and (r.get("date") != date_str and r.get("createdAt", "")[:10] != date_str):
            continue
        results.append(r)

    results.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return results[:limit]


def find_best_routing_branch(
    customer_lat: Optional[float] = None,
    customer_lng: Optional[float] = None,
    district_or_address: str = "",
    items: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Thuật toán Điều Phối Đơn Hàng Thông Minh (Smart Order Routing):
    1. Kiểm tra tồn khả dụng (Available Stock) tại các chi nhánh cho danh sách sản phẩm.
    2. Trong số các chi nhánh còn đủ hàng, ưu tiên chi nhánh có khoảng cách địa lý gần nhất.
    3. Nếu không có chi nhánh nào đủ tất cả, trả về chi nhánh gần nhất và cờ cảnh báo thiếu hàng.
    """
    branches = get_branches()
    active_branches = [b for b in branches if b.get("isActive", True)]

    if not active_branches:
        return {
            "assignedBranchId": "branch_q10",
            "status": "fallback",
            "reason": "Không tìm thấy chi nhánh đang hoạt động"
        }

    date_today = get_current_vn_date_str()
    evaluated_branches = []

    for b in active_branches:
        b_id = b["id"]
        b_lat = b.get("lat")
        b_lng = b.get("lng")

        # Tính khoảng cách
        dist_km = None
        if customer_lat is not None and customer_lng is not None and b_lat is not None and b_lng is not None:
            dist_km = round(calculate_haversine_distance(customer_lat, customer_lng, b_lat, b_lng), 2)

        # Kiểm tra tồn kho của từng món trong giỏ hàng
        has_sufficient_stock = True
        insufficient_items = []

        if items:
            products = get_products()
            p_dict = {p.get("id"): p for p in products}

            for itm in items:
                p_id = itm.get("productId") or itm.get("id")
                qty = int(itm.get("quantity") or 1)
                prod = p_dict.get(p_id)
                if prod:
                    stock_info = get_product_stock_for_branch(prod, b_id, date_today)
                    avail = stock_info["available"]
                    if avail < qty:
                        has_sufficient_stock = False
                        insufficient_items.append({
                            "productId": p_id,
                            "required": qty,
                            "available": avail
                        })

        evaluated_branches.append({
            "branchId": b_id,
            "branchName": b.get("name"),
            "distanceKm": dist_km,
            "deliveryRadiusKm": b.get("deliveryRadiusKm", 10),
            "hasSufficientStock": has_sufficient_stock,
            "insufficientItems": insufficient_items
        })

    # Phân nhóm các chi nhánh còn đủ hàng
    branches_with_stock = [b for b in evaluated_branches if b["hasSufficientStock"]]

    # Ưu tiên chọn từ nhóm đủ hàng
    candidate_pool = branches_with_stock if branches_with_stock else evaluated_branches

    # Nếu có khoảng cách GPS, sắp xếp theo khoảng cách tăng dần
    if any(b["distanceKm"] is not None for b in candidate_pool):
        best_candidate = min(candidate_pool, key=lambda x: (x["distanceKm"] if x["distanceKm"] is not None else 9999))
    else:
        # Fallback theo địa chỉ / quận huyện
        nearest_b_id = assign_nearest_branch(district_or_address, customer_lat, customer_lng)
        if nearest_b_id == "admin":
            return {
                "assignedBranchId": "admin",
                "branchName": "Tổng Đại Lý / Ngoại Tỉnh",
                "distanceKm": None,
                "hasSufficientStock": True,
                "insufficientItems": [],
                "status": "admin_dispatch",
                "reason": "Đơn hàng ngoại tỉnh hoặc địa chỉ không thuộc showroom trực tiếp",
                "evaluatedBranches": evaluated_branches
            }
        match = next((b for b in candidate_pool if b["branchId"] == nearest_b_id), None)
        best_candidate = match if match else candidate_pool[0]

    all_in_stock = (len(branches_with_stock) > 0 and best_candidate in branches_with_stock)

    return {
        "assignedBranchId": best_candidate["branchId"],
        "branchName": best_candidate["branchName"],
        "distanceKm": best_candidate["distanceKm"],
        "hasSufficientStock": all_in_stock,
        "insufficientItems": best_candidate.get("insufficientItems", []),
        "status": "optimal" if all_in_stock else "stock_warning",
        "reason": "Đủ tồn kho và khoảng cách tối ưu" if all_in_stock else "Chi nhánh gần nhất (lưu ý thiếu một số tồn kho)",
        "evaluatedBranches": evaluated_branches
    }


# ==============================================================================
# PHÂN HỆ NHẬP KHO HOA CÀNH, TRỪ KHO ĐƠN HÀNG, COGS & BÁO CÁO THÁNG (V2)
# ==============================================================================

def create_inbound_receipt(
    data: Dict[str, Any],
    user_dict: Optional[Dict[str, Any]] = None
) -> Tuple[bool, Union[Dict[str, Any], str]]:
    """
    Lập phiếu nhập hoa tươi / phụ liệu nguyên vật liệu từ nhà vườn.
    Lưu phiếu vào config/anne/inventory/inbounds/{YYYY_MM}/inb_...json
    Tự động cộng dồn số lượng cành vào materials.json của chi nhánh.
    """
    if not data or not isinstance(data, dict):
        return False, "Dữ liệu phiếu nhập không hợp lệ"

    branch_id = data.get("branchId")
    if not branch_id:
        return False, "Vui lòng chọn chi nhánh nhận hàng"

    items = data.get("items") or []
    if not items or not isinstance(items, list):
        return False, "Phiếu nhập phải có ít nhất 1 loại nguyên vật liệu hoa cành"

    total_stems = 0
    total_cost = 0
    parsed_items = []

    for itm in items:
        mat_id = itm.get("materialId") or itm.get("productId") or itm.get("id")
        qty = int(itm.get("quantity") or 0)
        if qty <= 0:
            continue
        unit_cost = int(itm.get("costPrice") or itm.get("unitCost") or itm.get("unitPrice") or 0)
        item_total = qty * unit_cost

        total_stems += qty
        total_cost += item_total

        mat_info = get_material_by_id(mat_id)
        mat_name = itm.get("name") or itm.get("materialName") or (mat_info.get("name") if mat_info else "Hoa cành")
        unit = itm.get("unit") or (mat_info.get("unit") if mat_info else "cành")
        bundles = int(itm.get("bundles") or 0) if itm.get("bundles") else None
        stems_per_bundle = int(itm.get("stemsPerBundle") or 0) if itm.get("stemsPerBundle") else None
        import_mode = itm.get("importMode") or ("bundle" if bundles else "stem")

        parsed_items.append({
            "materialId": mat_id,
            "materialName": mat_name,
            "requestedQty": int(itm.get("requestedQty") or itm.get("quantity") or 0),
            "quantity": qty,
            "bundles": bundles,
            "stemsPerBundle": stems_per_bundle,
            "importMode": import_mode,
            "unit": unit,
            "costPrice": unit_cost,
            "totalAmount": item_total
        })

    if not parsed_items:
        return False, "Số lượng nguyên vật liệu nhập phải lớn hơn 0"

    now_dt = datetime.now(VN_TZ)
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    import_date = data.get("importDate") or now_dt.strftime("%Y-%m-%d")
    month_key = import_date[:7].replace("-", "_")

    receipt_id = f"inb_{now_dt.strftime('%Y%m%d_%H%M%S')}_{branch_id}_{uuid.uuid4().hex[:4]}"
    inbound_code = f"NH_{now_dt.strftime('%Y%m%d')}_{uuid.uuid4().hex[:3].upper()}"

    receiver_id = (user_dict.get("id") or user_dict.get("userId")) if user_dict else "staff"
    receiver_name = (user_dict.get("fullName") or user_dict.get("name")) if user_dict else data.get("receiverName", "Thủ kho")

    receipt = {
        "id": receipt_id,
        "inboundCode": inbound_code,
        "purchaseRequestId": data.get("purchaseRequestId"),
        "requestCode": data.get("requestCode"),
        "branchId": branch_id,
        "supplier": data.get("supplier") or "Nhà vườn Đà Lạt",
        "importDate": import_date,
        "receivedBy": receiver_id,
        "receiverName": receiver_name,
        "paymentStatus": data.get("paymentStatus", "paid"),
        "items": parsed_items,
        "totalItems": len(parsed_items),
        "totalStems": total_stems,
        "totalCost": total_cost,
        "notes": (data.get("notes") or "").strip(),
        "createdAt": now_iso
    }

    # 1. Lưu file hóa đơn vào inventory/inbounds/{YYYY_MM}/
    inbounds_dir = os.path.join(get_config_path("inventory"), "inbounds", month_key)
    os.makedirs(inbounds_dir, exist_ok=True)
    file_path = os.path.join(inbounds_dir, f"{receipt_id}.json")
    write_json(file_path, receipt)

    # 2. Tự động cộng dồn số lượng cành / hàng direct vào materials.json và products.json
    for itm in parsed_items:
        m_id = itm.get("materialId") or itm.get("productId") or itm.get("id")
        qty_add = int(itm.get("quantity") or 0)
        if not m_id or qty_add <= 0:
            continue
        clean_id = m_id.replace("prod:", "").replace("mat:", "")
        update_material_stock(clean_id, branch_id, delta=qty_add)

    return True, receipt


def get_inbound_receipts(
    month_str: Optional[str] = None,
    branch_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Lấy danh sách các phiếu nhập hàng theo tháng và chi nhánh."""
    inbounds_base = os.path.join(get_config_path("inventory"), "inbounds")
    if not os.path.exists(inbounds_base):
        return []

    month_key = month_str.replace("-", "_") if month_str else None
    receipts = []

    target_dirs = []
    if month_key:
        m_dir = os.path.join(inbounds_base, month_key)
        if os.path.exists(m_dir):
            target_dirs.append(m_dir)
    else:
        for entry in os.listdir(inbounds_base):
            p = os.path.join(inbounds_base, entry)
            if os.path.isdir(p):
                target_dirs.append(p)

    for d in target_dirs:
        for fname in os.listdir(d):
            if fname.endswith(".json"):
                fpath = os.path.join(d, fname)
                rc = read_json(fpath, default=None)
                if isinstance(rc, dict):
                    if not branch_id or branch_id == "all" or rc.get("branchId") == branch_id:
                        receipts.append(rc)

    receipts.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return receipts


def get_inbound_receipt_by_id(receipt_id: str) -> Optional[Dict[str, Any]]:
    """Tìm phiếu nhập kho theo id hoặc inboundCode."""
    if not receipt_id:
        return None
    inbounds_base = os.path.join(get_config_path("inventory"), "inbounds")
    if not os.path.exists(inbounds_base):
        return None

    for entry in os.listdir(inbounds_base):
        sub_p = os.path.join(inbounds_base, entry)
        if os.path.isdir(sub_p):
            for fn in os.listdir(sub_p):
                if fn.endswith(".json"):
                    fp = os.path.join(sub_p, fn)
                    try:
                        rec = read_json(fp, default={})
                        if isinstance(rec, dict):
                            if rec.get("id") == receipt_id or rec.get("inboundCode") == receipt_id:
                                return rec
                    except Exception:
                        pass
    return None


# ---------------------------------------------------------------------------
# QUẢN LÝ YÊU CẦU NHẬP HÀNG (PURCHASE REQUISITIONS & FULFILLMENT)
# ---------------------------------------------------------------------------

def get_purchase_requests(
    month_str: Optional[str] = None,
    branch_id: Optional[str] = None,
    status: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Lấy danh sách các phiếu yêu cầu nhập hàng từ các chi nhánh."""
    req_file = get_config_path("purchase_requests.json")
    requests_list = read_json(req_file, default=[])
    if not isinstance(requests_list, list):
        requests_list = []

    res = []
    month_filter = month_str[:7].replace("_", "-") if month_str else None

    for r in requests_list:
        if not isinstance(r, dict):
            continue
        if branch_id and branch_id != "all" and r.get("branchId") != branch_id:
            continue
        if status and str(status).lower() != "all":
            if (r.get("status") or "").lower() != str(status).lower():
                continue
        if month_filter:
            r_date = r.get("requestDate") or r.get("createdAt", "")[:10]
            if not r_date.startswith(month_filter):
                continue
        res.append(r)

    res.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return res


def create_purchase_request(
    data: Dict[str, Any],
    user_dict: Optional[Dict[str, Any]] = None
) -> Tuple[bool, Union[Dict[str, Any], str]]:
    """
    Tạo phiếu yêu cầu nhập hoa tươi / phụ liệu từ chi nhánh.
    Lưu vào config/anne/purchase_requests.json
    """
    if not data or not isinstance(data, dict):
        return False, "Dữ liệu yêu cầu không hợp lệ"

    branch_id = data.get("branchId")
    if not branch_id:
        return False, "Vui lòng chọn chi nhánh gửi yêu cầu"

    items = data.get("items") or []
    if not items or not isinstance(items, list):
        return False, "Yêu cầu nhập hàng phải có ít nhất 1 mặt hàng"

    parsed_items = []
    total_stems = 0
    estimated_cost = 0

    for itm in items:
        mat_id = itm.get("materialId") or itm.get("id")
        qty = int(itm.get("requestedQty") or itm.get("quantity") or 0)
        if qty <= 0:
            continue
        mat_info = get_material_by_id(mat_id) or {}
        mat_name = itm.get("name") or itm.get("materialName") or mat_info.get("name") or "Cành hoa"
        unit = itm.get("unit") or mat_info.get("unit") or "cành"
        cost = int(itm.get("costPrice") or mat_info.get("costPrice") or 0)
        current_stock = int(mat_info.get("stockByBranch", {}).get(branch_id, 0)) if mat_info else 0

        parsed_items.append({
            "materialId": mat_id,
            "materialName": mat_name,
            "currentStock": current_stock,
            "requestedQty": qty,
            "unit": unit,
            "costPrice": cost,
            "reason": (itm.get("reason") or "").strip()
        })
        total_stems += qty
        estimated_cost += qty * cost

    if not parsed_items:
        return False, "Số lượng cành hoa yêu cầu phải lớn hơn 0"

    now_dt = datetime.now(VN_TZ)
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    req_date = data.get("requestDate") or now_dt.strftime("%Y-%m-%d")
    expected_date = data.get("expectedDate") or (now_dt + timedelta(days=1)).strftime("%Y-%m-%d")

    req_id = f"req_{int(now_dt.timestamp())}_{uuid.uuid4().hex[:4]}"
    req_code = f"YCNH_{now_dt.strftime('%Y%m%d')}_{uuid.uuid4().hex[:3].upper()}"

    requester_id = (user_dict.get("id") or user_dict.get("userId")) if user_dict else "staff"
    requester_name = (user_dict.get("fullName") or user_dict.get("name")) if user_dict else data.get("requesterName", "Quản lý CN")

    branch_info = get_branch_by_id(branch_id)
    branch_name = branch_info.get("name", branch_id) if branch_info else branch_id

    req_obj = {
        "id": req_id,
        "requestCode": req_code,
        "branchId": branch_id,
        "branchName": branch_name,
        "requestedBy": requester_id,
        "requesterName": requester_name,
        "requestDate": req_date,
        "expectedDate": expected_date,
        "items": parsed_items,
        "totalItems": len(parsed_items),
        "totalStems": total_stems,
        "estimatedCost": estimated_cost,
        "status": "pending",
        "approvedBy": None,
        "fulfilledInboundId": None,
        "notes": (data.get("notes") or "").strip(),
        "createdAt": now_iso
    }

    req_file = get_config_path("purchase_requests.json")
    all_reqs = read_json(req_file, default=[])
    if not isinstance(all_reqs, list):
        all_reqs = []
    all_reqs.insert(0, req_obj)
    write_json(req_file, all_reqs)

    return True, req_obj


def update_purchase_request_status(
    request_id: str,
    new_status: str,
    user_dict: Optional[Dict[str, Any]] = None,
    notes: Optional[str] = None
) -> Tuple[bool, Union[Dict[str, Any], str]]:
    """Cập nhật trạng thái phiếu yêu cầu (pending, approved, rejected, fulfilled, closed)."""
    if not new_status:
        return False, "Vui lòng chỉ định trạng thái mới"

    new_status = str(new_status).strip().lower()
    valid_statuses = ["pending", "approved", "rejected", "fulfilled", "closed"]
    if new_status not in valid_statuses:
        return False, f"Trạng thái không hợp lệ: {new_status}"

    req_file = get_config_path("purchase_requests.json")
    all_reqs = read_json(req_file, default=[])
    target = None

    for r in all_reqs:
        if r.get("id") == request_id or r.get("requestCode") == request_id:
            target = r
            break

    if not target:
        return False, "Không tìm thấy phiếu yêu cầu nhập hàng"

    curr_status = (target.get("status") or "pending").lower()

    # Khóa bất biến 1: Đơn đã đóng (closed) thì không thể thay đổi bất kỳ trạng thái nào
    if curr_status == "closed":
        return False, "Đơn hàng đã đóng hoàn tất (closed), không thể thay đổi trạng thái"

    # Khóa bất biến 2: Đơn đã nhận hàng (fulfilled) chỉ có thể chuyển sang 'closed'
    if curr_status == "fulfilled" and new_status != "closed":
        return False, "Đơn hàng đã xác nhận nhận hàng (fulfilled), không thể quay lại trạng thái khác ngoài việc đóng đơn"

    # Phân quyền: Chỉ super_admin / admin mới có quyền đóng đơn hàng (closed)
    if new_status == "closed":
        user_role = user_dict.get("role") if user_dict else None
        if user_dict and user_role not in ["super_admin", "admin"]:
            return False, "Chỉ Super Admin mới có quyền đóng chốt đơn hàng sau thời gian theo dõi"

    # Kiểm tra quyền chi nhánh nếu là branch_manager
    if user_dict and user_dict.get("role") == "branch_manager":
        user_branch = user_dict.get("branchId")
        if user_branch and target.get("branchId") and target.get("branchId") != user_branch:
            return False, "Bạn chỉ có quyền cập nhật phiếu yêu cầu của chi nhánh mình"

    target["status"] = new_status
    actor_name = (user_dict.get("fullName") or user_dict.get("name") or user_dict.get("id")) if user_dict else "admin"
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    if new_status == "approved":
        target["approvedBy"] = actor_name
        target["approvedAt"] = now_iso
    elif new_status == "rejected":
        target["rejectedBy"] = actor_name
        target["rejectedAt"] = now_iso
    elif new_status == "closed":
        target["closedBy"] = actor_name
        target["closedAt"] = now_iso
    elif new_status == "pending":
        target["approvedBy"] = None
        target["approvedAt"] = None
        target["rejectedBy"] = None
        target["rejectedAt"] = None

    if notes is not None:
        target["processNotes"] = str(notes).strip()
    target["updatedAt"] = now_iso

    write_json(req_file, all_reqs)
    return True, target


def fulfill_purchase_request(
    request_id: str,
    inbound_data: Dict[str, Any],
    user_dict: Optional[Dict[str, Any]] = None
) -> Tuple[bool, Union[Dict[str, Any], str]]:
    """
    Xử lý Yêu cầu nhập hàng:
    1. Tạo Phiếu Nhập Kho thực tế (create_inbound_receipt).
    2. Gắn fulfilledInboundId vào phiếu yêu cầu và đổi trạng thái sang 'fulfilled'.
    """
    req_file = get_config_path("purchase_requests.json")
    all_reqs = read_json(req_file, default=[])
    target = None
    for r in all_reqs:
        if r.get("id") == request_id or r.get("requestCode") == request_id:
            target = r
            break

    if not target:
        return False, "Không tìm thấy phiếu yêu cầu nhập hàng để xử lý"

    curr_status = (target.get("status") or "pending").lower()
    if curr_status in ["fulfilled", "closed", "rejected"]:
        return False, f"Không thể xử lý nhập kho cho yêu cầu ở trạng thái '{curr_status}'"

    # Lập phiếu nhập kho
    inbound_data_copy = dict(inbound_data)
    if not inbound_data_copy.get("purchaseRequestId"):
        inbound_data_copy["purchaseRequestId"] = target.get("id")
    if not inbound_data_copy.get("requestCode"):
        inbound_data_copy["requestCode"] = target.get("requestCode")

    ok, receipt_or_err = create_inbound_receipt(inbound_data_copy, user_dict=user_dict)
    if not ok:
        return False, receipt_or_err

    receipt = receipt_or_err
    target["status"] = "fulfilled"
    target["fulfilledInboundId"] = receipt.get("id")
    target["fulfilledInboundCode"] = receipt.get("inboundCode")
    target["fulfilledAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if user_dict:
        target["fulfilledBy"] = user_dict.get("fullName") or user_dict.get("name") or user_dict.get("id")

    write_json(req_file, all_reqs)
    return True, {
        "request": target,
        "inboundReceipt": receipt
    }


def deduct_order_materials(order_dict: Dict[str, Any], branch_id: str) -> Tuple[bool, str]:
    """
    Trừ hoa cành trong materials.json khi đơn hàng hoàn thành cắm hoa (status -> photo_sent/delivered).
    """
    if not order_dict or not branch_id:
        return False, "Thiếu thông tin đơn hàng hoặc chi nhánh"

    items = order_dict.get("items") or []
    deducted_count = 0

    for itm in items:
        item_qty = int(itm.get("quantity") or 1)
        recipe = itm.get("recipe") or []
        if not recipe:
            p_id = itm.get("productId") or itm.get("id")
            if p_id:
                from data_service import get_product_by_id
                p_detail = get_product_by_id(p_id)
                if p_detail and p_detail.get("recipe"):
                    recipe = p_detail.get("recipe") or []

        for r in recipe:
            mat_id = r.get("materialId")
            if mat_id:
                r_qty = int(r.get("quantity") or 0) * item_qty
                if r_qty > 0:
                    update_material_stock(mat_id, branch_id, delta=-r_qty)
                    deducted_count += 1

    return True, f"Đã trừ {deducted_count} loại hoa cành trong kho chi nhánh {branch_id}"


def calculate_order_cogs_and_profit(order_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tính toán chi phí giá vốn (COGS) hoa cành và Lợi nhuận gộp (Gross Profit) của đơn hàng.
    """
    revenue = int(order_dict.get("financials", {}).get("subtotal") or order_dict.get("totalAmount") or 0)
    cogs = 0

    for itm in order_dict.get("items") or []:
        item_qty = int(itm.get("quantity") or 1)
        recipe = itm.get("recipe") or []
        if not recipe:
            p_id = itm.get("productId") or itm.get("id")
            if p_id:
                from data_service import get_product_by_id
                p_detail = get_product_by_id(p_id)
                if p_detail and p_detail.get("recipe"):
                    recipe = p_detail.get("recipe") or []

        if recipe:
            for r in recipe:
                r_qty = int(r.get("quantity") or 0)
                cost = int(r.get("costPrice") or 0)
                if cost <= 0:
                    mat = get_material_by_id(r.get("materialId"))
                    if mat:
                        cost = int(mat.get("costPrice") or 0)
                cogs += cost * r_qty * item_qty
        else:
            cogs += int(itm.get("costPrice") or 0) * item_qty

    gross_profit = revenue - cogs
    profit_margin = round((gross_profit / revenue * 100), 2) if revenue > 0 else 0.0

    return {
        "revenue": revenue,
        "cogs": cogs,
        "grossProfit": gross_profit,
        "profitMarginPercent": profit_margin
    }


def get_monthly_inventory_report(
    month_str: str,
    branch_id: Optional[str] = None,
    item_type: Optional[str] = "all"
) -> Dict[str, Any]:
    """
    Tổng hợp Báo Cáo Nhập – Xuất – Tồn Theo Tháng (Monthly Inventory Balance Report).
    Tuân thủ công thức: Tồn Cuối = Tồn Đầu + Nhập - Bán - Hủy
    """
    normalized_month = month_str.replace("_", "-")[:7]
    month_key = normalized_month.replace("-", "_")

    # 1. Thu thập Inbound trong tháng
    inbounds = get_inbound_receipts(month_str=month_key, branch_id=branch_id)
    inbound_map: Dict[str, int] = {}
    for inb in inbounds:
        for itm in inb.get("items") or []:
            mid = itm.get("materialId")
            if mid:
                inbound_map[mid] = inbound_map.get(mid, 0) + int(itm.get("quantity") or 0)

    # 2. Thu thập Xuất Bán trong tháng
    all_orders = get_all_orders_across_all_months(branch_id=branch_id)
    sold_map: Dict[str, int] = {}
    for ord_dict in all_orders:
        if ord_dict.get("status") in ["cancelled", "returned"]:
            continue
        ord_date = ord_dict.get("createdAt", "")[:7].replace("_", "-")
        if ord_date != normalized_month:
            continue
        for itm in ord_dict.get("items") or []:
            pid = itm.get("productId") or itm.get("id")
            qty = int(itm.get("quantity") or 1)
            recipe = itm.get("recipe") or []
            if recipe:
                for r in recipe:
                    mid = r.get("materialId")
                    if mid:
                        sold_map[mid] = sold_map.get(mid, 0) + int(r.get("quantity") or 0) * qty
            elif pid:
                sold_map[pid] = sold_map.get(pid, 0) + qty

    # 3. Thu thập Hao Hụt Báo Hủy trong tháng
    wastage_map: Dict[str, int] = {}
    for rep in get_wastage_reports():
        if branch_id and branch_id != "all" and rep.get("branchId") != branch_id:
            continue
        rep_date = (rep.get("date") or rep.get("createdAt", ""))[:7].replace("_", "-")
        if rep_date != normalized_month:
            continue
        for itm in rep.get("items") or []:
            target_id = itm.get("materialId") or itm.get("productId")
            if target_id:
                wastage_map[target_id] = wastage_map.get(target_id, 0) + int(itm.get("damagedStems") or 0)

    # 4. Tập hợp danh mục mặt hàng
    report_items = []
    total_opening_val = 0
    total_inbound_val = 0
    total_sold_val = 0
    total_closing_val = 0

    # A. Danh mục cành hoa (materials)
    if item_type in ["all", "materials"]:
        materials = get_materials()
        for m in materials:
            mid = m.get("id")
            stock_dict = m.get("stockByBranch") or {}
            closing_stock = sum(int(v or 0) for b, v in stock_dict.items() if (not branch_id or branch_id == "all" or b == branch_id))
            inbound_qty = inbound_map.get(mid, 0)
            sold_qty = sold_map.get(mid, 0)
            wastage_qty = wastage_map.get(mid, 0)
            unit_cost = int(m.get("costPrice") or 0)

            opening_stock = max(0, closing_stock - inbound_qty + sold_qty + wastage_qty)
            closing_stock = max(0, opening_stock + inbound_qty - sold_qty - wastage_qty)

            closing_val = closing_stock * unit_cost
            total_opening_val += opening_stock * unit_cost
            total_inbound_val += inbound_qty * unit_cost
            total_sold_val += sold_qty * unit_cost
            total_closing_val += closing_val

            report_items.append({
                "id": mid,
                "name": m.get("name"),
                "category": m.get("category"),
                "productType": "materials",
                "unit": m.get("unit", "cành"),
                "unitCost": unit_cost,
                "opening": opening_stock,
                "inbound": inbound_qty,
                "sold": sold_qty,
                "wastage": wastage_qty,
                "closing": closing_stock,
                "closingValue": closing_val
            })

    # B. Hàng bền (direct products)
    if item_type in ["all", "direct"]:
        products = get_products()
        for p in products:
            if p.get("productType") != "direct" and p.get("category") != "binh_hoa":
                continue
            pid = p.get("id")
            stock_dict = p.get("stockByBranch") or {}
            closing_stock = sum(int(v or 0) for b, v in stock_dict.items() if (not branch_id or branch_id == "all" or b == branch_id))
            inbound_qty = inbound_map.get(pid, 0)
            sold_qty = sold_map.get(pid, 0)
            wastage_qty = wastage_map.get(pid, 0)
            unit_price = int(p.get("priceNumber") or 0)

            opening_stock = max(0, closing_stock - inbound_qty + sold_qty + wastage_qty)
            closing_stock = max(0, opening_stock + inbound_qty - sold_qty - wastage_qty)

            closing_val = closing_stock * unit_price
            total_opening_val += opening_stock * unit_price
            total_inbound_val += inbound_qty * unit_price
            total_sold_val += sold_qty * unit_price
            total_closing_val += closing_val

            report_items.append({
                "id": pid,
                "name": p.get("name"),
                "category": p.get("category"),
                "productType": "direct",
                "unit": "cái",
                "unitCost": unit_price,
                "opening": opening_stock,
                "inbound": inbound_qty,
                "sold": sold_qty,
                "wastage": wastage_qty,
                "closing": closing_stock,
                "closingValue": closing_val
            })

    return {
        "month": normalized_month,
        "branchId": branch_id or "all",
        "summary": {
            "totalOpeningValue": total_opening_val,
            "totalInboundValue": total_inbound_val,
            "totalSoldValue": total_sold_val,
            "totalClosingValue": total_closing_val,
            "totalItemsCount": len(report_items)
        },
        "items": report_items
    }

