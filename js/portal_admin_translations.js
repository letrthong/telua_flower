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

/**
 * Kiểm tra tính hợp lệ của định danh Text ID:
 * - Không rỗng, độ dài <= 100
 * - Chỉ cho phép chữ cái (a-z, A-Z), số (0-9), gạch dưới (_), gạch ngang (-), chấm (.)
 */
export function isValidTextId(textId) {
    if (!textId || typeof textId !== "string") return false;
    const clean = textId.trim();
    if (!clean || clean.length > 100) return false;
    return /^[a-zA-Z0-9_\-\.]+$/.test(clean);
}

/**
 * Kiểm tra định dạng cấu trúc tệp JSON và tính hợp lệ của Text ID và các trường ngôn ngữ
 * @param {string} jsonStr - Chuỗi JSON tải lên
 * @param {string} expectedKey - Khóa Text ID đang được mở (nếu có)
 * @returns {{ valid: boolean, error?: string, textId?: string, type?: string, translations?: Object }}
 */
export function validateAndParseTranslationJson(jsonStr, expectedKey = "") {
    if (!jsonStr || typeof jsonStr !== "string" || !jsonStr.trim()) {
        return { valid: false, error: "Nội dung tệp JSON hoàn toàn rỗng!" };
    }

    let parsed;
    try {
        parsed = JSON.parse(jsonStr);
    } catch (e) {
        return { valid: false, error: `Cú pháp JSON không hợp lệ: ${e.message}` };
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { valid: false, error: "Dữ liệu JSON phải là một đối tượng (Object), không được là mảng hay giá trị nguyên thủy!" };
    }

    let resolvedTextId = "";
    let transMap = {};
    let resolvedType = "system";

    // Phân tích các trường hợp cấu trúc JSON phổ biến:
    // Trường hợp 1: { textId: "nav_home", translations: { vi: "...", en: "..." } } hoặc { text_id: "..." }
    const explicitId = parsed.textId || parsed.text_id || parsed.id;
    if (explicitId && typeof explicitId === "string") {
        resolvedTextId = explicitId.trim();
        resolvedType = parsed.type || "system";
        if (parsed.translations && typeof parsed.translations === "object" && !Array.isArray(parsed.translations)) {
            transMap = parsed.translations;
        } else {
            transMap = parsed;
        }
    }
    // Trường hợp 2: { "nav_home": { vi: "...", en: "..." } } (khớp với expectedKey)
    else if (expectedKey && parsed[expectedKey] && typeof parsed[expectedKey] === "object" && !Array.isArray(parsed[expectedKey])) {
        resolvedTextId = expectedKey;
        transMap = parsed[expectedKey];
        resolvedType = transMap.type || "system";
    }
    // Trường hợp 3: Trực tiếp chứa các khóa ngôn ngữ: { vi: "...", en: "...", ja: "...", ko: "...", zh: "..." }
    else {
        const keys = Object.keys(parsed);
        const langKeys = ["vi", "en", "ja", "ko", "zh"];
        const hasDirectLangKeys = keys.some(k => langKeys.includes(k));

        if (hasDirectLangKeys) {
            resolvedTextId = expectedKey;
            transMap = parsed;
            resolvedType = parsed.type || "system";
        } else if (keys.length === 1 && typeof parsed[keys[0]] === "object" && !Array.isArray(parsed[keys[0]])) {
            // Đúng 1 key con duy nhất: { "key_name": { vi: "...", en: "..." } }
            resolvedTextId = keys[0];
            transMap = parsed[keys[0]];
            resolvedType = transMap.type || "system";
        } else {
            return {
                valid: false,
                error: "Không nhận diện được Text ID hoặc khóa ngôn ngữ (vi, en, ja, ko, zh) trong tệp JSON!"
            };
        }
    }

    // 1. Kiểm tra định danh Text ID hợp lệ
    if (!resolvedTextId) {
        return { valid: false, error: "Thiếu định danh Text ID (ví dụ: 'textId': 'nav_home')!" };
    }

    if (!isValidTextId(resolvedTextId)) {
        return {
            valid: false,
            error: `Định danh Text ID "${resolvedTextId}" không hợp lệ! Chỉ được phép chứa chữ cái (a-z, A-Z), số (0-9), dấu gạch dưới (_), gạch ngang (-) hoặc dấu chấm (.), tối đa 100 ký tự.`
        };
    }

    // 2. Kiểm tra các trường ngôn ngữ
    const validLangs = ["vi", "en", "ja", "ko", "zh"];
    const extractedTranslations = {};
    let validLangCount = 0;

    for (const lang of validLangs) {
        if (transMap[lang] !== undefined && transMap[lang] !== null) {
            if (typeof transMap[lang] !== "string") {
                return {
                    valid: false,
                    error: `Trường ngôn ngữ '${lang}' phải là chuỗi văn bản (String), nhận được kiểu: ${typeof transMap[lang]}!`
                };
            }
            extractedTranslations[lang] = transMap[lang].trim();
            validLangCount++;
        } else {
            extractedTranslations[lang] = "";
        }
    }

    if (validLangCount === 0) {
        return {
            valid: false,
            error: "Tệp JSON không chứa bất kỳ trường ngôn ngữ hợp lệ nào (vi, en, ja, ko, zh)!"
        };
    }

    return {
        valid: true,
        textId: resolvedTextId,
        type: resolvedType,
        translations: extractedTranslations
    };
}

/**
 * Tải xuống tệp JSON cho Text ID hiện tại đang chọn
 */
export function downloadCurrentTranslationKeyJson() {
    if (!currentSelectedTransKey) {
        notifyUser("Vui lòng chọn một Text ID trước khi tải JSON!", "warning");
        return;
    }
    syncSingleKeyInputToDictionary();
    const data = allAdminTranslations[currentSelectedTransKey] || {};

    const exportPayload = {
        textId: currentSelectedTransKey,
        type: data.type || "system",
        translations: {
            vi: data.vi || "",
            en: data.en || "",
            ja: data.ja || "",
            ko: data.ko || "",
            zh: data.zh || ""
        },
        exportedAt: new Date().toISOString()
    };

    const jsonStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `translation_${currentSelectedTransKey}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notifyUser(`Đã xuất file translation_${currentSelectedTransKey}.json thành công!`, "success");
}

/**
 * Kích hoạt hộp thoại chọn file JSON upload cho Text ID
 */
export function triggerUploadTranslationKeyJson() {
    const fileInput = document.getElementById("transKeyJsonFileInput");
    if (fileInput) {
        fileInput.value = "";
        fileInput.click();
    }
}

/**
 * Xử lý khi người dùng chọn file JSON để cập nhật bản dịch Text ID
 */
export async function handleUploadTranslationKeyJson(event) {
    const file = event.target?.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
        notifyUser("Định dạng tệp không hợp lệ! Vui lòng chọn tệp tin đuôi .json", "error");
        return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB
        notifyUser("Dung lượng tệp vượt quá giới hạn cho phép (tối đa 2MB)!", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const content = e.target.result;
        const validation = validateAndParseTranslationJson(content, currentSelectedTransKey);

        if (!validation.valid) {
            notifyUser(`Lỗi kiểm tra định dạng: ${validation.error}`, "error");
            const confirmFn = typeof showConfirmDialog === "function" ? showConfirmDialog : window.showConfirmDialog;
            if (confirmFn) {
                await confirmFn({
                    title: "Tệp JSON Không Hợp Lệ",
                    message: `Không thể tải lên tệp do lỗi cấu trúc JSON:\n\n• ${validation.error}\n\nVui lòng kiểm tra lại định dạng tệp trước khi tải lên!`,
                    confirmText: "Đã Hiểu",
                    confirmColor: "danger"
                });
            }
            return;
        }

        const { textId, translations, type } = validation;
        const isNewKey = !allAdminTranslations[textId];
        const confirmFn = typeof showConfirmDialog === "function" ? showConfirmDialog : window.showConfirmDialog;

        // Nếu là Text ID hoàn toàn mới (chưa có trong từ điển)
        if (isNewKey) {
            if (confirmFn) {
                const confirmed = await confirmFn({
                    title: "Tải Lên Text ID Mới",
                    message: `Tệp JSON chứa mã Text ID mới: "${textId}" (chưa có trong hệ thống).\n\nBạn có muốn khởi tạo mã Text ID "${textId}" và nạp các bản dịch từ tệp này không?`,
                    confirmText: "Thêm Text ID Mới",
                    confirmColor: "primary"
                });
                if (!confirmed) return;
            }
        }
        // Nếu textId trong file khác với Text ID đang mở trên màn hình
        else if (currentSelectedTransKey && textId !== currentSelectedTransKey) {
            if (confirmFn) {
                const confirmed = await confirmFn({
                    title: "Xác nhận Text ID",
                    message: `Tệp JSON có mã Text ID là "${textId}", khác với khóa đang chọn "${currentSelectedTransKey}".\nBạn có muốn cập nhật bản dịch cho Text ID "${textId}" không?`,
                    confirmText: "Đồng ý",
                    confirmColor: "primary"
                });
                if (!confirmed) return;
            }
        }

        // Cập nhật vào đối tượng quản trị
        if (!allAdminTranslations[textId]) {
            allAdminTranslations[textId] = { type: type || "user" };
        }

        const existingType = allAdminTranslations[textId].type || type || "system";
        allAdminTranslations[textId] = {
            type: existingType,
            vi: translations.vi !== undefined ? translations.vi : (allAdminTranslations[textId].vi || ""),
            en: translations.en !== undefined ? translations.en : (allAdminTranslations[textId].en || ""),
            ja: translations.ja !== undefined ? translations.ja : (allAdminTranslations[textId].ja || ""),
            ko: translations.ko !== undefined ? translations.ko : (allAdminTranslations[textId].ko || ""),
            zh: translations.zh !== undefined ? translations.zh : (allAdminTranslations[textId].zh || "")
        };

        // Lưu trực tiếp lên máy chủ để đồng bộ bền vững
        lockScreen(isNewKey ? `Đang khởi tạo Text ID mới "${textId}"...` : `Đang lưu bản dịch Text ID "${textId}"...`);
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
            if (!res.ok || !json.success) {
                notifyUser("Cảnh báo: Chưa thể lưu lên máy chủ: " + (json.message || "Lỗi không xác định"), 'warning');
            }
        } catch (e) {
            console.error("Lỗi đồng bộ máy chủ:", e);
        } finally {
            unlockScreen();
        }

        // Đảm bảo GUI nạp đầy đủ dữ liệu mới ngay lập tức
        // 1. Chuyển sang Single Key View nếu đang xem Table View
        switchTransViewMode("single");

        // 2. Xóa bộ lọc tìm kiếm để Text ID mới chắc chắn xuất hiện trên Dropdown
        const filterInput = document.getElementById("filterTransKeyInput");
        if (filterInput) filterInput.value = "";

        // 3. Nạp lại Dropdown với toàn bộ danh sách Text ID bao gồm Text ID mới
        currentSelectedTransKey = textId;
        populateTranslationKeyDropdown(allAdminTranslations, "");

        // 4. Chọn đúng Text ID trên Dropdown
        const select = document.getElementById("selectTranslationKey");
        if (select) {
            select.value = textId;
        }

        // 5. Nạp trực tiếp dữ liệu 5 ngôn ngữ vào các ô Editor
        loadSingleKeyIntoEditor(textId);
        updateTransKeyCounter();

        // 6. Cập nhật bảng dữ liệu ma trận (nếu người dùng chuyển qua bảng sau đó)
        renderTranslationsTable(allAdminTranslations);

        // 7. Hiệu ứng làm nổi bật Text ID và các ô ngôn ngữ vừa nạp
        const badge = document.getElementById("currentEditingKeyBadge");
        if (badge) {
            badge.scrollIntoView({ behavior: "smooth", block: "nearest" });
            badge.classList.add("ring-4", "ring-primary/30");
            setTimeout(() => badge.classList.remove("ring-4", "ring-primary/30"), 1500);
        }

        ["vi", "en", "ja", "ko", "zh"].forEach(lang => {
            const el = document.getElementById(`singleTransInput_${lang}`);
            if (el) {
                el.classList.add("bg-pink-50/50");
                setTimeout(() => el.classList.remove("bg-pink-50/50"), 1500);
            }
        });

        if (isNewKey) {
            notifyUser(`Đã thêm Text ID mới "${textId}" và nạp bản dịch thành công lên giao diện và máy chủ!`, "success");
        } else {
            notifyUser(`Đã nạp bản dịch cho Text ID "${textId}" thành công lên giao diện và máy chủ!`, "success");
        }
    };

    reader.onerror = () => {
        notifyUser("Lỗi khi đọc tệp tin từ máy tính!", "error");
    };

    reader.readAsText(file, "UTF-8");
}

/**
 * Tải xuống toàn bộ từ điển đa ngôn ngữ translations.json
 */
export function downloadAllTranslationsJson() {
    syncSingleKeyInputToDictionary();
    const exportPayload = {
        languages: ["vi", "en", "ja", "ko", "zh"],
        translations: allAdminTranslations || {}
    };

    const jsonStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "translations.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notifyUser("Đã tải xuống toàn bộ từ điển translations.json thành công!", "success");
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
    window.isValidTextId = isValidTextId;
    window.validateAndParseTranslationJson = validateAndParseTranslationJson;
    window.downloadCurrentTranslationKeyJson = downloadCurrentTranslationKeyJson;
    window.triggerUploadTranslationKeyJson = triggerUploadTranslationKeyJson;
    window.handleUploadTranslationKeyJson = handleUploadTranslationKeyJson;
    window.downloadAllTranslationsJson = downloadAllTranslationsJson;
}
