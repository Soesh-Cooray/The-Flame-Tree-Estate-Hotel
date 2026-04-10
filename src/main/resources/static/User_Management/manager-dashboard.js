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
let unseenNotificationCount = 0;

const notificationBadge = document.getElementById('notificationBadge');
const notificationList = document.getElementById('notificationList');
const notificationPermissionBtn = document.getElementById('notificationPermissionBtn');
const notificationPermissionText = document.getElementById('notificationPermissionText');
const dashboardToastStack = document.getElementById('dashboardToastStack');

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateNotificationBadge() {
  if (!notificationBadge) {
    return;
  }

  if (unseenNotificationCount <= 0) {
    notificationBadge.hidden = true;
    notificationBadge.textContent = '0';
    return;
  }

  notificationBadge.hidden = false;
  notificationBadge.textContent = String(unseenNotificationCount);
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

async function pollDashboardLiveUpdates() {
  if (pollInFlight) {
    return;
  }

  pollInFlight = true;
  try {
    await Promise.all([
      loadDashboardMetrics(),
      loadApprovalTables(),
      checkLowStockTransitions()
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
    if (document.visibilityState === 'visible') {
      markNotificationsSeen();
    }
  });

  if (notificationList) {
    notificationList.addEventListener('mouseenter', markNotificationsSeen);
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'inventoryUpdateSignal') {
      pollDashboardLiveUpdates();
    }
  });

  updateNotificationPermissionUI();
}

async function loadApprovalTables() {
  try {
    const [guestRoutingRes, housekeepingRes, maintenanceRes, inventoryRes] = await Promise.all([
      fetch('/guestservice/routing-pending'),
      fetch('/housekeeping/list'),
      fetch('/maintenance/list'),
      fetch('/inventory/low-stock-pending')
    ]);

    const routingRequests = guestRoutingRes.ok ? await guestRoutingRes.json() : [];
    const housekeepingTasks = housekeepingRes.ok ? await housekeepingRes.json() : [];
    const maintenanceTickets = maintenanceRes.ok ? await maintenanceRes.json() : [];
    const inventoryItems = inventoryRes.ok ? await inventoryRes.json() : [];

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
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button type="button" class="approve-btn" data-module="guest-route" data-route="housekeeping" data-requestid="${escapeHtml(request.requestId)}">Housekeeping</button>
                <button type="button" class="approve-btn" data-module="guest-route" data-route="maintenance" data-requestid="${escapeHtml(request.requestId)}">Maintenance</button>
              </div>
            </td>
          </tr>
        `).join('')
        : '<tr><td colspan="5">No new guest requests waiting for routing.</td></tr>';
    }

    const housekeepingBody = document.getElementById('housekeepingApprovalTableBody');
    if (housekeepingBody) {
      const completedTasks = housekeepingTasks.filter((task) => String(task.taskStatus).toLowerCase() === 'completed');
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
        : '<tr><td colspan="5">No completed housekeeping tasks pending approval.</td></tr>';
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
            <td><button type="button" class="approve-btn" data-module="inventory" data-id="${item.id}">Approve</button></td>
          </tr>
        `).join('')
        : '<tr><td colspan="6">No low stock items awaiting approval.</td></tr>';
    }
  } catch (err) {
    console.error('Could not load approval tables', err);
  }
}

async function updateApproval(moduleName, id, approved) {
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

  const body = moduleName === 'inventory' ? { id } : { id, approved, role: currentRole };
  const data = await apiPost(url, body);
  if (!data.success) {
    alert(data.message || 'Approval update failed.');
    return;
  }
  
  loadApprovalTables();
}

async function routeGuestRequest(requestId, targetModule) {
  const data = await apiPost('/guestservice/route', {
    requestId,
    targetModule,
    role: currentRole,
  });

  if (!data.success) {
    alert(data.message || 'Could not route guest request.');
    return;
  }

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
    datalist.innerHTML = users.map(u => `<option value="${u.username}">`).join('');

    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.username}</td>
        <td style="color:var(--text-muted)">${u.staffEmail || '—'}</td>
        <td>${u.role || '—'}</td>
        <td><span class="status-pill ${u.status ? 'active' : 'inactive'}">${u.status ? 'Active' : 'Inactive'}</span></td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Could not load users', e);
  }
}

loadUsers();
initializeDashboard();
setupNotificationInteractions();
checkLowStockTransitions();
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

// ── Assign Role ──────────────────────────────────────────────────────────
document.getElementById('assignRoleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('assignMsg');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  const data = await apiPut('/auth/assign-role', {
    username: document.getElementById('staffUser').value.trim(),
    role: document.getElementById('role').value
  });

  showMsg(msg, data.message, data.success);
  btn.disabled = false;
  if (data.success) {
    e.target.reset();
    loadUsers();
  }
});

// ── Deactivate / Activate Account ────────────────────────────────────────
async function setAccountStatus(active) {
  const username = document.getElementById('deactivateUser').value.trim();
  const msg = document.getElementById('statusMsg');

  if (!username) {
    showMsg(msg, 'Please enter a username.', false);
    return;
  }

  const data = await apiPut('/auth/status', { username, active: String(active) });
  showMsg(msg, data.message, data.success);
  if (data.success) {
    document.getElementById('statusForm').reset();
    loadUsers();
  }
}

document.getElementById('deactivateBtn').addEventListener('click', () => setAccountStatus(false));
document.getElementById('activateBtn').addEventListener('click', () => setAccountStatus(true));

document.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains('approve-btn')) return;

  const moduleName = target.dataset.module;

  if (moduleName === 'guest-route') {
    const requestId = target.dataset.requestid;
    const routeTo = target.dataset.route;
    if (!requestId || !routeTo) return;
    await routeGuestRequest(requestId, routeTo);
    return;
  }

  const id = Number(target.dataset.id);
  const approved = String(target.dataset.approved) === 'true';

  if (!moduleName || Number.isNaN(id)) return;
  await updateApproval(moduleName, id, approved);
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
