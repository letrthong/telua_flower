// portal_admin_livestream_orders.js
// This module provides functionality to load and display Live Stream orders in the admin portal.
// It reuses the existing order rendering logic from portal_admin_orders.js.

import { loadAdminOrders } from './portal_admin_orders.js';

/**
 * Fetch all orders and filter for Live Stream sources, then render them.
 */
export async function loadLiveStreamOrders() {
  // Reuse the existing loadAdminOrders to fetch data.
  // It populates a global variable `lastLoadedAdminOrders`.
  await loadAdminOrders();
  // After fetching, filter the orders.
  if (typeof lastLoadedAdminOrders === 'undefined') {
    console.warn('lastLoadedAdminOrders is not defined');
    return;
  }
  const liveOrders = lastLoadedAdminOrders.filter(order =>
    order.source === 'livestream_quick_order' || order.source === 'livestream'
  );
  // Use the same rendering function from portal_admin_orders.js.
  // It is defined as a private function `renderAdminOrdersTable` inside that module.
  // We'll call it via the global scope if it exists.
  if (typeof renderAdminOrdersTable === 'function') {
    renderAdminOrdersTable(liveOrders);
  } else {
    // Fallback: replace the table body with a simple message.
    const tbody = document.getElementById('adminOrdersTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-gray-400">Không có đơn Live Stream nào.</td></tr>`;
    }
  }
}
