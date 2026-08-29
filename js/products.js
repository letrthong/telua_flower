// Dịch vụ nạp dữ liệu sản phẩm & danh mục động từ Backend API (đọc trực tiếp từ config/anne/products.json)
import { API_BASE } from './utils.js';

let cachedProducts = [];
let cachedCategories = [];

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
 * Lấy chi tiết một sản phẩm theo ID (đọc từ config/anne/products/{id}.json có In-Memory RAM Cache)
 * @param {string} productId - Mã định danh sản phẩm
 */
export async function getProductById(productId) {
    if (!productId) return null;
    if (productDetailMemoryCache.has(productId)) {
        return productDetailMemoryCache.get(productId);
    }
    try {
        const res = await fetch(`${API_BASE}/products/${productId}`);
        if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
                productDetailMemoryCache.set(productId, json.data);
                return json.data;
            }
        }
    } catch (e) {
        console.warn("Lỗi nạp chi tiết sản phẩm:", e);
    }
    return cachedProducts.find(p => p && p.id === productId) || null;
}

/**
 * Lấy danh sách danh mục động từ Backend (đọc từ config/anne/categories.json)
 * @param {boolean} activeOnly - Chỉ lấy danh mục đang hoạt động
 */
export async function getCategories(activeOnly = true) {
    try {
        const url = activeOnly ? `${API_BASE}/categories?active=true&_t=${Date.now()}` : `${API_BASE}/categories?_t=${Date.now()}`;
        const res = await fetch(url);
        if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                cachedCategories = json.data;
                if (typeof window !== 'undefined') window.activeStorefrontCategories = cachedCategories;
                return cachedCategories;
            }
        }
    } catch (e) {
        console.warn("Lỗi nạp danh mục từ API:", e);
    }
    return cachedCategories;
}

// Global browser support
if (typeof window !== 'undefined') {
    window.getProducts = getProducts;
    window.getProductById = getProductById;
    window.getCategories = getCategories;
}
