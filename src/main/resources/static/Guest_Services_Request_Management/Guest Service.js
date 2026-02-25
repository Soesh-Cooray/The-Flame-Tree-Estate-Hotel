/**
 * Guest Service Requests Management
 * Dynamic CRUD operations with localStorage persistence
 */

const STORAGE_KEY = 'guestServiceRequests';

// Default sample data
const defaultRequests = [
  {
    requestId: 'GS-2026-021',
    guestName: 'Ms. Perera',
    roomNo: '204',
    requestType: 'Extra Towels',
    assignedStaff: 'N. Silva',
    status: 'In Progress',
  },
  {
    requestId: 'GS-2026-022',
    guestName: 'Mr. Adams',
    roomNo: '116',
    requestType: 'Room Assistance',
    assignedStaff: 'R. Fernando',
    status: 'Assigned',
  },
  {
    requestId: 'GS-2026-019',
    guestName: 'Dr. Khan',
    roomNo: '308',
    requestType: 'Toiletries Refill',
    assignedStaff: 'P. Nuwan',
    status: 'Completed',
  },
];

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  loadRequests();
  renderMetrics();
  renderTable();
  attachEventListeners();
});

// Load requests from localStorage
function loadRequests() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultRequests));
  }
}

// Get requests from storage
function getRequests() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : defaultRequests;
}

// Save requests to storage
function saveRequests(requests) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

// Render summary metrics
function renderMetrics() {
  const requests = getRequests();

  const totalRequests = requests.length;
  const assignedCount = requests.filter((r) => r.status === 'Assigned').length;
  const inProgressCount = requests.filter((r) => r.status === 'In Progress').length;
  const completedCount = requests.filter((r) => r.status === 'Completed').length;

  document.getElementById('totalRequestsMetric').textContent = totalRequests;
  document.getElementById('assignedMetric').textContent = assignedCount;
  document.getElementById('inProgressMetric').textContent = inProgressCount;
  document.getElementById('completedMetric').textContent = completedCount;
}

// Get status tag styling
function statusFromRequest(status) {
  const statusMap = {
    'Assigned': 'assigned',
    'In Progress': 'in-progress',
    'Completed': 'completed',
  };
  return statusMap[status] || 'assigned';
}

// Render dynamic table
function renderTable() {
  const requests = getRequests();
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

  requests.forEach((request, index) => {
    const statusClass = statusFromRequest(request.status);
    const row = document.createElement('tr');
    row.dataset.index = index;
    row.innerHTML = `
      <td>${escapeHtml(request.requestId)}</td>
      <td>${escapeHtml(request.guestName)} / ${escapeHtml(request.roomNo)}</td>
      <td>${escapeHtml(request.requestType)}</td>
      <td>${escapeHtml(request.assignedStaff)}</td>
      <td><span class="tag ${statusClass}">${escapeHtml(request.status)}</span></td>
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
  // Add request button
  document.getElementById('openAddDialogBtn').addEventListener('click', openAddDialog);

  // Cancel buttons
  document.getElementById('cancelAddDialogBtn').addEventListener('click', () => {
    document.getElementById('addRequestDialog').close();
  });

  document.getElementById('cancelUpdateDialogBtn').addEventListener('click', () => {
    document.getElementById('updateRequestDialog').close();
  });

  // Add form submission
  document.getElementById('addRequestForm').addEventListener('submit', handleAddSubmit);

  // Update form submission
  document.getElementById('updateRequestForm').addEventListener('submit', handleUpdateSubmit);

  // Row action delegation
  document.getElementById('requestsTableBody').addEventListener('click', (e) => {
    if (e.target.dataset.action === 'edit') {
      openUpdateDialog(parseInt(e.target.dataset.index));
    } else if (e.target.dataset.action === 'delete') {
      handleDelete(parseInt(e.target.dataset.index));
    }
  });
}

// Open add dialog
function openAddDialog() {
  document.getElementById('addRequestForm').reset();
  document.getElementById('addRequestDialog').showModal();
}

// Open update dialog
function openUpdateDialog(index) {
  const requests = getRequests();
  const request = requests[index];

  if (!request) return;

  document.getElementById('updateRequestIndex').value = index;
  document.getElementById('updateRequestId').value = request.requestId;
  document.getElementById('updateGuestName').value = request.guestName;
  document.getElementById('updateRoomNo').value = request.roomNo;
  document.getElementById('updateRequestType').value = request.requestType;
  document.getElementById('updateStaffName').value = request.assignedStaff;
  document.getElementById('updateStatus').value = request.status;

  document.getElementById('updateRequestDialog').showModal();
}

// Handle add form submission
function handleAddSubmit(e) {
  e.preventDefault();

  const requests = getRequests();
  const newRequest = {
    requestId: document.getElementById('requestId').value,
    guestName: document.getElementById('guestName').value,
    roomNo: document.getElementById('roomNo').value,
    requestType: document.getElementById('requestType').value,
    assignedStaff: document.getElementById('staffName').value,
    status: document.getElementById('status').value,
  };

  requests.push(newRequest);
  saveRequests(requests);

  renderMetrics();
  renderTable();
  document.getElementById('addRequestDialog').close();
  showMessage('Request added successfully!');
}

// Handle update form submission
function handleUpdateSubmit(e) {
  e.preventDefault();

  const index = parseInt(document.getElementById('updateRequestIndex').value);
  const requests = getRequests();

  if (index >= 0 && index < requests.length) {
    requests[index] = {
      requestId: document.getElementById('updateRequestId').value,
      guestName: document.getElementById('updateGuestName').value,
      roomNo: document.getElementById('updateRoomNo').value,
      requestType: document.getElementById('updateRequestType').value,
      assignedStaff: document.getElementById('updateStaffName').value,
      status: document.getElementById('updateStatus').value,
    };

    saveRequests(requests);
    renderMetrics();
    renderTable();
    document.getElementById('updateRequestDialog').close();
    showMessage('Request updated successfully!');
  }
}

// Handle delete
function handleDelete(index) {
  if (!confirm('Are you sure you want to delete this request?')) {
    return;
  }

  const requests = getRequests();
  if (index >= 0 && index < requests.length) {
    requests.splice(index, 1);
    saveRequests(requests);
    renderMetrics();
    renderTable();
    showMessage('Request deleted successfully!');
  }
}

// Show temporary message
function showMessage(message) {
  const messageEl = document.getElementById('requestMessage');
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
