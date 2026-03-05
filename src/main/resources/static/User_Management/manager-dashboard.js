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

    const guestAssigned = countByStatus(guestRequests, 'status', 'Assigned');
    const guestInProgress = countByStatus(guestRequests, 'status', 'In Progress');
    const guestCompleted = countByStatus(guestRequests, 'status', 'Completed');

    setMetric('guestTotalMetric', guestRequests.length);
    setMetric('guestAssignedMetric', guestAssigned);
    setMetric('guestInProgressMetric', guestInProgress);
    setMetric('guestCompletedMetric', guestCompleted);

    const housekeepingAssigned = countByStatus(housekeepingTasks, 'taskStatus', 'Assigned');
    const housekeepingInProgress = countByStatus(housekeepingTasks, 'taskStatus', 'In Progress');
    const housekeepingCompleted = countByStatus(housekeepingTasks, 'taskStatus', 'Completed');

    setMetric('housekeepingTotalMetric', housekeepingTasks.length);
    setMetric('housekeepingAssignedMetric', housekeepingAssigned);
    setMetric('housekeepingInProgressMetric', housekeepingInProgress);
    setMetric('housekeepingCompletedMetric', housekeepingCompleted);

    const inventoryLowStock = countByStatus(inventoryItems, 'status', 'Low Stock');
    const inventoryDamaged = inventoryItems.reduce((sum, item) => sum + Number(item?.damaged || 0), 0);
    const inventoryMissing = inventoryItems.reduce((sum, item) => sum + Number(item?.missing || 0), 0);

    setMetric('inventoryTotalMetric', inventoryItems.length);
    setMetric('inventoryLowStockMetric', inventoryLowStock);
    setMetric('inventoryDamagedMetric', inventoryDamaged);
    setMetric('inventoryMissingMetric', inventoryMissing);

    const maintenanceOpen = countByStatus(maintenanceTickets, 'status', 'Open');
    const maintenanceInProgress = countByStatus(maintenanceTickets, 'status', 'In Progress');
    const maintenanceRepaired = countByStatus(maintenanceTickets, 'status', 'Repaired');
    const maintenanceReplacement = countByStatus(maintenanceTickets, 'status', 'Replacement Needed');

    setMetric('maintenanceOpenMetric', maintenanceOpen);
    setMetric('maintenanceInProgressMetric', maintenanceInProgress);
    setMetric('maintenanceRepairedMetric', maintenanceRepaired);
    setMetric('maintenanceReplacementMetric', maintenanceReplacement);

    const ordersPending = countByStatus(orders, 'status', 'Pending');
    const ordersPartial = countByStatus(orders, 'status', 'Partial');
    const ordersComplete = countByStatus(orders, 'status', 'Complete');

    setMetric('ordersTotalMetric', orders.length);
    setMetric('ordersPendingMetric', ordersPending);
    setMetric('ordersPartialMetric', ordersPartial);
    setMetric('ordersCompleteMetric', ordersComplete);

    setMetric('overviewOpenGuestRequestsMetric', guestAssigned + guestInProgress);
    setMetric('overviewPendingHousekeepingMetric', housekeepingAssigned + housekeepingInProgress);
    setMetric('overviewLowInventoryMetric', inventoryLowStock);
    setMetric('overviewOpenMaintenanceMetric', maintenanceOpen + maintenanceInProgress + maintenanceReplacement);
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
loadDashboardMetrics();

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
