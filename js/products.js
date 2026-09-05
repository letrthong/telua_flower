// Dịch vụ nạp dữ liệu sản phẩm & danh mục động từ Backend API (đọc trực tiếp từ config/anne/products.json)
import { API_BASE } from './utils.js';

const CATEGORIES_CACHE_KEY = 'telua_categories_cache_v1';
const CATEGORIES_ETAG_KEY = 'telua_categories_etag_v1';

let cachedProducts = [];
let cachedCategories = [];
let _isSyncingCategories = false;
let _lastCategoriesSyncTime = 0;

// Khởi tạo tức thì danh mục từ cache LocalStorage (0ms Instant Boot)
try {
    if (typeof localStorage !== 'undefined') {
        const cachedRaw = localStorage.getItem(CATEGORIES_CACHE_KEY);
        if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                cachedCategories = parsed;
                if (typeof window !== 'undefined') window.activeStorefrontCategories = cachedCategories;
            }
        }
    }
} catch (e) {
    console.warn("Lỗi đọc cache danh mục:", e);
}

/**
 * Lấy toàn bộ danh sách sản phẩm động từ Backend (đọc từ config/anne/products.json)
 * @param {boolean} activeOnly - Chỉ lấy sản phẩm đang bật bán
 */
export async function getProducts(activeOnly = true) {
    try {
        const url = activeOnly ? `${API_BASE}/products?active=true&_t=${Date.now()}` : `${API_BASE}/products?_t=${Date.now()}`;
        const res = await fetch(url);
        if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                cachedProducts = json.data;
                if (typeof window !== 'undefined') window.allStorefrontProducts = cachedProducts;
                return cachedProducts;
            }
        }
    } catch (e) {
        console.warn("Lỗi nạp sản phẩm từ API:", e);
    }
    return cachedProducts;
}

const productDetailMemoryCache = new Map();
const MAX_PRODUCT_CACHE_SIZE = 120; // Giới hạn tối đa 120 sản phẩm trong RAM client chống tràn bộ nhớ

/**
 * Xóa cache chi tiết sản phẩm trong RAM (cho một sản phẩm hoặc toàn bộ)
 */
export function clearProductDetailCache(productId = null) {
    if (productId) {
        productDetailMemoryCache.delete(productId);
    } else {
        productDetailMemoryCache.clear();
    }
}

/**
 * Lấy chi tiết một sản phẩm theo ID (đọc từ config/anne/products/{id}.json có In-Memory RAM Cache giới hạn)
 * @param {string} productId - Mã định danh sản phẩm
 * @param {string} [lang] - Ngôn ngữ cần lấy (vi, en, ja, ko, zh)
 */
export async function getProductById(productId, lang = null) {
    if (!productId) return null;
    const currentLang = lang || ((typeof window !== 'undefined' && window.currentLang) ? window.currentLang : 'vi');
    const cacheKey = `${productId}_${currentLang}`;
    
    if (productDetailMemoryCache.has(cacheKey)) {
        return productDetailMemoryCache.get(cacheKey);
    }
    try {
        const url = `${API_BASE}/products/${productId}?lang=${encodeURIComponent(currentLang)}`;
        const res = await fetch(url);
        if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
                // Giới hạn kích thước cache RAM: Tự động loại bỏ phần tử cũ nhất (FIFO/LRU) khi vượt ngưỡng
                if (productDetailMemoryCache.size >= MAX_PRODUCT_CACHE_SIZE) {
                    const oldestKey = productDetailMemoryCache.keys().next().value;
                    if (oldestKey) productDetailMemoryCache.delete(oldestKey);
                }
                productDetailMemoryCache.set(cacheKey, json.data);
                return json.data;
            }
        }
    } catch (e) {
        console.warn("Lỗi nạp chi tiết sản phẩm từ API:", e);
    }

    // Fallback: Thử đọc trực tiếp file chi tiết riêng config/anne/products/${productId}.json
    try {
        const fbRes = await fetch(`config/anne/products/${productId}.json?_t=${Date.now()}`);
        if (fbRes.ok) {
            const rawDetail = await fbRes.json();
            if (rawDetail && typeof rawDetail === 'object') {
                if (currentLang && currentLang !== 'vi' && rawDetail.i18n && rawDetail.i18n[currentLang]) {
                    const lData = rawDetail.i18n[currentLang];
                    rawDetail.name = lData.name || rawDetail.name;
                    rawDetail.flowerComposition = lData.flowerComposition || rawDetail.flowerComposition;
                    rawDetail.description = lData.description || rawDetail.description;
                    rawDetail.careTips = lData.careTips || rawDetail.careTips;
                }
                productDetailMemoryCache.set(cacheKey, rawDetail);
                return rawDetail;
            }
        }
    } catch (fbErr) {
        // Tiếp tục fallback tới cachedProducts
    }

    return cachedProducts.find(p => p && p.id === productId) || null;
}

/**
 * Nạp lại danh mục (config/anne/categories.json) nếu có thay đổi từ máy chủ (dựa trên ETag HTTP 304).
 */
export async function reloadCategoriesIfChanged(forceRefresh = false) {
    if (_isSyncingCategories) return { changed: false, categories: cachedCategories };
    _isSyncingCategories = true;

    let categoriesChanged = false;
    let storedEtag = null;

    if (typeof localStorage !== 'undefined') {
        try {
            storedEtag = localStorage.getItem(CATEGORIES_ETAG_KEY);
        } catch (e) {}
    }

    try {
        const headers = {};
        if (storedEtag && !forceRefresh) {
            headers['If-None-Match'] = storedEtag;
        }

        const res = await fetch(`${API_BASE}/categories?_t=${Date.now()}`, { headers });
        if (res.status === 200) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                const oldStr = JSON.stringify(cachedCategories || []);
                const newStr = JSON.stringify(json.data);
                if (oldStr !== newStr) {
                    cachedCategories = json.data;
                    categoriesChanged = true;
                    if (typeof window !== 'undefined') window.activeStorefrontCategories = cachedCategories;
                }
                const newEtag = res.headers.get("ETag");
                if (typeof localStorage !== 'undefined') {
                    try {
                        localStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(cachedCategories));
                        if (newEtag) localStorage.setItem(CATEGORIES_ETAG_KEY, newEtag);
                    } catch (e) {}
                }
            }
        } else if (res.status === 304) {
            categoriesChanged = false;
        } else if (!res.ok) {
            throw new Error("HTTP " + res.status);
        }
    } catch (e) {
        // Fallback file tĩnh config/anne/categories.json nếu API không phản hồi
        if (!cachedCategories || cachedCategories.length === 0 || forceRefresh) {
            try {
                const fbRes = await fetch(`config/anne/categories.json?_t=${Date.now()}`);
                if (fbRes.ok) {
                    const fbData = await fbRes.json();
                    if (Array.isArray(fbData) && fbData.length > 0) {
                        const oldStr = JSON.stringify(cachedCategories || []);
                        const newStr = JSON.stringify(fbData);
                        if (oldStr !== newStr) {
                            cachedCategories = fbData;
                            categoriesChanged = true;
                            if (typeof window !== 'undefined') window.activeStorefrontCategories = cachedCategories;
                        }
                        if (typeof localStorage !== 'undefined') {
                            try {
                                localStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(cachedCategories));
                            } catch (e) {}
                        }
                    }
                }
            } catch (errFb) {}
        }
    } finally {
        _lastCategoriesSyncTime = Date.now();
        _isSyncingCategories = false;
    }

    if (categoriesChanged && typeof window !== 'undefined' && typeof window.renderStorefrontCategories === 'function') {
        window.renderStorefrontCategories();
    }

    return { changed: categoriesChanged, categories: cachedCategories };
}

function filterActiveCategories(cats, activeOnly) {
    if (!Array.isArray(cats)) return [];
    if (!activeOnly) return cats;
    return cats.filter(c => 
        c && 
        c.isActive !== false && 
        c.isActive !== 'false' && 
        c.status !== 'inactive' && 
        c.status !== 'deleted' && 
        !c.isDeleted
    );
}

/**
 * Lấy danh sách danh mục động (hỗ trợ Cache 0ms và kiểm tra ETag)
 * @param {boolean} activeOnly - Chỉ lấy danh mục đang hoạt động
 */
export async function getCategories(activeOnly = true) {
    // 1. Trả về ngay lập tức nếu đã có trong cache RAM / localStorage (0ms)
    if (cachedCategories && cachedCategories.length > 0) {
        // Kiểm tra ngầm ETag ở chế độ nền
        reloadCategoriesIfChanged(false).catch(() => {});
        return filterActiveCategories(cachedCategories, activeOnly);
    }

    // 2. Nếu chưa có, nạp qua reloadCategoriesIfChanged
    await reloadCategoriesIfChanged(false);
    return filterActiveCategories(cachedCategories, activeOnly);
}

// Tự động kiểm tra thay đổi của categories.json khi người dùng chuyển lại tab (sau ít nhất 15 giây)
if (typeof window !== "undefined" && typeof document !== "undefined") {
    const handleCategoriesVisibilityOrFocus = () => {
        const now = Date.now();
        if (now - _lastCategoriesSyncTime > 15000) {
            reloadCategoriesIfChanged(false).catch(() => {});
        }
    };
    window.addEventListener("focus", handleCategoriesVisibilityOrFocus);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            handleCategoriesVisibilityOrFocus();
        }
    });
}

// Global browser support
if (typeof window !== 'undefined') {
    window.getProducts = getProducts;
    window.getProductById = getProductById;
    window.getCategories = getCategories;
    window.reloadCategoriesIfChanged = reloadCategoriesIfChanged;
}
