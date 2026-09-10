import { getAuthToken } from './auth.js';
import { API_BASE, showConfirmDialog } from './utils.js';
import { lockScreen, unlockScreen, notifyUser, allAdminPromotions, allAdminAddons } from './portal_admin_state.js';
import { compressAndConvertToBase64 } from './portal_admin_products.js';

// ==========================================
// QUẢN LÝ KHUYẾN MÃI & VOUCHER (PROMOTIONS - Timestamps & Soft Delete)
// ==========================================

export async function loadAdminPromotions() {
    const tbody = document.getElementById("promotionsTableBody");
    if (!tbody) return;

    if (!allAdminPromotions || allAdminPromotions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-gray-400 font-medium"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải dữ liệu voucher...</td></tr>`;
    }

    try {
        const res = await fetch(`${API_BASE}/promotions`);
        const json = await res.json();
        if (json.success && json.data) {
            allAdminPromotions = json.data;
            if (typeof window !== "undefined") window.allAdminPromotions = allAdminPromotions;
            renderPromotionsTable(allAdminPromotions);
        } else if (!allAdminPromotions || allAdminPromotions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-red-500 font-bold">${json.message || "Không thể tải danh sách khuyến mãi"}</td></tr>`;
        }
    } catch (e) {
        if (!allAdminPromotions || allAdminPromotions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
        }
    }
}

export function renderPromotionsTable(promotions) {
    const tbody = document.getElementById("promotionsTableBody");
    if (!tbody) return;

    if (!Array.isArray(promotions) || promotions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="p-12 text-center">
                    <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                        <div class="w-16 h-16 rounded-full bg-purple-50 text-purple-400 flex items-center justify-center text-2xl mb-3 shadow-inner">
                            <i class="fa-solid fa-ticket-simple"></i>
                        </div>
                        <p class="font-bold text-gray-700 text-sm">Chưa có voucher khuyến mãi nào</p>
                        <p class="text-xs text-gray-400 mt-1">Bấm nút "Thêm Voucher Mới" để phát hành mã giảm giá cho khách hàng.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = "";
    promotions.forEach((p) => {
        const isDeleted = p.status === "deleted" || p.isDeleted === true;
        const isActive = !isDeleted && p.isActive !== false;

        let statusBadge = "";
        if (isDeleted) {
            statusBadge = `<span class="bg-red-100 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-200">🔴 Đã Xóa Mềm</span>`;
        } else if (isActive) {
            statusBadge = `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-200">🟢 Đang Áp Dụng</span>`;
        } else {
            statusBadge = `<span class="bg-gray-100 text-gray-500 text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-200">⚪ Tạm Dừng</span>`;
        }

        const discountStr = p.discountType === "percentage" 
            ? `<span class="font-extrabold text-primary text-sm">${p.discountValue}%</span>`
            : `<span class="font-extrabold text-primary text-sm">${(p.discountValue || 0).toLocaleString()}₫</span>`;

        const minOrder = (p.minOrderAmount || 0).toLocaleString() + "₫";
        const maxDiscount = (p.maxDiscountAmount || 0).toLocaleString() + "₫";

        const start = p.startDate ? p.startDate.split("T")[0] : "—";
        const end = p.endDate ? p.endDate.split("T")[0] : "—";

        const createdDate = p.createdAt ? p.createdAt.replace("T", " ").replace("Z", "") : "—";
        const updatedDate = p.updatedAt ? p.updatedAt.replace("T", " ").replace("Z", "") : createdDate;
        const deletedDate = p.deletedAt ? p.deletedAt.replace("T", " ").replace("Z", "") : null;

        const rowBg = isDeleted ? "bg-red-50/20 opacity-75" : "hover:bg-pink-50/20";

        html += `
            <tr class="${rowBg} transition border-b border-gray-100">
                <td class="p-3">
                    <div class="flex items-center space-x-2">
                        <span class="bg-pink-100 text-primary font-mono font-extrabold text-xs px-2.5 py-1 rounded-lg border border-pink-200 ${isDeleted ? 'line-through text-gray-400' : ''}">${p.code}</span>
                    </div>
                    <div class="font-bold text-gray-800 text-xs mt-1 ${isDeleted ? 'line-through text-gray-400' : ''}">${p.title}</div>
                    ${p.topBarMessage ? `<div class="text-[10px] text-amber-600 truncate max-w-[200px]" title="${p.topBarMessage}">📢 ${p.topBarMessage}</div>` : ''}
                </td>
                <td class="p-3">${discountStr}</td>
                <td class="p-3 text-[11px] text-gray-600">
                    <div>Đơn tối thiểu: <b>${minOrder}</b></div>
                    <div>Giảm tối đa: <b>${maxDiscount}</b></div>
                </td>
                <td class="p-3 text-[11px]">
                    <span class="font-bold text-gray-800">${p.usedCount || 0}</span> / <span class="text-gray-500">${p.usageLimit || 500}</span>
                </td>
                <td class="p-3 text-[11px] text-gray-500 font-mono">
                    <div>${start}</div>
                    <div>➔ ${end}</div>
                </td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3 text-[10px] text-gray-500 font-mono leading-tight">
                    <div><span class="text-gray-400">Tạo:</span> ${createdDate}</div>
                    <div><span class="text-gray-400">Sửa:</span> ${updatedDate}</div>
                    ${deletedDate ? `<div class="text-red-500 font-bold"><span>Xóa:</span> ${deletedDate}</div>` : ''}
                </td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center space-x-1.5">
                        ${!isDeleted ? `
                            <button onclick="editPromo('${p.id}')" title="Chỉnh sửa voucher" class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="togglePromo('${p.id}')" title="${isActive ? 'Tạm dừng voucher' : 'Kích hoạt voucher'}" class="px-2.5 py-1 ${isActive ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' : 'bg-green-50 hover:bg-green-100 text-green-700'} rounded-lg text-xs font-bold transition">
                                <i class="fa-solid ${isActive ? 'fa-pause' : 'fa-play'} mr-1"></i> ${isActive ? 'Dừng' : 'Bật'}
                            </button>
                            <button onclick="deletePromo('${p.id}', '${p.code}')" title="Xóa mềm voucher (vẫn lưu trong json)" class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        ` : `
                            <button onclick="restorePromo('${p.id}', '${p.code}')" title="Khôi phục voucher đã xóa mềm" class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center">
                                <i class="fa-solid fa-rotate-left mr-1"></i> Khôi Phục
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

export function openPromoModal(isEdit = false) {
    const modal = document.getElementById("promoModal");
    const title = document.getElementById("promoModalTitle");
    const err = document.getElementById("promoModalError");
    if (!modal) return;

    if (err) {
        err.textContent = "";
        err.classList.add("hidden");
    }

    if (!isEdit) {
        title.textContent = "Thêm Voucher Khuyến Mãi Mới";
        document.getElementById("editPromoId").value = "";
        document.getElementById("promoCode").value = "";
        document.getElementById("promoCode").disabled = false;
        document.getElementById("promoTitle").value = "";
        document.getElementById("promoDiscountType").value = "percentage";
        document.getElementById("promoDiscountValue").value = "15";
        document.getElementById("promoMinOrder").value = "300000";
        document.getElementById("promoMaxDiscount").value = "150000";
        document.getElementById("promoStartDate").value = "2026-01-01";
        document.getElementById("promoEndDate").value = "2026-12-31";
        document.getElementById("promoUsageLimit").value = "500";
        document.getElementById("promoTopBarMessage").value = "";
        document.getElementById("promoIsActive").checked = true;
    } else {
        title.textContent = "Chỉnh Sửa Voucher Khuyến Mãi";
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

export function closePromoModal() {
    const modal = document.getElementById("promoModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export function editPromo(promoId) {
    const promo = (allAdminPromotions || []).find((p) => p.id === promoId);
    if (!promo) return alert("Không tìm thấy dữ liệu voucher");

    openPromoModal(true);

    document.getElementById("editPromoId").value = promo.id;
    document.getElementById("promoCode").value = promo.code || "";
    document.getElementById("promoCode").disabled = true; // Không cho sửa code chính
    document.getElementById("promoTitle").value = promo.title || "";
    document.getElementById("promoDiscountType").value = promo.discountType || "percentage";
    document.getElementById("promoDiscountValue").value = promo.discountValue || 10;
    document.getElementById("promoMinOrder").value = promo.minOrderAmount || 0;
    document.getElementById("promoMaxDiscount").value = promo.maxDiscountAmount || 100000;
    document.getElementById("promoStartDate").value = promo.startDate ? promo.startDate.split("T")[0] : "2026-01-01";
    document.getElementById("promoEndDate").value = promo.endDate ? promo.endDate.split("T")[0] : "2026-12-31";
    document.getElementById("promoUsageLimit").value = promo.usageLimit || 500;
    document.getElementById("promoTopBarMessage").value = promo.topBarMessage || "";
    document.getElementById("promoIsActive").checked = promo.isActive !== false;
}

export async function handlePromoSubmit(event) {
    event.preventDefault();
    const btn = document.getElementById("btnSavePromo");
    const err = document.getElementById("promoModalError");
    const editId = document.getElementById("editPromoId").value.trim();
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    const payload = {
        code: document.getElementById("promoCode").value.trim().toUpperCase(),
        title: document.getElementById("promoTitle").value.trim(),
        discountType: document.getElementById("promoDiscountType").value,
        discountValue: parseInt(document.getElementById("promoDiscountValue").value, 10) || 10,
        minOrderAmount: parseInt(document.getElementById("promoMinOrder").value, 10) || 0,
        maxDiscountAmount: parseInt(document.getElementById("promoMaxDiscount").value, 10) || 100000,
        startDate: (document.getElementById("promoStartDate").value || "2026-01-01") + "T00:00:00Z",
        endDate: (document.getElementById("promoEndDate").value || "2026-12-31") + "T23:59:59Z",
        usageLimit: parseInt(document.getElementById("promoUsageLimit").value, 10) || 500,
        topBarMessage: document.getElementById("promoTopBarMessage").value.trim(),
        isActive: document.getElementById("promoIsActive").checked
    };

    if (btn) btn.disabled = true;
    lockScreen(editId ? "Đang cập nhật voucher..." : "Đang tạo voucher mới...");
    try {
        const url = editId ? `${API_BASE}/admin/promotions/${editId}` : `${API_BASE}/admin/promotions`;
        const method = editId ? "PUT" : "POST";

        const res = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (json.success) {
            closePromoModal();
            await loadAdminPromotions();
            notifyUser(editId ? "Đã cập nhật voucher thành công!" : "Đã tạo voucher mới thành công!", 'success');
        } else {
            const msg = json.message || "Lỗi lưu voucher";
            if (err) {
                err.textContent = "❌ " + msg;
                err.classList.remove("hidden");
            }
            notifyUser(`Lỗi lưu voucher: ${msg}`, 'error');
        }
    } catch (e) {
        if (err) {
            err.textContent = "❌ Lỗi kết nối: " + e.message;
            err.classList.remove("hidden");
        }
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
        unlockScreen();
    }
}

export async function togglePromo(promoId) {
    lockScreen("Đang cập nhật trạng thái...");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/promotions/${promoId}/toggle`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminPromotions();
            notifyUser("Đã cập nhật trạng thái voucher khuyến mãi thành công!", 'success');
        } else {
            notifyUser("Lỗi: " + (json.message || "Lỗi cập nhật trạng thái voucher"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

export async function deletePromo(promoId, promoCode) {
    const isConfirmed = await (typeof showConfirmDialog === 'function' ? showConfirmDialog : window.showConfirmDialog)({
        title: "Xác nhận Xóa Voucher",
        message: `Bạn có chắc chắn muốn xóa voucher khuyến mãi "${promoCode}" không?`,
        detail: "Dữ liệu voucher sẽ được chuyển sang trạng thái 'Đã xóa mềm' (Soft Deleted) và lưu trong hệ thống.",
        confirmText: "Xóa voucher",
        cancelText: "Hủy bỏ",
        type: "danger",
        icon: "fa-solid fa-trash"
    });
    if (!isConfirmed) return;

    lockScreen("Đang xóa voucher...");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/promotions/${promoId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminPromotions();
            notifyUser("Đã chuyển voucher sang trạng thái Đã Xóa thành công!", 'success');
        } else {
            notifyUser("Không thể xóa voucher: " + (json.message || ""), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

export async function restorePromo(promoId, promoCode) {
    lockScreen("Đang khôi phục voucher...");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/promotions/${promoId}/restore`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminPromotions();
            notifyUser(`Đã khôi phục voucher "${promoCode || promoId}" thành công!`, 'success');
        } else {
            notifyUser(json.message || "Lỗi khôi phục voucher", 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

// ==========================================
// QUẢN LÝ SẢN PHẨM KÈM THEO (ADD-ONS CMS)
// ==========================================

export async function loadAdminAddons() {
    const tbody = document.getElementById("addonsTableBody");
    if (!tbody) return;

    if (!allAdminAddons || allAdminAddons.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-400 font-medium"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải dữ liệu sản phẩm kèm theo...</td></tr>`;
    }

    try {
        const token = typeof getAuthToken === "function" ? getAuthToken() : "";
        const res = await fetch(`${API_BASE}/admin/addons`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success && json.data) {
            allAdminAddons = json.data;
            if (typeof window !== "undefined") window.allAdminAddons = allAdminAddons;
            renderAddonsTable(allAdminAddons);
        } else if (!allAdminAddons || allAdminAddons.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-red-500 font-bold">${json.message || "Không thể tải danh sách sản phẩm kèm theo"}</td></tr>`;
        }
    } catch (e) {
        if (!allAdminAddons || allAdminAddons.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-red-500 font-bold">Lỗi kết nối: ${e.message}</td></tr>`;
        }
    }
}

export function renderAddonsTable(addons) {
    const tbody = document.getElementById("addonsTableBody");
    if (!tbody) return;

    if (!Array.isArray(addons) || addons.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-12 text-center">
                    <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                        <div class="w-16 h-16 rounded-full bg-pink-50 text-pink-400 flex items-center justify-center text-2xl mb-3 shadow-inner">
                            <i class="fa-solid fa-gift"></i>
                        </div>
                        <p class="font-bold text-gray-700 text-sm">Chưa có sản phẩm kèm theo nào</p>
                        <p class="text-xs text-gray-400 mt-1">Bấm nút "Thêm Sản Phẩm Kèm Theo" để tạo add-on cho khách hàng.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = "";
    addons.forEach((a) => {
        const isDeleted = a.status === "deleted" || a.isDeleted === true;
        const isActive = !isDeleted && a.isActive !== false;

        let statusBadge = "";
        if (isDeleted) {
            statusBadge = `<span class="bg-red-100 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-200">🔴 Đã Xóa Mềm</span>`;
        } else if (isActive) {
            statusBadge = `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-200">🟢 Đang Hiển Thị</span>`;
        } else {
            statusBadge = `<span class="bg-gray-100 text-gray-500 text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-200">⚪ Đã Ẩn</span>`;
        }

        const priceStr = (a.price || 0).toLocaleString("vi-VN") + "₫";
        const createdDate = a.createdAt ? a.createdAt.replace("T", " ").replace("Z", "") : "—";
        const rowBg = isDeleted ? "bg-red-50/20 opacity-75" : "hover:bg-pink-50/20";

        html += `
            <tr class="${rowBg} transition border-b border-gray-100">
                <td class="p-3">
                    <div class="flex items-center space-x-2.5">
                        <img src="${a.image || ''}" alt="${a.name || ''}" onerror="this.style.display='none'" class="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0">
                        <div>
                            <div class="font-bold text-gray-800 text-xs ${isDeleted ? 'line-through text-gray-400' : ''}">${a.nameVi || a.name || ''}</div>
                            <div class="text-[10px] text-gray-400 font-mono">${a.id}</div>
                        </div>
                    </div>
                </td>
                <td class="p-3 text-[11px] text-gray-600 capitalize">${a.category || '—'}</td>
                <td class="p-3 font-extrabold text-primary text-sm">${priceStr}</td>
                <td class="p-3 text-[11px] text-gray-600">${a.sortOrder || 0}</td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3 text-[10px] text-gray-500 font-mono">${createdDate}</td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center space-x-1.5">
                        ${!isDeleted ? `
                            <button onclick="editAddon('${a.id}')" title="Chỉnh sửa add-on" class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="toggleAddon('${a.id}')" title="${isActive ? 'Ẩn add-on' : 'Hiển thị add-on'}" class="px-2.5 py-1 ${isActive ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' : 'bg-green-50 hover:bg-green-100 text-green-700'} rounded-lg text-xs font-bold transition">
                                <i class="fa-solid ${isActive ? 'fa-eye-slash' : 'fa-eye'} mr-1"></i> ${isActive ? 'Ẩn' : 'Hiện'}
                            </button>
                            <button onclick="deleteAddon('${a.id}', '${(a.nameVi || a.name || '').replace(/'/g, "\\'")}')" title="Xóa mềm add-on" class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        ` : `
                            <button onclick="restoreAddon('${a.id}')" title="Khôi phục add-on đã xóa mềm" class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center">
                                <i class="fa-solid fa-rotate-left mr-1"></i> Khôi Phục
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

export function openAddonModal(isEdit = false) {
    const modal = document.getElementById("addonModal");
    const title = document.getElementById("addonModalTitle");
    const err = document.getElementById("addonModalError");
    if (!modal) return;

    if (err) {
        err.textContent = "";
        err.classList.add("hidden");
    }

    if (!isEdit) {
        title.textContent = "Thêm Sản Phẩm Kèm Theo Mới";
        document.getElementById("editAddonId").value = "";
        document.getElementById("addonName").value = "";
        document.getElementById("addonNameVi").value = "";
        document.getElementById("addonCategory").value = "gift";
        document.getElementById("addonPrice").value = "";
        document.getElementById("addonImage").value = "";
        document.getElementById("addonDescription").value = "";
        document.getElementById("addonSortOrder").value = "1";
        document.getElementById("addonIsActive").checked = true;
        const prevNew = document.getElementById("addonImagePreview");
        if (prevNew) prevNew.src = "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=200";
        const statusNew = document.getElementById("addonImageStatusLabel");
        if (statusNew) {
            statusNew.textContent = "URL Web";
            statusNew.className = "text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md";
        }
        const sizeNew = document.getElementById("addonImageSizeInfo");
        if (sizeNew) sizeNew.textContent = "";
    } else {
        title.textContent = "Chỉnh Sửa Sản Phẩm Kèm Theo";
    }

    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

export function closeAddonModal() {
    const modal = document.getElementById("addonModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export function editAddon(addonId) {
    const addon = (allAdminAddons || []).find((a) => a.id === addonId);
    if (!addon) return alert("Không tìm thấy dữ liệu add-on");

    openAddonModal(true);

    document.getElementById("editAddonId").value = addon.id;
    document.getElementById("addonName").value = addon.name || "";
    document.getElementById("addonNameVi").value = addon.nameVi || "";
    document.getElementById("addonCategory").value = addon.category || "gift";
    document.getElementById("addonPrice").value = addon.price || "";
    document.getElementById("addonImage").value = addon.image || "";
    document.getElementById("addonDescription").value = addon.description || "";
    document.getElementById("addonSortOrder").value = addon.sortOrder || 1;
    document.getElementById("addonIsActive").checked = addon.isActive !== false;
    const prevEdit = document.getElementById("addonImagePreview");
    if (prevEdit) prevEdit.src = addon.image || "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=200";
    const statusEdit = document.getElementById("addonImageStatusLabel");
    if (statusEdit) {
        statusEdit.textContent = addon.image ? "URL Web" : "Chưa có ảnh";
        statusEdit.className = "text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md";
    }
    const sizeEdit = document.getElementById("addonImageSizeInfo");
    if (sizeEdit) sizeEdit.textContent = "";
}

export async function handleAddonSubmit(event) {
    event.preventDefault();
    const btn = document.getElementById("btnSaveAddon");
    const err = document.getElementById("addonModalError");
    const editId = document.getElementById("editAddonId").value.trim();
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    const payload = {
        name: document.getElementById("addonName").value.trim(),
        nameVi: document.getElementById("addonNameVi").value.trim(),
        category: document.getElementById("addonCategory").value,
        price: parseInt(document.getElementById("addonPrice").value, 10) || 0,
        image: document.getElementById("addonImage").value.trim(),
        description: document.getElementById("addonDescription").value.trim(),
        sortOrder: parseInt(document.getElementById("addonSortOrder").value, 10) || 1,
        isActive: document.getElementById("addonIsActive").checked
    };

    if (btn) btn.disabled = true;
    lockScreen(editId ? "Đang cập nhật add-on..." : "Đang tạo add-on mới...");
    try {
        const url = editId ? `${API_BASE}/admin/addons/${editId}` : `${API_BASE}/admin/addons`;
        const method = editId ? "PUT" : "POST";

        const res = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (json.success) {
            closeAddonModal();
            await loadAdminAddons();
            if (typeof window !== 'undefined' && typeof window.reloadAddonsIfChanged === 'function') {
                window.reloadAddonsIfChanged(true).catch(() => {});
            }
            notifyUser(editId ? "Đã cập nhật add-on thành công!" : "Đã tạo add-on mới thành công!", 'success');
        } else {
            const msg = json.message || "Lỗi lưu add-on";
            if (err) {
                err.textContent = "❌ " + msg;
                err.classList.remove("hidden");
            }
            notifyUser(`Lỗi lưu add-on: ${msg}`, 'error');
        }
    } catch (e) {
        if (err) {
            err.textContent = "❌ Lỗi kết nối: " + e.message;
            err.classList.remove("hidden");
        }
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
        unlockScreen();
    }
}

/**
 * Tải ảnh Add-On lên máy chủ (lưu vào thư mục ảnh giống sản phẩm hoa).
 * Dự phòng: nén Base64 khi không gọi được API upload.
 */
export async function handleAddonImageFileUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    const previewImg = document.getElementById("addonImagePreview");
    const inputStr = document.getElementById("addonImage");
    const statusLabel = document.getElementById("addonImageStatusLabel");
    const sizeInfo = document.getElementById("addonImageSizeInfo");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";

    if (statusLabel) {
        statusLabel.textContent = "⏳ Đang tải ảnh lên máy chủ...";
        statusLabel.className = "text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block";
    }

    try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("prefix", "addon");

        const res = await fetch(`${API_BASE}/admin/upload-image`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData
        });

        const json = await res.json();
        if (res.ok && json.success && json.data?.url) {
            const uploadedUrl = json.data.url;
            if (inputStr) inputStr.value = uploadedUrl;
            if (previewImg) previewImg.src = uploadedUrl;
            if (statusLabel) {
                statusLabel.textContent = "🟢 Đã Lưu Vào Thư Mục Tĩnh";
                statusLabel.className = "text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md inline-block";
            }
            if (sizeInfo) sizeInfo.textContent = `URL: ${uploadedUrl} (${(file.size / 1024).toFixed(1)} KB)`;
            notifyUser(`Tải ảnh "${file.name}" lên thành công!`, "success");
        } else {
            const base64String = await compressAndConvertToBase64(file, 800, 800, 0.82);
            if (inputStr) inputStr.value = base64String;
            if (previewImg) previewImg.src = base64String;
            if (statusLabel) {
                statusLabel.textContent = "🟡 Ảnh Base64 Tạm";
                statusLabel.className = "text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block";
            }
        }
    } catch (err) {
        try {
            const base64String = await compressAndConvertToBase64(file, 800, 800, 0.82);
            if (inputStr) inputStr.value = base64String;
            if (previewImg) previewImg.src = base64String;
            if (statusLabel) {
                statusLabel.textContent = "🟡 Ảnh Base64 Tạm";
                statusLabel.className = "text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block";
            }
        } catch (e2) {
            alert("Lỗi xử lý ảnh: " + err.message);
        }
    }
}

export async function toggleAddon(addonId) {
    lockScreen("Đang cập nhật trạng thái...");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/addons/${addonId}/toggle`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminAddons();
            if (typeof window !== 'undefined' && typeof window.reloadAddonsIfChanged === 'function') {
                window.reloadAddonsIfChanged(true).catch(() => {});
            }
            notifyUser("Đã cập nhật trạng thái hiển thị add-on thành công!", 'success');
        } else {
            notifyUser("Lỗi: " + (json.message || "Lỗi cập nhật trạng thái add-on"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

export async function deleteAddon(addonId, addonName) {
    const isConfirmed = await (typeof showConfirmDialog === 'function' ? showConfirmDialog : window.showConfirmDialog)({
        title: "Xác nhận Xóa Add-On",
        message: `Bạn có chắc chắn muốn xóa sản phẩm kèm theo "${addonName}" không?`,
        detail: "Dữ liệu add-on sẽ được chuyển sang trạng thái 'Đã xóa mềm' (Soft Deleted) và lưu trong hệ thống.",
        confirmText: "Xóa add-on",
        cancelText: "Hủy bỏ",
        type: "danger",
        icon: "fa-solid fa-trash"
    });
    if (!isConfirmed) return;

    lockScreen("Đang xóa add-on...");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/addons/${addonId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminAddons();
            if (typeof window !== 'undefined' && typeof window.reloadAddonsIfChanged === 'function') {
                window.reloadAddonsIfChanged(true).catch(() => {});
            }
            notifyUser("Đã chuyển add-on sang trạng thái Đã Xóa thành công!", 'success');
        } else {
            notifyUser("Không thể xóa add-on: " + (json.message || ""), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

export async function restoreAddon(addonId) {
    lockScreen("Đang khôi phục add-on...");
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/addons/${addonId}/restore`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            await loadAdminAddons();
            if (typeof window !== 'undefined' && typeof window.reloadAddonsIfChanged === 'function') {
                window.reloadAddonsIfChanged(true).catch(() => {});
            }
            notifyUser(`Đã khôi phục add-on thành công!`, 'success');
        } else {
            notifyUser(json.message || "Lỗi khôi phục add-on", 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

if (typeof window !== "undefined") {
    // Promotions & Vouchers
    window.loadAdminPromotions = loadAdminPromotions;
    window.openPromoModal = openPromoModal;
    window.closePromoModal = closePromoModal;
    window.editPromo = editPromo;
    window.handlePromoSubmit = handlePromoSubmit;
    window.togglePromo = togglePromo;
    window.deletePromo = deletePromo;
    window.restorePromo = restorePromo;

    // Add-Ons (Sản Phẩm Kèm Theo)
    window.loadAdminAddons = loadAdminAddons;
    window.openAddonModal = openAddonModal;
    window.closeAddonModal = closeAddonModal;
    window.editAddon = editAddon;
    window.handleAddonSubmit = handleAddonSubmit;
    window.handleAddonImageFileUpload = handleAddonImageFileUpload;
    window.toggleAddon = toggleAddon;
    window.deleteAddon = deleteAddon;
    window.restoreAddon = restoreAddon;
}
