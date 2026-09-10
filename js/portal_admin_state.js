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

export const PRICE_LEVEL_CONFIG = {
    price_lvl_01: { name: "LV_01: Phổ Thông (Standard)", min: 300000, max: 550000 },
    price_lvl_02: { name: "LV_02: Cao Cấp (Premium)", min: 600000, max: 950000 },
    price_lvl_03: { name: "LV_03: Sang Trọng (Luxury)", min: 1000000, max: 2500000 },
    price_lvl_04: { name: "LV_04: Độc Bản VIP (Exclusive)", min: 2600000, max: 15000000 }
};

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
}
