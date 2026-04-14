/**
 * Housekeeping Management
 * CRUD operations backed by the /housekeeping REST API
 */

document.addEventListener('DOMContentLoaded', () => {
  loadAndRender();
  loadUsageSection();
  loadNotifications();
  initRealtime();
  attachEventListeners();
});

let housekeepingStaffOptions = [];
let housekeepingEventSource = null;

function broadcastInventoryUpdate() {
  try {
    localStorage.setItem('inventoryUpdateSignal', String(Date.now()));
  } catch {
    // Storage may be blocked in some browser modes; polling still works.
  }
}

async function loadAndRender() {
  try {
    const res = await fetch('/housekeeping/list');
    if (!res.ok) throw new Error('Failed to load tasks.');
    const tasks = await res.json();
    renderMetrics(tasks);
    renderTable(tasks);
  } catch (err) {
    showMessage('Error loading tasks: ' + err.message);
  }
}

function renderMetrics(tasks) {
  document.getElementById('totalTasksMetric').textContent = tasks.length;
  document.getElementById('assignedMetric').textContent = tasks.filter((t) => t.taskStatus === 'Pending' || t.taskStatus === 'Assigned').length;
  document.getElementById('inProgressMetric').textContent = tasks.filter((t) => t.taskStatus === 'In Progress').length;
  document.getElementById('completedMetric').textContent = tasks.filter((t) => t.taskStatus === 'Completed').length;
}

function statusFromTask(status) {
  const statusMap = {
    'Pending': 'assigned',
    'Assigned': 'assigned',
    'In Progress': 'clean',
    'Completed': 'completed',
  };
  return statusMap[status] || 'assigned';
}

function approvalLabel(approved) {
  return approved ? 'Approved' : 'Not Approved';
}

function renderTable(tasks) {
  const tbody = document.getElementById('tasksTableBody');
  tbody.innerHTML = '';

  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">
          No housekeeping tasks recorded. Click "Add Task" to create one.
        </td>
      </tr>
    `;
    return;
  }

  tasks.forEach((task) => {
    const statusClass = statusFromTask(task.taskStatus);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(task.requestId)}</td>
      <td>${escapeHtml(task.room)}</td>
      <td>${escapeHtml(task.requestType)}</td>
      <td>${escapeHtml(task.assignedStaff)}</td>
      <td><span class="tag ${statusClass}">${escapeHtml(task.taskStatus)}</span></td>
      <td><span class="tag ${task.approved ? 'done' : 'assigned'}">${escapeHtml(task.supervisorDecision || approvalLabel(Boolean(task.approved)))}</span></td>
      <td>
        <div class="action-buttons">
          <button type="button" class="edit-btn" data-action="edit" data-id="${task.id}">Edit</button>
          <button type="button" class="delete-btn" data-action="delete" data-id="${task.id}" data-request="${escapeHtml(task.requestId)}">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function attachEventListeners() {
  document.getElementById('openAddDialogBtn').addEventListener('click', openAddDialog);
  document.getElementById('clearNotificationsBtn')?.addEventListener('click', clearNotifications);
  document.getElementById('requestType').addEventListener('change', toggleCustomRequestTypeInput);

  document.getElementById('cancelAddDialogBtn').addEventListener('click', () => {
    document.getElementById('addTaskDialog').close();
  });

  document.getElementById('cancelUpdateDialogBtn').addEventListener('click', () => {
    document.getElementById('updateTaskDialog').close();
  });

  document.getElementById('addTaskForm').addEventListener('submit', handleAddSubmit);
  document.getElementById('updateTaskForm').addEventListener('submit', handleUpdateSubmit);
  document.getElementById('usageForm').addEventListener('submit', handleUsageSubmit);

  document.getElementById('tasksTableBody').addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    const id = Number(e.target.dataset.id);

    if (!action || !id) return;

    if (action === 'edit') {
      await openUpdateDialog(id);
    } else if (action === 'delete') {
      const requestLabel = e.target.dataset.request || 'this task';
      await handleDelete(id, requestLabel);
    }
  });
}

async function clearNotifications() {
  try {
    const res = await fetch('/workflow/notifications/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audience: 'HOUSEKEEPING' }),
    });
    let data = {};
    const raw = await res.text();
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { message: 'Unexpected server response while clearing notifications.' };
      }
    }

    if (!res.ok || data.success === false) {
      throw new Error(data.message || 'Failed to clear notifications.');
    }

    renderNotifications([]);
    showMessage('Notifications cleared.');
  } catch (error) {
    const reason = error?.message === 'Failed to fetch'
      ? 'Cannot reach server. Open this page from http://localhost:8080 and make sure backend is running.'
      : (error.message || 'Failed to clear notifications.');
    showMessage(reason);
  }
}

async function loadUsageSection() {
  await Promise.all([
    loadHousekeepingStaffDropdown('usageStaffName'),
    loadInventoryItemDropdown(),
    loadUsageLogs()
  ]);
}

async function loadHousekeepingStaffDropdown(selectId) {
  const select = document.getElementById(selectId);
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  try {
    const res = await fetch('/auth/users');
    if (!res.ok) {
      throw new Error('Failed to load users.');
    }

    const users = await res.json();
    const staff = (Array.isArray(users) ? users : [])
      .filter((user) => Boolean(user?.status))
      .filter((user) => normalizeRole(user?.role).includes('housekeeping'))
      .map((user) => String(user?.username || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    housekeepingStaffOptions = [...new Set(staff)];
  } catch {
    housekeepingStaffOptions = [];
  }

  if (!housekeepingStaffOptions.length) {
    select.innerHTML = '<option value="">No active housekeeping staff found</option>';
    return;
  }

  select.innerHTML = `
    <option value="">Select housekeeping staff</option>
    ${housekeepingStaffOptions.map((name) => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`).join('')}
  `;
}

async function loadInventoryItemDropdown() {
  const select = document.getElementById('usageInventoryItem');
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  try {
    const res = await fetch('/inventory/list');
    if (!res.ok) {
      throw new Error('Failed to load inventory.');
    }

    const items = await res.json();
    const sorted = (Array.isArray(items) ? items : []).sort((a, b) =>
      String(a?.item || '').localeCompare(String(b?.item || ''))
    );

    if (!sorted.length) {
      select.innerHTML = '<option value="">No inventory items found</option>';
      return;
    }

    select.innerHTML = `
      <option value="">Select inventory item</option>
      ${sorted
        .map((item) => `<option value="${Number(item.id)}">${escapeHtml(item.item)} (${Number(item.inStock || 0)} in stock)</option>`)
        .join('')}
    `;
  } catch {
    select.innerHTML = '<option value="">Could not load inventory items</option>';
  }
}

async function loadUsageLogs() {
  const tbody = document.getElementById('usageTableBody');
  if (!(tbody instanceof HTMLElement)) {
    return;
  }

  try {
    const res = await fetch('/housekeeping/inventory-usage/list');
    if (!res.ok) {
      throw new Error('Failed to load usage logs.');
    }

    const rows = await res.json();
    tbody.innerHTML = '';

    if (!Array.isArray(rows) || rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">
            No inventory usage logs yet.
          </td>
        </tr>
      `;
      return;
    }

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(formatDateTime(row.usedAt))}</td>
        <td>${escapeHtml(row.itemName)}</td>
        <td>${escapeHtml(row.staffName)}</td>
        <td>${Number(row.usedQty || 0)}</td>
        <td>${Number(row.damagedQty || 0)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">
          Could not load usage logs.
        </td>
      </tr>
    `;
  }
}

async function handleUsageSubmit(event) {
  event.preventDefault();

  const inventoryId = Number(document.getElementById('usageInventoryItem').value);
  const staffName = document.getElementById('usageStaffName').value;
  const usedQty = Number(document.getElementById('usageQty').value);
  const damagedQty = Number(document.getElementById('usageDamagedQty').value || 0);

  if (!inventoryId) {
    showMessage('Please select an inventory item.');
    return;
  }

  if (!staffName) {
    showMessage('Please select a housekeeping staff member.');
    return;
  }

  if (!usedQty || usedQty < 1) {
    showMessage('Used quantity must be at least 1.');
    return;
  }

  if (!Number.isFinite(damagedQty) || damagedQty < 0) {
    showMessage('Damaged quantity cannot be negative.');
    return;
  }

  try {
    const res = await fetch('/housekeeping/inventory-usage/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventoryId, staffName, usedQty, damagedQty })
    });

    const data = await res.json();
    if (!data.success) {
      showMessage(data.message || 'Failed to log inventory usage.');
      return;
    }

    document.getElementById('usageForm').reset();
    const damagedInput = document.getElementById('usageDamagedQty');
    if (damagedInput instanceof HTMLInputElement) {
      damagedInput.value = '0';
    }
    showMessage(data.message || 'Inventory usage logged.');
    broadcastInventoryUpdate();
    await Promise.all([loadUsageLogs(), loadInventoryItemDropdown(), loadAndRender()]);
  } catch {
    showMessage('Error logging inventory usage.');
  }
}

async function openAddDialog() {
  document.getElementById('addTaskForm').reset();
  toggleCustomRequestTypeInput();
  await loadHousekeepingStaffOptions();
  await fetchNextHousekeepingTaskId();
  document.getElementById('addTaskDialog').showModal();
}

function toggleCustomRequestTypeInput() {
  const requestTypeSelect = document.getElementById('requestType');
  const customContainer = document.getElementById('customRequestTypeContainer');
  const customInput = document.getElementById('customRequestType');

  if (!(requestTypeSelect instanceof HTMLSelectElement) || !(customContainer instanceof HTMLElement) || !(customInput instanceof HTMLInputElement)) {
    return;
  }

  const isOther = requestTypeSelect.value === 'Other';
  customContainer.style.display = isOther ? 'block' : 'none';

  if (!isOther) {
    customInput.value = '';
  }
}

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

async function loadHousekeepingStaffOptions() {
  await loadHousekeepingStaffDropdown('staffName');
}

async function fetchNextHousekeepingTaskId() {
  try {
    const res = await fetch('/housekeeping/next-task-id');
    if (!res.ok) throw new Error('Could not generate next housekeeping task ID.');
    const data = await res.json();
    document.getElementById('requestId').value = data.requestId || '';
  } catch {
    showMessage('Error generating housekeeping task ID. Please try again.');
  }
}

async function openUpdateDialog(id) {
  try {
    const res = await fetch('/housekeeping/list');
    const tasks = await res.json();
    const task = tasks.find((t) => t.id === id);

    if (!task) {
      showMessage('Task not found.');
      return;
    }

    document.getElementById('updateTaskDbId').value = String(task.id);
    document.getElementById('updateRequestId').value = task.requestId;
    document.getElementById('updateRoomNo').value = task.room;
    const updateRequestTypeSelect = document.getElementById('updateRequestType');
    ensureOptionExists(updateRequestTypeSelect, task.requestType);
    updateRequestTypeSelect.value = task.requestType;
    document.getElementById('updateStaffName').value = task.assignedStaff;
    document.getElementById('updateTaskStatus').value = task.taskStatus;

    document.getElementById('updateTaskDialog').showModal();
  } catch {
    showMessage('Error fetching task details.');
  }
}

function ensureOptionExists(selectEl, value) {
  if (!(selectEl instanceof HTMLSelectElement)) return;

  const normalized = String(value ?? '').trim();
  if (!normalized) return;

  const exists = Array.from(selectEl.options).some((option) => option.value === normalized || option.text === normalized);
  if (exists) return;

  const option = document.createElement('option');
  option.value = normalized;
  option.textContent = normalized;
  selectEl.appendChild(option);
}

async function handleAddSubmit(e) {
  e.preventDefault();

  const requestId = document.getElementById('requestId').value.trim();
  if (!requestId) {
    showMessage('Please enter a valid request ID.');
    return;
  }

  const requestTypeValue = document.getElementById('requestType').value;
  const customRequestTypeValue = document.getElementById('customRequestType').value.trim();
  const resolvedRequestType = requestTypeValue === 'Other' ? customRequestTypeValue : requestTypeValue;

  const payload = {
    requestId,
    room: document.getElementById('roomNo').value,
    requestType: resolvedRequestType,
    assignedStaff: document.getElementById('staffName').value,
    taskStatus: document.getElementById('taskStatus').value,
  };

  if (!requestTypeValue) {
    showMessage('Please select a request type.');
    return;
  }

  if (requestTypeValue === 'Other' && !customRequestTypeValue) {
    showMessage('Please type a custom request type.');
    return;
  }

  if (!payload.room) {
    showMessage('Please select a room.');
    return;
  }

  if (!payload.assignedStaff) {
    showMessage('Please select a housekeeping staff member.');
    return;
  }

  try {
    const res = await fetch('/housekeeping/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!data.success) {
      showMessage(data.message || 'Failed to add task.');
      return;
    }

    document.getElementById('addTaskDialog').close();
    document.getElementById('addTaskForm').reset();
    showMessage(data.message || 'Task added successfully!');
    await loadAndRender();
  } catch {
    showMessage('Error adding task.');
  }
}

async function handleUpdateSubmit(e) {
  e.preventDefault();

  const id = Number(document.getElementById('updateTaskDbId').value);
  const requestId = document.getElementById('updateRequestId').value.trim();

  if (!requestId) {
    showMessage('Please enter a valid request ID.');
    return;
  }

  const payload = {
    id,
    requestId,
    room: document.getElementById('updateRoomNo').value.trim(),
    requestType: document.getElementById('updateRequestType').value,
    assignedStaff: document.getElementById('updateStaffName').value.trim(),
    taskStatus: document.getElementById('updateTaskStatus').value,
  };

  try {
    const res = await fetch('/housekeeping/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!data.success) {
      showMessage(data.message || 'Failed to update task.');
      return;
    }

    document.getElementById('updateTaskDialog').close();
    document.getElementById('updateTaskForm').reset();
    showMessage(data.message || 'Task updated successfully!');
    await loadAndRender();
  } catch {
    showMessage('Error updating task.');
  }
}

async function handleDelete(id, requestLabel) {
  if (!confirm(`Are you sure you want to delete task ${requestLabel}?`)) return;

  try {
    const res = await fetch('/housekeeping/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    showMessage(data.message || 'Task deleted successfully!');
    await loadAndRender();
  } catch {
    showMessage('Error deleting task.');
  }
}

function showMessage(message) {
  const messageEl = document.getElementById('taskMessage');
  messageEl.textContent = message;
  messageEl.classList.add('show');

  setTimeout(() => {
    messageEl.classList.remove('show');
  }, 3000);
}

async function loadNotifications() {
  try {
    const res = await fetch('/workflow/notifications?audience=HOUSEKEEPING');
    if (!res.ok) {
      throw new Error('Failed to load notifications.');
    }
    const notifications = await res.json();
    renderNotifications(notifications);
  } catch {
    renderNotifications([]);
  }
}

function renderNotifications(notifications) {
  const list = document.getElementById('notificationList');
  if (!(list instanceof HTMLElement)) {
    return;
  }

  const rows = Array.isArray(notifications) ? notifications : [];
  if (!rows.length) {
    list.innerHTML = '<li class="notification-item"><strong>No notifications yet.</strong><p>Workflow updates will appear here in real time.</p></li>';
    return;
  }

  list.innerHTML = rows.slice(0, 12).map((item) => `
    <li class="notification-item">
      <strong>${escapeHtml(item.title || 'Update')}</strong>
      <p>${escapeHtml(item.message || '')}</p>
    </li>
  `).join('');
}

function prependNotification(item) {
  const list = document.getElementById('notificationList');
  if (!(list instanceof HTMLElement)) {
    return;
  }

  const first = list.firstElementChild;
  const isEmpty = first && first.textContent && first.textContent.includes('No notifications yet.');
  if (isEmpty) {
    list.innerHTML = '';
  }

  const row = document.createElement('li');
  row.className = 'notification-item';
  row.innerHTML = `
    <strong>${escapeHtml(item?.title || 'Update')}</strong>
    <p>${escapeHtml(item?.message || '')}</p>
  `;
  list.prepend(row);

  while (list.children.length > 12) {
    list.removeChild(list.lastElementChild);
  }
}

function initRealtime() {
  if (housekeepingEventSource) {
    housekeepingEventSource.close();
  }

  housekeepingEventSource = new EventSource('/workflow/stream?audience=HOUSEKEEPING');

  housekeepingEventSource.addEventListener('notification', (event) => {
    try {
      const payload = JSON.parse(event.data);
      prependNotification(payload);
      loadAndRender();
    } catch {
      // Ignore malformed event payload.
    }
  });

  housekeepingEventSource.addEventListener('data-change', () => {
    loadAndRender();
  });

  housekeepingEventSource.onerror = () => {
    if (housekeepingEventSource) {
      housekeepingEventSource.close();
    }
    setTimeout(initRealtime, 2000);
  };
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}
