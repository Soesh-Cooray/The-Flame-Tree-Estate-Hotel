/**
 * Housekeeping Management
 * CRUD operations backed by the /housekeeping REST API
 */

document.addEventListener('DOMContentLoaded', () => {
  loadAndRender();
  attachEventListeners();
});

let housekeepingStaffOptions = [];

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
  document.getElementById('requestType').addEventListener('change', toggleCustomRequestTypeInput);

  document.getElementById('cancelAddDialogBtn').addEventListener('click', () => {
    document.getElementById('addTaskDialog').close();
  });

  document.getElementById('cancelUpdateDialogBtn').addEventListener('click', () => {
    document.getElementById('updateTaskDialog').close();
  });

  document.getElementById('addTaskForm').addEventListener('submit', handleAddSubmit);
  document.getElementById('updateTaskForm').addEventListener('submit', handleUpdateSubmit);

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
  const select = document.getElementById('staffName');
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}
