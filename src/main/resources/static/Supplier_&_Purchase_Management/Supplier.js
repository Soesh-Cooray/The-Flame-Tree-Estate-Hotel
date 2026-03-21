/**
 * Supplier & Purchase Management
 * CRUD operations backed by the /orders REST API
 */

let selectedNotificationId = null;

document.addEventListener('DOMContentLoaded', () => {
  Promise.all([loadAndRender(), loadNotifications()]);
  attachEventListeners();
});

async function loadAndRender() {
  try {
    const res = await fetch('/orders/list');
    if (!res.ok) throw new Error('Failed to load purchase orders.');
    const pos = await res.json();
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

async function loadNotifications() {
  try {
    const res = await fetch('/inventory/approved-low-stock-notifications');
    if (!res.ok) throw new Error('Failed to load low stock notifications.');
    const notifications = await res.json();
    renderNotifications(notifications);
  } catch (err) {
    showMessage('Error loading low stock notifications: ' + err.message);
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

async function openAddDialog(prefill = null) {
  document.getElementById('addPoForm').reset();
  selectedNotificationId = null;

  try {
    const nextPoId = await fetchNextPoId();
    document.getElementById('poId').value = nextPoId;
  } catch {
    showMessage('Could not generate PO ID. Please try again.');
    return;
  }

  if (prefill) {
    selectedNotificationId = prefill.notificationId || null;
    document.getElementById('itemName').value = prefill.item || '';
    document.getElementById('orderedQty').value = String(prefill.qty || 1);
    document.getElementById('poStatus').value = prefill.status || 'Pending';
  }

  document.getElementById('addPoDialog').showModal();
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

  const poid = document.getElementById('poId').value.trim();
  if (!poid) {
    showMessage('Please enter a valid PO ID.');
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
      return;
    }

    document.getElementById('addPoDialog').close();
    document.getElementById('addPoForm').reset();
    selectedNotificationId = null;
    showMessage(data.message || 'Purchase order added successfully!');
    await Promise.all([loadAndRender(), loadNotifications()]);
  } catch {
    showMessage('Error adding purchase order.');
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
