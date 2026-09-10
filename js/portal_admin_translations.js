import { getAuthToken } from './auth.js';
import { API_BASE, showConfirmDialog } from './utils.js';
import { lockScreen, unlockScreen, notifyUser, allAdminTranslations } from './portal_admin_state.js';

// ==========================================
// BIÊN DỊCH ĐA NGÔN NGỮ ĐỘNG (Single Key Selector & Matrix View)
// ==========================================

export let currentSelectedTransKey = "";
export let currentFilteredTransKeys = [];

export async function loadAdminTranslations() {
    const badge = document.getElementById("transStatusBadge");
    if (badge) {
        badge.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1 text-[8px]"></i> Đang tải từ điển...`;
        badge.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200";
    }

    try {
        const res = await fetch(`${API_BASE}/translations?_t=${Date.now()}`);
        const json = await res.json();
        if (json.success && json.data) {
            allAdminTranslations = json.data.translations || {};
            if (typeof window !== "undefined") window.allAdminTranslations = allAdminTranslations;
            
            // Khởi tạo danh sách dropdown và bảng
            populateTranslationKeyDropdown(allAdminTranslations);
            renderTranslationsTable(allAdminTranslations);
            
            if (badge) {
                const count = Object.keys(allAdminTranslations).length;
                badge.innerHTML = `<i class="fa-solid fa-circle-check mr-1 text-[8px] text-green-500"></i> ${count} khóa • Sẵn sàng`;
                badge.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200";
            }
        }
    } catch (e) {
        console.error("Lỗi tải từ điển:", e);
        const tbody = document.getElementById("translationsTableBody");
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold">Lỗi tải từ điển: ${e.message}</td></tr>`;
        if (badge) {
            badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1 text-[8px] text-red-500"></i> Lỗi kết nối`;
            badge.className = "inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200";
        }
    }
}

export function populateTranslationKeyDropdown(transObj, filterQuery = "") {
    const select = document.getElementById("selectTranslationKey");
    if (!select) return;

    const allKeys = Object.keys(transObj || {}).sort();
    const q = (filterQuery || "").trim().toLowerCase();
    
    currentFilteredTransKeys = q ? allKeys.filter(k => k.toLowerCase().includes(q)) : allKeys;

    let html = "";
    if (currentFilteredTransKeys.length === 0) {
        html = `<option value="">(Không tìm thấy Text ID nào khớp với "${filterQuery}")</option>`;
    } else {
        currentFilteredTransKeys.forEach((key, idx) => {
            const row = transObj[key] || {};
            const viPreview = (row.vi || "").slice(0, 35) + ((row.vi || "").length > 35 ? "..." : "");
            html += `<option value="${key}">[${idx + 1}/${currentFilteredTransKeys.length}] ${key} — "${viPreview || 'Chưa dịch'}"</option>`;
        });
    }
    select.innerHTML = html;

    // Cập nhật key đang chọn
    if (currentFilteredTransKeys.length > 0) {
        if (!currentSelectedTransKey || !currentFilteredTransKeys.includes(currentSelectedTransKey)) {
            currentSelectedTransKey = currentFilteredTransKeys[0];
        }
        select.value = currentSelectedTransKey;
        loadSingleKeyIntoEditor(currentSelectedTransKey);
    } else {
        currentSelectedTransKey = "";
        clearSingleKeyEditor();
    }
    updateTransKeyCounter();
}

export function onSelectTranslationKeyChange(key) {
    if (!key) return;
    currentSelectedTransKey = key;
    loadSingleKeyIntoEditor(key);
    updateTransKeyCounter();
    console.log(`🔤 [TRANSLATION_GUI] Đang chỉnh sửa Text ID: "${key}"`);
}

export function onFilterTransKeyDropdown(query) {
    populateTranslationKeyDropdown(allAdminTranslations, query);
}

export function navigateTransKey(direction) {
    if (!currentFilteredTransKeys || currentFilteredTransKeys.length === 0) return;
    let idx = currentFilteredTransKeys.indexOf(currentSelectedTransKey);
    if (idx === -1) idx = 0;
    
    idx += direction;
    if (idx < 0) idx = currentFilteredTransKeys.length - 1;
    if (idx >= currentFilteredTransKeys.length) idx = 0;

    const nextKey = currentFilteredTransKeys[idx];
    const select = document.getElementById("selectTranslationKey");
    if (select) select.value = nextKey;
    onSelectTranslationKeyChange(nextKey);
}

function updateTransKeyCounter() {
    const counter = document.getElementById("transKeyCounter");
    if (!counter) return;
    if (!currentFilteredTransKeys || currentFilteredTransKeys.length === 0) {
        counter.textContent = "0 / 0 khóa";
        return;
    }
    const idx = currentFilteredTransKeys.indexOf(currentSelectedTransKey);
    counter.textContent = `${idx >= 0 ? idx + 1 : 1} / ${currentFilteredTransKeys.length} khóa`;
}

function loadSingleKeyIntoEditor(key) {
    const badge = document.getElementById("currentEditingKeyBadge");
    if (badge) badge.textContent = key || "—";

    const data = (allAdminTranslations && allAdminTranslations[key]) || {};
    const keyType = data.type || "system";

    const typeBadge = document.getElementById("currentEditingKeyTypeBadge");
    const btnDelete = document.getElementById("btnDeleteCurrentTransKey");

    if (typeBadge) {
        if (keyType === "user") {
            typeBadge.textContent = "👤 user";
            typeBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono bg-purple-50 text-purple-700 border-purple-200";
        } else {
            typeBadge.textContent = "🔒 system";
            typeBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono bg-gray-100 text-gray-600 border-gray-200";
        }
    }

    if (btnDelete) {
        if (keyType === "user") {
            btnDelete.classList.remove("hidden");
            btnDelete.classList.add("flex");
        } else {
            btnDelete.classList.add("hidden");
            btnDelete.classList.remove("flex");
        }
    }

    const setVal = (lang, val) => {
        const el = document.getElementById(`singleTransInput_${lang}`);
        if (el) el.value = val || "";
    };

    setVal("vi", data.vi || "");
    setVal("en", data.en || "");
    setVal("ja", data.ja || "");
    setVal("ko", data.ko || "");
    setVal("zh", data.zh || "");
}

function clearSingleKeyEditor() {
    const badge = document.getElementById("currentEditingKeyBadge");
    if (badge) badge.textContent = "—";
    const typeBadge = document.getElementById("currentEditingKeyTypeBadge");
    if (typeBadge) {
        typeBadge.textContent = "—";
        typeBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono";
    }
    const btnDelete = document.getElementById("btnDeleteCurrentTransKey");
    if (btnDelete) {
        btnDelete.classList.add("hidden");
        btnDelete.classList.remove("flex");
    }
    ["vi", "en", "ja", "ko", "zh"].forEach(lang => {
        const el = document.getElementById(`singleTransInput_${lang}`);
        if (el) el.value = "";
    });
}

export function syncSingleKeyInputToDictionary() {
    if (!currentSelectedTransKey) return;
    if (!allAdminTranslations[currentSelectedTransKey]) {
        allAdminTranslations[currentSelectedTransKey] = {};
    }
    const getVal = (lang) => {
        const el = document.getElementById(`singleTransInput_${lang}`);
        return el ? el.value : "";
    };

    const existingType = allAdminTranslations[currentSelectedTransKey]?.type || "system";

    allAdminTranslations[currentSelectedTransKey] = {
        type: existingType,
        vi: getVal("vi"),
        en: getVal("en"),
        ja: getVal("ja"),
        ko: getVal("ko"),
        zh: getVal("zh")
    };
}

export async function saveCurrentSingleTranslationKey() {
    if (!currentSelectedTransKey) {
        notifyUser("Vui lòng chọn một Text ID để lưu!", "warning");
        return;
    }
    syncSingleKeyInputToDictionary();

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen(`Đang lưu bản dịch Text ID "${currentSelectedTransKey}"...`);
    try {
        const res = await fetch(`${API_BASE}/admin/translations`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify(allAdminTranslations)
        });

        const json = await res.json();
        if (res.ok && json.success) {
            notifyUser(`Đã lưu bản dịch cho Text ID "${currentSelectedTransKey}" thành công!`, 'success');
            const q = document.getElementById("filterTransKeyInput") ? document.getElementById("filterTransKeyInput").value : "";
            populateTranslationKeyDropdown(allAdminTranslations, q);
            renderTranslationsTable(allAdminTranslations);
        } else {
            notifyUser("Lỗi lưu bản dịch: " + (json.message || "Không xác định"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

export function openAddNewTranslationKeyModal() {
    const modal = document.getElementById("addTranslationKeyModal");
    const input = document.getElementById("newTransKeyInput");
    const errBox = document.getElementById("addTransKeyError");
    if (!modal) return;
    if (errBox) errBox.classList.add("hidden");
    if (input) {
        input.value = "";
        setTimeout(() => input.focus(), 100);
    }
    modal.style.display = "flex";
    modal.classList.remove("hidden");
}

export function closeAddNewTranslationKeyModal() {
    const modal = document.getElementById("addTranslationKeyModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

export async function handleAddNewTranslationKeySubmit(event) {
    if (event) event.preventDefault();
    const input = document.getElementById("newTransKeyInput");
    const errBox = document.getElementById("addTransKeyError");
    const rawKey = (input ? input.value : "").trim().toLowerCase().replace(/\s+/g, "_");

    if (!rawKey) {
        if (errBox) {
            errBox.textContent = "Vui lòng nhập mã Text ID!";
            errBox.classList.remove("hidden");
        }
        return;
    }

    if (!/^[a-z0-9_]+$/.test(rawKey)) {
        if (errBox) {
            errBox.textContent = "Mã Text ID chỉ gồm chữ cái thường, số và dấu gạch dưới!";
            errBox.classList.remove("hidden");
        }
        return;
    }

    if (allAdminTranslations && allAdminTranslations[rawKey]) {
        if (errBox) {
            errBox.textContent = `Mã Text ID "${rawKey}" đã tồn tại trong từ điển!`;
            errBox.classList.remove("hidden");
        }
        return;
    }

    // Tự động gán type là 'user' và khởi tạo giá trị 5 ngôn ngữ bằng chính rawKey
    allAdminTranslations[rawKey] = {
        type: "user",
        vi: rawKey,
        en: rawKey,
        ja: rawKey,
        ko: rawKey,
        zh: rawKey
    };

    closeAddNewTranslationKeyModal();
    lockScreen(`Đang khởi tạo Text ID "${rawKey}"...`);

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/translations`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify(allAdminTranslations)
        });

        const json = await res.json();
        if (res.ok && json.success) {
            notifyUser(`Đã thêm Text ID "${rawKey}" thành công! Hãy nhập nội dung dịch cho các ngôn ngữ.`, 'success');
            currentSelectedTransKey = rawKey;
            populateTranslationKeyDropdown(allAdminTranslations);
            const select = document.getElementById("selectTranslationKey");
            if (select) select.value = rawKey;
            onSelectTranslationKeyChange(rawKey);
            renderTranslationsTable(allAdminTranslations);
        } else {
            notifyUser("Lỗi thêm khóa bản dịch: " + (json.message || "Không xác định"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

export async function deleteCurrentTranslationKey() {
    if (!currentSelectedTransKey) return;
    const currentData = allAdminTranslations[currentSelectedTransKey] || {};
    const keyType = currentData.type || "system";

    if (keyType === "system") {
        notifyUser(`Khóa "${currentSelectedTransKey}" là khóa Hệ Thống, không thể xóa!`, 'error');
        return;
    }

    const confirmFn = typeof showConfirmDialog === "function" ? showConfirmDialog : (window.showConfirmDialog || confirm);
    const confirmed = await confirmFn({
        title: "Xác nhận Xóa Text ID",
        message: `Bạn có chắc chắn muốn xóa vĩnh viễn khóa bản dịch "${currentSelectedTransKey}" không?`,
        detail: "Khóa này thuộc loại User và sẽ bị xóa khỏi toàn bộ từ điển 5 ngôn ngữ.",
        confirmText: "Xóa Khóa",
        cancelText: "Hủy bỏ",
        type: "danger",
        icon: "fa-solid fa-trash"
    });
    if (!confirmed) return;

    lockScreen(`Đang xóa khóa bản dịch "${currentSelectedTransKey}"...`);
    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    try {
        const res = await fetch(`${API_BASE}/admin/translations/${currentSelectedTransKey}`, {
            method: "DELETE",
            headers: {
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            }
        });

        const json = await res.json();
        if (res.ok && json.success) {
            delete allAdminTranslations[currentSelectedTransKey];
            notifyUser(`Đã xóa khóa "${currentSelectedTransKey}" thành công!`, 'success');
            currentSelectedTransKey = "";
            populateTranslationKeyDropdown(allAdminTranslations);
            renderTranslationsTable(allAdminTranslations);
        } else {
            notifyUser("Lỗi xóa khóa bản dịch: " + (json.message || "Không xác định"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

function renderTranslationsTable(transObj) {
    const tbody = document.getElementById("translationsTableBody");
    if (!tbody) return;

    let html = "";
    Object.keys(transObj).forEach((k) => {
        const row = transObj[k] || {};
        html += `
            <tr class="hover:bg-gray-50/60 transition translation-row" data-key="${k}">
                <td class="p-3 font-bold text-gray-700 text-[11px] font-mono">${k}</td>
                <td class="p-2"><input type="text" value="${(row.vi || '').replace(/"/g, '&quot;')}" class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-primary i18n-input" data-key="${k}" data-lang="vi"></td>
                <td class="p-2"><input type="text" value="${(row.en || '').replace(/"/g, '&quot;')}" class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-primary i18n-input" data-key="${k}" data-lang="en"></td>
                <td class="p-2"><input type="text" value="${(row.ja || '').replace(/"/g, '&quot;')}" class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-primary i18n-input" data-key="${k}" data-lang="ja"></td>
                <td class="p-2"><input type="text" value="${(row.ko || '').replace(/"/g, '&quot;')}" class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-primary i18n-input" data-key="${k}" data-lang="ko"></td>
                <td class="p-2"><input type="text" value="${(row.zh || '').replace(/"/g, '&quot;')}" class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-primary i18n-input" data-key="${k}" data-lang="zh"></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

export function filterTranslations() {
    const input = document.getElementById("searchTranslationKey");
    const query = (input ? input.value : "").trim().toLowerCase();
    const rows = document.querySelectorAll(".translation-row");

    rows.forEach((r) => {
        const key = r.getAttribute("data-key") || "";
        if (key.toLowerCase().includes(query)) {
            r.classList.remove("hidden");
        } else {
            r.classList.add("hidden");
        }
    });
}

export function switchTransViewMode(mode) {
    const singleView = document.getElementById("transSingleKeyView");
    const tableView = document.getElementById("transFullTableView");
    const btnSingle = document.getElementById("btnTransViewSingle");
    const btnTable = document.getElementById("btnTransViewTable");

    if (mode === "single") {
        if (singleView) singleView.classList.remove("hidden");
        if (tableView) tableView.classList.add("hidden");
        if (btnSingle) {
            btnSingle.className = "px-3 py-1.5 font-bold rounded-lg bg-white text-primary shadow-xs transition flex items-center gap-1";
        }
        if (btnTable) {
            btnTable.className = "px-3 py-1.5 font-bold rounded-lg text-gray-600 hover:text-gray-900 transition flex items-center gap-1";
        }
    } else {
        if (singleView) singleView.classList.add("hidden");
        if (tableView) tableView.classList.remove("hidden");
        if (btnSingle) {
            btnSingle.className = "px-3 py-1.5 font-bold rounded-lg text-gray-600 hover:text-gray-900 transition flex items-center gap-1";
        }
        if (btnTable) {
            btnTable.className = "px-3 py-1.5 font-bold rounded-lg bg-white text-primary shadow-xs transition flex items-center gap-1";
        }
    }
}

export async function saveAllTranslations() {
    syncSingleKeyInputToDictionary();

    const inputs = document.querySelectorAll(".i18n-input");
    inputs.forEach((inp) => {
        const key = inp.getAttribute("data-key");
        const lang = inp.getAttribute("data-lang");
        const val = inp.value;

        if (!allAdminTranslations[key]) allAdminTranslations[key] = {};
        allAdminTranslations[key][lang] = val;
    });

    const token = typeof getAuthToken === "function" ? getAuthToken() : "";
    lockScreen("Đang lưu toàn bộ từ điển đa ngôn ngữ (5 ngôn ngữ)...");
    try {
        const res = await fetch(`${API_BASE}/admin/translations`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify(allAdminTranslations)
        });

        const json = await res.json();
        if (res.ok && json.success) {
            notifyUser("Đã lưu toàn bộ bản dịch 5 ngôn ngữ thành công!", 'success');
            const q = document.getElementById("filterTransKeyInput") ? document.getElementById("filterTransKeyInput").value : "";
            populateTranslationKeyDropdown(allAdminTranslations, q);
            renderTranslationsTable(allAdminTranslations);
        } else {
            notifyUser("Lỗi lưu bản dịch: " + (json.message || "Không xác định"), 'error');
        }
    } catch (e) {
        notifyUser("Lỗi kết nối máy chủ: " + e.message, 'error');
    } finally {
        unlockScreen();
    }
}

if (typeof window !== "undefined") {
    window.loadAdminTranslations = loadAdminTranslations;
    window.populateTranslationKeyDropdown = populateTranslationKeyDropdown;
    window.onSelectTranslationKeyChange = onSelectTranslationKeyChange;
    window.onFilterTransKeyDropdown = onFilterTransKeyDropdown;
    window.navigateTransKey = navigateTransKey;
    window.syncSingleKeyInputToDictionary = syncSingleKeyInputToDictionary;
    window.saveCurrentSingleTranslationKey = saveCurrentSingleTranslationKey;
    window.switchTransViewMode = switchTransViewMode;
    window.openAddNewTranslationKeyModal = openAddNewTranslationKeyModal;
    window.closeAddNewTranslationKeyModal = closeAddNewTranslationKeyModal;
    window.handleAddNewTranslationKeySubmit = handleAddNewTranslationKeySubmit;
    window.deleteCurrentTranslationKey = deleteCurrentTranslationKey;
    window.filterTranslations = filterTranslations;
    window.saveAllTranslations = saveAllTranslations;
}
