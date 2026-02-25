/**
 * Housekeeping Management
 * Dynamic CRUD operations with localStorage persistence
 */

const STORAGE_KEY = 'housekeepingTasks';

// Default sample data
const defaultTasks = [
  {
    requestId: 'HK-2026-031',
    roomNo: '305',
    requestType: 'Room Cleaning',
    assignedStaff: 'A. Silva',
    taskStatus: 'Assigned',
  },
  {
    requestId: 'HK-2026-028',
    roomNo: '112',
    requestType: 'Extra Linen',
    assignedStaff: 'N. Perera',
    taskStatus: 'Completed',
  },
  {
    requestId: 'HK-2026-030',
    roomNo: '219',
    requestType: 'Toiletries Refill',
    assignedStaff: 'R. Khan',
    taskStatus: 'Assigned',
  },
];

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  loadTasks();
  renderMetrics();
  renderTable();
  attachEventListeners();
});

// Load tasks from localStorage
function loadTasks() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultTasks));
  }
}

// Get tasks from storage
function getTasks() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : defaultTasks;
}

// Save tasks to storage
function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// Render summary metrics
function renderMetrics() {
  const tasks = getTasks();

  const totalTasks = tasks.length;
  const assignedCount = tasks.filter((t) => t.taskStatus === 'Assigned').length;
  const inProgressCount = tasks.filter((t) => t.taskStatus === 'In Progress').length;
  const completedCount = tasks.filter((t) => t.taskStatus === 'Completed').length;

  document.getElementById('totalTasksMetric').textContent = totalTasks;
  document.getElementById('assignedMetric').textContent = assignedCount;
  document.getElementById('inProgressMetric').textContent = inProgressCount;
  document.getElementById('completedMetric').textContent = completedCount;
}

// Get status tag styling
function statusFromTask(status) {
  const statusMap = {
    'Assigned': 'assigned',
    'In Progress': 'clean',
    'Completed': 'completed',
  };
  return statusMap[status] || 'assigned';
}

// Render dynamic table
function renderTable() {
  const tasks = getTasks();
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

  tasks.forEach((task, index) => {
    const statusClass = statusFromTask(task.taskStatus);
    const row = document.createElement('tr');
    row.dataset.index = index;
    row.innerHTML = `
      <td>${escapeHtml(task.requestId)}</td>
      <td>${escapeHtml(task.roomNo)}</td>
      <td>${escapeHtml(task.requestType)}</td>
      <td>${escapeHtml(task.assignedStaff)}</td>
      <td><span class="tag ${statusClass}">${escapeHtml(task.taskStatus)}</span></td>
      <td>
        <div class="action-buttons">
          <button type="button" class="edit-btn" data-action="edit" data-index="${index}">Edit</button>
          <button type="button" class="delete-btn" data-action="delete" data-index="${index}">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Event delegation for row actions
function attachEventListeners() {
  // Add task button
  document.getElementById('openAddDialogBtn').addEventListener('click', openAddDialog);

  // Cancel buttons
  document.getElementById('cancelAddDialogBtn').addEventListener('click', () => {
    document.getElementById('addTaskDialog').close();
  });

  document.getElementById('cancelUpdateDialogBtn').addEventListener('click', () => {
    document.getElementById('updateTaskDialog').close();
  });

  // Add form submission
  document.getElementById('addTaskForm').addEventListener('submit', handleAddSubmit);

  // Update form submission
  document.getElementById('updateTaskForm').addEventListener('submit', handleUpdateSubmit);

  // Row action delegation
  document.getElementById('tasksTableBody').addEventListener('click', (e) => {
    if (e.target.dataset.action === 'edit') {
      openUpdateDialog(parseInt(e.target.dataset.index));
    } else if (e.target.dataset.action === 'delete') {
      handleDelete(parseInt(e.target.dataset.index));
    }
  });
}

// Open add dialog
function openAddDialog() {
  document.getElementById('addTaskForm').reset();
  document.getElementById('addTaskDialog').showModal();
}

// Open update dialog
function openUpdateDialog(index) {
  const tasks = getTasks();
  const task = tasks[index];

  if (!task) return;

  document.getElementById('updateTaskIndex').value = index;
  document.getElementById('updateRequestId').value = task.requestId;
  document.getElementById('updateRoomNo').value = task.roomNo;
  document.getElementById('updateRequestType').value = task.requestType;
  document.getElementById('updateStaffName').value = task.assignedStaff;
  document.getElementById('updateTaskStatus').value = task.taskStatus;

  document.getElementById('updateTaskDialog').showModal();
}

// Handle add form submission
function handleAddSubmit(e) {
  e.preventDefault();

  const tasks = getTasks();
  const newTask = {
    requestId: document.getElementById('requestId').value,
    roomNo: document.getElementById('roomNo').value,
    requestType: document.getElementById('requestType').value,
    assignedStaff: document.getElementById('staffName').value,
    taskStatus: document.getElementById('taskStatus').value,
  };

  tasks.push(newTask);
  saveTasks(tasks);

  renderMetrics();
  renderTable();
  document.getElementById('addTaskDialog').close();
  showMessage('Task added successfully!');
}

// Handle update form submission
function handleUpdateSubmit(e) {
  e.preventDefault();

  const index = parseInt(document.getElementById('updateTaskIndex').value);
  const tasks = getTasks();

  if (index >= 0 && index < tasks.length) {
    tasks[index] = {
      requestId: document.getElementById('updateRequestId').value,
      roomNo: document.getElementById('updateRoomNo').value,
      requestType: document.getElementById('updateRequestType').value,
      assignedStaff: document.getElementById('updateStaffName').value,
      taskStatus: document.getElementById('updateTaskStatus').value,
    };

    saveTasks(tasks);
    renderMetrics();
    renderTable();
    document.getElementById('updateTaskDialog').close();
    showMessage('Task updated successfully!');
  }
}

// Handle delete
function handleDelete(index) {
  if (!confirm('Are you sure you want to delete this task?')) {
    return;
  }

  const tasks = getTasks();
  if (index >= 0 && index < tasks.length) {
    tasks.splice(index, 1);
    saveTasks(tasks);
    renderMetrics();
    renderTable();
    showMessage('Task deleted successfully!');
  }
}

// Show temporary message
function showMessage(message) {
  const messageEl = document.getElementById('taskMessage');
  messageEl.textContent = message;
  messageEl.classList.add('show');

  setTimeout(() => {
    messageEl.classList.remove('show');
  }, 3000);
}

// HTML escape utility
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
