/**
 * Supplier & Purchase Management
 * CRUD operations backed by the /orders REST API
 */

let selectedNotificationId = null;
const SUPPLIER_ALERT_POLL_MS = 5000;
const MAX_SUPPLIER_FEED_ITEMS = 8;

let supplierAlertTimer = null;
let supplierBaselineSet = false;
let knownSupplierApprovalIds = new Set();
let clearedSupplierApprovalIds = new Set();
let latestSupplierNotifications = [];
let purchaseOrdersCache = [];
let nextPoIdCache = '';
let nextPoIdInFlight = null;
let supplierSyncInFlight = false;
let supplierInventoryDecisionBaseline = false;
let knownInventoryDecisionSignatures = new Set();
let latestInventoryDecisions = [];

const supplierApprovalBadge = document.getElementById('supplierApprovalBadge');
const supplierApprovalFeed = document.getElementById('supplierApprovalFeed');
const supplierInventoryDecisionBadge = document.getElementById('supplierInventoryDecisionBadge');
const inventoryDecisionBody = document.getElementById('inventoryDecisionBody');
const supplierToastStack = document.getElementById('supplierToastStack');
const supplierClearAlertsBtn = document.getElementById('supplierClearAlertsBtn');

function broadcastInventoryUpdate() {
  try {
    localStorage.setItem('inventoryUpdateSignal', String(Date.now()));
  } catch {
    // Storage may be blocked; polling still updates notifications.
  }
}

document.addEventListener('DOMContentLoaded', () => {
  Promise.all([loadAndRender(), loadNotifications()]);
  attachEventListeners();
  startSupplierApprovalPolling();
  primeNextPoId();
});

async function loadAndRender() {
  try {
    const res = await fetch('/orders/list');
    if (!res.ok) throw new Error('Failed to load purchase orders.');
    const pos = await res.json();
    purchaseOrdersCache = Array.isArray(pos) ? pos : [];
    renderMetrics(pos);
    renderTable(pos);
  } catch (err) {
    showMessage('Error loading purchase orders: ' + err.message);
  }
}

function renderMetrics(pos) {
  document.getElementById('totalPosMetric').textContent = pos.length;
  document.getElementById('pendingMetric').textContent = pos.filter((p) => p.status === 'Pending').length;
  document.getElementById('partialMetric').textContent = pos.filter((p) => p.status === 'Partial').length;
  document.getElementById('completeMetric').textContent = pos.filter((p) => p.status === 'Complete').length;
}

function statusFromPo(status) {
  const statusMap = {
    'Pending': 'pending',
    'Partial': 'partial',
    'Complete': 'done',
  };
  return statusMap[status] || 'pending';
}

function renderTable(pos) {
  const tbody = document.getElementById('posTableBody');
  tbody.innerHTML = '';

  if (pos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">
          No purchase orders recorded. Click "Add PO" to create one.
        </td>
      </tr>
    `;
    return;
  }

  pos.forEach((po) => {
    const statusClass = statusFromPo(po.status);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(po.poid)}</td>
      <td>${escapeHtml(po.supplier)}</td>
      <td>${escapeHtml(po.item)}</td>
      <td>${po.qty}</td>
      <td><span class="tag ${statusClass}">${escapeHtml(po.status)}</span></td>
      <td>
        <div class="action-buttons">
          <button type="button" class="edit-btn" data-action="edit" data-id="${po.id}">Edit</button>
          <button type="button" class="delete-btn" data-action="delete" data-id="${po.id}" data-poid="${escapeHtml(po.poid)}">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function getInventoryDecisionSignature(decision) {
  return `${decision?.id || ''}:${decision?.inventoryReviewedAt || ''}:${decision?.inventoryReviewStatus || ''}`;
}

function updateInventoryDecisionBadge(currentVisibleCount) {
  if (!supplierInventoryDecisionBadge) {
    return;
  }

  supplierInventoryDecisionBadge.textContent = String(currentVisibleCount);
}

function renderInventoryDecisionFeed(decisions) {
  if (!inventoryDecisionBody) {
    return;
  }

  inventoryDecisionBody.innerHTML = '';
  updateInventoryDecisionBadge(decisions.length);

  if (decisions.length === 0) {
    inventoryDecisionBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">
          No inventory decisions yet.
        </td>
      </tr>
    `;
    return;
  }

  decisions.forEach((decision) => {
    const status = String(decision?.inventoryReviewStatus || 'Pending');
    const statusClass = status === 'Approved' ? 'done' : 'partial';
    const rejectionReason = String(decision?.inventoryRejectionReason || '-');

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(decision.item || '')}</td>
      <td>${escapeHtml(decision.supplier || '')}</td>
      <td>${Number(decision.qty ?? 0)}</td>
      <td><span class="tag ${statusClass}">${escapeHtml(status)}</span></td>
      <td>${escapeHtml(rejectionReason)}</td>
      <td>${escapeHtml(formatDateTime(decision.inventoryReviewedAt))}</td>
    `;
    inventoryDecisionBody.appendChild(row);
  });
}

async function loadInventoryDecisions() {
  const res = await fetch('/orders/inventory-review-decisions');
  if (!res.ok) {
    throw new Error('Failed to load inventory decisions.');
  }

  return res.json();
}

async function pollInventoryDecisions() {
  try {
    const decisions = await loadInventoryDecisions();
    latestInventoryDecisions = Array.isArray(decisions) ? decisions : [];
    const currentSignatures = new Set(latestInventoryDecisions.map((decision) => getInventoryDecisionSignature(decision)));

    if (!supplierInventoryDecisionBaseline) {
      supplierInventoryDecisionBaseline = true;
      knownInventoryDecisionSignatures = currentSignatures;
      renderInventoryDecisionFeed(latestInventoryDecisions);
      return;
    }

    latestInventoryDecisions
      .filter((decision) => !knownInventoryDecisionSignatures.has(getInventoryDecisionSignature(decision)))
      .forEach((decision) => {
        const itemName = String(decision?.item || 'Purchase order');
        const supplier = String(decision?.supplier || 'Supplier');
        const status = String(decision?.inventoryReviewStatus || 'Updated');
        const reason = String(decision?.inventoryRejectionReason || '');
        const reasonSuffix = reason ? ` Reason: ${reason}` : '';

        showSupplierToast(
          'Inventory Decision Received',
          `${itemName} from ${supplier} was ${status.toLowerCase()}.${reasonSuffix}`
        );
      });

    renderInventoryDecisionFeed(latestInventoryDecisions);
    knownInventoryDecisionSignatures = currentSignatures;
  } catch (err) {
    showMessage('Error loading inventory decisions: ' + err.message);
  }
}

async function syncSupplierSnapshot() {
  if (supplierSyncInFlight) {
    return;
  }

  supplierSyncInFlight = true;
  try {
    await loadAndRender();
  } finally {
    supplierSyncInFlight = false;
  }
}

async function loadNotifications() {
  try {
    const res = await fetch('/inventory/approved-low-stock-notifications');
    if (!res.ok) throw new Error('Failed to load low stock notifications.');
    const notifications = await res.json();
    latestSupplierNotifications = Array.isArray(notifications) ? notifications : [];
    renderNotifications(notifications);
    return notifications;
  } catch (err) {
    showMessage('Error loading low stock notifications: ' + err.message);
    return [];
  }
}

function renderSupplierApprovalFeed(notifications) {
  if (!supplierApprovalFeed) {
    return;
  }

  supplierApprovalFeed.innerHTML = '';
  if (notifications.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No live alerts yet.';
    supplierApprovalFeed.appendChild(li);
    return;
  }

  notifications.slice(0, MAX_SUPPLIER_FEED_ITEMS).forEach((notification) => {
    const approvedQty = Number(notification?.suggestedQty ?? 1);
    const li = document.createElement('li');
    li.textContent = `${notification.itemName} was approved by ${notification.approvedBy || 'Manager'} for ${approvedQty} units at ${formatDateTime(notification.approvedAt)}.`;
    supplierApprovalFeed.appendChild(li);
  });
}

function updateSupplierApprovalBadge(currentVisibleCount) {
  if (!supplierApprovalBadge) {
    return;
  }
  supplierApprovalBadge.textContent = String(currentVisibleCount);
}

function showSupplierToast(title, text) {
  if (!supplierToastStack) {
    return;
  }

  const toast = document.createElement('article');
  toast.className = 'supplier-toast';
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p>`;
  supplierToastStack.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 4200);
}

async function pollSupplierApprovals() {
  const notifications = await loadNotifications();
  latestSupplierNotifications = notifications;
  const currentIds = new Set(notifications.map((notification) => Number(notification.id)));

  if (!supplierBaselineSet) {
    knownSupplierApprovalIds = currentIds;
    supplierBaselineSet = true;
    const visibleAtStart = notifications.filter(
      (notification) => !clearedSupplierApprovalIds.has(Number(notification.id))
    );
    renderSupplierApprovalFeed(visibleAtStart);
    updateSupplierApprovalBadge(visibleAtStart.length);
    return;
  }

  const newApprovals = notifications.filter((notification) => !knownSupplierApprovalIds.has(Number(notification.id)));
  newApprovals.forEach((notification) => {
    const approvedQty = Number(notification?.suggestedQty ?? 1);
    showSupplierToast(
      'Manager Approval Received',
      `${notification.itemName} low-stock request was approved for ${approvedQty} units and is ready for PO creation.`
    );
  });

  const visibleNotifications = notifications.filter(
    (notification) => !clearedSupplierApprovalIds.has(Number(notification.id))
  );
  renderSupplierApprovalFeed(visibleNotifications);
  updateSupplierApprovalBadge(visibleNotifications.length);
  knownSupplierApprovalIds = currentIds;
}

function clearSupplierAlerts() {
  latestSupplierNotifications.forEach((notification) => {
    clearedSupplierApprovalIds.add(Number(notification.id));
  });

  renderSupplierApprovalFeed([]);
  updateSupplierApprovalBadge(0);
}

function startSupplierApprovalPolling() {
  if (supplierAlertTimer !== null) {
    return;
  }

  syncSupplierSnapshot();
  pollSupplierApprovals();
  pollInventoryDecisions();
  supplierAlertTimer = window.setInterval(() => {
    syncSupplierSnapshot();
    pollSupplierApprovals();
    pollInventoryDecisions();
  }, SUPPLIER_ALERT_POLL_MS);

  window.addEventListener('beforeunload', () => {
    if (supplierAlertTimer !== null) {
      window.clearInterval(supplierAlertTimer);
      supplierAlertTimer = null;
    }
  });

  if (supplierApprovalFeed) {
    supplierApprovalFeed.addEventListener('mouseenter', () => {
      const visibleNotifications = latestSupplierNotifications.filter(
        (notification) => !clearedSupplierApprovalIds.has(Number(notification.id))
      );
      updateSupplierApprovalBadge(visibleNotifications.length);
    });
  }

  if (supplierClearAlertsBtn) {
    supplierClearAlertsBtn.addEventListener('click', clearSupplierAlerts);
  }
}

function renderNotifications(notifications) {
  const badge = document.getElementById('lowStockNotificationBadge');
  const tbody = document.getElementById('lowStockNotificationBody');

  badge.textContent = String(notifications.length);
  tbody.innerHTML = '';

  if (notifications.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">
          No approved low stock alerts waiting for purchase orders.
        </td>
      </tr>
    `;
    return;
  }

  notifications.forEach((notification) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(formatDateTime(notification.approvedAt))}</td>
      <td>${escapeHtml(notification.itemName)}</td>
      <td>${escapeHtml(notification.category)}</td>
      <td>${Number(notification.inStock ?? 0)}</td>
      <td>${Number(notification.minLevel ?? 0)}</td>
      <td>${Number(notification.suggestedQty ?? 1)}</td>
      <td>
        <button type="button" class="notif-create-btn" data-action="create-po" data-notification-id="${notification.id}" data-item="${escapeHtml(notification.itemName)}" data-qty="${Number(notification.suggestedQty ?? 1)}">
          Create PO
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function attachEventListeners() {
  document.getElementById('openAddDialogBtn').addEventListener('click', () => {
    openAddDialog();
  });

  document.getElementById('cancelAddDialogBtn').addEventListener('click', () => {
    document.getElementById('addPoDialog').close();
  });

  document.getElementById('cancelUpdateDialogBtn').addEventListener('click', () => {
    document.getElementById('updatePoDialog').close();
  });

  document.getElementById('addPoForm').addEventListener('submit', handleAddSubmit);
  document.getElementById('updatePoForm').addEventListener('submit', handleUpdateSubmit);

  document.getElementById('posTableBody').addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    const id = Number(e.target.dataset.id);

    if (!action || !id) return;

    if (action === 'edit') {
      await openUpdateDialog(id);
    } else if (action === 'delete') {
      const poidLabel = e.target.dataset.poid || 'this order';
      await handleDelete(id, poidLabel);
    }
  });

  document.getElementById('lowStockNotificationBody').addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (action !== 'create-po') return;

    const notificationId = Number(e.target.dataset.notificationId);
    const item = e.target.dataset.item || '';
    const qty = Number(e.target.dataset.qty || '1');

    await openAddDialog({
      notificationId,
      item,
      qty,
      status: 'Pending',
    });
  });
}

async function fetchNextPoId() {
  const res = await fetch('/orders/next-po-id');
  if (!res.ok) throw new Error('Failed to generate PO ID.');
  const data = await res.json();
  return data.poid || '';
}

async function primeNextPoId(force = false) {
  if (!force && nextPoIdCache) {
    return nextPoIdCache;
  }

  if (nextPoIdInFlight) {
    return nextPoIdInFlight;
  }

  nextPoIdInFlight = fetchNextPoId()
    .then((poid) => {
      nextPoIdCache = poid;
      return poid;
    })
    .finally(() => {
      nextPoIdInFlight = null;
    });

  return nextPoIdInFlight;
}

async function openAddDialog(prefill = null) {
  document.getElementById('addPoForm').reset();
  selectedNotificationId = null;

  const poIdInput = document.getElementById('poId');
  poIdInput.value = nextPoIdCache || '';
  poIdInput.placeholder = nextPoIdCache ? 'Auto-generated' : 'Generating PO ID...';

  if (prefill) {
    selectedNotificationId = prefill.notificationId || null;
    document.getElementById('itemName').value = prefill.item || '';
    document.getElementById('orderedQty').value = String(prefill.qty || 1);
    document.getElementById('poStatus').value = prefill.status || 'Pending';
  }

  document.getElementById('addPoDialog').showModal();

  try {
    const nextPoId = await primeNextPoId();
    if (document.getElementById('addPoDialog').open) {
      poIdInput.value = nextPoId;
      poIdInput.placeholder = 'Auto-generated';
    }
  } catch {
    if (document.getElementById('addPoDialog').open) {
      showMessage('Could not generate PO ID. Please try again.');
    }
  }
}

async function openUpdateDialog(id) {
  try {
    const res = await fetch('/orders/list');
    const pos = await res.json();
    const po = pos.find((p) => p.id === id);

    if (!po) {
      showMessage('Purchase order not found.');
      return;
    }

    document.getElementById('updatePoDbId').value = String(po.id);
    document.getElementById('updatePoId').value = po.poid;
    document.getElementById('updateSupplierName').value = po.supplier;
    document.getElementById('updateItemName').value = po.item;
    document.getElementById('updateOrderedQty').value = String(po.qty);
    document.getElementById('updatePoStatus').value = po.status;

    document.getElementById('updatePoDialog').showModal();
  } catch {
    showMessage('Error fetching order details.');
  }
}

async function handleAddSubmit(e) {
  e.preventDefault();

  const submitBtn = document.querySelector('#addPoForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
  }

  const poid = document.getElementById('poId').value.trim();
  if (!poid) {
    showMessage('Please enter a valid PO ID.');
    if (submitBtn) {
      submitBtn.disabled = false;
    }
    return;
  }

  const payload = {
    poid,
    supplier: document.getElementById('supplierName').value.trim(),
    item: document.getElementById('itemName').value.trim(),
    qty: parseInt(document.getElementById('orderedQty').value, 10),
    status: document.getElementById('poStatus').value,
    notificationId: selectedNotificationId,
  };

  try {
    const res = await fetch('/orders/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!data.success) {
      showMessage(data.message || 'Failed to add purchase order.');
      if (submitBtn) {
        submitBtn.disabled = false;
      }
      return;
    }

    if (data.order && Number.isInteger(Number(data.order.id))) {
      const newId = Number(data.order.id);
      const exists = purchaseOrdersCache.some((order) => Number(order?.id) === newId);
      if (!exists) {
        purchaseOrdersCache.push(data.order);
      }
      renderMetrics(purchaseOrdersCache);
      renderTable(purchaseOrdersCache);
    }

    if (payload.notificationId) {
      const notificationId = Number(payload.notificationId);
      latestSupplierNotifications = latestSupplierNotifications.filter(
        (notification) => Number(notification.id) !== notificationId
      );
      const visibleNotifications = latestSupplierNotifications.filter(
        (notification) => !clearedSupplierApprovalIds.has(Number(notification.id))
      );
      renderNotifications(latestSupplierNotifications);
      renderSupplierApprovalFeed(visibleNotifications);
      updateSupplierApprovalBadge(visibleNotifications.length);
    }

    document.getElementById('addPoDialog').close();
    document.getElementById('addPoForm').reset();
    selectedNotificationId = null;
    nextPoIdCache = '';
    showMessage(data.message || 'Purchase order added successfully!');
    if (payload.notificationId) {
      broadcastInventoryUpdate();
    }
    primeNextPoId(true);
  } catch {
    showMessage('Error adding purchase order.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }
}

async function handleUpdateSubmit(e) {
  e.preventDefault();

  const id = Number(document.getElementById('updatePoDbId').value);
  const poid = document.getElementById('updatePoId').value.trim();

  if (!poid) {
    showMessage('Please enter a valid PO ID.');
    return;
  }

  const payload = {
    id,
    poid,
    supplier: document.getElementById('updateSupplierName').value.trim(),
    item: document.getElementById('updateItemName').value.trim(),
    qty: parseInt(document.getElementById('updateOrderedQty').value, 10),
    status: document.getElementById('updatePoStatus').value,
  };

  try {
    const res = await fetch('/orders/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!data.success) {
      showMessage(data.message || 'Failed to update purchase order.');
      return;
    }

    document.getElementById('updatePoDialog').close();
    document.getElementById('updatePoForm').reset();
    showMessage(data.message || 'Purchase order updated successfully!');
    broadcastInventoryUpdate();
    await loadAndRender();
  } catch {
    showMessage('Error updating purchase order.');
  }
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

async function handleDelete(id, poidLabel) {
  if (!confirm(`Are you sure you want to delete purchase order ${poidLabel}?`)) return;

  try {
    const res = await fetch('/orders/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    showMessage(data.message || 'Purchase order deleted successfully!');
    await loadAndRender();
  } catch {
    showMessage('Error deleting purchase order.');
  }
}

function showMessage(message) {
  const messageEl = document.getElementById('poMessage');
  messageEl.textContent = message;
  messageEl.classList.add('show');

  setTimeout(() => {
    messageEl.classList.remove('show');
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}
