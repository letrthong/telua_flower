// portal_admin_livestream_orders.js
// This module provides functionality to load and display Live Stream orders in the admin portal.
// It reuses the existing order rendering logic from portal_admin_orders.js.

import { loadAdminOrders } from './portal_admin_orders.js';

/**
 * Fetch all orders and filter for Live Stream sources, then render them.
 */
export async function loadLiveStreamOrders() {
  // Load all orders first.
  await loadAdminOrders();
  // After loading, hide non-live stream rows.
  const tbody = document.getElementById('adminOrdersTableBody');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr');
  let hasLive = false;
  rows.forEach(row => {
    // Determine if this row is a live stream order by checking for the Live badge.
    const isLive = row.querySelector('span.inline-flex')?.innerText.includes('Live');
    if (isLive) {
      hasLive = true;
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
  if (!hasLive) {
    tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-gray-400">Không có đơn Live Stream nào.</td></tr>`;
  }
}
