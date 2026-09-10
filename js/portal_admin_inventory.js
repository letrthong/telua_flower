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
    const btnMatrix = document.getElementById("subViewBtnMatrix");
    const btnWastage = document.getElementById("subViewBtnWastage");
    const subMatrix = document.getElementById("inventoryMatrixSubView");
    const subWastage = document.getElementById("inventoryWastageSubView");

    if (view === "matrix") {
        if (btnMatrix) btnMatrix.className = "py-2.5 px-1 font-bold text-xs border-b-2 border-primary text-primary transition flex items-center gap-1.5";
        if (btnWastage) btnWastage.className = "py-2.5 px-1 font-bold text-xs border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition flex items-center gap-1.5";
        if (subMatrix) subMatrix.classList.remove("hidden");
        if (subWastage) subWastage.classList.add("hidden");
    } else {
        if (btnMatrix) btnMatrix.className = "py-2.5 px-1 font-bold text-xs border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition flex items-center gap-1.5";
        if (btnWastage) btnWastage.className = "py-2.5 px-1 font-bold text-xs border-b-2 border-primary text-primary transition flex items-center gap-1.5";
        if (subMatrix) subMatrix.classList.add("hidden");
        if (subWastage) subWastage.classList.remove("hidden");
        loadAdminWastageHistory();
    }
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
}
