// ── Helpers ──────────────────────────────────────────────────────────────
function showMsg(el, text, ok) {
  el.textContent = text;
  el.style.color = ok ? '#27ae60' : '#c0392b';
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function apiPut(url, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

function setMetric(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = String(value ?? 0);
  }
}

function countByStatus(items, field, expected) {
  return items.filter(item => String(item?.[field] || '').toLowerCase() === expected.toLowerCase()).length;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const currentRole = localStorage.getItem('currentUserRole') || 'Manager';
const DASHBOARD_POLL_INTERVAL_MS = 5000;
const MAX_NOTIFICATION_ITEMS = 8;

let dashboardPollTimer = null;
let pollInFlight = false;
let hasLowStockBaseline = false;
let knownLowStockKeys = new Set();
let hasSupplierPoBaseline = false;
let knownSupplierPoNotificationIds = new Set();
let hasReceivedPoBaseline = false;
let knownReceivedPoNotificationIds = new Set();
let hasHousekeepingUsageBaseline = false;
let knownHousekeepingUsageIds = new Set();
let hasGuestRequestBaseline = false;
let knownGuestRequestNotificationIds = new Set();
let hasTaskCompletionBaseline = false;
let knownTaskCompletionNotificationIds = new Set();
let unseenNotificationCount = 0;

// Staff assignment tracking
let assignmentStaff = {
  housekeeping: [],
  maintenance: [],
};

const alertsBellBtn = document.getElementById('alertsBellBtn');
const alertsBellCounter = document.getElementById('alertsBellCounter');
const notificationsModal = document.getElementById('notificationsModal');
const closeNotificationsBtn = document.getElementById('closeNotificationsBtn');
const clearAlertsBtn = document.getElementById('clearAlertsBtn');
const notificationList = document.getElementById('notificationList');
const notificationPermissionBtn = document.getElementById('notificationPermissionBtn');
const notificationPermissionText = document.getElementById('notificationPermissionText');
const dashboardToastStack = document.getElementById('dashboardToastStack');

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateNotificationBadge() {
  if (!alertsBellCounter) {
    return;
  }

  if (unseenNotificationCount <= 0) {
    alertsBellCounter.hidden = true;
    alertsBellCounter.textContent = '0';
    return;
  }

  alertsBellCounter.hidden = false;
  alertsBellCounter.textContent = String(unseenNotificationCount);
}

function markNotificationsSeen() {
  unseenNotificationCount = 0;
  updateNotificationBadge();
}

function addNotificationFeedItem(text) {
  if (!notificationList) {
    return;
  }

  const item = document.createElement('li');
  item.innerHTML = `<p>${escapeHtml(text)}</p><span class="notification-time">${escapeHtml(nowLabel())}</span>`;
  notificationList.prepend(item);

  while (notificationList.children.length > MAX_NOTIFICATION_ITEMS) {
    notificationList.removeChild(notificationList.lastElementChild);
  }
}

function showToast(title, text) {
  if (!dashboardToastStack) {
    return;
  }

  const toast = document.createElement('article');
  toast.className = 'dashboard-toast';
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p>`;
  dashboardToastStack.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 4500);
}

function tryShowBrowserNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  new Notification(title, { body });
}

function updateNotificationPermissionUI() {
  if (!notificationPermissionBtn || !notificationPermissionText) {
    return;
  }

  if (!('Notification' in window)) {
    notificationPermissionBtn.disabled = true;
    notificationPermissionBtn.textContent = 'Browser Alerts Unavailable';
    notificationPermissionText.textContent = 'This browser does not support native notifications.';
    return;
  }

  if (Notification.permission === 'granted') {
    notificationPermissionBtn.disabled = true;
    notificationPermissionBtn.textContent = 'Browser Alerts Enabled';
    notificationPermissionText.textContent = 'Desktop alerts are active for low-stock updates.';
    return;
  }

  if (Notification.permission === 'denied') {
    notificationPermissionBtn.disabled = true;
    notificationPermissionBtn.textContent = 'Browser Alerts Blocked';
    notificationPermissionText.textContent = 'Browser alerts are blocked. You can still see in-page alerts.';
    return;
  }

  notificationPermissionBtn.disabled = false;
  notificationPermissionBtn.textContent = 'Enable Browser Alerts';
  notificationPermissionText.textContent = 'Enable browser alerts for instant low-stock updates.';
}

function getInventoryKey(item) {
  if (item?.id !== undefined && item?.id !== null) {
    return `id:${item.id}`;
  }
  return `name:${String(item?.item || '').trim().toLowerCase()}|category:${String(item?.category || '').trim().toLowerCase()}`;
}

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

function suggestedApprovalQty(item) {
  const inStock = Number(item?.inStock || 0);
  const damaged = Number(item?.damaged || 0);
  const missing = Number(item?.missing || 0);
  const minLevel = Number(item?.minLevel || 0);
  const usableStock = Math.max(0, inStock - Math.max(0, damaged) - Math.max(0, missing));
  const targetLevel = Math.max(0, minLevel) + 10;
  return Math.max(1, targetLevel - usableStock);
}

function hydrateAssignmentStaff(users) {
  const safeUsers = Array.isArray(users) ? users : [];
  const activeUsers = safeUsers.filter((user) => Boolean(user?.status));

  const housekeeping = activeUsers
    .filter((user) => normalizeRole(user?.role).includes('housekeeping'))
    .map((user) => String(user?.username || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const maintenance = activeUsers
    .filter((user) => normalizeRole(user?.role).includes('maintenance'))
    .map((user) => String(user?.username || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  assignmentStaff = {
    housekeeping: [...new Set(housekeeping)],
    maintenance: [...new Set(maintenance)],
  };
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function assignedStaffSelectOptions() {
  const housekeepingOptions = (assignmentStaff.housekeeping || [])
    .map((name) => `<option value="${escapeAttr(name)}" data-module="housekeeping">${escapeHtml(name)} (Housekeeping)</option>`)
    .join('');

  const maintenanceOptions = (assignmentStaff.maintenance || [])
    .map((name) => `<option value="${escapeAttr(name)}" data-module="maintenance">${escapeHtml(name)} (Maintenance)</option>`)
    .join('');

  if (!housekeepingOptions && !maintenanceOptions) {
    return '<option value="">No available staff</option>';
  }

  return `
    <option value="">Select staff</option>
    ${housekeepingOptions}
    ${maintenanceOptions}
  `;
}

async function checkLowStockTransitions() {
  try {
    const res = await fetch('/inventory/list');
    if (!res.ok) {
      return;
    }

    const inventoryItems = await res.json();
    const lowStockItems = inventoryItems.filter(
      (item) => String(item?.status || '').toLowerCase() === 'low stock'
    );

    const currentKeys = new Set(lowStockItems.map(getInventoryKey));

    if (!hasLowStockBaseline) {
      knownLowStockKeys = currentKeys;
      hasLowStockBaseline = true;
      return;
    }

    const newLowStockItems = lowStockItems.filter((item) => !knownLowStockKeys.has(getInventoryKey(item)));

    newLowStockItems.forEach((item) => {
      const stock = Number(item?.inStock || 0);
      const minLevel = Number(item?.minLevel || 0);
      const itemName = String(item?.item || 'Inventory item');
      const message = `${itemName} reached low stock (${stock} / ${minLevel}).`;

      unseenNotificationCount += 1;
      addNotificationFeedItem(message);
      showToast('Low Stock Alert', message);
      tryShowBrowserNotification('Low Stock Alert', message);
    });

    updateNotificationBadge();
    knownLowStockKeys = currentKeys;
  } catch (err) {
    console.error('Could not check low stock transitions', err);
  }
}

async function checkSupplierPoNotifications() {
  try {
    const res = await fetch('/inventory/ordered-low-stock-notifications');
    if (!res.ok) {
      return;
    }

    const orderedNotifications = await res.json();
    const currentIds = new Set(orderedNotifications.map((notification) => Number(notification.id)));

    if (!hasSupplierPoBaseline) {
      knownSupplierPoNotificationIds = currentIds;
      hasSupplierPoBaseline = true;
      return;
    }

    const newSupplierPoNotifications = orderedNotifications.filter(
      (notification) => !knownSupplierPoNotificationIds.has(Number(notification.id))
    );

    newSupplierPoNotifications.forEach((notification) => {
      const itemName = String(notification?.itemName || 'Inventory item');
      const orderedQty = Number(notification?.orderedQty || 0);
      const supplier = String(notification?.supplier || 'Supplier team');
      const poid = String(notification?.poid || '').trim();
      const poLabel = poid ? ` (${poid})` : '';
      const message = `${supplier} created a PO${poLabel} for ${itemName} with quantity ${orderedQty}.`;

      unseenNotificationCount += 1;
      addNotificationFeedItem(message);
      showToast('Supplier PO Created', message);
      tryShowBrowserNotification('Supplier PO Created', message);
    });

    updateNotificationBadge();
    knownSupplierPoNotificationIds = currentIds;
  } catch (err) {
    console.error('Could not load supplier PO notifications', err);
  }
}

async function checkReceivedPoNotifications() {
  try {
    const res = await fetch('/inventory/received-low-stock-notifications');
    if (!res.ok) {
      return;
    }

    const receivedNotifications = await res.json();
    const currentIds = new Set(receivedNotifications.map((notification) => Number(notification.id)));

    if (!hasReceivedPoBaseline) {
      knownReceivedPoNotificationIds = currentIds;
      hasReceivedPoBaseline = true;
      return;
    }

    const newReceivedNotifications = receivedNotifications.filter(
      (notification) => !knownReceivedPoNotificationIds.has(Number(notification.id))
    );

    newReceivedNotifications.forEach((notification) => {
      const itemName = String(notification?.itemName || 'Inventory item');
      const orderedQty = Number(notification?.orderedQty || 0);
      const poid = String(notification?.poid || '').trim();
      const poLabel = poid ? ` (${poid})` : '';
      const message = `Order received${poLabel}: ${itemName} quantity ${orderedQty} has been received.`;

      unseenNotificationCount += 1;
      addNotificationFeedItem(message);
      showToast('Order Received', message);
      tryShowBrowserNotification('Order Received', message);
    });

    updateNotificationBadge();
    knownReceivedPoNotificationIds = currentIds;
  } catch (err) {
    console.error('Could not load received PO notifications', err);
  }
}

async function checkHousekeepingUsageNotifications() {
  try {
    const res = await fetch('/inventory/housekeeping-usage-notifications');
    if (!res.ok) {
      return;
    }

    const usageLogs = await res.json();
    const currentIds = new Set(usageLogs.map((usage) => Number(usage.id)));

    if (!hasHousekeepingUsageBaseline) {
      knownHousekeepingUsageIds = currentIds;
      hasHousekeepingUsageBaseline = true;
      return;
    }

    const newUsageLogs = usageLogs.filter((usage) => !knownHousekeepingUsageIds.has(Number(usage.id)));
    newUsageLogs.forEach((usage) => {
      const itemName = String(usage?.itemName || 'Inventory item');
      const staffName = String(usage?.staffName || 'Housekeeping staff');
      const usedQty = Number(usage?.usedQty || 0);
      const damagedQty = Number(usage?.damagedQty || 0);
      const damagedSuffix = damagedQty > 0 ? ` and reported ${damagedQty} damaged` : '';
      const message = `${staffName} used ${usedQty} units of ${itemName}${damagedSuffix} during housekeeping runs.`;

      unseenNotificationCount += 1;
      addNotificationFeedItem(message);
      showToast('Housekeeping Usage', message);
      tryShowBrowserNotification('Housekeeping Usage', message);
    });

    updateNotificationBadge();
    knownHousekeepingUsageIds = currentIds;
  } catch (err) {
    console.error('Could not load housekeeping usage notifications', err);
  }
}

async function checkGuestRequestNotifications() {
  try {
    const res = await fetch('/workflow/notifications?audience=MANAGER');
    if (!res.ok) {
      return;
    }

    const notifications = await res.json();
    const guestRequestNotifications = Array.isArray(notifications) 
      ? notifications.filter((n) => String(n?.notificationType || '').toUpperCase() === 'REQUEST_PLACED')
      : [];
    const currentIds = new Set(guestRequestNotifications.map((notification) => Number(notification.id)));

    if (!hasGuestRequestBaseline) {
      knownGuestRequestNotificationIds = currentIds;
      hasGuestRequestBaseline = true;
      return;
    }

    const newGuestRequestNotifications = guestRequestNotifications.filter(
      (notification) => !knownGuestRequestNotificationIds.has(Number(notification.id))
    );

    newGuestRequestNotifications.forEach((notification) => {
      const requestId = String(notification?.requestId || 'Request');
      const message = String(notification?.message || 'A new guest request has been placed.');

      unseenNotificationCount += 1;
      addNotificationFeedItem(`${requestId}: ${message}`);
      showToast('New Guest Request', message);
      tryShowBrowserNotification('New Guest Request', message);
    });

    updateNotificationBadge();
    knownGuestRequestNotificationIds = currentIds;
  } catch (err) {
    console.error('Could not check guest request notifications', err);
  }
}

async function checkTaskCompletionNotifications() {
  try {
    const res = await fetch('/workflow/notifications?audience=MANAGER');
    if (!res.ok) {
      return;
    }

    const notifications = await res.json();
    const taskCompletionNotifications = Array.isArray(notifications) 
      ? notifications.filter((n) => String(n?.notificationType || '').toUpperCase() === 'TASK_COMPLETED')
      : [];
    const currentIds = new Set(taskCompletionNotifications.map((notification) => Number(notification.id)));

    if (!hasTaskCompletionBaseline) {
      knownTaskCompletionNotificationIds = currentIds;
      hasTaskCompletionBaseline = true;
      return;
    }

    const newTaskCompletionNotifications = taskCompletionNotifications.filter(
      (notification) => !knownTaskCompletionNotificationIds.has(Number(notification.id))
    );

    newTaskCompletionNotifications.forEach((notification) => {
      const requestId = String(notification?.requestId || 'Task');
      const message = String(notification?.message || 'A task has been completed.');
      const department = String(notification?.department || '');
      const title = department ? `${department} Task Completed` : 'Task Completed';

      unseenNotificationCount += 1;
      addNotificationFeedItem(`${requestId}: ${message}`);
      showToast(title, message);
      tryShowBrowserNotification(title, message);
    });

    updateNotificationBadge();
    knownTaskCompletionNotificationIds = currentIds;
  } catch (err) {
    console.error('Could not check task completion notifications', err);
  }
}

async function pollDashboardLiveUpdates() {
  if (pollInFlight) {
    return;
  }

  pollInFlight = true;
  try {
    await Promise.all([
      loadDashboardMetrics(),
      loadApprovalTables(),
      checkGuestRequestNotifications(),
      checkTaskCompletionNotifications(),
      checkLowStockTransitions(),
      checkSupplierPoNotifications(),
      checkReceivedPoNotifications(),
      checkHousekeepingUsageNotifications()
    ]);
  } finally {
    pollInFlight = false;
  }
}

function startLivePolling() {
  if (dashboardPollTimer !== null) {
    return;
  }

  dashboardPollTimer = window.setInterval(() => {
    pollDashboardLiveUpdates();
  }, DASHBOARD_POLL_INTERVAL_MS);

  window.addEventListener('beforeunload', () => {
    if (dashboardPollTimer !== null) {
      window.clearInterval(dashboardPollTimer);
      dashboardPollTimer = null;
    }
  });
}

function setupNotificationInteractions() {
  // Bell button - open modal
  if (alertsBellBtn) {
    alertsBellBtn.addEventListener('click', () => {
      if (notificationsModal) {
        notificationsModal.hidden = false;
        markNotificationsSeen();
      }
    });
  }

  // Close button - close modal
  if (closeNotificationsBtn) {
    closeNotificationsBtn.addEventListener('click', () => {
      if (notificationsModal) {
        notificationsModal.hidden = true;
      }
    });
  }

  // Clear alerts button
  if (clearAlertsBtn) {
    clearAlertsBtn.addEventListener('click', () => {
      if (notificationList) {
        notificationList.innerHTML = '';
      }
      unseenNotificationCount = 0;
      updateNotificationBadge();
      showToast('Alerts Cleared', 'All notifications have been cleared.');
      if (notificationsModal) {
        notificationsModal.hidden = true;
      }
    });
  }

  // Close modal when clicking outside
  if (notificationsModal) {
    notificationsModal.addEventListener('click', (e) => {
      if (e.target === notificationsModal) {
        notificationsModal.hidden = true;
      }
    });
  }

  if (notificationPermissionBtn) {
    notificationPermissionBtn.addEventListener('click', async () => {
      if (!('Notification' in window) || Notification.permission !== 'default') {
        updateNotificationPermissionUI();
        return;
      }

      const permission = await Notification.requestPermission();
      updateNotificationPermissionUI();

      if (permission === 'granted') {
        showToast('Browser Alerts Enabled', 'You will now receive desktop low-stock notifications.');
      }
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (
      document.visibilityState === 'visible'
      && notificationsModal
      && notificationsModal.hidden === false
    ) {
      markNotificationsSeen();
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key === 'inventoryUpdateSignal') {
      pollDashboardLiveUpdates();
    }
  });

  updateNotificationPermissionUI();
}

async function loadApprovalTables() {
  try {
    const [guestRoutingRes, usersRes, housekeepingRes, maintenanceRes, inventoryRes] = await Promise.all([
      fetch('/guestservice/routing-pending'),
      fetch('/auth/users'),
      fetch('/housekeeping/list'),
      fetch('/maintenance/list'),
      fetch('/inventory/low-stock-pending')
    ]);

    const routingRequests = guestRoutingRes.ok ? await guestRoutingRes.json() : [];
    const users = usersRes.ok ? await usersRes.json() : [];
    const housekeepingTasks = housekeepingRes.ok ? await housekeepingRes.json() : [];
    const maintenanceTickets = maintenanceRes.ok ? await maintenanceRes.json() : [];
    const inventoryItems = inventoryRes.ok ? await inventoryRes.json() : [];

    hydrateAssignmentStaff(users);

    const guestRoutingBody = document.getElementById('guestRoutingTableBody');
    if (guestRoutingBody) {
      guestRoutingBody.innerHTML = routingRequests.length
        ? routingRequests.map((request) => `
          <tr>
            <td>${escapeHtml(request.requestId)}</td>
            <td>${escapeHtml(request.roomName)}</td>
            <td>${escapeHtml(request.request)}</td>
            <td>${escapeHtml(formatDateTime(request.requestDateTime))}</td>
            <td>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <select class="guest-route-staff-select" data-requestid="${escapeAttr(request.requestId)}">
                  ${assignedStaffSelectOptions()}
                </select>
                <button type="button" class="approve-btn" data-module="guest-route" data-action="route-with-staff" data-requestid="${escapeHtml(request.requestId)}">Assign</button>
              </div>
            </td>
          </tr>
        `).join('')
        : '<tr><td colspan="5">No new guest requests waiting for routing.</td></tr>';
    }

    const housekeepingBody = document.getElementById('housekeepingApprovalTableBody');
    if (housekeepingBody) {
      const completedTasks = housekeepingTasks.filter(
        (task) => String(task.taskStatus).toLowerCase() === 'completed' && !Boolean(task.approved)
      );
      housekeepingBody.innerHTML = completedTasks.length
        ? completedTasks.map((task) => `
          <tr>
            <td>${escapeHtml(task.requestId)}</td>
            <td>${escapeHtml(task.room)}</td>
            <td>${escapeHtml(task.taskStatus)}</td>
            <td><span class="status-pill ${task.approved ? 'active' : 'inactive'}">${task.approved ? 'Approved' : 'Not Approved'}</span></td>
            <td><button type="button" class="approve-btn" data-module="housekeeping" data-id="${task.id}" data-approved="${task.approved ? 'false' : 'true'}">${task.approved ? 'Unapprove' : 'Approve'}</button></td>
          </tr>
        `).join('')
        : '<tr><td colspan="5">No completed housekeeping tasks awaiting approval.</td></tr>';
    }

    const maintenanceBody = document.getElementById('maintenanceApprovalTableBody');
    if (maintenanceBody) {
      const repairedTickets = maintenanceTickets.filter((ticket) => String(ticket.status).toLowerCase() === 'repaired');
      maintenanceBody.innerHTML = repairedTickets.length
        ? repairedTickets.map((ticket) => `
          <tr>
            <td>${escapeHtml(ticket.ticket)}</td>
            <td>${escapeHtml(ticket.location)}</td>
            <td>${escapeHtml(ticket.status)}</td>
            <td><span class="status-pill ${ticket.approved ? 'active' : 'inactive'}">${ticket.approved ? 'Approved' : 'Not Approved'}</span></td>
            <td><button type="button" class="approve-btn" data-module="maintenance" data-id="${ticket.id}" data-approved="${ticket.approved ? 'false' : 'true'}">${ticket.approved ? 'Unapprove' : 'Approve'}</button></td>
          </tr>
        `).join('')
        : '<tr><td colspan="5">No repaired maintenance tickets pending approval.</td></tr>';
    }

    const inventoryBody = document.getElementById('inventoryApprovalTableBody');
    if (inventoryBody) {
      inventoryBody.innerHTML = inventoryItems.length
        ? inventoryItems.map((item) => `
          <tr>
            <td>${escapeHtml(item.item)}</td>
            <td>${escapeHtml(item.category)}</td>
            <td>${item.inStock}</td>
            <td>${item.minLevel}</td>
            <td><span class="status-pill watch">${escapeHtml(item.status)}</span></td>
            <td>
              <input
                type="number"
                class="inventory-approve-qty"
                min="1"
                step="1"
                value="${suggestedApprovalQty(item)}"
                aria-label="Order quantity for ${escapeHtml(item.item)}"
              />
            </td>
            <td><button type="button" class="approve-btn" data-module="inventory" data-id="${item.id}">Approve</button></td>
          </tr>
        `).join('')
        : '<tr><td colspan="7">No low stock items awaiting approval.</td></tr>';
    }
  } catch (err) {
    console.error('Could not load approval tables', err);
  }
}

async function updateApproval(moduleName, id, approved, rowElement = null, inventoryQty = null) {
  let url;
  if (moduleName === 'housekeeping') {
    url = '/housekeeping/approve';
  } else if (moduleName === 'maintenance') {
    url = '/maintenance/approve';
  } else if (moduleName === 'inventory') {
    url = '/inventory/approve';
  } else {
    alert('Unknown module.');
    return;
  }

  const body = moduleName === 'inventory'
    ? { id, qty: inventoryQty }
    : { id, approved, role: currentRole };
  
  try {
    const data = await apiPost(url, body);
    if (!data.success) {
      alert(data.message || 'Approval update failed.');
      return;
    }
    
    // Immediately remove the row from UI if provided
    if (rowElement && rowElement instanceof HTMLElement) {
      const tbody = rowElement.parentElement;
      rowElement.style.opacity = '0.5';
      rowElement.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        rowElement.remove();
        
        // If table is now empty, reload to show empty message
        if (tbody && tbody.children.length === 0) {
          loadApprovalTables();
        }
      }, 300);
    } else {
      // Fallback: reload table if row not provided
      loadApprovalTables();
    }
  } catch (err) {
    console.error('Error updating approval:', err);
    alert('An error occurred while updating approval.');
  }
}

async function routeGuestRequest(requestId, targetModule, assignedStaff) {
  const data = await apiPost('/guestservice/route', {
    requestId,
    targetModule,
    assignedStaff: assignedStaff || '',
    role: currentRole,
  });

  if (!data.success) {
    alert(data.message || 'Could not route guest request.');
    return;
  }

  showToast('Request Assigned', `Request ${requestId} has been routed to ${targetModule}.`);
  await Promise.all([loadDashboardMetrics(), loadApprovalTables()]);
}

async function initializeDashboard() {
  await Promise.all([loadDashboardMetrics(), loadApprovalTables()]);
}

async function loadDashboardMetrics() {
  try {
    const [guestRes, housekeepingRes, inventoryRes, maintenanceRes, ordersRes] = await Promise.all([
      fetch('/guestservice/list'),
      fetch('/housekeeping/list'),
      fetch('/inventory/list'),
      fetch('/maintenance/list'),
      fetch('/orders/list')
    ]);

    const guestRequests = guestRes.ok ? await guestRes.json() : [];
    const housekeepingTasks = housekeepingRes.ok ? await housekeepingRes.json() : [];
    const inventoryItems = inventoryRes.ok ? await inventoryRes.json() : [];
    const maintenanceTickets = maintenanceRes.ok ? await maintenanceRes.json() : [];
    const orders = ordersRes.ok ? await ordersRes.json() : [];

    const guestPending = countByStatus(guestRequests, 'status', 'Pending');
    const guestInProgress = countByStatus(guestRequests, 'status', 'In Progress');
    const guestCompleted = countByStatus(guestRequests, 'status', 'Completed');

    setMetric('guestTotalMetric', guestRequests.length);
    setMetric('guestPendingMetric', guestPending);
    setMetric('guestInProgressMetric', guestInProgress);
    setMetric('guestCompletedMetric', guestCompleted);

    const housekeepingPending = countByStatus(housekeepingTasks, 'taskStatus', 'Pending')
      + countByStatus(housekeepingTasks, 'taskStatus', 'Assigned');
    const housekeepingInProgress = countByStatus(housekeepingTasks, 'taskStatus', 'In Progress');
    const housekeepingCompleted = countByStatus(housekeepingTasks, 'taskStatus', 'Completed');

    setMetric('housekeepingTotalMetric', housekeepingTasks.length);
    setMetric('housekeepingPendingMetric', housekeepingPending);
    setMetric('housekeepingInProgressMetric', housekeepingInProgress);
    setMetric('housekeepingCompletedMetric', housekeepingCompleted);

    const inventoryLowStock = countByStatus(inventoryItems, 'status', 'Low Stock');
    const inventoryDamaged = inventoryItems.reduce((sum, item) => sum + Number(item?.damaged || 0), 0);
    const inventoryMissing = inventoryItems.reduce((sum, item) => sum + Number(item?.missing || 0), 0);

    setMetric('inventoryTotalMetric', inventoryItems.length);
    setMetric('inventoryLowStockMetric', inventoryLowStock);
    setMetric('inventoryDamagedMetric', inventoryDamaged);
    setMetric('inventoryMissingMetric', inventoryMissing);

    const maintenancePending = countByStatus(maintenanceTickets, 'status', 'Pending')
      + countByStatus(maintenanceTickets, 'status', 'Open');
    const maintenanceInProgress = countByStatus(maintenanceTickets, 'status', 'In Progress');
    const maintenanceCompleted = countByStatus(maintenanceTickets, 'status', 'Completed')
      + countByStatus(maintenanceTickets, 'status', 'Repaired');
    const maintenanceRejected = maintenanceTickets.filter(
      (ticket) => String(ticket?.supervisorDecision || '').toLowerCase() === 'rejected'
    ).length;

    setMetric('maintenancePendingMetric', maintenancePending);
    setMetric('maintenanceInProgressMetric', maintenanceInProgress);
    setMetric('maintenanceCompletedMetric', maintenanceCompleted);
    setMetric('maintenanceRejectedMetric', maintenanceRejected);

    const ordersPending = countByStatus(orders, 'status', 'Pending');
    const ordersPartial = countByStatus(orders, 'status', 'Partial');
    const ordersComplete = countByStatus(orders, 'status', 'Complete');

    setMetric('ordersTotalMetric', orders.length);
    setMetric('ordersPendingMetric', ordersPending);
    setMetric('ordersPartialMetric', ordersPartial);
    setMetric('ordersCompleteMetric', ordersComplete);

    setMetric('overviewOpenGuestRequestsMetric', guestPending + guestInProgress);
    setMetric('overviewPendingHousekeepingMetric', housekeepingPending + housekeepingInProgress);
    setMetric('overviewLowInventoryMetric', inventoryLowStock);
    setMetric('overviewOpenMaintenanceMetric', maintenancePending + maintenanceInProgress + maintenanceRejected);
  } catch (err) {
    console.error('Could not load dashboard metrics', err);
  }
}

// ── Load all users into datalist + table ─────────────────────────────────
async function loadUsers() {
  try {
    const res = await fetch('/auth/users');
    const users = await res.json();

    const datalist = document.getElementById('usernames-list');
    if (datalist) {
      datalist.innerHTML = users.map(u => `<option value="${u.username}">`).join('');
    }

    const roleOptions = [
      'Manager',
      'Housekeeping Staff',
      'Inventory/Store Manager',
      'Maintenance Staff',
      'Staff Supervisor',
      'Front Desk / Reception Staff',
      'Supplier &amp; Purchase Management'
    ];

    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${escapeHtml(u.username)}</td>
        <td style="color:var(--text-muted)">${escapeHtml(u.staffEmail || '—')}</td>
        <td>
          <select class="user-role-select" data-username="${escapeHtml(u.username)}">
            ${roleOptions.map(role => `<option value="${role}" ${u.role === role ? 'selected' : ''}>${role}</option>`).join('')}
          </select>
        </td>
        <td><span class="status-pill ${u.status ? 'active' : 'inactive'}">${u.status ? 'Active' : 'Inactive'}</span></td>
        <td>
          <button class="user-action-btn user-status-btn" data-username="${escapeHtml(u.username)}" data-active="${u.status ? 'true' : 'false'}" data-action="${u.status ? 'deactivate' : 'activate'}">
            ${u.status ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>
    `).join('');

    // Add event listeners for role dropdowns
    document.querySelectorAll('.user-role-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const username = e.target.dataset.username;
        const newRole = e.target.value;
        await assignUserRole(username, newRole);
      });
    });

    // Add event listeners for status buttons
    document.querySelectorAll('.user-status-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const username = e.target.dataset.username;
        const action = e.target.dataset.action;
        const active = action === 'activate';
        await setUserStatus(username, active);
      });
    });
  } catch (e) {
    console.error('Could not load users', e);
  }
}

async function assignUserRole(username, role) {
  try {
    const data = await apiPut('/auth/assign-role', { username, role });
    if (!data.success) {
      alert(data.message || 'Failed to assign role.');
      loadUsers();
      return;
    }
    showToast('Role Updated', `${username} role has been changed to ${role}`);
    loadUsers();
  } catch (err) {
    console.error('Error assigning role:', err);
    alert('An error occurred while assigning the role.');
    loadUsers();
  }
}

async function setUserStatus(username, active) {
  try {
    const data = await apiPut('/auth/status', { username, active: String(active) });
    if (!data.success) {
      alert(data.message || 'Failed to update account status.');
      loadUsers();
      return;
    }
    const action = active ? 'activated' : 'deactivated';
    showToast('Account Status Updated', `${username} account has been ${action}.`);
    loadUsers();
  } catch (err) {
    console.error('Error updating status:', err);
    alert('An error occurred while updating the account status.');
    loadUsers();
  }
}

loadUsers();
initializeDashboard();
setupNotificationInteractions();
checkLowStockTransitions();
checkGuestRequestNotifications();
checkTaskCompletionNotifications();
startLivePolling();

// ── Create User Account ──────────────────────────────────────────────────
document.getElementById('createUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('createMsg');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  const data = await apiPost('/auth/register', {
    username: document.getElementById('newUsername').value.trim(),
    staffEmail: document.getElementById('newEmail').value.trim(),
    password: document.getElementById('tempPassword').value,
    role: document.getElementById('newRole').value
  });

  showMsg(msg, data.message, data.success);
  btn.disabled = false;
  if (data.success) {
    e.target.reset();
    loadUsers();
  }
});

// ── Deactivate / Activate Account ────────────────────────────────────────
document.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains('approve-btn')) return;

  const moduleName = target.dataset.module;

  if (moduleName === 'guest-route') {
    const requestId = target.dataset.requestid;
    const action = target.dataset.action;
    
    if (action === 'route-with-staff') {
      const row = target.closest('tr');
      const staffSelect = row?.querySelector('.guest-route-staff-select');
      
      if (!(staffSelect instanceof HTMLSelectElement)) {
        alert('Could not read staff selection.');
        return;
      }
      
      const assignedStaff = staffSelect.value;
      const selectedOption = staffSelect.selectedOptions[0];
      const selectedModule = selectedOption?.dataset?.module;
      
      if (!assignedStaff) {
        alert('Please select a staff member.');
        return;
      }
      
      if (!selectedModule) {
        alert('Invalid staff selection.');
        return;
      }
      
      await routeGuestRequest(requestId, selectedModule, assignedStaff);
      return;
    }
    
    const routeTo = target.dataset.route;
    if (!requestId || !routeTo) return;
    await routeGuestRequest(requestId, routeTo);
    return;
  }

  const id = Number(target.dataset.id);
  const approved = String(target.dataset.approved) === 'true';

  if (!moduleName || Number.isNaN(id)) return;

  let inventoryQty = null;
  if (moduleName === 'inventory') {
    const row = target.closest('tr');
    const qtyInput = row?.querySelector('.inventory-approve-qty');
    if (!(qtyInput instanceof HTMLInputElement)) {
      alert('Could not read approval quantity.');
      return;
    }

    const parsedQty = Number.parseInt(qtyInput.value, 10);
    if (!Number.isFinite(parsedQty) || parsedQty < 1) {
      alert('Please enter a valid quantity greater than 0 before approving.');
      qtyInput.focus();
      return;
    }

    inventoryQty = parsedQty;
  }
  
  // Get the row element for immediate UI feedback
  const row = target.closest('tr');
  await updateApproval(moduleName, id, approved, row, inventoryQty);
});

function formatDateTime(value) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
}
