/**
 * Housekeeping Management
 * CRUD operations backed by the /housekeeping REST API
 */

document.addEventListener('DOMContentLoaded', () => {
  loadAndRender();
  attachEventListeners();
});

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
  document.getElementById('assignedMetric').textContent = tasks.filter((t) => t.taskStatus === 'Assigned').length;
  document.getElementById('inProgressMetric').textContent = tasks.filter((t) => t.taskStatus === 'In Progress').length;
  document.getElementById('completedMetric').textContent = tasks.filter((t) => t.taskStatus === 'Completed').length;
}

function statusFromTask(status) {
  const statusMap = {
    'Assigned': 'assigned',
    'In Progress': 'clean',
    'Completed': 'completed',
  };
  return statusMap[status] || 'assigned';
}

function renderTable(tasks) {
  const tbody = document.getElementById('tasksTableBody');
  tbody.innerHTML = '';

  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">
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

function openAddDialog() {
  document.getElementById('addTaskForm').reset();
  document.getElementById('addTaskDialog').showModal();
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
    document.getElementById('updateRequestType').value = task.requestType;
    document.getElementById('updateStaffName').value = task.assignedStaff;
    document.getElementById('updateTaskStatus').value = task.taskStatus;

    document.getElementById('updateTaskDialog').showModal();
  } catch {
    showMessage('Error fetching task details.');
  }
}

async function handleAddSubmit(e) {
  e.preventDefault();

  const requestId = document.getElementById('requestId').value.trim();
  if (!requestId) {
    showMessage('Please enter a valid request ID.');
    return;
  }

  const payload = {
    requestId,
    room: document.getElementById('roomNo').value.trim(),
    requestType: document.getElementById('requestType').value,
    assignedStaff: document.getElementById('staffName').value.trim(),
    taskStatus: document.getElementById('taskStatus').value,
  };

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
