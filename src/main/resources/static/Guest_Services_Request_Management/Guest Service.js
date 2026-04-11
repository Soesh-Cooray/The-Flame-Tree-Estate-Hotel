/**
 * Guest Service Requests Management
 * CRUD operations backed by the /guestservice REST API
 */

document.addEventListener('DOMContentLoaded', () => {
  loadAndRender();
  loadNotifications();
  initRealtime();
  attachEventListeners();
});

let guestEventSource = null;

async function loadAndRender() {
  try {
    const res = await fetch('/guestservice/list');
    if (!res.ok) throw new Error('Failed to load requests.');
    const requests = await res.json();
    renderMetrics(requests);
    renderTable(requests);
  } catch (err) {
    showMessage('Error loading requests: ' + err.message);
  }
}

function renderMetrics(requests) {
  document.getElementById('totalRequestsMetric').textContent = requests.length;
  document.getElementById('pendingMetric').textContent = requests.filter((r) => r.status === 'Pending').length;
  document.getElementById('inProgressMetric').textContent = requests.filter((r) => r.status === 'In Progress').length;
  document.getElementById('completedMetric').textContent = requests.filter((r) => r.status === 'Completed').length;
}

function statusFromRequest(status) {
  const statusMap = {
    'Pending': 'pending',
    'In Progress': 'in-progress',
    'Completed': 'completed',
  };
  return statusMap[status] || 'pending';
}

function renderTable(requests) {
  const tbody = document.getElementById('requestsTableBody');
  tbody.innerHTML = '';

  if (requests.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">
          No service requests recorded. Click "Add Request" to create one.
        </td>
      </tr>
    `;
    return;
  }

  requests.forEach((req) => {
    const statusClass = statusFromRequest(req.status);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(req.requestId)}</td>
      <td>${escapeHtml(req.roomName)}</td>
      <td>${escapeHtml(req.request)}</td>
      <td>${formatDateTime(req.requestDateTime)}</td>
      <td><span class="tag ${statusClass}">${escapeHtml(req.status)}</span></td>
      <td>
        <div class="action-buttons">
          <button type="button" class="edit-btn" data-action="edit" data-id="${req.id}">Edit</button>
          <button type="button" class="delete-btn" data-action="delete" data-id="${req.id}" data-requestid="${escapeHtml(req.requestId)}">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function attachEventListeners() {
  document.getElementById('openAddDialogBtn').addEventListener('click', openAddDialog);
  document.getElementById('clearNotificationsBtn')?.addEventListener('click', clearNotifications);

  document.getElementById('cancelAddDialogBtn').addEventListener('click', () => {
    document.getElementById('addRequestDialog').close();
  });

  document.getElementById('cancelUpdateDialogBtn').addEventListener('click', () => {
    document.getElementById('updateRequestDialog').close();
  });

  document.getElementById('addRequestForm').addEventListener('submit', handleAddSubmit);
  document.getElementById('updateRequestForm').addEventListener('submit', handleUpdateSubmit);

  document.getElementById('requestsTableBody').addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    const id = Number(e.target.dataset.id);

    if (!action || !id) return;

    if (action === 'edit') {
      await openUpdateDialog(id);
    } else if (action === 'delete') {
      const requestLabel = e.target.dataset.requestid || 'this request';
      await handleDelete(id, requestLabel);
    }
  });
}

async function clearNotifications() {
  try {
    const res = await fetch('/workflow/notifications/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audience: 'GUEST' }),
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

function openAddDialog() {
  document.getElementById('addRequestForm').reset();
  document.getElementById('status').value = 'Pending';
  fetchNextRequestId();
  document.getElementById('addRequestDialog').showModal();
}

async function fetchNextRequestId() {
  try {
    const res = await fetch('/guestservice/next-request-id');
    if (!res.ok) throw new Error('Could not generate next Request ID.');
    const data = await res.json();
    document.getElementById('requestId').value = data.requestId || '';
  } catch {
    showMessage('Error generating Request ID. Please try again.');
  }
}

async function openUpdateDialog(id) {
  try {
    const res = await fetch('/guestservice/list');
    const requests = await res.json();
    const req = requests.find((r) => r.id === id);

    if (!req) {
      showMessage('Request not found.');
      return;
    }

    document.getElementById('updateRequestDbId').value = String(req.id);
    document.getElementById('updateRequestId').value = req.requestId;
    document.getElementById('updateRoomName').value = req.roomName;
    const requestType = detectRequestType(req.request);
    document.getElementById('updateRequestType').value = requestType;
    document.getElementById('updateCustomRequest').value = requestType === 'Other' ? req.request : '';
    document.getElementById('updateStatus').value = req.status;

    document.getElementById('updateRequestDialog').showModal();
  } catch {
    showMessage('Error fetching request details.');
  }
}

async function handleAddSubmit(e) {
  e.preventDefault();

  const requestId = document.getElementById('requestId').value.trim();
  if (!requestId) {
    showMessage('Request ID could not be generated. Please try again.');
    return;
  }

  const request = resolveRequestType(
    document.getElementById('requestType').value,
    document.getElementById('customRequest').value
  );

  if (!request) {
    showMessage('Please select a request type or enter a custom request.');
    return;
  }

  const payload = {
    requestId,
    roomName: document.getElementById('roomName').value,
    request,
  };

  try {
    const res = await fetch('/guestservice/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!data.success) {
      showMessage(data.message || 'Failed to add request.');
      return;
    }

    document.getElementById('addRequestDialog').close();
    document.getElementById('addRequestForm').reset();
    showMessage(data.message || 'Request added successfully!');
    await loadAndRender();
  } catch {
    showMessage('Error adding request.');
  }
}

async function handleUpdateSubmit(e) {
  e.preventDefault();

  const id = Number(document.getElementById('updateRequestDbId').value);
  const requestId = document.getElementById('updateRequestId').value.trim();

  if (!requestId) {
    showMessage('Please enter a valid Request ID.');
    return;
  }

  const request = resolveRequestType(
    document.getElementById('updateRequestType').value,
    document.getElementById('updateCustomRequest').value
  );

  if (!request) {
    showMessage('Please select a request type or enter a custom request.');
    return;
  }

  const payload = {
    id,
    requestId,
    roomName: document.getElementById('updateRoomName').value,
    request,
  };

  try {
    const res = await fetch('/guestservice/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!data.success) {
      showMessage(data.message || 'Failed to update request.');
      return;
    }

    document.getElementById('updateRequestDialog').close();
    document.getElementById('updateRequestForm').reset();
    showMessage(data.message || 'Request updated successfully!');
    await loadAndRender();
  } catch {
    showMessage('Error updating request.');
  }
}

async function handleDelete(id, requestLabel) {
  if (!confirm(`Are you sure you want to delete request ${requestLabel}?`)) return;

  try {
    const res = await fetch('/guestservice/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    showMessage(data.message || 'Request deleted successfully!');
    await loadAndRender();
  } catch {
    showMessage('Error deleting request.');
  }
}

function showMessage(message) {
  const messageEl = document.getElementById('requestMessage');
  messageEl.textContent = message;
  messageEl.classList.add('show');

  setTimeout(() => {
    messageEl.classList.remove('show');
  }, 3000);
}

async function loadNotifications() {
  try {
    const res = await fetch('/workflow/notifications?audience=GUEST');
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
  if (guestEventSource) {
    guestEventSource.close();
  }

  guestEventSource = new EventSource('/workflow/stream?audience=GUEST');

  guestEventSource.addEventListener('notification', (event) => {
    try {
      const payload = JSON.parse(event.data);
      prependNotification(payload);
      loadAndRender();
    } catch {
      // Ignore malformed event payload.
    }
  });

  guestEventSource.addEventListener('data-change', () => {
    loadAndRender();
  });

  guestEventSource.onerror = () => {
    if (guestEventSource) {
      guestEventSource.close();
    }
    setTimeout(initRealtime, 2000);
  };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function resolveRequestType(selectedType, customType) {
  const selected = (selectedType || '').trim();
  const custom = (customType || '').trim();

  if (custom) {
    return custom;
  }
  if (!selected) {
    return '';
  }
  if (selected === 'Other') {
    return '';
  }
  return selected;
}

function detectRequestType(requestText) {
  const builtInTypes = ['Room Assistance', 'Extra Towels', 'Toiletries Refill', 'Cleaning Follow-up'];
  if (builtInTypes.includes(requestText)) {
    return requestText;
  }
  return 'Other';
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }
  return escapeHtml(date.toLocaleString());
}
