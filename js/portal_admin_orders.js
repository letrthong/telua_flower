import { getAuthToken } from './auth.js';
import { API_BASE } from './utils.js';
import { notifyUser } from './portal_admin_state.js';

// ==========================================
// QUẢN LÝ ĐƠN HÀNG (ORDERS MANAGEMENT)
// ==========================================

export const ADMIN_ORDER_STATUS_META = {
    pending:        { label: "Chờ xác nhận",   color: "bg-amber-100 text-amber-700 border-amber-200",   icon: "fa-clock" },
    confirmed:      { label: "Đã xác nhận",    color: "bg-blue-100 text-blue-700 border-blue-200",       icon: "fa-check" },
    arranging:      { label: "Đang cắm hoa",   color: "bg-purple-100 text-purple-700 border-purple-200", icon: "fa-scissors" },
    shipping:       { label: "Đang vận chuyển", color: "bg-cyan-100 text-cyan-700 border-cyan-200",      icon: "fa-truck" },
    delivered:      { label: "Giao thành công", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    ready_for_pickup: { label: "Sẵn sàng nhận", color: "bg-teal-100 text-teal-700 border-teal-200",      icon: "fa-store" },
    completed:      { label: "Hoàn thành",     color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    cancelled:      { label: "Đã hủy",         color: "bg-red-100 text-red-700 border-red-200",          icon: "fa-ban" },
    returned:       { label: "Trả hàng",       color: "bg-orange-100 text-orange-700 border-orange-200", icon: "fa-rotate-left" }
};

export const ADMIN_PAYMENT_STATUS_META = {
    unpaid:   { label: "Chưa thanh toán", color: "bg-gray-100 text-gray-600 border-gray-200",   icon: "fa-credit-card" },
    paid:     { label: "Đã thanh toán",   color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "fa-circle-check" },
    refunded: { label: "Đã hoàn tiền",    color: "bg-blue-100 text-blue-700 border-blue-200",   icon: "fa-rotate-left" },
    failed:   { label: "Thanh toán lỗi",  color: "bg-red-100 text-red-700 border-red-200",      icon: "fa-circle-xmark" }
};

function adminFormatVND(amount) {
    const n = Number(amount) || 0;
    return n.toLocaleString("vi-VN") + "₫";
}

function adminFormatDate(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function adminGetStatusMeta(status, map) {
    return map[status] || { label: status || "Không xác định", color: "bg-gray-100 text-gray-600 border-gray-200", icon: "fa-circle-question" };
}

export async function loadAdminOrders() {
    const tbody = document.getElementById("adminOrdersTableBody");
    if (!tbody) return;

    const timeframeEl = document.getElementById("filterOrderTimeframe");
    const statusEl = document.getElementById("filterOrderStatus");
    const paymentEl = document.getElementById("filterOrderPayment");
    const searchEl = document.getElementById("searchOrderInput");

    const timeframe = timeframeEl ? timeframeEl.value : "this_month";
    const status = statusEl ? statusEl.value : "all";
    const paymentStatus = paymentEl ? paymentEl.value : "all";
    const search = searchEl ? searchEl.value.trim() : "";

    tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-gray-400">Đang tải đơn hàng...</td></tr>`;
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    try {
        let url = `${API_BASE}/admin/orders?timeframe=${encodeURIComponent(timeframe)}&status=${encodeURIComponent(status)}&paymentStatus=${encodeURIComponent(paymentStatus)}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;

        const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
        const json = await res.json();

        if (json.success && json.data) {
            const orders = Array.isArray(json.data.orders) ? json.data.orders : [];
            lastLoadedAdminOrders = orders;
            renderAdminOrdersTable(orders);
        } else {
            tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-red-500 font-bold">${json.message || "Lỗi tải đơn hàng"}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
    }
}

export let lastLoadedAdminOrders = [];

function renderAdminOrdersTable(orders) {
    const tbody = document.getElementById("adminOrdersTableBody");
    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-gray-400">Không có đơn hàng nào phù hợp</td></tr>`;
        return;
    }

    const branches = (typeof window !== "undefined" && Array.isArray(window.allAdminBranches)) ? window.allAdminBranches : [];

    tbody.innerHTML = orders.map(order => {
        const statusMeta = adminGetStatusMeta(order.status, ADMIN_ORDER_STATUS_META);
        const payMeta = adminGetStatusMeta(order.payment?.status, ADMIN_PAYMENT_STATUS_META);
        const total = Number(order.totalAmount) || Number(order.financials?.totalAmount) || 0;
        const sender = order.sender || {};
        const recipient = order.recipient || {};
        const branchId = order.branchId || order.assignedBranchId || "admin";
        const branchName = order.branchName || (branchId === "admin" ? "Trung Tâm (Admin)" : branchId);
        const creatorName = order.creatorName || sender.name || "Khách đặt online";
        const assigneeName = order.assigneeName || order.assignedTo || "Super Admin (staff_admin)";
        const isAssignedToAdmin = (branchId === "admin");

        const isLiveStream = (order.source === "livestream_quick_order" || order.source === "livestream");
        const proofImg = order.payment?.proofImage || order.paymentProofImage || "";
        const flowerName = (order.items && order.items[0] && order.items[0].productName) || "";

        // Chi nhánh tùy chọn cho dropdown điều phối
        const branchOptions = branches.filter(b => b.isActive !== false).map(b => `
            <option value="${b.id}" ${b.id === branchId ? 'selected' : ''}>📍 ${b.name || b.id}</option>
        `).join("");

        return `
            <tr class="hover:bg-pink-50/30 transition">
                <td class="p-3">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="font-mono text-[11px] font-bold text-gray-700">${order.orderCode || order.id || ""}</span>
                        ${isLiveStream ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[9px] font-bold border border-rose-200"><i class="fa-solid fa-video text-[8px] animate-pulse"></i> Live</span>' : ''}
                    </div>
                    <div class="text-[10px] text-gray-400">${adminFormatDate(order.createdAt || order.orderDate)}</div>
                    ${flowerName ? `<div class="text-[10px] text-rose-600 font-semibold line-clamp-1 mt-0.5" title="${flowerName}">🌸 ${flowerName}</div>` : ''}
                    ${proofImg ? `<a href="${proofImg}" target="_blank" class="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-bold mt-0.5"><i class="fa-solid fa-receipt"></i> Xem bill</a>` : ''}
                </td>
                <td class="p-3">
                    <div class="text-xs font-bold text-gray-800">${creatorName}</div>
                    <div class="text-[10px] text-gray-400 font-mono">${sender.phone || ""}</div>
                </td>
                <td class="p-3">
                    <div class="text-xs text-gray-700 font-bold">${recipient.name || "—"}</div>
                    <div class="text-[10px] text-gray-500 font-mono">${recipient.phone || ""}</div>
                    <div class="text-[10px] text-gray-400 truncate max-w-[140px] xl:max-w-[260px] 2xl:max-w-[360px]" title="${recipient.address || ''}">${recipient.address || ""}</div>
                </td>
                <td class="p-3">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-[11px] font-semibold ${isAssignedToAdmin ? 'text-amber-700 font-bold' : 'text-gray-700'}">${branchName}</span>
                        ${isAssignedToAdmin ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold border border-amber-200 animate-pulse"><i class="fa-solid fa-bolt"></i> Chờ điều phối</span>' : ''}
                    </div>
                </td>
                <td class="p-3">
                    <div class="text-[11px] font-semibold text-gray-800">${assigneeName}</div>
                    <div class="text-[10px] text-gray-400">Người thực hiện</div>
                </td>
                <td class="p-3 font-bold text-gray-800">${adminFormatVND(total)}</td>
                <td class="p-3">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${payMeta.color}">
                        <i class="fa-solid ${payMeta.icon}"></i> ${payMeta.label}
                    </span>
                </td>
                <td class="p-3">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusMeta.color}">
                        <i class="fa-solid ${statusMeta.icon}"></i> ${statusMeta.label}
                    </span>
                </td>
                <td class="p-3 text-center">
                    <div class="flex flex-col gap-1.5 items-center">
                        ${(() => {
                            const curStatus = (order.status || 'pending').toLowerCase();
                            const isTerminal = ['delivered', 'completed', 'cancelled', 'returned'].includes(curStatus);
                            if (isTerminal) {
                                return `<div class="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-400 flex items-center justify-center gap-1 cursor-not-allowed" title="Đơn hàng đã hoàn tất hoặc kết thúc, không thể thay đổi trạng thái"><i class="fa-solid fa-lock text-[9px]"></i> Đã hoàn tất</div>`;
                            }
                            const STATUS_LEVELS = { pending: 1, confirmed: 2, arranging: 3, in_progress: 3, photo_sent: 3, shipping: 4, ready_for_pickup: 4, delivered: 5, completed: 5 };
                            const curLevel = STATUS_LEVELS[curStatus] || 1;
                            let options = '<option value="">Cập nhật trạng thái...</option>';
                            if (curLevel < 2) options += '<option value="confirmed">✅ Xác nhận</option>';
                            if (curLevel < 3) options += '<option value="arranging">🌸 Đang cắm</option>';
                            if (curLevel < 4) options += '<option value="shipping">🚚 Vận chuyển</option>';
                            if (curLevel < 5) options += '<option value="delivered">🎉 Giao xong</option>';
                            options += '<option value="completed">🏁 Hoàn tất</option>';
                            options += '<option value="cancelled">❌ Hủy</option>';
                            return `<select onchange="updateAdminOrderStatus('${order.id}', this.value)" class="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-semibold focus:outline-none focus:border-primary">${options}</select>`;
                        })()}
                        <select onchange="dispatchAdminOrder('${order.id}', this.value)" class="w-full px-2 py-1 bg-pink-50/50 border border-pink-200 text-primary rounded-lg text-[10px] font-bold focus:outline-none focus:border-primary">
                            <option value="">⚡ Gán cửa hàng...</option>
                            <option value="admin" ${branchId === 'admin' ? 'selected' : ''}>🏢 Trung Tâm Admin</option>
                            ${branchOptions}
                        </select>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

export async function updateAdminOrderStatus(orderId, newStatus) {
    if (!orderId || !newStatus) return;
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    try {
        const res = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        const json = await res.json();

        if (json.success) {
            notifyUser("Đã cập nhật trạng thái đơn hàng!", 'success');
            loadAdminOrders();
            if (typeof loadLiveStreamOrders === "function") loadLiveStreamOrders();
        } else {
            notifyUser(json.message || "Lỗi cập nhật trạng thái", 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    }
}

export async function dispatchAdminOrder(orderId, targetBranchId) {
    if (!orderId || !targetBranchId) return;
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    try {
        const res = await fetch(`${API_BASE}/admin/orders/${orderId}/dispatch`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ targetBranchId: targetBranchId })
        });
        const json = await res.json();

        if (json.success) {
            notifyUser(json.message || "Đã điều phối đơn hàng thành công!", 'success');
            loadAdminOrders();
            if (typeof loadLiveStreamOrders === "function") loadLiveStreamOrders();
        } else {
            notifyUser(json.message || "Lỗi điều phối đơn hàng", 'error');
            loadAdminOrders();
        }
    } catch (e) {
        notifyUser("Lỗi kết nối điều phối: " + e.message, 'error');
    }
}

/**
 * Nhóm danh sách đơn hàng theo từng ngày (YYYY-MM-DD) để tạo Tab (Worksheet) riêng cho mỗi ngày trong Excel
 */
export function groupOrdersByDayForExcel(ordersToExport = []) {
    const groups = {};
    if (!Array.isArray(ordersToExport)) return groups;

    ordersToExport.forEach(o => {
        if (!o || typeof o !== "object") return;
        const rawDate = (o.delivery && o.delivery.deliveryDate)
            || o.deliveryDate
            || o.livestreamDate
            || o.orderDay
            || o.orderDate
            || (o.createdAt ? String(o.createdAt).slice(0, 10) : "")
            || "Khac";
        const dayKey = String(rawDate).trim().slice(0, 10) || "Khac";
        if (!groups[dayKey]) groups[dayKey] = [];
        groups[dayKey].push(o);
    });

    // Sắp xếp các đơn trong mỗi ngày theo giờ nhận hoa sớm nhất trước
    Object.keys(groups).forEach(dayKey => {
        groups[dayKey].sort((a, b) => {
            const slotA = String((a.delivery && a.delivery.timeSlot) || a.deliveryTime || a.timeSlot || "");
            const slotB = String((b.delivery && b.delivery.timeSlot) || b.deliveryTime || b.timeSlot || "");
            const normSlot = (s) => {
                if (!s || s.toLowerCase().includes("giao ngay") || s.toLowerCase().includes("sớm nhất")) return "00:00";
                const m = s.match(/(\d{1,2}):(\d{2})/);
                return m ? `${String(m[1]).padStart(2, "0")}:${m[2]}` : "23:59";
            };
            const cmp = normSlot(slotA).localeCompare(normSlot(slotB));
            if (cmp !== 0) return cmp;
            return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
        });
    });

    return groups;
}

/**
 * Tạo nội dung XML SpreadsheetML (Excel Workbook .xls) gồm nhiều Tab (Worksheet) cho từng ngày
 */
export function buildOrdersMultiSheetExcelXml(ordersToExport = []) {
    const escapeXml = (val) => {
        if (val === null || val === undefined) return "";
        return String(val)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    };

    const sanitizeSheetName = (rawName, usedNames) => {
        // Tên tab trong Excel tối đa 31 ký tự và không chứa: \ / ? * : [ ]
        let clean = String(rawName || "Sheet").replace(/[\\/?*:[\]]/g, "-").trim().slice(0, 28);
        if (!clean) clean = "Ngay";
        let candidate = clean;
        let idx = 2;
        while (usedNames.has(candidate.toLowerCase())) {
            candidate = `${clean.slice(0, 25)}_${idx++}`;
        }
        usedNames.add(candidate.toLowerCase());
        return candidate;
    };

    const formatDaySheetLabel = (dayKey) => {
        const parts = String(dayKey).split("-");
        if (parts.length === 3) {
            return `Ngay ${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return `Ngay ${dayKey}`;
    };

    const headers = [
        "Mã Đơn Hàng",
        "Ngày Nhận Hoa",
        "Khung Giờ Nhận",
        "Hình Thức Nhận",
        "Ngày Đặt",
        "Kênh Đặt",
        "Khách Đặt",
        "SĐT Khách",
        "Người Nhận",
        "SĐT Nhận",
        "Địa Chỉ Nhận Hoa",
        "Mẫu Bó Hoa",
        "Số Lượng",
        "Tổng Tiền (VNĐ)",
        "Thanh Toán",
        "Trạng Thái Đơn",
        "Lời Chúc Thiệp",
        "Ảnh Chuyển Khoản"
    ];

    const buildWorksheetXml = (sheetName, sheetOrders) => {
        let totalRevenue = 0;
        const rowsXml = sheetOrders.map(o => {
            const isLive = (o.source === "livestream_quick_order" || o.source === "livestream");
            const sender = o.sender || {};
            const recipient = o.recipient || {};
            const delivery = o.delivery || {};
            const total = Number(o.totalAmount) || Number(o.financials?.totalAmount) || Number(o.transferredAmount) || 0;
            if ((o.status || "").toLowerCase() !== "cancelled") {
                totalRevenue += total;
            }
            const item = (o.items && o.items[0]) || {};
            const flowerName = item.productName || "Hoa tươi";
            const qty = Number(item.quantity) || 1;
            const proof = o.payment?.proofImage || o.paymentProofImage || o.proofImage || "";
            const deliveryDate = delivery.deliveryDate || o.deliveryDate || o.orderDate || "";
            const timeSlot = delivery.timeSlot || o.deliveryTime || o.timeSlot || "Giao ngay trong ngày (Sớm nhất)";
            const fulfillment = (delivery.fulfillmentType === "pickup" || o.fulfillmentType === "pickup")
                ? "Nhận tại Shop"
                : "Giao tận nơi";
            const statusLabel = (ADMIN_ORDER_STATUS_META[o.status] && ADMIN_ORDER_STATUS_META[o.status].label) || o.status || "Chờ xử lý";

            const cells = [
                { type: "String", val: o.orderCode || o.id || "" },
                { type: "String", val: deliveryDate },
                { type: "String", val: timeSlot },
                { type: "String", val: fulfillment },
                { type: "String", val: o.createdAt || o.orderDate || "" },
                { type: "String", val: isLive ? "Live Stream (Nhanh)" : "Website" },
                { type: "String", val: o.creatorName || o.customerName || sender.name || recipient.name || "" },
                { type: "String", val: sender.phone || o.phone || recipient.phone || "" },
                { type: "String", val: recipient.name || o.customerName || "" },
                { type: "String", val: recipient.phone || o.phone || "" },
                { type: "String", val: recipient.address || o.address || "" },
                { type: "String", val: flowerName },
                { type: "Number", val: qty },
                { type: "Number", val: total },
                { type: "String", val: o.payment?.status === "paid" ? "Đã thanh toán" : "Chờ đối soát" },
                { type: "String", val: statusLabel },
                { type: "String", val: o.cardMessage || o.notes || recipient.deliveryNotes || "" },
                { type: "String", val: proof }
            ];

            return `<Row>${cells.map(c => `<Cell ss:StyleID="sData"><Data ss:Type="${c.type}">${escapeXml(c.val)}</Data></Cell>`).join("")}</Row>`;
        }).join("\n");

        const headerRowXml = `<Row ss:Height="24">${headers.map(h => `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join("")}</Row>`;
        const summaryRowXml = `<Row ss:Height="22">` +
            `<Cell ss:StyleID="sTotal"><Data ss:Type="String">TỔNG CỘNG (${sheetOrders.length} đơn)</Data></Cell>` +
            `<Cell ss:StyleID="sTotal" ss:MergeAcross="11"><Data ss:Type="String"></Data></Cell>` +
            `<Cell ss:StyleID="sTotalNum"><Data ss:Type="Number">${totalRevenue}</Data></Cell>` +
            `<Cell ss:StyleID="sTotal" ss:MergeAcross="3"><Data ss:Type="String"></Data></Cell>` +
            `</Row>`;

        return `<Worksheet ss:Name="${escapeXml(sheetName)}">\n<Table>\n${headerRowXml}\n${rowsXml}\n${summaryRowXml}\n</Table>\n</Worksheet>`;
    };

    const groups = groupOrdersByDayForExcel(ordersToExport);
    const sortedDayKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    const usedNames = new Set();
    const worksheets = [];

    // 1. Tạo từng Tab riêng cho mỗi ngày
    sortedDayKeys.forEach(dayKey => {
        const sheetName = sanitizeSheetName(formatDaySheetLabel(dayKey), usedNames);
        worksheets.push(buildWorksheetXml(sheetName, groups[dayKey]));
    });

    // 2. Tạo thêm Tab Tổng Hợp nếu có nhiều hơn 1 ngày (hoặc luôn có tab Tổng Hợp ở cuối để đối chiếu)
    if (sortedDayKeys.length > 1) {
        const allSheetName = sanitizeSheetName("Tong Hop Tat Ca", usedNames);
        worksheets.push(buildWorksheetXml(allSheetName, ordersToExport));
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Arial" ss:Size="10"/>
  </Style>
  <Style ss:ID="sHeader">
   <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
   <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#E11D48" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sData">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Arial" ss:Size="10"/>
  </Style>
  <Style ss:ID="sTotal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#9F1239"/>
   <Interior ss:Color="#FFF1F2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sTotalNum">
   <Alignment ss:Vertical="Center" ss:Horizontal="Right"/>
   <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#BE123C"/>
   <Interior ss:Color="#FFF1F2" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
 </Styles>
 ${worksheets.join("\n ")}
</Workbook>`;
}

/**
 * Xuất danh sách đơn hàng ra file Excel nhiều Tab theo từng ngày (.xls)
 */
export function exportOrdersToCsv(ordersToExport, filename = "danh_sach_don_hang.xls") {
    if (!Array.isArray(ordersToExport) || ordersToExport.length === 0) {
        notifyUser("Không có đơn hàng nào để xuất file!", "warning");
        return;
    }

    const groups = groupOrdersByDayForExcel(ordersToExport);
    const dayCount = Object.keys(groups).length;
    const xmlContent = buildOrdersMultiSheetExcelXml(ordersToExport);
    const excelFilename = String(filename || "danh_sach_don_hang.xls").replace(/\.csv$/i, ".xls");

    const blob = new Blob([xmlContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", excelFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notifyUser(`Đã xuất ${ordersToExport.length} đơn hàng ra file Excel (${dayCount} tab theo từng ngày) thành công!`, "success");
}

export const exportOrdersToExcelByDay = exportOrdersToCsv;

/**
 * Xuất các đơn hàng đang hiển thị trên bảng (chia tab theo từng ngày)
 */
export function exportCurrentAdminOrdersToCsv() {
    exportOrdersToCsv(lastLoadedAdminOrders, `don_hang_${new Date().toISOString().slice(0, 10)}.xls`);
}

/**
 * Tải và xuất toàn bộ đơn hàng từ phiên Live Stream (chia tab theo từng ngày)
 */
export async function exportLiveStreamOrdersCsv() {
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/orders?timeframe=all&source=livestream_quick_order`, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        const json = await res.json();
        const orders = (json.success && json.data && Array.isArray(json.data.orders)) ? json.data.orders : [];
        if (orders.length === 0) {
            notifyUser("Chưa có đơn hàng nào từ Live Stream để xuất!", "info");
            return;
        }
        exportOrdersToCsv(orders, `don_hang_livestream_${new Date().toISOString().slice(0, 10)}.xls`);
    } catch (e) {
        notifyUser("Lỗi khi tải đơn hàng live stream: " + e.message, "error");
    }
}

/**
 * Chuyển nhanh và lọc đơn hàng theo nguồn
 */
export function filterAdminOrdersBySource(sourceName = "livestream_quick_order") {
    const searchEl = document.getElementById("searchOrderInput");
    if (searchEl) {
        searchEl.value = sourceName === "livestream_quick_order" ? "livestream" : "";
    }
    loadAdminOrders();
}

if (typeof window !== "undefined") {
    window.ADMIN_ORDER_STATUS_META = ADMIN_ORDER_STATUS_META;
    window.ADMIN_PAYMENT_STATUS_META = ADMIN_PAYMENT_STATUS_META;
    window.loadAdminOrders = loadAdminOrders;
    window.updateAdminOrderStatus = updateAdminOrderStatus;
    window.dispatchAdminOrder = dispatchAdminOrder;
    window.exportOrdersToCsv = exportOrdersToCsv;
    window.exportOrdersToExcelByDay = exportOrdersToExcelByDay;
    window.groupOrdersByDayForExcel = groupOrdersByDayForExcel;
    window.buildOrdersMultiSheetExcelXml = buildOrdersMultiSheetExcelXml;
    window.exportCurrentAdminOrdersToCsv = exportCurrentAdminOrdersToCsv;
    window.exportLiveStreamOrdersCsv = exportLiveStreamOrdersCsv;
    window.filterAdminOrdersBySource = filterAdminOrdersBySource;
}

