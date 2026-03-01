/**
 * Guest Service Requests Management
 * CRUD operations backed by the /guestservice REST API
 */

document.addEventListener('DOMContentLoaded', () => {
  loadAndRender();
  attachEventListeners();
});

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
  document.getElementById('assignedMetric').textContent = requests.filter((r) => r.status === 'Assigned').length;
  document.getElementById('inProgressMetric').textContent = requests.filter((r) => r.status === 'In Progress').length;
  document.getElementById('completedMetric').textContent = requests.filter((r) => r.status === 'Completed').length;
}

function statusFromRequest(status) {
  const statusMap = {
    'Assigned': 'assigned',
    'In Progress': 'in-progress',
    'Completed': 'completed',
  };
  return statusMap[status] || 'assigned';
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
      <td>${escapeHtml(req.guestRoom)}</td>
      <td>${escapeHtml(req.request)}</td>
      <td>${escapeHtml(req.assignedStaff)}</td>
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

function openAddDialog() {
  document.getElementById('addRequestForm').reset();
  document.getElementById('addRequestDialog').showModal();
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
    document.getElementById('updateRoomNo').value = req.guestRoom;
    document.getElementById('updateRequestType').value = req.request;
    document.getElementById('updateStaffName').value = req.assignedStaff;
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
    showMessage('Please enter a valid Request ID.');
    return;
  }

  const payload = {
    requestId,
    guestRoom: document.getElementById('roomNo').value.trim(),
    request: document.getElementById('requestType').value,
    assignedStaff: document.getElementById('staffName').value.trim(),
    status: document.getElementById('status').value,
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

  const payload = {
    id,
    requestId,
    guestRoom: document.getElementById('updateRoomNo').value.trim(),
    request: document.getElementById('updateRequestType').value,
    assignedStaff: document.getElementById('updateStaffName').value.trim(),
    status: document.getElementById('updateStatus').value,
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}
