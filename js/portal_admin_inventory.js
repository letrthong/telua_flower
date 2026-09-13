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
                    <span title="Hạn mức nhập đầu ca">Nhập</span>•<span title="Đã bán">Bán</span>•<span title="Báo hủy hỏng">Hỏng</span>•<span title="Tồn khả dụng" class="font-bold text-primary">Tồn</span>
                </div>
            </th>
        `;
    });
    headerHtml += `
            <th class="p-3 text-center border-l border-gray-200 bg-gray-50/80 w-36">
                <div>Tổng Chuỗi</div>
                <div class="text-[9px] font-normal text-gray-400 mt-0.5">Nhập • Bán • Tồn</div>
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
                        <input type="number" min="0" value="${imported}" data-product-id="${prod.id}" data-branch-id="${b.id}" ${disabledAttr} class="${inputCls}" title="Hạn mức nhập đầu ngày">
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
        notifyUser("Không có dữ liệu hạn mức tồn kho nào để lưu", "warning");
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
        notifyUser("Vui lòng đăng nhập quyền Quản Lý hoặc Super Admin để lưu hạn mức!", "error");
        return;
    }

    lockScreen("Đang lưu hạn mức tồn kho chi nhánh...");
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
            notifyUser("Đã cập nhật hạn mức tồn kho thành công!", "success");
            loadAdminInventory();
        } else {
            notifyUser(json.message || "Không thể lưu hạn mức tồn kho", "error");
        }
    } catch (e) {
        unlockScreen();
        notifyUser(`Lỗi kết nối: ${e.message}`, "error");
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
    } else if (view === "inbounds") {
        loadAdminInbounds();
        loadAdminWastageHistory();
    } else if (view === "monthly_report") {
        loadMonthlyInventoryReport();
    }
}

// ----------------------------------------------------
// SUB-TAB 2: KHO CÀNH HOA & PHỤ LIỆU (RAW MATERIALS)
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
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-red-500 font-medium">Lỗi: ${e.message}</td></tr>`;
    }
}

export function renderAdminInboundsTable(receipts) {
    const tbody = document.getElementById("inventoryInboundsBody");
    if (!tbody) return;

    if (!receipts || receipts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-gray-400 font-medium">Chưa có phiếu nhập kho nào trong tháng này.</td></tr>`;
        return;
    }

    let html = "";
    receipts.forEach(r => {
        const bObj = (allAdminBranches || []).find(b => b.id === r.branchId);
        const bName = bObj ? (bObj.code ? `${bObj.code} - ${bObj.name.replace("Nở Hoa Thả Bình - Showroom ", "")}` : bObj.name) : r.branchId;
        const totalFmt = Number(r.totalCost || 0).toLocaleString("vi-VN") + "₫";

        let itemsSummary = (r.items || []).map(itm => {
            const name = itm.name || itm.materialId || itm.productId || "Vật liệu";
            const unit = itm.unit || "cành";
            return `<div class="text-[11px]"><b class="text-blue-600">+${itm.quantity} ${unit}</b> ${name}</div>`;
        }).join("");

        html += `
            <tr class="hover:bg-blue-50/20 transition">
                <td class="p-3 font-mono text-xs font-bold text-blue-700">${r.id}</td>
                <td class="p-3 font-semibold text-gray-700">${bName}</td>
                <td class="p-3 text-gray-600">${r.date || r.createdAt?.slice(0, 10)}</td>
                <td class="p-3 text-gray-700 font-medium">${r.supplier || "Nhà cung cấp"}</td>
                <td class="p-3 text-gray-600">${r.createdBy || "Admin"}</td>
                <td class="p-3 space-y-1">${itemsSummary}</td>
                <td class="p-3 font-bold text-blue-600 text-right">${totalFmt}</td>
                <td class="p-3 text-gray-500 text-xs italic">${r.notes || "—"}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

export function openInboundModal() {
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
    addInboundItemRow();

    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

export function closeInboundModal() {
    const modal = document.getElementById("inboundModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export function addInboundItemRow() {
    const tbody = document.getElementById("inboundItemsTableBody");
    if (!tbody) return;

    const rowId = "inbound_row_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);

    let options = `<optgroup label="Cành Hoa Tươi & Phụ Liệu (materials.json)">`;
    if (allAdminMaterials && allAdminMaterials.length > 0) {
        allAdminMaterials.forEach(m => {
            options += `<option value="mat:${m.id}" data-name="${m.name}" data-price="${m.costPrice || 0}" data-unit="${m.unit || 'cành'}">${m.name} (${m.unit || 'cành'} - ${Number(m.costPrice || 0).toLocaleString('vi-VN')}₫)</option>`;
        });
    } else {
        options += `<option value="mat:mat_rose_red" data-name="Hồng đỏ Pháp" data-price="12000" data-unit="cành">Hồng đỏ Pháp (12.000₫/cành)</option>`;
    }
    options += `</optgroup>`;

    const directProducts = (allAdminProducts || []).filter(p => p.productType === "direct" || p.category === "binh_hoa");
    if (directProducts.length > 0) {
        options += `<optgroup label="Bình Hoa & Hàng Bán Trực Tiếp (products.json)">`;
        directProducts.forEach(p => {
            options += `<option value="prod:${p.id}" data-name="${p.name}" data-price="${Math.round((p.priceNumber || 0) * 0.5)}" data-unit="bình">${p.name} (Tồn 1:1 - ${Number(p.priceNumber || 0).toLocaleString('vi-VN')}₫)</option>`;
        });
        options += `</optgroup>`;
    }

    const tr = document.createElement("tr");
    tr.id = rowId;
    tr.className = "hover:bg-blue-50/30 transition";
    tr.innerHTML = `
        <td class="p-2">
            <select onchange="onInboundItemSelect('${rowId}')" class="inbound-item-select w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary">
                ${options}
            </select>
        </td>
        <td class="p-2">
            <input type="number" min="1" value="50" oninput="recalculateInboundTotals()" class="inbound-item-qty w-full px-2 py-1 text-center bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-primary" required>
        </td>
        <td class="p-2">
            <input type="number" min="0" step="1000" value="12000" oninput="recalculateInboundTotals()" class="inbound-item-cost w-full px-2 py-1 text-right bg-white border border-gray-200 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-primary" required>
        </td>
        <td class="p-2 text-right font-mono font-bold text-blue-600 text-xs inbound-item-subtotal">
            600.000₫
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

export function onInboundItemSelect(rowId) {
    const tr = document.getElementById(rowId);
    if (!tr) return;
    const select = tr.querySelector(".inbound-item-select");
    const costInput = tr.querySelector(".inbound-item-cost");
    if (!select || !costInput) return;

    const opt = select.selectedOptions[0];
    if (opt && opt.dataset.price) {
        costInput.value = opt.dataset.price;
    }
    recalculateInboundTotals();
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
    let totalCost = 0;

    rows.forEach(tr => {
        const qtyInp = tr.querySelector(".inbound-item-qty");
        const costInp = tr.querySelector(".inbound-item-cost");
        const subtotalEl = tr.querySelector(".inbound-item-subtotal");

        const qty = Math.max(1, parseInt(qtyInp?.value || 1, 10));
        const cost = Math.max(0, parseInt(costInp?.value || 0, 10));
        const sub = qty * cost;

        if (subtotalEl) {
            subtotalEl.textContent = Number(sub).toLocaleString("vi-VN") + "₫";
        }

        totalItems += 1;
        totalCost += sub;
    });

    const badgeItems = document.getElementById("inboundTotalItemsBadge");
    const badgeAmount = document.getElementById("inboundTotalAmountBadge");
    if (badgeItems) badgeItems.textContent = totalItems;
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
        const qtyInp = tr.querySelector(".inbound-item-qty");
        const costInp = tr.querySelector(".inbound-item-cost");

        const val = select?.value || "";
        const opt = select?.selectedOptions[0];
        const qty = Math.max(1, parseInt(qtyInp?.value || 1, 10));
        const unitCost = Math.max(0, parseInt(costInp?.value || 0, 10));

        if (val.startsWith("mat:")) {
            items.push({
                materialId: val.replace("mat:", ""),
                name: opt?.dataset.name || "Hoa cành",
                unit: opt?.dataset.unit || "cành",
                quantity: qty,
                unitCost: unitCost
            });
        } else if (val.startsWith("prod:")) {
            items.push({
                productId: val.replace("prod:", ""),
                name: opt?.dataset.name || "Sản phẩm",
                unit: opt?.dataset.unit || "bình",
                quantity: qty,
                unitCost: unitCost
            });
        }
    });

    const payload = {
        branchId: branchId,
        date: dateStr,
        supplier: supplier || "Vườn Hoa Đà Lạt Hasfarm",
        notes: notes,
        items: items
    };

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen("Đang tạo phiếu nhập kho & cập nhật tồn cành hoa...");
    try {
        const res = await fetch(`${API_BASE}/admin/inventory/inbounds`, {
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
            notifyUser("Đã lập phiếu nhập kho thành công!", "success");
            closeInboundModal();
            loadAdminInbounds();
            loadAdminMaterials();
            loadAdminInventory();
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
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-400 font-medium">Chưa có phiếu báo hủy nào được lập.</td></tr>`;
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

        html += `
            <tr class="hover:bg-gray-50 transition">
                <td class="p-3 font-mono text-xs font-bold text-gray-800">${r.id}</td>
                <td class="p-3 font-semibold text-gray-700">${bName}</td>
                <td class="p-3 text-gray-600">${r.date || r.createdAt?.slice(0, 10)}</td>
                <td class="p-3 text-gray-600">${r.reportedBy || "Nhân viên"}</td>
                <td class="p-3 space-y-1">${itemsSummary}</td>
                <td class="p-3 font-bold text-rose-600 text-right">${lossFmt}</td>
                <td class="p-3 text-gray-500 text-xs italic">${r.notes || "—"}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

export function openWastageModal() {
    const modal = document.getElementById("wastageModal");
    const branchSelect = document.getElementById("wastageBranchSelect");
    const dateInput = document.getElementById("wastageDateInput");
    const notesInput = document.getElementById("wastageNotesInput");
    const errBox = document.getElementById("wastageModalError");

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

    const tbody = document.getElementById("wastageItemsTableBody");
    if (tbody) tbody.innerHTML = "";
    addWastageItemRow();

    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

export function closeWastageModal() {
    const modal = document.getElementById("wastageModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export function addWastageItemRow() {
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
    const errBox = document.getElementById("wastageModalError");

    const rows = document.querySelectorAll("#wastageItemsTableBody tr");
    if (!rows || rows.length === 0) {
        if (errBox) {
            errBox.textContent = "Vui lòng thêm ít nhất 1 dòng hoa hư hỏng cần báo hủy!";
            errBox.classList.remove("hidden");
        }
        return;
    }

    const items = [];
    rows.forEach(tr => {
        const sel = tr.querySelector(".wastage-prod-select");
        const flowerInput = tr.querySelector(".wastage-flower-input");
        const stemsInp = tr.querySelector(".wastage-stems-input");
        const costInp = tr.querySelector(".wastage-cost-input");
        const reasonSel = tr.querySelector(".wastage-reason-select");

        const pId = sel?.value || undefined;
        const flowerType = (flowerInput?.value || "").trim() || (sel?.selectedOptions[0]?.getAttribute("data-name") || "Hoa tươi");
        const damagedStems = Math.max(0, parseInt(stemsInp?.value, 10) || 0);
        const unitCost = Math.max(0, parseInt(costInp?.value, 10) || 0);
        const reason = reasonSel?.value || "Dập cánh khi vận chuyển";

        if (damagedStems > 0) {
            items.push({
                productId: pId,
                flowerType,
                damagedStems,
                unitCost,
                reason
            });
        }
    });

    if (items.length === 0) {
        if (errBox) {
            errBox.textContent = "Số lượng cành hoa hư hỏng phải lớn hơn 0!";
            errBox.classList.remove("hidden");
        }
        return;
    }

    const payload = {
        branchId: branchSelect?.value,
        date: dateInput?.value,
        notes: (notesInput?.value || "").trim(),
        items
    };

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen("Đang ghi nhận phiếu báo hủy hoa hỏng...");
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
            notifyUser("Đã lưu phiếu báo hủy hoa hỏng thành công!", "success");
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
    window.closeWastageModal = closeWastageModal;
    window.addWastageItemRow = addWastageItemRow;
    window.removeWastageItemRow = removeWastageItemRow;
    window.onWastageProductSelect = onWastageProductSelect;
    window.recalculateWastageTotals = recalculateWastageTotals;
    window.handleWastageSubmit = handleWastageSubmit;
    window.loadAdminMaterials = loadAdminMaterials;
    window.renderAdminMaterialsTable = renderAdminMaterialsTable;
    window.loadAdminInbounds = loadAdminInbounds;
    window.renderAdminInboundsTable = renderAdminInboundsTable;
    window.openInboundModal = openInboundModal;
    window.closeInboundModal = closeInboundModal;
    window.addInboundItemRow = addInboundItemRow;
    window.onInboundItemSelect = onInboundItemSelect;
    window.removeInboundItemRow = removeInboundItemRow;
    window.recalculateInboundTotals = recalculateInboundTotals;
    window.handleInboundSubmit = handleInboundSubmit;
    window.loadMonthlyInventoryReport = loadMonthlyInventoryReport;
    window.renderMonthlyInventoryReport = renderMonthlyInventoryReport;
}
