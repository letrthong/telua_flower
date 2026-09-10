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

    raw_items = data.get("items") or []
    if not raw_items or not isinstance(raw_items, list):
        return False, "Phiếu báo hủy phải có ít nhất 1 loại hoa hư hỏng"

    parsed_items = []
    total_loss_amount = 0

    for itm in raw_items:
        flower_type = (itm.get("flowerType") or itm.get("productName") or "").strip()
        damaged_stems = int(itm.get("damagedStems") or 0)
        if damaged_stems <= 0:
            continue

        unit_cost = int(itm.get("unitCost") or 0)
        item_loss = damaged_stems * unit_cost
        total_loss_amount += item_loss

        parsed_items.append({
            "productId": itm.get("productId") or None,
            "flowerType": flower_type or "Hoa tươi",
            "damagedStems": damaged_stems,
            "reason": (itm.get("reason") or "Hoa dập/gãy cành").strip(),
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

    new_report = {
        "id": report_id,
        "branchId": branch_id,
        "date": date_str,
        "reportedBy": reported_by,
        "items": parsed_items,
        "totalLossAmount": total_loss_amount,
        "notes": (data.get("notes") or "").strip(),
        "createdAt": now_iso
    }

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
