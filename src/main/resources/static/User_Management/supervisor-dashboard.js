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

const currentRole = localStorage.getItem('currentUserRole') || 'Staff Supervisor';

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
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

async function loadApprovalTables() {
  try {
    const [housekeepingRes, maintenanceRes] = await Promise.all([
      fetch('/housekeeping/list'),
      fetch('/maintenance/list')
    ]);

    const housekeepingTasks = housekeepingRes.ok ? await housekeepingRes.json() : [];
    const maintenanceTickets = maintenanceRes.ok ? await maintenanceRes.json() : [];

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
  } catch (err) {
    console.error('Could not load approval tables', err);
  }
}

async function updateApproval(moduleName, id, approved) {
  const url = moduleName === 'housekeeping' ? '/housekeeping/approve' : '/maintenance/approve';
  const data = await apiPost(url, { id, approved, role: currentRole });

  if (!data.success) {
    alert(data.message || 'Approval update failed.');
    return;
  }

  await Promise.all([loadDashboardMetrics(), loadApprovalTables()]);
}

document.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains('approve-btn')) return;

  const moduleName = target.dataset.module;
  const id = Number(target.dataset.id);
  const approved = String(target.dataset.approved) === 'true';

  if (!moduleName || Number.isNaN(id)) return;
  await updateApproval(moduleName, id, approved);
});

loadDashboardMetrics();
loadApprovalTables();
