import { getCurrentUser, getAuthToken, openAuthModal, logout } from './auth.js';
import { API_BASE, showToast, showConfirmDialog, showScreenLock, hideScreenLock, removeVietnameseTones } from './utils.js';

export function lockScreen(msg) {
    if (typeof showScreenLock === 'function') showScreenLock(msg);
    else if (typeof window !== 'undefined' && typeof window.showScreenLock === 'function') window.showScreenLock(msg);
}

export function unlockScreen() {
    if (typeof hideScreenLock === 'function') hideScreenLock();
    else if (typeof window !== 'undefined' && typeof window.hideScreenLock === 'function') window.hideScreenLock();
}

export function notifyUser(message, type = 'success', duration = 5000) {
    if (typeof showToast === 'function') {
        showToast(message, type, duration);
    } else if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        window.showToast(message, type, duration);
    } else {
        alert(message);
    }
}

/**
 * Phân hệ Quản Trị Hệ Thống (TASK 07 - Admin Portal, Product CMS & Price Governance)
 */

export let PRICE_LEVEL_CONFIG = {};
export let allAdminPriceLevels = [];

export function setAdminPriceLevels(levels) {
    allAdminPriceLevels = Array.isArray(levels) ? [...levels] : [];
    Object.keys(PRICE_LEVEL_CONFIG).forEach(k => delete PRICE_LEVEL_CONFIG[k]);
    allAdminPriceLevels.forEach(lvl => {
        if (lvl && lvl.id) {
            PRICE_LEVEL_CONFIG[lvl.id] = {
                id: lvl.id,
                code: lvl.code || lvl.id,
                name: `${lvl.code || ""}: ${lvl.name || ""}`.trim().replace(/^:\s*/, ""),
                rawName: lvl.name || "",
                min: Number(lvl.minPrice) || 0,
                max: Number(lvl.maxPrice) || 0,
                defaultPrice: Number(lvl.defaultPrice) || 0,
                description: lvl.description || ""
            };
        }
    });
    if (typeof window !== "undefined") {
        window.PRICE_LEVEL_CONFIG = PRICE_LEVEL_CONFIG;
        window.allAdminPriceLevels = allAdminPriceLevels;
    }
}

export let allAdminCategories = [];
export let allAdminProducts = [];
export let allAdminPromotions = [];
export let allAdminAddons = [];
export let allAdminTranslations = {};
export let allAdminUsers = [];
export let allAdminBranches = [];

if (typeof window !== "undefined") {
    window.lockScreen = lockScreen;
    window.unlockScreen = unlockScreen;
    window.notifyUser = notifyUser;
    window.PRICE_LEVEL_CONFIG = PRICE_LEVEL_CONFIG;
    window.allAdminPriceLevels = allAdminPriceLevels;
    window.setAdminPriceLevels = setAdminPriceLevels;
}
