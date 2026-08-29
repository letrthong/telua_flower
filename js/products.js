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
                // Giới hạn kích thước cache RAM: Tự động loại bỏ phần tử cũ nhất (FIFO/LRU) khi vượt ngưỡng
                if (productDetailMemoryCache.size >= MAX_PRODUCT_CACHE_SIZE) {
                    const oldestKey = productDetailMemoryCache.keys().next().value;
                    if (oldestKey) productDetailMemoryCache.delete(oldestKey);
                }
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
