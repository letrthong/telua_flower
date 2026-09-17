import { getCurrentUser, getAuthToken } from './auth.js';
import { API_BASE } from './utils.js';
import { 
    lockScreen, 
    unlockScreen, 
    notifyUser, 
    allAdminCategories, 
    allAdminBranches, 
    allAdminProducts 
} from './portal_admin_state.js';

// ==========================================
// 9. QUẢN LÝ TỒN KHO & HAO HỤT (INVENTORY & WASTAGE - TASK 06)
// ==========================================

export let currentInventoryData = null;
export let currentInventoryBranches = [];
export let allAdminWastageReports = [];
export let allAdminMaterials = [];
export let allAdminInbounds = [];
export let allAdminPurchaseRequests = [];
export let currentFulfillingRequestId = null;
export let currentWastageInbound = null;
export let currentMonthlyReport = null;

export async function loadAdminInventory() {
    const dateInput = document.getElementById("filterInventoryDate");
    const branchSelect = document.getElementById("filterInventoryBranch");
    const tbody = document.getElementById("inventoryMatrixBody");
    const syncBadge = document.getElementById("inventorySyncStatusBadge");

    if (!dateInput) return;

    if (!dateInput.value) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    }

    const selectedDate = dateInput.value;
    const selectedBranch = branchSelect ? branchSelect.value : "all";

    if (tbody && (!currentInventoryData || !currentInventoryData.matrix || currentInventoryData.matrix.length === 0)) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-400 font-medium"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải ma trận tồn kho chi nhánh...</td></tr>`;
    }

    if (syncBadge) {
        syncBadge.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin mr-1 text-[8px] text-amber-500"></i> Đang đồng bộ...`;
        syncBadge.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200";
    }

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    let url = `${API_BASE}/admin/inventory/matrix?date=${selectedDate}`;
    if (selectedBranch && selectedBranch !== "all") {
        url += `&branchId=${selectedBranch}`;
    }

    try {
        const res = await fetch(url, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error("Không thể tải ma trận tồn kho");
        const json = await res.json();
        if (json.success && json.data) {
            currentInventoryData = json.data;
            currentInventoryBranches = json.data.branches || [];

            if (branchSelect && branchSelect.options.length <= 1) {
                currentInventoryBranches.forEach(b => {
                    const opt = document.createElement("option");
                    opt.value = b.id;
                    opt.textContent = b.code ? `${b.code} - ${b.name.replace("Nở Hoa Thả Bình - Showroom ", "")}` : b.name;
                    branchSelect.appendChild(opt);
                });
            }

            renderInventoryKPIs(json.data.summary);
            renderInventoryMatrixTable(json.data.matrix, currentInventoryBranches);

            if (syncBadge) {
                syncBadge.innerHTML = `<i class="fa-solid fa-circle-check mr-1 text-[8px] text-emerald-500"></i> Thời gian thực (${new Date().toLocaleTimeString('vi-VN')})`;
                syncBadge.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200";
            }
        }
    } catch (err) {
        console.error("Lỗi load ma trận tồn kho:", err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500 font-medium"><i class="fa-solid fa-triangle-exclamation mr-2"></i> Lỗi: ${err.message}</td></tr>`;
        }
        if (syncBadge) {
            syncBadge.innerHTML = `<i class="fa-solid fa-circle-xmark mr-1 text-[8px] text-rose-500"></i> Lỗi kết nối`;
            syncBadge.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200";
        }
    }
}

export function renderInventoryKPIs(summary) {
    if (!summary) return;
    const elImp = document.getElementById("invKpiImported");
    const elSold = document.getElementById("invKpiSold");
    const elWast = document.getElementById("invKpiWastage");
    const elLoss = document.getElementById("invKpiLossAmount");
    const elAvail = document.getElementById("invKpiAvailable");
    const elAlerts = document.getElementById("invKpiAlerts");

    if (elImp) elImp.textContent = Number(summary.totalImported || 0).toLocaleString("vi-VN");
    if (elSold) elSold.textContent = Number(summary.totalSold || 0).toLocaleString("vi-VN");
    if (elWast) elWast.textContent = `${Number(summary.totalWastageStems || 0).toLocaleString("vi-VN")} cành`;
    if (elLoss) elLoss.textContent = `${Number(summary.totalWastageLossAmount || 0).toLocaleString("vi-VN")}₫ vốn mất`;
    if (elAvail) elAvail.textContent = Number(summary.totalAvailable || 0).toLocaleString("vi-VN");
    if (elAlerts) {
        const totalAlerts = (summary.lowStockCount || 0) + (summary.outOfStockCount || 0);
        elAlerts.textContent = `${totalAlerts} mẫu (${summary.outOfStockCount || 0} hết)`;
    }
}

export function renderInventoryMatrixTable(matrix, branches) {
    const thead = document.getElementById("inventoryMatrixHeader");
    const tbody = document.getElementById("inventoryMatrixBody");
    if (!tbody || !thead) return;

    let headerHtml = `
        <tr>
            <th class="p-3 w-52">Mẫu Hoa</th>
            <th class="p-3 w-28">Danh Mục</th>
            <th class="p-3 w-24">Giá Bán</th>
    `;
    branches.forEach(b => {
        const shortName = b.code || b.name.replace("Nở Hoa Thả Bình - Showroom ", "");
        headerHtml += `
            <th class="p-3 text-center border-l border-pink-100/80 bg-pink-50/70">
                <div class="font-bold text-gray-800">${shortName}</div>
                <div class="text-[9px] font-normal text-gray-500 tracking-normal flex justify-center gap-1.5 mt-0.5">
                    <span title="Hạn mức mở bán">Mở bán</span>•<span title="Đã bán">Bán</span>•<span title="Báo hủy hỏng">Hỏng</span>•<span title="Tồn khả dụng" class="font-bold text-primary">Tồn</span>
                </div>
            </th>
        `;
    });
    headerHtml += `
            <th class="p-3 text-center border-l border-gray-200 bg-gray-50/80 w-36">
                <div>Tổng Chuỗi</div>
                <div class="text-[9px] font-normal text-gray-400 mt-0.5">Mở Bán • Bán • Tồn</div>
            </th>
            <th class="p-3 text-center w-28">Trạng Thái</th>
        </tr>
    `;
    thead.innerHTML = headerHtml;

    if (!matrix || matrix.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${5 + branches.length}" class="p-8 text-center text-gray-400 font-medium">Không tìm thấy sản phẩm nào trong kho.</td></tr>`;
        return;
    }

    const currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : null;
    const isSuperAdmin = currentUser?.role === "super_admin";
    const userBranch = currentUser?.branchId;

    let bodyHtml = "";
    matrix.forEach(prod => {
        const catObj = (allAdminCategories || []).find(c => c.id === prod.category);
        const catName = catObj ? catObj.name : (prod.category || "Hoa tươi");
        const priceFmt = Number(prod.priceNumber || 0).toLocaleString("vi-VN") + "₫";

        bodyHtml += `
            <tr class="hover:bg-pink-50/20 transition group" data-product-id="${prod.id}" data-product-name="${(prod.name || '').toLowerCase()}">
                <td class="p-3">
                    <div class="flex items-center space-x-2.5">
                        <img src="${prod.image || 'https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=100'}" class="w-10 h-10 rounded-xl object-cover border border-gray-200 shadow-2xs flex-shrink-0" alt="${prod.name}">
                        <div class="min-w-0">
                            <div class="font-bold text-gray-800 text-xs truncate" title="${prod.name}">${prod.name}</div>
                            <div class="text-[10px] font-mono text-gray-400">${prod.id}</div>
                        </div>
                    </div>
                </td>
                <td class="p-3 text-gray-600">${catName}</td>
                <td class="p-3 font-bold text-gray-700">${priceFmt}</td>
        `;

        branches.forEach(b => {
            const bStats = prod.branches ? prod.branches[b.id] : null;
            const imported = bStats ? bStats.imported : 0;
            const sold = bStats ? bStats.sold : 0;
            const wastage = bStats ? bStats.wastage : 0;
            const avail = bStats ? bStats.available : 0;

            const canEdit = isSuperAdmin || (userBranch === b.id);
            const disabledAttr = canEdit ? "" : "disabled";
            const inputCls = canEdit 
                ? "batch-inventory-input w-12 px-1 py-0.5 text-center font-bold text-xs bg-white border border-gray-200 rounded-md focus:border-primary focus:outline-none transition shadow-2xs" 
                : "w-12 px-1 py-0.5 text-center font-bold text-xs bg-gray-100 text-gray-500 border border-gray-200 rounded-md cursor-not-allowed";

            let availBadgeCls = "text-emerald-700 bg-emerald-50 border border-emerald-200";
            if (avail === 0) availBadgeCls = "text-rose-700 bg-rose-50 border border-rose-200";
            else if (avail < 5) availBadgeCls = "text-amber-700 bg-amber-50 border border-amber-200";

            bodyHtml += `
                <td class="p-2.5 text-center border-l border-pink-100/60">
                    <div class="flex items-center justify-center space-x-1.5">
                        <input type="number" min="0" value="${imported}" data-product-id="${prod.id}" data-branch-id="${b.id}" ${disabledAttr} class="${inputCls}" title="Hạn mức mở bán">
                        <span class="text-[10px] text-gray-500 font-semibold" title="Đã bán">${sold}</span>
                        <span class="text-[10px] text-rose-500 font-semibold" title="Hao hụt">${wastage}</span>
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${availBadgeCls}" title="Tồn khả dụng">${avail}</span>
                    </div>
                </td>
            `;
        });

        let totalBadgeCls = "text-emerald-700 bg-emerald-50 border border-emerald-200";
        if (prod.totalAvailable === 0) totalBadgeCls = "text-rose-700 bg-rose-50 border border-rose-200";
        else if (prod.totalAvailable < 5) totalBadgeCls = "text-amber-700 bg-amber-50 border border-amber-200";

        let statusBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full text-emerald-700 bg-emerald-50 border border-emerald-200">🟢 Còn hàng</span>`;
        if (prod.totalAvailable === 0) {
            statusBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full text-rose-700 bg-rose-50 border border-rose-200">🔴 Hết hàng</span>`;
        } else if (prod.totalAvailable < 5) {
            statusBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full text-amber-700 bg-amber-50 border border-amber-200">🟠 Sắp hết</span>`;
        }

        bodyHtml += `
                <td class="p-3 text-center border-l border-gray-200 bg-gray-50/40">
                    <div class="font-bold text-xs text-gray-800">
                        <span>${prod.totalImported}</span>
                        <span class="text-gray-300 mx-1">/</span>
                        <span class="text-emerald-600">${prod.totalSold}</span>
                        <span class="text-gray-300 mx-1">/</span>
                        <span class="px-1.5 py-0.5 rounded font-bold ${totalBadgeCls}">${prod.totalAvailable}</span>
                    </div>
                </td>
                <td class="p-3 text-center">
                    ${statusBadge}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = bodyHtml;
}

export async function saveBatchInventory() {
    const inputs = document.querySelectorAll(".batch-inventory-input");
    if (!inputs || inputs.length === 0) {
        notifyUser("Không có dữ liệu hạn mức mở bán nào để lưu", "warning");
        return;
    }

    const updates = [];
    inputs.forEach(inp => {
        const pId = inp.getAttribute("data-product-id");
        const bId = inp.getAttribute("data-branch-id");
        const val = Math.max(0, parseInt(inp.value, 10) || 0);
        if (pId && bId) {
            updates.push({
                productId: pId,
                branchId: bId,
                quota: val
            });
        }
    });

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    if (!token) {
        notifyUser("Vui lòng đăng nhập quyền Quản Lý hoặc Super Admin để lưu hạn mức mở bán!", "error");
        return;
    }

    lockScreen("Đang lưu hạn mức mở bán chi nhánh...");
    try {
        const res = await fetch(`${API_BASE}/admin/inventory/batch`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ updates })
        });
        const json = await res.json();
        unlockScreen();
        if (res.ok && json.success) {
            notifyUser("Đã cập nhật hạn mức mở bán thành công!", "success");
            loadAdminInventory();
        } else {
            notifyUser(json.message || "Không thể lưu hạn mức mở bán", "error");
        }
    } catch (e) {
        unlockScreen();
        notifyUser(`Lỗi kết nối: ${e.message}`, "error");
    }
}

export function openInventoryManagementModal(subView = "matrix") {
    if (typeof window !== "undefined" && typeof window.closeAdminPortalModal === "function") {
        window.closeAdminPortalModal();
    }

    const modal = document.getElementById("inventoryManagementModal");
    if (!modal) return;

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    const branchSelect = document.getElementById("filterInventoryBranch");
    if (branchSelect && branchSelect.options.length <= 1 && allAdminBranches && allAdminBranches.length > 0) {
        allAdminBranches.filter(b => b.isActive !== false).forEach(b => {
            const opt = document.createElement("option");
            opt.value = b.id;
            opt.textContent = b.code ? `${b.code} - ${b.name.replace("Nở Hoa Thả Bình - Showroom ", "")}` : b.name;
            branchSelect.appendChild(opt);
        });
    }

    switchInventorySubView(subView || "matrix");
}

export function closeInventoryManagementModal() {
    const modal = document.getElementById("inventoryManagementModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export function switchInventorySubView(view) {
    if (view === "wastage") view = "inbounds";

    const user = (typeof getCurrentUser === "function") ? getCurrentUser() : null;
    const checkSubAllowed = (typeof window !== "undefined" && typeof window.isSubTabAllowed === "function") ? window.isSubTabAllowed : null;
    if (user && checkSubAllowed && !checkSubAllowed("inventory", view, user.role)) {
        notifyUser("Bạn không có quyền truy cập phân hệ này!", "warning");
        return;
    }

    const btnMatrix = document.getElementById("subViewBtnMatrix");
    const btnMaterials = document.getElementById("subViewBtnMaterials");
    const btnInbounds = document.getElementById("subViewBtnInbounds");
    const btnMonthlyReport = document.getElementById("subViewBtnMonthlyReport");

    const subMatrix = document.getElementById("inventoryMatrixSubView");
    const subMaterials = document.getElementById("inventoryMaterialsSubView");
    const subInbounds = document.getElementById("inventoryInboundsSubView");
    const subMonthlyReport = document.getElementById("inventoryMonthlyReportSubView");

    const activeBtnClass = "py-2.5 px-2 font-bold text-xs border-b-2 border-primary text-primary transition flex items-center gap-1.5";
    const inactiveBtnClass = "py-2.5 px-2 font-bold text-xs border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition flex items-center gap-1.5";

    if (view === "wastage") view = "inbounds";

    const views = {
        matrix: { btn: btnMatrix, sub: subMatrix },
        materials: { btn: btnMaterials, sub: subMaterials },
        inbounds: { btn: btnInbounds, sub: subInbounds },
        monthly_report: { btn: btnMonthlyReport, sub: subMonthlyReport }
    };

    Object.keys(views).forEach(vKey => {
        const item = views[vKey];
        if (item.btn) {
            item.btn.className = (vKey === view) ? activeBtnClass : inactiveBtnClass;
        }
        if (item.sub) {
            if (vKey === view) item.sub.classList.remove("hidden");
            else item.sub.classList.add("hidden");
        }
    });

    if (view === "matrix") {
        loadAdminInventory();
    } else if (view === "materials") {
        loadAdminMaterials();
        loadAdminPurchaseRequests();
    } else if (view === "inbounds") {
        loadAdminInbounds();
        loadAdminWastageHistory();
        loadAdminPurchaseRequests();
    } else if (view === "monthly_report") {
        loadMonthlyInventoryReport();
    }
}

// ----------------------------------------------------
// SUB-TAB 2.1: YÊU CẦU NHẬP HÀNG (PURCHASE REQUISITIONS)
// ----------------------------------------------------
export async function loadAdminPurchaseRequests() {
    const tbody = document.getElementById("purchaseRequestsTableBody");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    try {
        const res = await fetch(`${API_BASE}/admin/inventory/requests`, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error("Không thể tải danh sách yêu cầu nhập hàng");
        const json = await res.json();
        if (json.success && json.data) {
            allAdminPurchaseRequests = json.data;
            if (typeof window !== "undefined") window.allAdminPurchaseRequests = allAdminPurchaseRequests;
            renderAdminPurchaseRequestsTable();
            renderPendingFulfillmentRequestsTable();
        }
    } catch (e) {
        console.warn("Lỗi khi tải yêu cầu nhập hàng:", e);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-red-500 font-medium">Lỗi: ${e.message}</td></tr>`;
        }
    }
}

export function filterAdminPurchaseRequests() {
    const filterSelect = document.getElementById("filterRequestStatus");
    const status = (filterSelect?.value || "ALL").toLowerCase();
    let list = allAdminPurchaseRequests;
    if (status !== "all") {
        list = list.filter(r => (r.status || "").toLowerCase() === status);
    }
    renderAdminPurchaseRequestsTable(list);
}

export async function changePurchaseRequestStatus(requestId, targetStatus) {
    if (!requestId || !targetStatus) return;

    let notes = "";
    if (targetStatus === "rejected") {
        const reason = prompt("Vui lòng nhập lý do từ chối yêu cầu nhập hàng (tùy chọn):", "");
        if (reason === null) {
            renderAdminPurchaseRequestsTable();
            return;
        }
        notes = reason.trim();
    } else if (targetStatus === "approved") {
        const confirmed = confirm("Bạn có chắc chắn muốn DUYỆT yêu cầu nhập hàng này?");
        if (!confirmed) {
            renderAdminPurchaseRequestsTable();
            return;
        }
    } else if (targetStatus === "closed") {
        const confirmed = confirm("Bạn có chắc chắn muốn ĐÓNG ĐƠN HÀNG này sau 2-3 ngày theo dõi?\n\nSau khi đóng đơn, tính năng báo hoa hỏng của đợt nhập này sẽ được khóa vĩnh viễn để chốt số liệu công nợ kế toán.");
        if (!confirmed) {
            renderAdminPurchaseRequestsTable();
            return;
        }
    }

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen("Đang cập nhật trạng thái yêu cầu...");

    try {
        const res = await fetch(`${API_BASE}/admin/inventory/requests/${requestId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                status: targetStatus,
                notes: notes
            })
        });

        const json = await res.json();
        unlockScreen();

        if (!res.ok || !json.success) {
            throw new Error(json.message || "Không thể cập nhật trạng thái phiếu yêu cầu");
        }

        notifyUser(json.message || `Đã cập nhật trạng thái phiếu yêu cầu sang '${targetStatus}'!`, "success");
        await loadAdminPurchaseRequests();
    } catch (e) {
        unlockScreen();
        console.error("Lỗi cập nhật trạng thái phiếu yêu cầu:", e);
        notifyUser(e.message || "Lỗi khi cập nhật trạng thái yêu cầu", "error");
        renderAdminPurchaseRequestsTable();
    }
}

export async function closePurchaseRequest(requestId) {
    await changePurchaseRequestStatus(requestId, "closed");
}

export function renderAdminPurchaseRequestsTable(requestsToRender) {
    const tbody = document.getElementById("purchaseRequestsTableBody");
    if (!tbody) return;

    const list = requestsToRender || allAdminPurchaseRequests;
    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-gray-400 font-medium">Chưa có đề xuất / yêu cầu nhập hàng nào.</td></tr>`;
        return;
    }

    const branchMap = {};
    if (Array.isArray(allAdminBranches)) {
        allAdminBranches.forEach(b => {
            branchMap[b.id] = b.code || b.name.replace("Nở Hoa Thả Bình - Showroom ", "");
        });
    }

    const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    let html = "";
    list.forEach(req => {
        const bName = branchMap[req.branchId] || req.branchId;
        const reqDate = req.createdAt ? req.createdAt.substring(0, 10) : "--";
        const needDate = req.neededDate || "--";
        const st = (req.status || "pending").toLowerCase();
        
        let prioBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">Thường</span>`;
        if (req.priority === "urgent") {
            prioBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 animate-pulse">Khẩn cấp</span>`;
        } else if (req.priority === "high") {
            prioBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Ưu tiên</span>`;
        }

        let statusBadge = "";
        if (st === "fulfilled") {
            statusBadge = `
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Đã nhận hàng từ xe hoa và chốt vào kho (Bất biến)">
                    <i class="fa-solid fa-box-archive text-[10px]"></i> Đã nhận hàng
                </span>
            `;
        } else if (st === "closed") {
            statusBadge = `
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-300" title="Đã đóng đơn hoàn tất sau 2-3 ngày theo dõi (Chốt sổ công nợ)">
                    <i class="fa-solid fa-lock text-[10px] text-gray-500"></i> Đã đóng đơn
                </span>
            `;
        } else {
            let statusStyle = "bg-amber-50 text-amber-700 border-amber-200";
            if (st === "approved") statusStyle = "bg-blue-50 text-blue-700 border-blue-200";
            else if (st === "rejected") statusStyle = "bg-rose-50 text-rose-700 border-rose-200";

            statusBadge = `
                <div class="inline-flex flex-col items-center">
                    <div class="relative inline-block" title="Nhấp vào để đổi trạng thái yêu cầu">
                        <select onchange="changePurchaseRequestStatus('${req.id}', this.value)" class="cursor-pointer appearance-none pl-2.5 pr-6 py-1 rounded-full text-[11px] font-bold border transition shadow-2xs focus:ring-2 focus:ring-primary/20 ${statusStyle}">
                            <option value="pending" ${st === 'pending' ? 'selected' : ''}>⏳ Chờ duyệt</option>
                            <option value="approved" ${st === 'approved' ? 'selected' : ''}>✅ Đã duyệt</option>
                            <option value="rejected" ${st === 'rejected' ? 'selected' : ''}>❌ Từ chối</option>
                        </select>
                        <i class="fa-solid fa-chevron-down absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] opacity-60"></i>
                    </div>
                    ${req.approvedBy && st === 'approved' ? `<span class="text-[9px] text-blue-600 mt-0.5 font-medium" title="Duyệt bởi ${esc(req.approvedBy)}">Duyệt: ${esc(req.approvedBy)}</span>` : ''}
                    ${req.rejectedBy && st === 'rejected' ? `<span class="text-[9px] text-rose-600 mt-0.5 font-medium" title="Từ chối bởi ${esc(req.rejectedBy)}">Bởi: ${esc(req.rejectedBy)}</span>` : ''}
                    ${req.processNotes ? `<span class="text-[9px] text-gray-500 italic mt-0.5 max-w-[130px] truncate" title="${esc(req.processNotes)}">${esc(req.processNotes)}</span>` : ''}
                </div>
            `;
        }

        const itemsSummary = (req.items || []).map(it => `<div>• <b>${esc(it.name || it.materialName || it.materialId)}</b>: ${it.requestedQty || it.quantity} ${it.unit || "cành"}</div>`).join("");

        let actions = "";
        if (st === "pending") {
            actions = `
                <div class="flex items-center justify-center gap-1.5 flex-wrap">
                    <button type="button" onclick="changePurchaseRequestStatus('${req.id}', 'approved')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs" title="Duyệt yêu cầu nhập hàng">
                        <i class="fa-solid fa-check text-[10px]"></i> Duyệt
                    </button>
                    <button type="button" onclick="changePurchaseRequestStatus('${req.id}', 'rejected')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs" title="Từ chối yêu cầu nhập hàng">
                        <i class="fa-solid fa-xmark text-[10px]"></i> Từ chối
                    </button>
                    <button type="button" onclick="fulfillPurchaseRequestFromQueue('${req.id}')" class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs" title="Xử lý nhập kho nhanh">
                        <i class="fa-solid fa-bolt text-[10px]"></i>
                    </button>
                </div>
            `;
        } else if (st === "approved") {
            actions = `
                <div class="flex items-center justify-center gap-1.5 flex-wrap">
                    <button type="button" onclick="fulfillPurchaseRequestFromQueue('${req.id}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs" title="Lập phiếu nhập kho">
                        <i class="fa-solid fa-bolt text-[10px]"></i> Nhập Kho
                    </button>
                    <button type="button" onclick="changePurchaseRequestStatus('${req.id}', 'rejected')" class="px-1.5 py-1 text-gray-400 hover:text-rose-600 rounded text-xs transition" title="Hủy duyệt / Đổi sang Từ chối">
                        <i class="fa-solid fa-ban"></i>
                    </button>
                </div>
            `;
        } else if (st === "rejected") {
            actions = `
                <div class="flex items-center justify-center gap-1.5">
                    <button type="button" onclick="changePurchaseRequestStatus('${req.id}', 'approved')" class="px-2.5 py-1 bg-gray-50 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 border border-gray-200 hover:border-emerald-200 rounded-lg text-xs font-medium transition flex items-center gap-1 shadow-2xs" title="Xem xét và Duyệt lại">
                        <i class="fa-solid fa-rotate-left text-[10px]"></i> Duyệt Lại
                    </button>
                </div>
            `;
        } else if (st === "fulfilled") {
            const inbTargetId = req.fulfilledInboundId || req.inboundId || "";
            actions = `
                <div class="flex flex-col items-center justify-center gap-1">
                    <span class="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"><i class="fa-solid fa-circle-check text-emerald-600"></i> Đã Nhận Hàng</span>
                    ${inbTargetId ? `<span class="text-[10px] text-blue-600 font-mono font-medium" title="Mã đợt nhập liên kết"><i class="fa-solid fa-receipt text-gray-400"></i> ${inbTargetId}</span>` : ''}
                </div>
            `;
        } else if (st === "closed") {
            const inbTargetId = req.fulfilledInboundId || req.inboundId || "";
            actions = `
                <div class="flex flex-col items-center justify-center gap-1">
                    <span class="inline-flex items-center gap-1 text-[11px] text-gray-500 font-medium italic bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200"><i class="fa-solid fa-lock text-gray-400"></i> Đã chốt sổ</span>
                    ${inbTargetId ? `<span class="text-[10px] text-gray-400 font-mono" title="Mã đợt nhập"><i class="fa-solid fa-receipt text-gray-400"></i> ${inbTargetId}</span>` : ''}
                </div>
            `;
        } else {
            actions = `<span class="text-[10px] text-gray-400 italic">Không khả dụng</span>`;
        }

        const linkedInboundBadge = (st === "fulfilled" && (req.fulfilledInboundId || req.inboundId))
            ? `<div class="text-[10px] text-blue-600 font-mono font-medium mt-0.5"><i class="fa-solid fa-link text-[9px] text-gray-400"></i> ${req.fulfilledInboundId || req.inboundId}</div>`
            : '';

        html += `
            <tr class="hover:bg-emerald-50/20 transition">
                <td class="p-3 font-mono text-xs font-bold text-emerald-800">
                    <div>${req.requestCode || req.id}</div>
                    ${linkedInboundBadge}
                </td>
                <td class="p-3 font-bold text-gray-800">${bName}</td>
                <td class="p-3 text-gray-500">${reqDate}</td>
                <td class="p-3 font-semibold text-gray-700">${needDate}</td>
                <td class="p-3 text-gray-600">${req.requesterName || req.requestedBy || "admin"}</td>
                <td class="p-3 text-xs text-gray-700">${itemsSummary || "--"}</td>
                <td class="p-3 text-center">${prioBadge}</td>
                <td class="p-3 text-center">${statusBadge}</td>
                <td class="p-3 text-center">${actions}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

export let currentQueueFilter = "all";

export function setQueueFilter(filter) {
    currentQueueFilter = filter;
    const btnAll = document.getElementById("btnFilterQueueAll");
    const btnApproved = document.getElementById("btnFilterQueueApproved");
    const btnFulfilled = document.getElementById("btnFilterQueueFulfilled");
    
    if (btnAll) btnAll.className = "px-2.5 py-1 rounded-md text-gray-600 hover:text-blue-700 text-[11px] transition";
    if (btnApproved) btnApproved.className = "px-2.5 py-1 rounded-md text-gray-600 hover:text-blue-700 text-[11px] transition";
    if (btnFulfilled) btnFulfilled.className = "px-2.5 py-1 rounded-md text-gray-600 hover:text-emerald-700 text-[11px] transition";

    if (filter === "all" && btnAll) {
        btnAll.className = "px-2.5 py-1 rounded-md bg-blue-600 text-white font-bold text-[11px] transition shadow-2xs";
    } else if (filter === "approved" && btnApproved) {
        btnApproved.className = "px-2.5 py-1 rounded-md bg-blue-600 text-white font-bold text-[11px] transition shadow-2xs";
    } else if (filter === "fulfilled" && btnFulfilled) {
        btnFulfilled.className = "px-2.5 py-1 rounded-md bg-emerald-600 text-white font-bold text-[11px] transition shadow-2xs";
    }
    renderPendingFulfillmentRequestsTable();
}

export async function openWastageModalForPurchaseRequest(reqId) {
    const req = (allAdminPurchaseRequests || []).find(r => r.id === reqId || r.requestCode === reqId);
    if (!req) {
        notifyUser("Không tìm thấy đơn yêu cầu nhập hàng", "warning");
        return;
    }
    if ((req.status || "").toLowerCase() === "closed") {
        notifyUser("Đơn hàng này đã được đóng chốt sổ (closed). Không thể báo hoa hỏng thêm!", "warning");
        return;
    }
    let inbId = req.fulfilledInboundId || req.inboundId;
    if (!inbId) {
        if (!allAdminInbounds || allAdminInbounds.length === 0) {
            await loadAdminInbounds();
        }
        const found = (allAdminInbounds || []).find(i => i.purchaseRequestId === req.id || i.requestCode === req.id || i.purchaseRequestId === req.requestCode);
        if (found) inbId = found.id;
    }
    if (inbId) {
        await openWastageModalForInbound(inbId);
    } else {
        await openWastageModal();
    }
}

export function renderPendingFulfillmentRequestsTable() {
    const tbody = document.getElementById("pendingFulfillmentTableBody");
    const badge = document.getElementById("pendingRequisitionCountBadge");
    const countApprEl = document.getElementById("countFilterApproved");
    const countFulfEl = document.getElementById("countFilterFulfilled");
    if (!tbody) return;

    const allList = (allAdminPurchaseRequests || []);
    const approvedList = allList.filter(r => (r.status || "").toLowerCase() === "approved");
    const fulfilledList = allList.filter(r => (r.status || "").toLowerCase() === "fulfilled");

    if (countApprEl) countApprEl.textContent = approvedList.length;
    if (countFulfEl) countFulfEl.textContent = fulfilledList.length;
    if (badge) {
        badge.textContent = `${approvedList.length} chờ nhận | ${fulfilledList.length} đã nhận`;
    }

    let targetList = [];
    if (currentQueueFilter === "approved") {
        targetList = approvedList;
    } else if (currentQueueFilter === "fulfilled") {
        targetList = fulfilledList;
    } else {
        // "all": hiển thị các đơn approved và fulfilled (kèm closed gần đây)
        targetList = allList.filter(r => {
            const st = (r.status || "").toLowerCase();
            return st === "approved" || st === "fulfilled" || st === "closed";
        });
    }

    if (targetList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-400 font-medium">Không có yêu cầu nhập hàng nào phù hợp với bộ lọc.</td></tr>`;
        return;
    }

    const branchMap = {};
    if (Array.isArray(allAdminBranches)) {
        allAdminBranches.forEach(b => {
            branchMap[b.id] = b.code || b.name.replace("Nở Hoa Thả Bình - Showroom ", "");
        });
    }

    const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    let html = "";
    targetList.forEach(req => {
        const bName = branchMap[req.branchId] || req.branchId;
        const needDate = req.neededDate || "--";
        const st = (req.status || "").toLowerCase();

        let prioBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">Thường</span>`;
        if (req.priority === "urgent") {
            prioBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Khẩn cấp</span>`;
        } else if (req.priority === "high") {
            prioBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Ưu tiên</span>`;
        }

        const itemsSummary = (req.items || []).map(it => `<div>• <b>${esc(it.name || it.materialName || it.materialId)}</b>: ${it.requestedQty || it.quantity} ${it.unit || "cành"}</div>`).join("");

        let statusText = "";
        let actionButtons = "";

        if (st === "approved") {
            statusText = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1"><i class="fa-solid fa-clock text-[9px]"></i> Chờ xe hoa</span>`;
            actionButtons = `
                <button type="button" onclick="fulfillPurchaseRequestFromQueue('${req.id}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5 mx-auto" title="Xe hoa về: Bấm để kiểm đếm thực tế & xác nhận nhận hàng">
                    <i class="fa-solid fa-bolt text-[10px]"></i> Xử Lý Nhập Kho
                </button>
            `;
        } else if (st === "fulfilled") {
            const inbTargetId = req.fulfilledInboundId || req.inboundId || "";
            statusText = `
                <div>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1"><i class="fa-solid fa-circle-check text-[9px]"></i> Đã nhận hàng</span>
                    ${inbTargetId ? `<div class="text-[9px] text-blue-600 font-mono mt-0.5"><i class="fa-solid fa-receipt text-gray-400"></i> ${inbTargetId}</div>` : ''}
                </div>
            `;
            actionButtons = `
                <div class="flex items-center justify-center gap-1.5 flex-wrap">
                    <button type="button" onclick="openWastageModalForPurchaseRequest('${req.id}')" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs" title="Báo hoa hư hỏng sau xử lý nhập kho (theo dõi 1-2 ngày kho lạnh)">
                        <i class="fa-solid fa-triangle-exclamation text-amber-600 text-[11px]"></i> Báo Hỏng
                    </button>
                    <button type="button" onclick="closePurchaseRequest('${req.id}')" class="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-300 rounded-lg text-xs font-medium transition flex items-center gap-1 shadow-2xs" title="Đóng đơn hàng sau 2-3 ngày theo dõi (Khóa báo hỏng)">
                        <i class="fa-solid fa-lock text-gray-500 text-[10px]"></i> Đóng Đơn
                    </button>
                </div>
            `;
        } else if (st === "closed") {
            statusText = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 inline-flex items-center gap-1"><i class="fa-solid fa-lock text-[9px]"></i> Đã đóng đơn</span>`;
            actionButtons = `<span class="inline-flex items-center gap-1 text-[11px] text-gray-500 font-medium italic"><i class="fa-solid fa-lock text-gray-400"></i> Đã chốt sổ</span>`;
        }

        html += `
            <tr class="hover:bg-blue-50/40 transition">
                <td class="p-2.5 font-mono text-xs font-bold text-blue-900">${req.requestCode || req.id}</td>
                <td class="p-2.5 font-bold text-gray-800">${bName}</td>
                <td class="p-2.5 font-semibold text-gray-700">${needDate}</td>
                <td class="p-2.5 text-xs text-gray-700">${itemsSummary || "--"}</td>
                <td class="p-2.5 text-center">${prioBadge}</td>
                <td class="p-2.5 text-center text-xs">${statusText}</td>
                <td class="p-2.5 text-center">${actionButtons}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

export async function openPurchaseRequestModal(prefillMaterialId) {
    const modal = document.getElementById("purchaseRequestModal");
    const branchSelect = document.getElementById("purchaseRequestBranchSelect");
    const dateInput = document.getElementById("purchaseRequestNeededDateInput");
    const notesInput = document.getElementById("purchaseRequestNotesInput");
    const errBox = document.getElementById("purchaseRequestModalError");

    if (!modal) return;
    if (errBox) errBox.classList.add("hidden");
    if (notesInput) notesInput.value = "";

    if (dateInput) {
        const target = new Date();
        target.setDate(target.getDate() + 2);
        const y = target.getFullYear();
        const m = String(target.getMonth() + 1).padStart(2, '0');
        const d = String(target.getDate()).padStart(2, '0');
        dateInput.value = `${y}-${m}-${d}`;
    }

    if (branchSelect) {
        branchSelect.innerHTML = "";
        const currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : null;
        const isSuperAdmin = currentUser?.role === "super_admin";
        const userBranch = currentUser?.branchId;

        const branches = (allAdminBranches && allAdminBranches.length > 0)
            ? allAdminBranches.filter(b => b.isActive !== false)
            : [
                { id: "branch_q10", name: "Showroom Q.10 (Flagship)", code: "CN_Q10" },
                { id: "branch_q1", name: "Showroom Bến Nghé Q.1", code: "CN_Q1" },
                { id: "branch_thao_dien", name: "Showroom Thảo Điền", code: "CN_Q2" }
            ];

        branches.forEach(b => {
            const opt = document.createElement("option");
            opt.value = b.id;
            opt.textContent = b.code ? `${b.code} - ${b.name.replace("Nở Hoa Thả Bình - Showroom ", "")}` : b.name;
            branchSelect.appendChild(opt);
        });

        if (!isSuperAdmin && userBranch) {
            branchSelect.value = userBranch;
            branchSelect.disabled = true;
        } else {
            branchSelect.disabled = false;
        }
    }

    const tbody = document.getElementById("purchaseRequestItemsTableBody");
    if (tbody) tbody.innerHTML = "";

    await ensureAdminMaterialsLoaded();
    const defaultMaterialId = prefillMaterialId || (allAdminMaterials && allAdminMaterials.length > 0 ? allAdminMaterials[0].id : null);
    await addPurchaseRequestItemRow(defaultMaterialId);

    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

export function closePurchaseRequestModal() {
    const modal = document.getElementById("purchaseRequestModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

function normalizeSearchText(str) {
    if (!str) return "";
    return str.toString().toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .trim();
}

export async function addPurchaseRequestItemRow(preselectedId, defaultQty, defaultNotes) {
    const tbody = document.getElementById("purchaseRequestItemsTableBody");
    if (!tbody) return;

    if (!allAdminMaterials || allAdminMaterials.length === 0) {
        await ensureAdminMaterialsLoaded();
    }

    const rowId = "pr_row_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
    const options = getInboundMaterialOptionsHtml();

    const tr = document.createElement("tr");
    tr.id = rowId;
    tr.className = "hover:bg-emerald-50/20 transition pr-item-row border-b border-gray-100";
    tr.innerHTML = `
        <td class="p-2.5 relative min-w-[340px]">
            <div class="relative w-full pr-combobox-wrapper" id="${rowId}_wrapper">
                <div class="relative flex items-center">
                    <i class="fa-solid fa-magnifying-glass absolute left-2.5 text-emerald-600 text-xs pointer-events-none"></i>
                    <input type="text" 
                        placeholder="🔍 Gõ tìm hoặc bấm mũi tên để chọn cành hoa..." 
                        class="pr-search-input w-full pl-8 pr-14 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 transition shadow-2xs" 
                        onfocus="onPrSearchFocus('${rowId}')" 
                        oninput="onPrSearchInput('${rowId}')" 
                        autocomplete="off">
                    <div class="absolute right-2 flex items-center gap-1 text-gray-400">
                        <button type="button" onclick="clearPrSearchSelection('${rowId}')" class="pr-clear-btn hover:text-gray-600 text-xs hidden transition p-1" title="Xóa tìm cành khác">
                            <i class="fa-solid fa-circle-xmark"></i>
                        </button>
                        <button type="button" onclick="togglePrSearchDropdown('${rowId}')" class="hover:text-emerald-600 text-xs transition p-1" title="Mở danh sách mặt hàng">
                            <i class="fa-solid fa-chevron-down text-[10px]"></i>
                        </button>
                    </div>
                </div>
                <!-- Dropdown danh sách kết quả tìm kiếm -->
                <div class="pr-search-results absolute left-0 top-full mt-1 w-full bg-white border border-emerald-200 rounded-xl shadow-2xl z-[300] max-h-64 overflow-y-auto hidden divide-y divide-gray-100 text-xs ring-1 ring-black/5">
                    <!-- Dynamic suggestions -->
                </div>
                <!-- Select ngầm để đồng bộ và tương thích form -->
                <select class="pr-item-select hidden">
                    ${options}
                </select>
            </div>
            <div class="pr-selected-badge mt-1.5 hidden text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5 bg-emerald-50/90 px-2.5 py-1 rounded-lg border border-emerald-200/80">
                <i class="fa-solid fa-circle-check text-emerald-600"></i>
                <span class="pr-selected-name font-bold">--</span>
                <span class="pr-selected-detail text-gray-600 font-normal">--</span>
            </div>
        </td>
        <td class="p-2.5 w-32 text-center">
            <input type="number" min="1" value="${defaultQty || 50}" class="pr-item-qty w-24 px-2 py-1.5 text-center bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-emerald-600 shadow-2xs" title="Số lượng cành đề xuất">
        </td>
        <td class="p-2.5 w-36">
            <input type="text" placeholder="Ghi chú..." value="${defaultNotes || ''}" class="pr-item-notes w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-emerald-600 shadow-2xs">
        </td>
        <td class="p-2.5 w-12 text-center">
            <button type="button" onclick="removePurchaseRequestItemRow('${rowId}')" class="w-7 h-7 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition mx-auto">
                <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);

    if (preselectedId) {
        selectPrMaterial(rowId, preselectedId);
    } else {
        const inp = tr.querySelector(".pr-search-input");
        if (inp) {
            setTimeout(() => inp.focus(), 50);
        }
    }
}

export function onPrSearchFocus(rowId) {
    const tr = document.getElementById(rowId);
    if (!tr) return;
    const input = tr.querySelector(".pr-search-input");
    if (input) {
        input.select();
    }
    renderPrSearchResults(rowId, input?.value || "");
}

export function onPrSearchInput(rowId) {
    const tr = document.getElementById(rowId);
    if (!tr) return;
    const input = tr.querySelector(".pr-search-input");
    renderPrSearchResults(rowId, input?.value || "");
}

export function renderPrSearchResults(rowId, term = "") {
    const tr = document.getElementById(rowId);
    if (!tr) return;
    const resultsEl = tr.querySelector(".pr-search-results");
    if (!resultsEl) return;

    let cleanTerm = (term || "").trim();
    cleanTerm = cleanTerm.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (tr.dataset.materialName && cleanTerm.toLowerCase() === tr.dataset.materialName.toLowerCase()) {
        cleanTerm = "";
    }

    const normTerm = normalizeSearchText(cleanTerm);
    const materials = allAdminMaterials || [];

    const matched = materials.filter(m => {
        if (!normTerm) return true;
        const normName = normalizeSearchText(m.name || "");
        const normId = normalizeSearchText(m.id || "");
        const normCat = normalizeSearchText(m.category || "");
        return normName.includes(normTerm) || normId.includes(normTerm) || normCat.includes(normTerm);
    });

    if (matched.length === 0) {
        resultsEl.innerHTML = `
            <div class="p-3 text-center text-gray-400 text-xs italic">
                <i class="fa-solid fa-circle-question mr-1"></i> Không tìm thấy cành hoa nào khớp với "${cleanTerm || term}"
            </div>
        `;
        resultsEl.classList.remove("hidden");
        return;
    }

    let html = "";
    matched.slice(0, 25).forEach(m => {
        const cost = m.costPrice || Math.round((m.priceNumber || 0) * 0.5) || 0;
        const unit = m.unit || (m.category === "binh_hoa" ? "bình" : "cành");
        const costFmt = Number(cost).toLocaleString("vi-VN") + "₫";
        const catName = m.category === "binh_hoa" ? "Bình hoa" : "Hoa cành";

        html += `
            <div onclick="selectPrMaterial('${rowId}', '${m.id}')" class="p-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between gap-2 transition group">
                <div class="flex items-center gap-2">
                    <span class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition shadow-2xs">
                        🌿
                    </span>
                    <div>
                        <div class="font-bold text-gray-800 text-xs group-hover:text-emerald-800">${m.name}</div>
                        <div class="text-[10px] text-gray-400 font-medium">${catName} • Mã: <span class="font-mono text-gray-500">${m.id}</span></div>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <div class="font-bold text-emerald-600 text-xs">${costFmt}</div>
                    <div class="text-[10px] text-gray-400 font-medium">/${unit}</div>
                </div>
            </div>
        `;
    });

    resultsEl.innerHTML = html;
    resultsEl.classList.remove("hidden");
}

export function togglePrSearchDropdown(rowId) {
    const tr = document.getElementById(rowId);
    if (!tr) return;
    const resultsEl = tr.querySelector(".pr-search-results");
    const input = tr.querySelector(".pr-search-input");
    if (!resultsEl) return;
    if (resultsEl.classList.contains("hidden")) {
        renderPrSearchResults(rowId, "");
        if (input) input.focus();
    } else {
        resultsEl.classList.add("hidden");
    }
}

export function selectPrMaterial(rowId, materialId) {
    const tr = document.getElementById(rowId);
    if (!tr) return;
    const m = (allAdminMaterials || []).find(x => x.id === materialId);
    if (!m) return;

    const input = tr.querySelector(".pr-search-input");
    const results = tr.querySelector(".pr-search-results");
    const clearBtn = tr.querySelector(".pr-clear-btn");
    const select = tr.querySelector(".pr-item-select");
    const badge = tr.querySelector(".pr-selected-badge");
    const badgeName = tr.querySelector(".pr-selected-name");
    const badgeDetail = tr.querySelector(".pr-selected-detail");

    const unit = m.unit || (m.category === "binh_hoa" ? "bình" : "cành");
    if (input) input.value = `${m.name} (${unit})`;
    if (results) results.classList.add("hidden");
    if (clearBtn) clearBtn.classList.remove("hidden");

    if (select) {
        select.value = m.id;
    }

    tr.dataset.materialId = m.id;
    tr.dataset.materialName = m.name;
    tr.dataset.materialUnit = unit;

    if (badge && badgeName && badgeDetail) {
        badgeName.textContent = m.name;
        const cost = m.costPrice || Math.round((m.priceNumber || 0) * 0.5) || 0;
        badgeDetail.textContent = `• Quy cách: ${unit} • Giá vốn: ${Number(cost).toLocaleString("vi-VN")}₫`;
        badge.classList.remove("hidden");
    }
}

export function clearPrSearchSelection(rowId) {
    const tr = document.getElementById(rowId);
    if (!tr) return;
    const input = tr.querySelector(".pr-search-input");
    const results = tr.querySelector(".pr-search-results");
    const clearBtn = tr.querySelector(".pr-clear-btn");
    const select = tr.querySelector(".pr-item-select");
    const badge = tr.querySelector(".pr-selected-badge");

    if (input) {
        input.value = "";
        input.focus();
    }
    if (clearBtn) clearBtn.classList.add("hidden");
    if (select) select.value = "";
    if (badge) badge.classList.add("hidden");
    tr.dataset.materialId = "";
    tr.dataset.materialName = "";
    tr.dataset.materialUnit = "";

    renderPrSearchResults(rowId, "");
}

export function removePurchaseRequestItemRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) row.remove();
}

export async function handlePurchaseRequestSubmit(event) {
    if (event) event.preventDefault();
    const branchSelect = document.getElementById("purchaseRequestBranchSelect");
    const neededDateInput = document.getElementById("purchaseRequestNeededDateInput");
    const prioritySelect = document.getElementById("purchaseRequestPrioritySelect");
    const notesInput = document.getElementById("purchaseRequestNotesInput");
    const errBox = document.getElementById("purchaseRequestModalError");

    const branchId = branchSelect?.value;
    const neededDate = neededDateInput?.value;
    const priority = prioritySelect?.value || "normal";
    const notes = notesInput?.value?.trim() || "";

    if (!branchId || !neededDate) {
        if (errBox) {
            errBox.textContent = "Vui lòng chọn chi nhánh và ngày cần hàng";
            errBox.classList.remove("hidden");
        }
        return;
    }

    const rows = document.querySelectorAll("#purchaseRequestItemsTableBody tr");
    if (rows.length === 0) {
        if (errBox) {
            errBox.textContent = "Vui lòng thêm ít nhất một mặt hàng cần nhập";
            errBox.classList.remove("hidden");
        }
        return;
    }

    const items = [];
    let hasUnselected = false;

    rows.forEach(tr => {
        const select = tr.querySelector(".pr-item-select");
        const qtyInp = tr.querySelector(".pr-item-qty");
        const noteInp = tr.querySelector(".pr-item-notes");

        const val = tr.dataset.materialId || select?.value || "";
        if (!val) {
            hasUnselected = true;
            return;
        }

        const opt = select?.selectedOptions[0];
        const qty = Math.max(1, parseInt(qtyInp?.value || 1, 10));
        const itemNote = noteInp?.value?.trim() || "";
        const cleanId = val.replace("mat:", "").replace("prod:", "");
        const matchedMat = (allAdminMaterials || []).find(m => m.id === cleanId);
        const resolvedName = tr.dataset.materialName || opt?.dataset.name || matchedMat?.name || cleanId || "Cành hoa";
        const resolvedUnit = tr.dataset.materialUnit || opt?.dataset.unit || matchedMat?.unit || "cành";
        const costPrice = matchedMat?.costPrice || 0;

        items.push({
            materialId: cleanId,
            productId: cleanId,
            materialName: resolvedName,
            name: resolvedName,
            unit: resolvedUnit,
            costPrice: costPrice,
            quantity: qty,
            requestedQty: qty,
            notes: itemNote
        });
    });

    if (hasUnselected && items.length === 0) {
        if (errBox) {
            errBox.textContent = "Vui lòng tìm kiếm và chọn cành hoa cho tất cả các dòng yêu cầu!";
            errBox.classList.remove("hidden");
        }
        return;
    }

    const payload = {
        branchId: branchId,
        neededDate: neededDate,
        priority: priority,
        notes: notes,
        items: items
    };

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen("Đang gửi yêu cầu nhập hàng...");
    try {
        const res = await fetch(`${API_BASE}/admin/inventory/requests`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        unlockScreen();

        if (res.ok && json.success) {
            notifyUser("Đã tạo yêu cầu nhập hàng thành công!", "success");
            closePurchaseRequestModal();
            loadAdminPurchaseRequests();
        } else {
            if (errBox) {
                errBox.textContent = json.message || "Lỗi khi lưu yêu cầu nhập hàng";
                errBox.classList.remove("hidden");
            }
        }
    } catch (e) {
        unlockScreen();
        if (errBox) {
            errBox.textContent = `Lỗi kết nối: ${e.message}`;
            errBox.classList.remove("hidden");
        }
    }
}

export async function fulfillPurchaseRequestFromQueue(reqId) {
    const req = (allAdminPurchaseRequests || []).find(r => r.id === reqId);
    if (!req) {
        notifyUser("Không tìm thấy thông tin yêu cầu nhập hàng", "warning");
        return;
    }

    currentFulfillingRequestId = req.id;
    await openInboundModal();

    // Show request banner
    const banner = document.getElementById("inboundRequestBanner");
    const bannerCode = document.getElementById("inboundRequestBannerCode");
    if (banner && bannerCode) {
        bannerCode.textContent = req.id;
        banner.classList.remove("hidden");
    }

    // Set branch
    const branchSelect = document.getElementById("inboundBranchSelect");
    if (branchSelect && req.branchId) {
        branchSelect.value = req.branchId;
    }

    // Set notes
    const notesInput = document.getElementById("inboundNotesInput");
    if (notesInput) {
        notesInput.value = `[Nhập kho đối soát theo Đề Xuất ${req.id}] ${req.notes || ""}`.trim();
    }

    // Customize submit button
    const btnSubmit = document.getElementById("btnSubmitInbound");
    if (btnSubmit) {
        btnSubmit.innerHTML = `<i class="fa-solid fa-clipboard-check"></i> Xác Nhận Hàng Thực Nhận & Nhập Kho`;
    }

    // Khóa nút "Thêm Mặt Hàng" vì danh mục hàng đã được chốt cố định theo Đơn Yêu Cầu
    const btnAdd = document.getElementById("btnAddInboundItem");
    if (btnAdd) {
        btnAdd.classList.add("hidden");
    }

    // Populate rows from req.items - CỐ ĐỊNH MẶT HÀNG, KHÔNG CHO ĐỔI LOẠI HOA
    const tbody = document.getElementById("inboundItemsTableBody");
    if (tbody && Array.isArray(req.items) && req.items.length > 0) {
        tbody.innerHTML = "";
        for (const item of req.items) {
            const rowId = "inbound_row_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
            const cleanId = (item.materialId || item.productId || item.id || "").replace("mat:", "").replace("prod:", "");
            const matchedMat = (allAdminMaterials || []).find(m => m.id === cleanId || m.id === item.materialId);
            const itemName = item.materialName || item.name || item.flowerType || matchedMat?.name || cleanId || "Hoa cành";
            const itemUnit = item.unit || matchedMat?.unit || (matchedMat?.category === "binh_hoa" ? "bình" : "cành");
            const itemCost = item.costPrice || item.unitCost || matchedMat?.costPrice || 0;
            const reqQty = item.requestedQty || item.quantity || 1;

            const tr = document.createElement("tr");
            tr.id = rowId;
            tr.className = "hover:bg-blue-50/30 transition inbound-item-row bg-blue-50/15 border-b border-gray-100";
            tr.dataset.requestedQty = reqQty;
            tr.dataset.materialId = cleanId;
            tr.dataset.materialName = itemName;
            tr.dataset.materialUnit = itemUnit;

            tr.innerHTML = `
                <td class="p-2.5">
                    <div class="flex items-center gap-2.5">
                        <span class="w-9 h-9 rounded-xl bg-blue-100/90 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 border border-blue-200 shadow-2xs" title="Mặt hàng đã chốt theo yêu cầu, không thể thay đổi">
                            <i class="fa-solid fa-seedling text-sm text-blue-600"></i>
                        </span>
                        <div class="space-y-0.5">
                            <div class="font-bold text-gray-900 text-xs flex items-center gap-1.5 flex-wrap">
                                <span class="text-blue-900 font-extrabold text-sm">${itemName}</span>
                                <span class="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-mono font-semibold">Mã: ${cleanId}</span>
                                <span class="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium"><i class="fa-solid fa-lock text-[8px]"></i> Đã khóa</span>
                            </div>
                            <div class="text-[11px] text-blue-700 font-semibold flex items-center gap-1">
                                <i class="fa-solid fa-clipboard-list text-[10px]"></i> Đề xuất ban đầu: <span class="font-extrabold text-blue-800 text-xs">${reqQty}</span> ${itemUnit}
                            </div>
                        </div>
                    </div>
                    <!-- Select ngầm để handleInboundSubmit đọc đúng -->
                    <select class="inbound-item-select hidden" disabled>
                        <option value="${cleanId}" data-name="${itemName}" data-unit="${itemUnit}" data-price="${itemCost}" selected>${itemName}</option>
                    </select>
                </td>
                <td class="p-2 w-28 text-center">
                    <select onchange="onInboundModeChange('${rowId}')" class="inbound-item-mode w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:border-primary">
                        <option value="stem" selected>🌿 Cành/Cái</option>
                        <option value="bundle">💐 Theo Bó</option>
                    </select>
                </td>
                <td class="p-2 w-48 text-center">
                    <div class="inbound-bundle-inputs hidden items-center justify-center space-x-1">
                        <div class="relative w-16">
                            <input type="number" min="1" value="1" oninput="recalculateInboundTotals()" class="inbound-item-bundles w-full px-1.5 py-1 text-center bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-primary" title="Số lượng bó">
                            <span class="text-[9px] text-gray-400 font-bold block mt-0.5">Bó</span>
                        </div>
                        <span class="text-xs text-gray-400 font-bold self-center mb-2">&times;</span>
                        <div class="relative w-16">
                            <input type="number" min="1" value="20" oninput="recalculateInboundTotals()" class="inbound-item-bundle-stems w-full px-1.5 py-1 text-center bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-primary" title="Số cành trên 1 bó">
                            <span class="text-[9px] text-gray-400 font-bold block mt-0.5">Cành/bó</span>
                        </div>
                    </div>
                    <div class="inbound-stem-inputs flex flex-col items-center justify-center gap-0.5">
                        <div class="flex items-center space-x-1">
                            <input type="number" min="0" value="${reqQty}" oninput="recalculateInboundTotals()" class="inbound-item-qty w-24 px-2 py-1 text-center bg-white border-2 border-blue-400 font-extrabold text-blue-800 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-200" title="Cập nhật số lượng thực tế khi nhận xe hoa">
                            <span class="text-xs text-gray-500 font-medium inbound-unit-label">${itemUnit}</span>
                        </div>
                        <span class="text-[9px] text-emerald-600 font-bold uppercase tracking-tight">Số thực nhận</span>
                    </div>
                </td>
                <td class="p-2 w-32">
                    <input type="number" min="0" step="500" value="${itemCost}" oninput="recalculateInboundTotals()" class="inbound-item-cost w-full px-2 py-1 text-right bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-primary">
                </td>
                <td class="p-2 w-28 text-right font-bold text-gray-800 inbound-item-subtotal">
                    0₫
                </td>
                <td class="p-2 w-10 text-center">
                    <div class="w-7 h-7 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center mx-auto" title="Mặt hàng đã chốt theo đơn yêu cầu, không thể xóa">
                        <i class="fa-solid fa-lock text-[11px]"></i>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        }
        recalculateInboundTotals();
    }
}

// ----------------------------------------------------
// SUB-TAB 2.2: KHO CÀNH HOA & PHỤ LIỆU (RAW MATERIALS)
// ----------------------------------------------------
export async function loadAdminMaterials() {
    const tbody = document.getElementById("materialsTableBody");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    if (tbody && (!allAdminMaterials || allAdminMaterials.length === 0)) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-gray-400 font-medium"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải kho cành hoa & nguyên liệu...</td></tr>`;
    }

    try {
        const res = await fetch(`${API_BASE}/admin/inventory/materials`, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error("Không thể tải danh mục cành hoa");
        const json = await res.json();
        if (json.success && json.data) {
            allAdminMaterials = json.data;
            renderAdminMaterialsTable(allAdminMaterials);
        }
    } catch (e) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-red-500 font-medium">Lỗi: ${e.message}</td></tr>`;
    }
}

export function renderAdminMaterialsTable(materials) {
    const thead = document.getElementById("materialsTableHeader");
    const tbody = document.getElementById("materialsTableBody");
    if (!tbody) return;

    const branches = (currentInventoryBranches && currentInventoryBranches.length > 0)
        ? currentInventoryBranches
        : (allAdminBranches || []);

    if (thead) {
        let thHtml = `
            <tr>
                <th class="p-3">Mã Nguyên Liệu</th>
                <th class="p-3">Tên Hoa Cành / Phụ Liệu</th>
                <th class="p-3">Phân Loại</th>
                <th class="p-3 text-center">ĐVT</th>
                <th class="p-3 text-right">Đơn Giá Vốn (₫)</th>
        `;
        branches.forEach(b => {
            const shortName = b.code || (b.name ? b.name.replace("Nở Hoa Thả Bình - Showroom ", "") : b.id);
            thHtml += `<th class="p-3 text-center border-l border-emerald-100 bg-emerald-50/70 text-emerald-800 font-bold">${shortName}</th>`;
        });
        thHtml += `
                <th class="p-3 text-center border-l border-gray-200 bg-gray-50 font-bold">Tổng Chuỗi</th>
                <th class="p-3 text-center">Ngưỡng Tối Thiểu</th>
                <th class="p-3 text-center">Trạng Thái</th>
            </tr>
        `;
        thead.innerHTML = thHtml;
    }

    if (!materials || materials.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${7 + branches.length}" class="p-8 text-center text-gray-400 font-medium">Chưa có nguyên liệu hoa cành nào trong kho.</td></tr>`;
        return;
    }

    let bodyHtml = "";
    materials.forEach(mat => {
        const costFmt = Number(mat.costPrice || 0).toLocaleString("vi-VN") + "₫";
        const minAlert = parseInt(mat.minAlertLevel || 20, 10);
        let totalStock = 0;

        bodyHtml += `
            <tr class="hover:bg-emerald-50/20 transition">
                <td class="p-3 font-mono text-xs font-bold text-gray-700">${mat.id}</td>
                <td class="p-3">
                    <div class="font-bold text-gray-800 text-xs">${mat.name}</div>
                    <div class="text-[10px] text-gray-400 font-mono">${mat.supplier || "Nhà vườn Đà Lạt"}</div>
                </td>
                <td class="p-3 text-gray-600">${mat.category || "Hoa tươi"}</td>
                <td class="p-3 text-center font-semibold text-gray-600">${mat.unit || "cành"}</td>
                <td class="p-3 text-right font-bold text-gray-700">${costFmt}</td>
        `;

        branches.forEach(b => {
            const bStock = mat.stockByBranch ? parseInt(mat.stockByBranch[b.id] || 0, 10) : 0;
            totalStock += bStock;
            let stockBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
            if (bStock === 0) stockBadge = "bg-rose-50 text-rose-700 border-rose-200 font-bold";
            else if (bStock < 10) stockBadge = "bg-amber-50 text-amber-700 border-amber-200";

            bodyHtml += `
                <td class="p-2.5 text-center border-l border-emerald-100/60">
                    <span class="px-2 py-0.5 text-xs font-bold rounded-md border ${stockBadge}">${bStock}</span>
                </td>
            `;
        });

        let statusBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full text-emerald-700 bg-emerald-50 border border-emerald-200">🟢 Đủ hàng</span>`;
        if (totalStock === 0) {
            statusBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full text-rose-700 bg-rose-50 border border-rose-200">🔴 Hết cành</span>`;
        } else if (totalStock < minAlert) {
            statusBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full text-amber-700 bg-amber-50 border border-amber-200">🟠 Sắp hết</span>`;
        }

        bodyHtml += `
                <td class="p-3 text-center border-l border-gray-200 bg-gray-50/50 font-bold text-gray-800 text-xs">${totalStock} ${mat.unit || "cành"}</td>
                <td class="p-3 text-center text-gray-500">${minAlert} ${mat.unit || "cành"}</td>
                <td class="p-3 text-center">${statusBadge}</td>
            </tr>
        `;
    });

    tbody.innerHTML = bodyHtml;
}

// ----------------------------------------------------
// SUB-TAB 3: PHIẾU NHẬP HÀNG & INBOUND MODAL
// ----------------------------------------------------
export async function loadAdminInbounds() {
    const tbody = document.getElementById("inventoryInboundsBody");
    const monthInput = document.getElementById("filterInboundMonth");
    const branchSelect = document.getElementById("filterInventoryBranch");

    if (monthInput && !monthInput.value) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        monthInput.value = `${y}-${m}`;
    }

    const monthStr = monthInput ? monthInput.value.replace("-", "_") : "";
    const branchId = branchSelect ? branchSelect.value : "";
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    let url = `${API_BASE}/admin/inventory/inbounds?month=${monthStr}`;
    if (branchId && branchId !== "all") url += `&branchId=${branchId}`;

    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-gray-400 font-medium"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải phiếu nhập kho...</td></tr>`;
    }

    try {
        const res = await fetch(url, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error("Không thể tải lịch sử nhập hàng");
        const json = await res.json();
        if (json.success && json.data) {
            allAdminInbounds = json.data;
            renderAdminInboundsTable(allAdminInbounds);
        }
    } catch (e) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-red-500 font-medium">Lỗi: ${e.message}</td></tr>`;
    }
}

export function renderAdminInboundsTable(receipts) {
    const tbody = document.getElementById("inventoryInboundsBody");
    if (!tbody) return;

    if (!receipts || receipts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-gray-400 font-medium">Chưa có phiếu nhập kho nào trong tháng này.</td></tr>`;
        return;
    }

    let html = "";
    receipts.forEach(r => {
        const bObj = (allAdminBranches || []).find(b => b.id === r.branchId);
        const bName = bObj ? (bObj.code ? `${bObj.code} - ${bObj.name.replace("Nở Hoa Thả Bình - Showroom ", "")}` : bObj.name) : r.branchId;
        const totalFmt = Number(r.totalCost || 0).toLocaleString("vi-VN") + "₫";

        let itemsSummary = (r.items || []).map(itm => {
            const cleanId = (itm.materialId || itm.productId || "").replace("mat:", "").replace("prod:", "");
            const matchedMat = (allAdminMaterials || []).find(m => m.id === cleanId || m.id === itm.materialId);
            const name = (itm.name && itm.name !== "Cành hoa" && itm.name !== "Vật liệu") 
                ? itm.name 
                : (itm.materialName || itm.flowerType || matchedMat?.name || cleanId || "Hoa cành");
            const unit = itm.unit || matchedMat?.unit || "cành";
            const reqHint = (itm.requestedQty && itm.requestedQty !== itm.quantity)
                ? `<span class="text-[10px] text-gray-400 font-normal ml-1">(đề xuất ${itm.requestedQty})</span>`
                : '';
            return `<div class="text-[11px]"><b class="text-blue-600">+${itm.quantity} ${unit}</b> <span class="font-bold text-gray-800">${name}</span>${reqHint}</div>`;
        }).join("");

        const reqBadge = (r.requestCode || r.purchaseRequestId)
            ? `<div class="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-1 inline-flex items-center gap-1 font-semibold" title="Nhập kho theo Đề xuất">
                <i class="fa-solid fa-link text-[9px]"></i> ${r.requestCode || r.purchaseRequestId}
               </div>`
            : '';

        html += `
            <tr class="hover:bg-blue-50/20 transition">
                <td class="p-3 font-mono text-xs font-bold text-blue-700">
                    <button type="button" onclick="openWastageModalForInbound('${r.id}')" class="hover:underline text-blue-600 flex items-center gap-1 font-mono font-bold text-left" title="Click vào ID đợt nhập để báo hoa hỏng từ đợt này">
                        <i class="fa-solid fa-truck-ramp-box text-[11px] text-blue-500"></i> ${r.id}
                    </button>
                    ${reqBadge}
                </td>
                <td class="p-3 font-semibold text-gray-700">${bName}</td>
                <td class="p-3 text-gray-600">${r.date || r.createdAt?.slice(0, 10)}</td>
                <td class="p-3 text-gray-700 font-medium">${r.supplier || "Nhà cung cấp"}</td>
                <td class="p-3 text-gray-600">${r.createdBy || "Admin"}</td>
                <td class="p-3 space-y-1">${itemsSummary}</td>
                <td class="p-3 font-bold text-blue-600 text-right">${totalFmt}</td>
                <td class="p-3 text-gray-500 text-xs italic">${r.notes || "—"}</td>
                <td class="p-3 text-center">
                    <button type="button" onclick="openWastageModalForInbound('${r.id}')" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs mx-auto" title="Báo hoa hỏng trực tiếp cho đợt nhập này">
                        <i class="fa-solid fa-triangle-exclamation text-amber-600"></i> Báo Hỏng
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

export async function openInboundModal() {
    const modal = document.getElementById("inboundModal");
    const branchSelect = document.getElementById("inboundBranchSelect");
    const dateInput = document.getElementById("inboundDateInput");
    const notesInput = document.getElementById("inboundNotesInput");
    const errBox = document.getElementById("inboundModalError");

    if (!modal) return;
    if (errBox) errBox.classList.add("hidden");
    if (notesInput) notesInput.value = "";

    if (dateInput) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    }

    if (branchSelect) {
        branchSelect.innerHTML = "";
        const currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : null;
        const isSuperAdmin = currentUser?.role === "super_admin";
        const userBranch = currentUser?.branchId;

        const branches = (allAdminBranches && allAdminBranches.length > 0)
            ? allAdminBranches.filter(b => b.isActive !== false)
            : [
                { id: "branch_q10", name: "Showroom Q.10 (Flagship)", code: "CN_Q10" },
                { id: "branch_q1", name: "Showroom Bến Nghé Q.1", code: "CN_Q1" },
                { id: "branch_thao_dien", name: "Showroom Thảo Điền", code: "CN_Q2" }
            ];

        branches.forEach(b => {
            const opt = document.createElement("option");
            opt.value = b.id;
            opt.textContent = b.code ? `${b.code} - ${b.name.replace("Nở Hoa Thả Bình - Showroom ", "")}` : b.name;
            branchSelect.appendChild(opt);
        });

        if (!isSuperAdmin && userBranch) {
            branchSelect.value = userBranch;
            branchSelect.disabled = true;
        } else {
            branchSelect.disabled = false;
        }
    }

    const tbody = document.getElementById("inboundItemsTableBody");
    if (tbody) tbody.innerHTML = "";

    const btnAdd = document.getElementById("btnAddInboundItem");
    if (btnAdd) btnAdd.classList.remove("hidden");
    
    // Đảm bảo dữ liệu cành hoa (materials) được tải đầy đủ trước khi mở modal
    await ensureAdminMaterialsLoaded();
    await addInboundItemRow();

    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

export function closeInboundModal() {
    currentFulfillingRequestId = null;
    const banner = document.getElementById("inboundRequestBanner");
    if (banner) banner.classList.add("hidden");
    const btnAdd = document.getElementById("btnAddInboundItem");
    if (btnAdd) btnAdd.classList.remove("hidden");
    const btnSubmit = document.getElementById("btnSubmitInbound");
    if (btnSubmit) {
        btnSubmit.innerHTML = `<i class="fa-solid fa-check"></i> Xác Nhận Nhập Kho`;
    }
    const modal = document.getElementById("inboundModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export async function ensureAdminMaterialsLoaded() {
    if (allAdminMaterials && allAdminMaterials.length > 0) return allAdminMaterials;
    if (typeof window !== "undefined" && window.allAdminMaterials && window.allAdminMaterials.length > 0) {
        allAdminMaterials = window.allAdminMaterials;
        return allAdminMaterials;
    }
    try {
        const token = typeof getAuthToken === "function" ? getAuthToken() : "";
        const res = await fetch(`${API_BASE}/admin/inventory/materials`, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                allAdminMaterials = json.data;
                if (typeof window !== "undefined") window.allAdminMaterials = json.data;
            }
        }
    } catch (e) {
        console.warn("Không thể tải danh sách materials cho inbound modal:", e);
    }
    return allAdminMaterials;
}

export function getInboundMaterialOptionsHtml() {
    let options = "";
    if (allAdminMaterials && allAdminMaterials.length > 0) {
        options += `<optgroup label="Cành Hoa & Hàng Trực Tiếp (materials.json)">`;
        allAdminMaterials.forEach(m => {
            const lower = (m.name || "").toLowerCase();
            const defStems = m.stemCount || ((lower.includes("hồng") || lower.includes("rose")) ? 20 : (lower.includes("ly") || lower.includes("lily") || lower.includes("tana") || lower.includes("baby")) ? 10 : (m.category === "binh_hoa" ? 1 : 20));
            const unit = m.unit || (m.category === "binh_hoa" ? "bình" : "cành");
            const cost = m.costPrice || Math.round((m.priceNumber || 0) * 0.5) || 0;
            options += `<option value="${m.id}" data-type="mat" data-name="${m.name}" data-price="${cost}" data-unit="${unit}" data-default-stems="${defStems}">${m.name} (${unit} - ${Number(cost).toLocaleString('vi-VN')}₫)</option>`;
        });
        options += `</optgroup>`;
    } else {
        options = `<option value="" disabled>Chưa có sản phẩm direct nào trong kho materials.json</option>`;
    }
    return options;
}

export async function addInboundItemRow() {
    const tbody = document.getElementById("inboundItemsTableBody");
    if (!tbody) return;

    if (!allAdminMaterials || allAdminMaterials.length === 0) {
        await ensureAdminMaterialsLoaded();
    }

    const rowId = "inbound_row_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
    const options = getInboundMaterialOptionsHtml();

    const tr = document.createElement("tr");
    tr.id = rowId;
    tr.className = "hover:bg-blue-50/30 transition inbound-item-row";
    tr.innerHTML = `
        <td class="p-2">
            <select onchange="onInboundItemSelect('${rowId}')" class="inbound-item-select w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary">
                ${options}
            </select>
        </td>
        <td class="p-2 w-28">
            <select onchange="onInboundModeChange('${rowId}')" class="inbound-item-mode w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:border-primary">
                <option value="bundle">💐 Theo Bó</option>
                <option value="stem">🌿 Cành/Cái</option>
            </select>
        </td>
        <td class="p-2 w-48 text-center">
            <!-- Chế độ Bó: [Số bó] x [Cành/bó] -> [Tổng cành] -->
            <div class="inbound-bundle-inputs flex items-center justify-center space-x-1">
                <div class="relative w-16">
                    <input type="number" min="1" value="5" oninput="recalculateInboundTotals()" class="inbound-item-bundles w-full px-1.5 py-1 text-center bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-primary" title="Số lượng bó">
                    <span class="text-[9px] text-gray-400 font-bold block mt-0.5">Bó</span>
                </div>
                <span class="text-xs text-gray-400 font-bold self-center mb-2">&times;</span>
                <div class="relative w-16">
                    <input type="number" min="1" value="20" oninput="recalculateInboundTotals()" class="inbound-item-bundle-stems w-full px-1.5 py-1 text-center bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-primary" title="Số cành trên 1 bó">
                    <span class="text-[9px] text-gray-400 font-bold block mt-0.5">Cành/bó</span>
                </div>
            </div>
            <!-- Chế độ Cành / Cái lẻ -->
            <div class="inbound-stem-inputs hidden items-center justify-center">
                <input type="number" min="1" value="50" oninput="recalculateInboundTotals()" class="inbound-item-qty w-20 px-2 py-1 text-center bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-primary">
                <span class="inbound-unit-label ml-1.5 text-[11px] text-gray-500 font-bold">cành</span>
            </div>
            <div class="inbound-calc-badge text-[10px] font-bold text-blue-600 mt-0.5 text-center">
                = <span class="inbound-total-stems font-extrabold text-blue-700">100</span> cành
            </div>
        </td>
        <td class="p-2 w-32">
            <input type="number" min="0" step="500" value="12000" oninput="recalculateInboundTotals()" class="inbound-item-cost w-full px-2 py-1 text-right bg-white border border-gray-200 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-primary" required>
            <div class="inbound-cost-per-bundle text-[9px] text-gray-400 text-right mt-0.5 font-semibold">(240.000₫/bó)</div>
        </td>
        <td class="p-2 text-right font-mono font-bold text-blue-600 text-xs inbound-item-subtotal">
            1.200.000₫
        </td>
        <td class="p-2 text-center">
            <button type="button" onclick="removeInboundItemRow('${rowId}')" class="w-6 h-6 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 flex items-center justify-center transition">
                <i class="fa-solid fa-xmark text-xs"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);

    onInboundItemSelect(rowId);
    recalculateInboundTotals();
}

export function onInboundModeChange(rowId) {
    const tr = document.getElementById(rowId);
    if (!tr) return;
    const modeSelect = tr.querySelector(".inbound-item-mode");
    const bundleBox = tr.querySelector(".inbound-bundle-inputs");
    const stemBox = tr.querySelector(".inbound-stem-inputs");
    const calcBadge = tr.querySelector(".inbound-calc-badge");
    const bundleCostEl = tr.querySelector(".inbound-cost-per-bundle");
    const mode = modeSelect?.value || "bundle";

    if (mode === "bundle") {
        if (bundleBox) bundleBox.classList.remove("hidden");
        if (stemBox) {
            stemBox.classList.add("hidden");
            stemBox.classList.remove("flex");
        }
        if (calcBadge) calcBadge.classList.remove("hidden");
        if (bundleCostEl) bundleCostEl.classList.remove("hidden");
    } else {
        if (bundleBox) bundleBox.classList.add("hidden");
        if (stemBox) {
            stemBox.classList.remove("hidden");
            stemBox.classList.add("flex");
        }
        if (calcBadge) calcBadge.classList.add("hidden");
        if (bundleCostEl) bundleCostEl.classList.add("hidden");
    }
    recalculateInboundTotals();
}

export function onInboundItemSelect(rowId) {
    const tr = document.getElementById(rowId);
    if (!tr) return;
    const select = tr.querySelector(".inbound-item-select");
    const costInput = tr.querySelector(".inbound-item-cost");
    const modeSelect = tr.querySelector(".inbound-item-mode");
    const bundleStemsInput = tr.querySelector(".inbound-item-bundle-stems");
    const unitLabel = tr.querySelector(".inbound-unit-label");
    if (!select) return;

    const opt = select.selectedOptions[0];
    if (!opt) return;

    const itemType = opt.dataset.type || (opt.value.startsWith("prod:") ? "prod" : "mat");
    const unit = opt.dataset.unit || "cành";
    if (unitLabel) unitLabel.textContent = unit;

    tr.dataset.materialId = opt.value;
    tr.dataset.materialName = opt.dataset.name || opt.text?.replace(/\s*\([^)]*\)\s*$/, "") || "";
    tr.dataset.materialUnit = unit;

    if (itemType === "prod") {
        if (modeSelect) {
            modeSelect.value = "stem";
            modeSelect.disabled = true;
        }
    } else {
        if (modeSelect) {
            modeSelect.disabled = false;
            const defStems = parseInt(opt.dataset.defaultStems || 20, 10);
            if (bundleStemsInput && !bundleStemsInput.value) {
                bundleStemsInput.value = defStems;
            } else if (bundleStemsInput && (bundleStemsInput.value === "20" || bundleStemsInput.value === "10")) {
                bundleStemsInput.value = defStems;
            }
        }
    }

    if (opt.dataset.price && costInput) {
        costInput.value = opt.dataset.price;
    }

    onInboundModeChange(rowId);
}

export function removeInboundItemRow(rowId) {
    const tr = document.getElementById(rowId);
    if (tr) {
        tr.remove();
        recalculateInboundTotals();
    }
}

export function recalculateInboundTotals() {
    const rows = document.querySelectorAll("#inboundItemsTableBody tr");
    let totalItems = 0;
    let totalStems = 0;
    let totalCost = 0;

    rows.forEach(tr => {
        const modeSelect = tr.querySelector(".inbound-item-mode");
        const bundlesInp = tr.querySelector(".inbound-item-bundles");
        const bundleStemsInp = tr.querySelector(".inbound-item-bundle-stems");
        const qtyInp = tr.querySelector(".inbound-item-qty");
        const costInp = tr.querySelector(".inbound-item-cost");
        const subtotalEl = tr.querySelector(".inbound-item-subtotal");
        const calcStemsEl = tr.querySelector(".inbound-total-stems");
        const bundleCostEl = tr.querySelector(".inbound-cost-per-bundle");

        const mode = modeSelect?.value || "bundle";
        let rowStems = 0;
        let stemsPerB = 1;

        if (mode === "bundle") {
            const bQty = Math.max(1, parseInt(bundlesInp?.value || 1, 10));
            stemsPerB = Math.max(1, parseInt(bundleStemsInp?.value || 1, 10));
            rowStems = bQty * stemsPerB;
            if (calcStemsEl) calcStemsEl.textContent = rowStems;
        } else {
            rowStems = Math.max(1, parseInt(qtyInp?.value || 1, 10));
        }

        const costPerStem = Math.max(0, parseInt(costInp?.value || 0, 10));
        if (bundleCostEl && mode === "bundle") {
            const costPerB = costPerStem * stemsPerB;
            bundleCostEl.textContent = `(~${Number(costPerB).toLocaleString('vi-VN')}₫/bó)`;
        }

        const sub = rowStems * costPerStem;
        if (subtotalEl) {
            subtotalEl.textContent = Number(sub).toLocaleString("vi-VN") + "₫";
        }

        totalItems += 1;
        totalStems += rowStems;
        totalCost += sub;
    });

    const badgeItems = document.getElementById("inboundTotalItemsBadge");
    const badgeAmount = document.getElementById("inboundTotalAmountBadge");
    if (badgeItems) badgeItems.textContent = `${totalItems} mặt hàng (${totalStems} cành/sp)`;
    if (badgeAmount) badgeAmount.textContent = Number(totalCost).toLocaleString("vi-VN") + "₫";
}

export async function handleInboundSubmit(event) {
    if (event) event.preventDefault();
    const branchSelect = document.getElementById("inboundBranchSelect");
    const dateInput = document.getElementById("inboundDateInput");
    const supplierInput = document.getElementById("inboundSupplierInput");
    const notesInput = document.getElementById("inboundNotesInput");
    const errBox = document.getElementById("inboundModalError");

    const branchId = branchSelect?.value;
    const dateStr = dateInput?.value;
    const supplier = supplierInput?.value?.trim();
    const notes = notesInput?.value?.trim() || "";

    if (!branchId || !dateStr) {
        if (errBox) {
            errBox.textContent = "Vui lòng chọn chi nhánh và ngày nhập hàng";
            errBox.classList.remove("hidden");
        }
        return;
    }

    const rows = document.querySelectorAll("#inboundItemsTableBody tr");
    if (rows.length === 0) {
        if (errBox) {
            errBox.textContent = "Vui lòng thêm ít nhất một mặt hàng nhập kho";
            errBox.classList.remove("hidden");
        }
        return;
    }

    const items = [];
    rows.forEach(tr => {
        const select = tr.querySelector(".inbound-item-select");
        const modeSelect = tr.querySelector(".inbound-item-mode");
        const bundlesInp = tr.querySelector(".inbound-item-bundles");
        const bundleStemsInp = tr.querySelector(".inbound-item-bundle-stems");
        const qtyInp = tr.querySelector(".inbound-item-qty");
        const costInp = tr.querySelector(".inbound-item-cost");

        const val = tr.dataset.materialId || select?.value || "";
        const opt = select?.selectedOptions[0];
        const mode = modeSelect?.value || "bundle";
        let qty = 1;
        let bundles = null;
        let stemsPerBundle = null;

        if (mode === "bundle") {
            bundles = Math.max(1, parseInt(bundlesInp?.value || 1, 10));
            stemsPerBundle = Math.max(1, parseInt(bundleStemsInp?.value || 1, 10));
            qty = bundles * stemsPerBundle;
        } else {
            qty = Math.max(1, parseInt(qtyInp?.value || 1, 10));
        }

        const unitCost = Math.max(0, parseInt(costInp?.value || 0, 10));

        const cleanId = val.replace("mat:", "").replace("prod:", "");
        const reqQty = parseInt(tr.dataset.requestedQty, 10);
        items.push({
            materialId: cleanId,
            productId: cleanId,
            name: tr.dataset.materialName || opt?.dataset.name || "Hàng nhập",
            materialName: tr.dataset.materialName || opt?.dataset.name || "Hàng nhập",
            unit: tr.dataset.materialUnit || opt?.dataset.unit || "cành",
            quantity: qty,
            requestedQty: (!isNaN(reqQty) && reqQty > 0) ? reqQty : qty,
            unitCost: unitCost,
            importMode: mode,
            bundles: bundles,
            stemsPerBundle: stemsPerBundle
        });
    });

    const payload = {
        branchId: branchId,
        date: dateStr,
        importDate: dateStr,
        supplier: supplier || "Vườn Hoa Đà Lạt Hasfarm",
        notes: notes,
        purchaseRequestId: currentFulfillingRequestId || undefined,
        requestCode: currentFulfillingRequestId || undefined,
        items: items
    };

    const isFulfillingRequest = !!currentFulfillingRequestId;
    const confirmMsg = isFulfillingRequest
        ? "Xác nhận đã nhận hàng thực tế từ xe hoa?\n\nSau khi bấm ĐỒNG Ý, hệ thống sẽ chốt số lượng hoa vào kho và chuyển đơn hàng sang trạng thái [ĐÃ NHẬN HÀNG] (khóa bất biến, không thể sửa/hủy)."
        : "Xác nhận lập phiếu nhập kho cho lô hoa này?\n\nSố lượng hoa cành sẽ được cộng dồn ngay vào tồn kho chi nhánh.";
    if (!confirm(confirmMsg)) {
        return;
    }

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    const url = isFulfillingRequest 
        ? `${API_BASE}/admin/inventory/requests/${currentFulfillingRequestId}/fulfill`
        : `${API_BASE}/admin/inventory/inbounds`;

    lockScreen(isFulfillingRequest ? "Đang xác nhận nhận hàng & cập nhật kho..." : "Đang tạo phiếu nhập kho & cập nhật tồn cành hoa...");
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        unlockScreen();

        if (res.ok && json.success) {
            notifyUser(isFulfillingRequest ? "Đã xử lý nhập kho theo yêu cầu thành công!" : "Đã lập phiếu nhập kho thành công!", "success");
            currentFulfillingRequestId = null;
            closeInboundModal();
            loadAdminInbounds();
            loadAdminMaterials();
            loadAdminInventory();
            loadAdminPurchaseRequests();
        } else {
            if (errBox) {
                errBox.textContent = json.message || "Lỗi khi lưu phiếu nhập kho";
                errBox.classList.remove("hidden");
            }
        }
    } catch (e) {
        unlockScreen();
        if (errBox) {
            errBox.textContent = `Lỗi kết nối: ${e.message}`;
            errBox.classList.remove("hidden");
        }
    }
}

// ----------------------------------------------------
// SUB-TAB 4: BÁO CÁO NHẬP - XUẤT - TỒN THÁNG (MONTHLY BALANCE & PNL)
// ----------------------------------------------------
export async function loadMonthlyInventoryReport() {
    const monthInput = document.getElementById("filterMonthlyReportMonth");
    const branchSelect = document.getElementById("filterMonthlyReportBranch");
    const tbody = document.getElementById("monthlyBalanceBody");

    if (monthInput && !monthInput.value) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        monthInput.value = `${y}-${m}`;
    }

    if (branchSelect && branchSelect.options.length <= 1 && allAdminBranches && allAdminBranches.length > 0) {
        allAdminBranches.forEach(b => {
            const opt = document.createElement("option");
            opt.value = b.id;
            opt.textContent = b.code ? `${b.code} - ${b.name.replace("Nở Hoa Thả Bình - Showroom ", "")}` : b.name;
            branchSelect.appendChild(opt);
        });
    }

    const monthStr = monthInput ? monthInput.value.replace("-", "_") : "";
    const branchId = branchSelect ? branchSelect.value : "";
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    let url = `${API_BASE}/admin/inventory/monthly-report?month=${monthStr}`;
    if (branchId && branchId !== "all") url += `&branchId=${branchId}`;

    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-gray-400 font-medium"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải báo cáo Nhập - Xuất - Tồn tháng...</td></tr>`;
    }

    try {
        const res = await fetch(url, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error("Không thể tải báo cáo Nhập - Xuất - Tồn");
        const json = await res.json();
        if (json.success && json.data) {
            currentMonthlyReport = json.data;
            renderMonthlyInventoryReport(currentMonthlyReport);
        }
    } catch (e) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-red-500 font-medium">Lỗi: ${e.message}</td></tr>`;
    }
}

export function renderMonthlyInventoryReport(report) {
    if (!report) return;

    const elRev = document.getElementById("monthlyKpiRevenue");
    const elCogs = document.getElementById("monthlyKpiCogs");
    const elGross = document.getElementById("monthlyKpiGrossProfit");
    const elMargin = document.getElementById("monthlyKpiMargin");

    const pnl = report.pnl || {};
    if (elRev) elRev.textContent = Number(pnl.revenue || 0).toLocaleString("vi-VN") + "₫";
    if (elCogs) elCogs.textContent = Number(pnl.cogs || 0).toLocaleString("vi-VN") + "₫";
    if (elGross) elGross.textContent = Number(pnl.grossProfit || 0).toLocaleString("vi-VN") + "₫";
    if (elMargin) elMargin.textContent = `${Number(pnl.profitMarginPercent || 0).toFixed(1)}%`;

    const tbody = document.getElementById("monthlyBalanceBody");
    if (!tbody) return;

    const items = report.items || [];
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-gray-400 font-medium">Không có dữ liệu phát sinh nào trong tháng này.</td></tr>`;
        return;
    }

    let html = "";
    items.forEach(itm => {
        const closingValFmt = Number(itm.closingValue || 0).toLocaleString("vi-VN") + "₫";
        const typeBadge = (itm.productType === "materials")
            ? `<span class="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Hoa cành</span>`
            : `<span class="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-700 border border-blue-200">Bình/Mẫu</span>`;

        html += `
            <tr class="hover:bg-gray-50 transition">
                <td class="p-3 font-mono text-xs font-bold text-gray-700">${itm.id}</td>
                <td class="p-3 font-semibold text-gray-800">${itm.name}</td>
                <td class="p-3">${typeBadge}</td>
                <td class="p-3 text-center text-gray-600 font-semibold">${itm.unit || "cành"}</td>
                <td class="p-3 text-center bg-gray-50/70 font-semibold text-gray-700">${itm.opening}</td>
                <td class="p-3 text-center bg-blue-50/40 font-bold text-blue-700">+${itm.inbound}</td>
                <td class="p-3 text-center bg-emerald-50/40 font-bold text-emerald-700">-${itm.sold}</td>
                <td class="p-3 text-center bg-rose-50/40 font-bold text-rose-700">-${itm.wastage}</td>
                <td class="p-3 text-center bg-purple-50/60 font-extrabold text-purple-700">${itm.closing}</td>
                <td class="p-3 text-right font-mono font-bold text-gray-800">${closingValFmt}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

export async function loadAdminWastageHistory() {
    const tbody = document.getElementById("inventoryWastageBody");
    const branchSelect = document.getElementById("filterInventoryBranch");
    const dateInput = document.getElementById("filterInventoryDate");

    const selectedBranch = branchSelect ? branchSelect.value : "all";
    const selectedDate = dateInput ? dateInput.value : "";
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    let url = `${API_BASE}/admin/inventory/wastage?limit=100`;
    if (selectedBranch && selectedBranch !== "all") url += `&branchId=${selectedBranch}`;

    try {
        const res = await fetch(url, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error("Không thể tải nhật ký báo hủy");
        const json = await res.json();
        if (json.success && json.data) {
            allAdminWastageReports = json.data;
            renderAdminWastageTable(allAdminWastageReports);
        }
    } catch (e) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500">Lỗi: ${e.message}</td></tr>`;
    }
}

export function renderAdminWastageTable(reports) {
    const tbody = document.getElementById("inventoryWastageBody");
    if (!tbody) return;

    if (!reports || reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-gray-400 font-medium">Chưa có phiếu báo hủy nào được lập.</td></tr>`;
        return;
    }

    let html = "";
    reports.forEach(r => {
        const bObj = (allAdminBranches || []).find(b => b.id === r.branchId);
        const bName = bObj ? (bObj.code ? `${bObj.code} - ${bObj.name.replace("Nở Hoa Thả Bình - Showroom ", "")}` : bObj.name) : r.branchId;
        const lossFmt = Number(r.totalLossAmount || 0).toLocaleString("vi-VN") + "₫";

        let itemsSummary = (r.items || []).map(itm => 
            `<div class="text-[11px]"><b class="text-rose-600">${itm.damagedStems} cành</b> ${itm.flowerType} <span class="text-gray-400 italic">(${itm.reason || "Hoa dập"})</span></div>`
        ).join("");

        let photosHtml = `<span class="text-gray-300 text-xs italic">Không có ảnh</span>`;
        if (r.proofImages && Array.isArray(r.proofImages) && r.proofImages.length > 0) {
            photosHtml = `<div class="flex items-center justify-center gap-1">` +
                r.proofImages.map(imgUrl => `
                    <a href="${imgUrl}" target="_blank" title="Xem ảnh gốc" class="block w-9 h-9 rounded-lg overflow-hidden border border-rose-200 hover:scale-110 transition shadow-2xs">
                        <img src="${imgUrl}" class="w-full h-full object-cover" alt="Minh chứng hủy">
                    </a>
                `).join("") + `</div>`;
        }

        const inboundInfoHtml = (r.inboundCode || r.inboundId)
            ? `
                <div class="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-flex items-center gap-1">
                    <i class="fa-solid fa-truck-ramp-box text-[10px]"></i> ${r.inboundCode || r.inboundId}
                </div>
                ${r.supplier ? `<div class="text-[11px] text-gray-500 font-medium mt-0.5">${r.supplier}</div>` : ''}
              `
            : `<span class="text-gray-400 italic text-[11px]">Phiếu cũ (trước liên kết)</span>`;

        html += `
            <tr class="hover:bg-gray-50 transition">
                <td class="p-3 font-mono text-xs font-bold text-gray-800">${r.id}</td>
                <td class="p-3 font-mono text-xs">${inboundInfoHtml}</td>
                <td class="p-3 font-semibold text-gray-700">${bName}</td>
                <td class="p-3 text-gray-600">${r.date || r.createdAt?.slice(0, 10)}</td>
                <td class="p-3 text-gray-600">${r.reportedBy || "Nhân viên"}</td>
                <td class="p-3 space-y-1">${itemsSummary}</td>
                <td class="p-3 text-center">${photosHtml}</td>
                <td class="p-3 font-bold text-rose-600 text-right">${lossFmt}</td>
                <td class="p-3 text-gray-500 text-xs italic">${r.notes || "—"}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

let currentWastagePhotos = [];

export async function openWastageModalForInbound(inboundId) {
    if (!allAdminInbounds || allAdminInbounds.length === 0) {
        await loadAdminInbounds();
    }
    let targetInbound = (allAdminInbounds || []).find(r => r.id === inboundId || r.inboundCode === inboundId);

    if (!targetInbound) {
        try {
            const token = typeof getAuthToken === "function" ? getAuthToken() : "";
            const res = await fetch(`${API_BASE}/admin/inventory/inbounds/${inboundId}`, {
                headers: token ? { "Authorization": `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) {
                    targetInbound = json.data;
                }
            }
        } catch (e) {
            console.warn("Could not fetch inbound by ID:", e);
        }
    }

    if (!targetInbound) {
        notifyUser("Không tìm thấy thông tin đợt nhập hàng " + inboundId, "error");
        return;
    }

    // Kiểm tra nếu đợt nhập này thuộc đơn yêu cầu đã đóng (closed)
    const reqRef = targetInbound.purchaseRequestId || targetInbound.requestCode;
    if (reqRef && Array.isArray(allAdminPurchaseRequests)) {
        const matchedReq = allAdminPurchaseRequests.find(r => r.id === reqRef || r.requestCode === reqRef);
        if (matchedReq && (matchedReq.status || "").toLowerCase() === "closed") {
            notifyUser(`Đợt nhập hàng ${inboundId} thuộc đơn đề xuất đã được Admin đóng chốt sổ (closed). Không thể báo hoa hỏng thêm!`, "warning");
            return;
        }
    }

    await openWastageModal({ inbound: targetInbound });
}

export async function openWastageModal(options = {}) {
    const modal = document.getElementById("wastageModal");
    const branchSelect = document.getElementById("wastageBranchSelect");
    const dateInput = document.getElementById("wastageDateInput");
    const notesInput = document.getElementById("wastageNotesInput");
    const errBox = document.getElementById("wastageModalError");
    const previews = document.getElementById("wastagePhotoPreviews");
    const photoFileInput = document.getElementById("wastagePhotoFileInput");

    currentWastagePhotos = [];
    if (previews) previews.innerHTML = "";
    if (photoFileInput) photoFileInput.value = "";

    if (!modal) return;
    if (errBox) errBox.classList.add("hidden");
    if (notesInput) notesInput.value = "";

    if (dateInput) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    }

    if (branchSelect) {
        branchSelect.innerHTML = "";
        const currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : null;
        const isSuperAdmin = currentUser?.role === "super_admin";
        const userBranch = currentUser?.branchId;

        const branches = (allAdminBranches && allAdminBranches.length > 0)
            ? allAdminBranches.filter(b => b.isActive !== false)
            : [
                { id: "branch_q10", name: "Showroom Q.10 (Flagship)", code: "CN_Q10" },
                { id: "branch_q1", name: "Showroom Bến Nghé Q.1", code: "CN_Q1" },
                { id: "branch_thao_dien", name: "Showroom Thảo Điền", code: "CN_Q2" }
            ];

        branches.forEach(b => {
            const opt = document.createElement("option");
            opt.value = b.id;
            opt.textContent = b.code ? `${b.code} - ${b.name.replace("Nở Hoa Thả Bình - Showroom ", "")}` : b.name;
            branchSelect.appendChild(opt);
        });

        if (!isSuperAdmin && userBranch) {
            branchSelect.value = userBranch;
            branchSelect.disabled = true;
        } else {
            branchSelect.disabled = false;
        }
    }

    const contextBox = document.getElementById("wastageInboundContextContainer");
    const selectBox = document.getElementById("wastageInboundSelectContainer");
    const inbSelect = document.getElementById("wastageInboundSelect");
    const inbCodeDisp = document.getElementById("wastageInboundCodeDisplay");
    const inbDetailsDisp = document.getElementById("wastageInboundDetailsDisplay");
    const btnClearInb = document.getElementById("btnClearWastageInbound");

    if (options.inbound) {
        currentWastageInbound = options.inbound;
        if (branchSelect && currentWastageInbound.branchId) {
            branchSelect.value = currentWastageInbound.branchId;
            branchSelect.disabled = true;
        }
        if (contextBox) contextBox.classList.remove("hidden");
        if (selectBox) selectBox.classList.add("hidden");
        if (inbCodeDisp) inbCodeDisp.textContent = currentWastageInbound.inboundCode || currentWastageInbound.id;
        if (inbDetailsDisp) {
            const dateStr = currentWastageInbound.date || currentWastageInbound.createdAt?.slice(0, 10) || "—";
            inbDetailsDisp.textContent = `Nhà vườn: ${currentWastageInbound.supplier || "Hasfarm"} | Ngày nhập: ${dateStr}`;
        }
        if (btnClearInb) btnClearInb.classList.remove("hidden");

        populateWastageItemsFromInbound(currentWastageInbound);
    } else {
        currentWastageInbound = null;
        if (contextBox) contextBox.classList.add("hidden");
        if (selectBox) selectBox.classList.remove("hidden");
        if (btnClearInb) btnClearInb.classList.add("hidden");

        // Đảm bảo có danh sách đợt nhập để chọn
        if (!allAdminInbounds || allAdminInbounds.length === 0) {
            await loadAdminInbounds();
        }

        if (inbSelect) {
            inbSelect.innerHTML = `<option value="">-- Chọn đợt nhập hàng đã nhận (Bắt buộc) --</option>`;
            (allAdminInbounds || []).forEach(inb => {
                const bObj = (allAdminBranches || []).find(b => b.id === inb.branchId);
                const bName = bObj ? (bObj.code || bObj.name) : (inb.branchId || "");
                const inbDate = inb.date || inb.createdAt?.slice(0, 10);
                const opt = document.createElement("option");
                opt.value = inb.id;
                opt.textContent = `[${inb.id}] ${inb.supplier || 'NCC'} - ${inbDate} (${bName})`;
                inbSelect.appendChild(opt);
            });
        }

        const tbody = document.getElementById("wastageItemsTableBody");
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-amber-700 bg-amber-50/50 rounded-xl font-medium"><i class="fa-solid fa-triangle-exclamation mr-1.5"></i> Vui lòng chọn đợt nhập hàng ở trên để hiển thị danh sách hoa cần báo hỏng.</td></tr>`;
        }
        recalculateWastageTotals();
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

export function clearWastageInboundContext() {
    currentWastageInbound = null;
    openWastageModal();
}

export function onWastageInboundSelectChange(inboundId) {
    if (!inboundId) {
        currentWastageInbound = null;
        const tbody = document.getElementById("wastageItemsTableBody");
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-amber-700 bg-amber-50/50 rounded-xl font-medium"><i class="fa-solid fa-triangle-exclamation mr-1.5"></i> Vui lòng chọn đợt nhập hàng ở trên để hiển thị danh sách hoa cần báo hỏng.</td></tr>`;
        }
        recalculateWastageTotals();
        return;
    }

    const inb = (allAdminInbounds || []).find(r => r.id === inboundId || r.inboundCode === inboundId);
    if (inb) {
        currentWastageInbound = inb;
        const branchSelect = document.getElementById("wastageBranchSelect");
        if (branchSelect && inb.branchId) {
            branchSelect.value = inb.branchId;
            branchSelect.disabled = true;
        }
        populateWastageItemsFromInbound(inb);
    }
}

export function populateWastageItemsFromInbound(inbound) {
    const tbody = document.getElementById("wastageItemsTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const items = inbound.items || [];
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-400 font-medium">Đợt nhập này không có danh sách hoa chi tiết.</td></tr>`;
        recalculateWastageTotals();
        return;
    }

    items.forEach(itm => {
        addWastageItemRowFromInbound(itm, inbound);
    });
    recalculateWastageTotals();
}

export function addWastageItemRowFromInbound(item, inbound) {
    const tbody = document.getElementById("wastageItemsTableBody");
    if (!tbody) return;

    const rowId = "wastage_inb_row_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
    const cleanId = (item.materialId || item.productId || "").replace("mat:", "").replace("prod:", "");
    const matchedMat = (allAdminMaterials || []).find(m => m.id === cleanId || m.id === item.materialId);
    const flowerName = (item.name && item.name !== "Cành hoa" && item.name !== "Vật liệu" && item.name !== "Hàng nhập")
        ? item.name
        : (item.materialName || item.flowerType || matchedMat?.name || cleanId || "Hoa cành");
    const maxQty = Math.max(1, parseInt(item.quantity || 1, 10));
    const defaultCost = Math.max(0, parseInt(item.unitCost || 0, 10));
    const unit = item.unit || matchedMat?.unit || "cành";

    const tr = document.createElement("tr");
    tr.id = rowId;
    tr.className = "hover:bg-rose-50/30 transition border-b border-gray-100";
    tr.dataset.materialId = cleanId;
    tr.dataset.flowerName = flowerName;
    tr.dataset.maxQty = maxQty;
    tr.innerHTML = `
        <td class="p-3">
            <div class="font-bold text-gray-800 text-xs">${flowerName}</div>
            <div class="text-[11px] text-blue-600 font-semibold mt-0.5 flex items-center gap-1">
                <i class="fa-solid fa-box-open text-[10px]"></i> Thực nhận đợt này: <span class="font-extrabold text-blue-700">${maxQty}</span> ${unit}
            </div>
        </td>
        <td class="p-3 text-center">
            <div class="flex flex-col items-center">
                <input type="number" min="0" max="${maxQty}" value="0" 
                    class="wastage-stems-input w-24 px-2 py-1.5 bg-white border-2 border-rose-300 rounded-lg text-xs font-bold text-center text-rose-700 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200" 
                    oninput="onWastageStemQtyInput(this, ${maxQty})" 
                    title="Nhập số cành hỏng (tối đa ${maxQty} cành)">
                <span class="text-[10px] text-gray-400 font-semibold mt-0.5">Tối đa: ${maxQty} ${unit}</span>
            </div>
        </td>
        <td class="p-3">
            <div class="flex items-center space-x-1">
                <input type="number" min="0" step="500" value="${defaultCost}" class="wastage-cost-input w-24 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:border-rose-400 focus:outline-none text-right" oninput="recalculateWastageTotals()">
                <span class="text-xs text-gray-400">₫</span>
            </div>
        </td>
        <td class="p-3">
            <select class="wastage-reason-select w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:border-rose-400 focus:outline-none">
                <option value="Dập cánh khi vận chuyển">🚚 Dập cánh khi vận chuyển</option>
                <option value="Thối gốc / úa héo sau bảo quản">🥀 Thối gốc / héo úa kho lạnh</option>
                <option value="Nở quá độ trong thời tiết nóng">☀️ Nở bung quá lứa do thời tiết</option>
                <option value="Gãy cành / dập lá khi cắm">✂️ Gãy cành / dập lá khi cắm</option>
                <option value="Khách đổi ý không lấy mẫu đã cắm">❌ Khách hủy không nhận</option>
                <option value="Khác">Khác...</option>
            </select>
        </td>
        <td class="p-3 text-right font-bold text-rose-600 wastage-row-loss">0₫</td>
        <td class="p-3 text-center">
            <button type="button" onclick="resetWastageRow('${rowId}')" class="px-2 py-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xs font-bold transition" title="Đặt lại về 0">
                <i class="fa-solid fa-rotate-left"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
}

export function resetWastageRow(rowId) {
    const tr = document.getElementById(rowId);
    if (!tr) return;
    const stemsInp = tr.querySelector(".wastage-stems-input");
    if (stemsInp) stemsInp.value = 0;
    recalculateWastageTotals();
}

export function onWastageStemQtyInput(inputEl, maxQty) {
    let val = parseInt(inputEl.value, 10);
    if (isNaN(val) || val < 0) {
        inputEl.value = 0;
        val = 0;
    }
    if (val > maxQty) {
        inputEl.value = maxQty;
        notifyUser(`Số lượng báo hỏng không được vượt quá số thực nhận (${maxQty} cành) của đợt nhập!`, "warning");
    }
    recalculateWastageTotals();
}

export async function handleWastagePhotoSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const statusEl = document.getElementById("wastagePhotoUploadStatus");
    if (statusEl) statusEl.classList.remove("hidden");

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("prefix", "wastage");

        try {
            const res = await fetch(`${API_BASE}/admin/upload-image`, {
                method: "POST",
                headers: token ? { "Authorization": `Bearer ${token}` } : {},
                body: formData
            });
            const json = await res.json();
            if (res.ok && json.success && json.data && json.data.url) {
                currentWastagePhotos.push(json.data.url);
            } else {
                notifyUser(json.message || "Không thể tải ảnh minh chứng", "error");
            }
        } catch (err) {
            notifyUser(`Lỗi tải ảnh: ${err.message}`, "error");
        }
    }

    if (statusEl) statusEl.classList.add("hidden");
    renderWastagePhotoPreviews();
}

export function renderWastagePhotoPreviews() {
    const container = document.getElementById("wastagePhotoPreviews");
    if (!container) return;
    container.innerHTML = "";

    currentWastagePhotos.forEach((url, idx) => {
        const div = document.createElement("div");
        div.className = "relative w-16 h-16 rounded-lg overflow-hidden border border-rose-200 group shadow-2xs";
        div.innerHTML = `
            <img src="${url}" class="w-full h-full object-cover" alt="Hoa hỏng">
            <button type="button" onclick="removeWastagePhoto(${idx})" class="absolute top-0.5 right-0.5 w-5 h-5 bg-black/70 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-[10px] transition">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        container.appendChild(div);
    });
}

export function removeWastagePhoto(index) {
    if (index >= 0 && index < currentWastagePhotos.length) {
        currentWastagePhotos.splice(index, 1);
        renderWastagePhotoPreviews();
    }
}

export function closeWastageModal() {
    currentWastageInbound = null;
    const modal = document.getElementById("wastageModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export function addWastageItemRow() {
    // Dự phòng khi gọi độc lập (hoặc người dùng thêm dòng hoa tự do)
    const tbody = document.getElementById("wastageItemsTableBody");
    if (!tbody) return;

    const rowId = "wastage_row_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);

    let productOptions = `<option value="">-- Nhập tên hoa tự do hoặc chọn mẫu hoa --</option>`;
    if (allAdminProducts && allAdminProducts.length > 0) {
        allAdminProducts.forEach(p => {
            productOptions += `<option value="${p.id}" data-name="${p.name}" data-price="${p.priceNumber || 0}">${p.name} (${Number(p.priceNumber || 0).toLocaleString('vi-VN')}₫)</option>`;
        });
    }

    const tr = document.createElement("tr");
    tr.id = rowId;
    tr.className = "hover:bg-rose-50/30 transition";
    tr.innerHTML = `
        <td class="p-2">
            <div class="space-y-1">
                <select class="wastage-prod-select w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:border-rose-400 focus:outline-none" onchange="onWastageProductSelect('${rowId}')">
                    ${productOptions}
                </select>
                <input type="text" placeholder="Hoặc nhập tên hoa tươi (vd: Hồng Ecuador đỏ)..." class="wastage-flower-input w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:border-rose-400 focus:outline-none">
            </div>
        </td>
        <td class="p-2 text-center">
            <input type="number" min="1" value="1" class="wastage-stems-input w-20 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-center focus:border-rose-400 focus:outline-none" oninput="recalculateWastageTotals()">
        </td>
        <td class="p-2">
            <input type="number" min="0" step="5000" value="20000" class="wastage-cost-input w-24 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold focus:border-rose-400 focus:outline-none" oninput="recalculateWastageTotals()">
        </td>
        <td class="p-2">
            <select class="wastage-reason-select w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:border-rose-400 focus:outline-none">
                <option value="Dập cánh khi vận chuyển">🚚 Dập cánh khi vận chuyển</option>
                <option value="Nở quá độ trong thời tiết nóng">☀️ Nở quá độ do thời tiết</option>
                <option value="Gãy cành / dập lá khi cắm">✂️ Gãy cành / dập lá khi cắm</option>
                <option value="Khách đổi ý không lấy mẫu đã cắm">❌ Khách hủy không nhận</option>
                <option value="Héo úa cuối ca làm việc">🥀 Héo úa tồn cuối ca</option>
                <option value="Khác">Khác...</option>
            </select>
        </td>
        <td class="p-2 text-right font-bold text-rose-600 wastage-row-loss">20,000₫</td>
        <td class="p-2 text-center">
            <button type="button" onclick="removeWastageItemRow('${rowId}')" class="w-6 h-6 rounded-full hover:bg-rose-100 text-rose-500 hover:text-rose-700 inline-flex items-center justify-center transition">
                <i class="fa-solid fa-trash text-xs"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    recalculateWastageTotals();
}

export function onWastageProductSelect(rowId) {
    const tr = document.getElementById(rowId);
    if (!tr) return;
    const sel = tr.querySelector(".wastage-prod-select");
    const flowerInput = tr.querySelector(".wastage-flower-input");
    const costInput = tr.querySelector(".wastage-cost-input");

    if (sel && sel.value) {
        const opt = sel.selectedOptions[0];
        const pName = opt.getAttribute("data-name");
        const pPrice = parseInt(opt.getAttribute("data-price"), 10) || 0;
        if (flowerInput) flowerInput.value = pName;
        if (costInput && pPrice > 0) costInput.value = Math.round(pPrice * 0.4 / 10000) * 10000;
    }
    recalculateWastageTotals();
}

export function removeWastageItemRow(rowId) {
    const tr = document.getElementById(rowId);
    if (tr) tr.remove();
    recalculateWastageTotals();
}

export function recalculateWastageTotals() {
    const rows = document.querySelectorAll("#wastageItemsTableBody tr");
    let totalStems = 0;
    let totalAmount = 0;

    rows.forEach(tr => {
        const stemsInp = tr.querySelector(".wastage-stems-input");
        const costInp = tr.querySelector(".wastage-cost-input");
        const lossEl = tr.querySelector(".wastage-row-loss");

        const stems = Math.max(0, parseInt(stemsInp?.value, 10) || 0);
        const cost = Math.max(0, parseInt(costInp?.value, 10) || 0);
        const rowLoss = stems * cost;

        totalStems += stems;
        totalAmount += rowLoss;

        if (lossEl) lossEl.textContent = rowLoss.toLocaleString("vi-VN") + "₫";
    });

    const stemsBadge = document.getElementById("wastageTotalStemsBadge");
    const amountBadge = document.getElementById("wastageTotalAmountBadge");
    if (stemsBadge) stemsBadge.textContent = totalStems.toLocaleString("vi-VN");
    if (amountBadge) amountBadge.textContent = totalAmount.toLocaleString("vi-VN") + "₫";
}

export async function handleWastageSubmit(event) {
    if (event) event.preventDefault();
    const branchSelect = document.getElementById("wastageBranchSelect");
    const dateInput = document.getElementById("wastageDateInput");
    const notesInput = document.getElementById("wastageNotesInput");
    const inbSelect = document.getElementById("wastageInboundSelect");
    const errBox = document.getElementById("wastageModalError");

    // Xác định đợt nhập hàng gắn với phiếu báo hỏng
    let targetInbound = currentWastageInbound;
    if (!targetInbound && inbSelect && inbSelect.value) {
        targetInbound = (allAdminInbounds || []).find(r => r.id === inbSelect.value || r.inboundCode === inbSelect.value);
    }

    if (!targetInbound) {
        if (errBox) {
            errBox.textContent = "Bắt buộc phải chọn Đợt Nhập Hàng để báo hoa hỏng! Hệ thống không cho phép báo hỏng trôi nổi không rõ nguồn gốc.";
            errBox.classList.remove("hidden");
        }
        return;
    }

    const rows = document.querySelectorAll("#wastageItemsTableBody tr");
    if (!rows || rows.length === 0) {
        if (errBox) {
            errBox.textContent = "Vui lòng nhập số lượng cành hoa hư hỏng cần báo hủy!";
            errBox.classList.remove("hidden");
        }
        return;
    }

    const items = [];
    let hasQuantityOverflow = false;

    rows.forEach(tr => {
        const stemsInp = tr.querySelector(".wastage-stems-input");
        const costInp = tr.querySelector(".wastage-cost-input");
        const reasonSel = tr.querySelector(".wastage-reason-select");
        const damagedStems = Math.max(0, parseInt(stemsInp?.value, 10) || 0);

        if (damagedStems > 0) {
            const flowerType = tr.dataset.flowerName || tr.querySelector(".wastage-flower-input")?.value || "Hoa tươi";
            const materialId = tr.dataset.materialId || tr.querySelector(".wastage-prod-select")?.value;
            const maxQty = parseInt(tr.dataset.maxQty, 10);
            
            if (!isNaN(maxQty) && damagedStems > maxQty) {
                hasQuantityOverflow = true;
            }

            const unitCost = Math.max(0, parseInt(costInp?.value, 10) || 0);
            const reason = reasonSel?.value || "Dập cánh khi vận chuyển";

            items.push({
                materialId: materialId || undefined,
                productId: materialId || undefined,
                flowerType,
                damagedStems,
                unitCost,
                reason
            });
        }
    });

    if (hasQuantityOverflow) {
        if (errBox) {
            errBox.textContent = "Số cành hoa báo hỏng không được vượt quá số cành thực tế đã nhận của đợt nhập!";
            errBox.classList.remove("hidden");
        }
        return;
    }

    if (items.length === 0) {
        if (errBox) {
            errBox.textContent = "Vui lòng nhập số lượng cành hoa hư hỏng (> 0) cho ít nhất một loại hoa thuộc đợt nhập!";
            errBox.classList.remove("hidden");
        }
        return;
    }

    const payload = {
        branchId: targetInbound.branchId || branchSelect?.value,
        inboundId: targetInbound.id,
        inboundCode: targetInbound.inboundCode || targetInbound.id,
        requestCode: targetInbound.requestCode || targetInbound.purchaseRequestId,
        supplier: targetInbound.supplier,
        date: dateInput?.value,
        notes: (notesInput?.value || "").trim(),
        proofImages: currentWastagePhotos,
        items
    };

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen("Đang ghi nhận phiếu báo hủy gắn với đợt nhập " + (payload.inboundCode || payload.inboundId) + "...");
    try {
        const res = await fetch(`${API_BASE}/admin/inventory/wastage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        unlockScreen();

        if (res.ok && json.success) {
            notifyUser(`Đã lưu phiếu báo hủy gắn với đợt nhập ${payload.inboundCode || payload.inboundId} thành công!`, "success");
            closeWastageModal();
            loadAdminInventory();
            loadAdminWastageHistory();
        } else {
            if (errBox) {
                errBox.textContent = json.message || "Lỗi khi lưu phiếu báo hủy";
                errBox.classList.remove("hidden");
            }
        }
    } catch (e) {
        unlockScreen();
        if (errBox) {
            errBox.textContent = `Lỗi mạng: ${e.message}`;
            errBox.classList.remove("hidden");
        }
    }
}

export function filterInventoryMatrixTable() {
    const input = document.getElementById("searchInventoryInput");
    if (!input) return;
    const term = (input.value || "").toLowerCase().trim();
    const rows = document.querySelectorAll("#inventoryMatrixBody tr");

    rows.forEach(tr => {
        const pName = tr.getAttribute("data-product-name") || "";
        const pId = tr.getAttribute("data-product-id") || "";
        if (!term || pName.includes(term) || pId.toLowerCase().includes(term)) {
            tr.style.display = "";
        } else {
            tr.style.display = "none";
        }
    });
}

if (typeof window !== "undefined") {
    window.loadAdminInventory = loadAdminInventory;
    window.saveBatchInventory = saveBatchInventory;
    window.renderInventoryKPIs = renderInventoryKPIs;
    window.renderInventoryMatrixTable = renderInventoryMatrixTable;
    window.filterInventoryMatrixTable = filterInventoryMatrixTable;
    window.switchInventorySubView = switchInventorySubView;
    window.loadAdminWastageHistory = loadAdminWastageHistory;
    window.openWastageModal = openWastageModal;
    window.openWastageModalForInbound = openWastageModalForInbound;
    window.clearWastageInboundContext = clearWastageInboundContext;
    window.onWastageInboundSelectChange = onWastageInboundSelectChange;
    window.populateWastageItemsFromInbound = populateWastageItemsFromInbound;
    window.addWastageItemRowFromInbound = addWastageItemRowFromInbound;
    window.onWastageStemQtyInput = onWastageStemQtyInput;
    window.resetWastageRow = resetWastageRow;
    window.closeWastageModal = closeWastageModal;
    window.addWastageItemRow = addWastageItemRow;
    window.removeWastageItemRow = removeWastageItemRow;
    window.onWastageProductSelect = onWastageProductSelect;
    window.recalculateWastageTotals = recalculateWastageTotals;
    window.handleWastageSubmit = handleWastageSubmit;
    window.handleWastagePhotoSelect = handleWastagePhotoSelect;
    window.renderWastagePhotoPreviews = renderWastagePhotoPreviews;
    window.removeWastagePhoto = removeWastagePhoto;
    window.loadAdminMaterials = loadAdminMaterials;
    window.renderAdminMaterialsTable = renderAdminMaterialsTable;
    window.loadAdminInbounds = loadAdminInbounds;
    window.renderAdminInboundsTable = renderAdminInboundsTable;
    window.openInboundModal = openInboundModal;
    window.closeInboundModal = closeInboundModal;
    window.addInboundItemRow = addInboundItemRow;
    window.onInboundItemSelect = onInboundItemSelect;
    window.onInboundModeChange = onInboundModeChange;
    window.removeInboundItemRow = removeInboundItemRow;
    window.recalculateInboundTotals = recalculateInboundTotals;
    window.handleInboundSubmit = handleInboundSubmit;
    window.loadMonthlyInventoryReport = loadMonthlyInventoryReport;
    window.renderMonthlyInventoryReport = renderMonthlyInventoryReport;
    window.allAdminPurchaseRequests = allAdminPurchaseRequests;
    window.loadAdminPurchaseRequests = loadAdminPurchaseRequests;
    window.filterAdminPurchaseRequests = filterAdminPurchaseRequests;
    window.renderAdminPurchaseRequestsTable = renderAdminPurchaseRequestsTable;
    window.renderPendingFulfillmentRequestsTable = renderPendingFulfillmentRequestsTable;
    window.openPurchaseRequestModal = openPurchaseRequestModal;
    window.closePurchaseRequestModal = closePurchaseRequestModal;
    window.addPurchaseRequestItemRow = addPurchaseRequestItemRow;
    window.removePurchaseRequestItemRow = removePurchaseRequestItemRow;
    window.onPrSearchFocus = onPrSearchFocus;
    window.onPrSearchInput = onPrSearchInput;
    window.renderPrSearchResults = renderPrSearchResults;
    window.selectPrMaterial = selectPrMaterial;
    window.clearPrSearchSelection = clearPrSearchSelection;
    window.togglePrSearchDropdown = togglePrSearchDropdown;
    window.handlePurchaseRequestSubmit = handlePurchaseRequestSubmit;
    window.fulfillPurchaseRequestFromQueue = fulfillPurchaseRequestFromQueue;
    window.changePurchaseRequestStatus = changePurchaseRequestStatus;
    window.closePurchaseRequest = closePurchaseRequest;
    window.setQueueFilter = setQueueFilter;
    window.openWastageModalForPurchaseRequest = openWastageModalForPurchaseRequest;
    window.openInventoryManagementModal = openInventoryManagementModal;
    window.closeInventoryManagementModal = closeInventoryManagementModal;
}

if (typeof document !== "undefined") {
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".pr-combobox-wrapper")) {
            document.querySelectorAll(".pr-search-results").forEach(el => el.classList.add("hidden"));
        }
    });
}
