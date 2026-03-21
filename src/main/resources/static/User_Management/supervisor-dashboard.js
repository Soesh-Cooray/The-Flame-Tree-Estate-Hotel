const currentRole = localStorage.getItem('currentUserRole') || 'Staff Supervisor';

const state = {
  rows: [],
  assignmentStaff: {
    housekeeping: [],
    maintenance: [],
  },
};

function setMetric(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = String(value ?? 0);
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function showMessage(id, message) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = message;
  }
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function loadUnifiedData() {
  try {
    const [panelRes, usersRes] = await Promise.all([
      fetch('/guestservice/supervisor/unified'),
      fetch('/auth/users'),
    ]);

    if (!panelRes.ok) {
      throw new Error('Failed to load supervisor panel data.');
    }

    const data = await panelRes.json();
    const guest = Array.isArray(data.guestPending) ? data.guestPending : [];
    const housekeeping = Array.isArray(data.housekeepingTasks) ? data.housekeepingTasks : [];
    const maintenance = Array.isArray(data.maintenanceTasks) ? data.maintenanceTasks : [];

    const users = usersRes.ok ? await usersRes.json() : [];
    hydrateAssignmentStaff(users);

    state.rows = [...guest, ...housekeeping, ...maintenance];
    renderMetrics(state.rows);
    renderTaskQueues();
  } catch (error) {
    showMessage('taskActionMessage', error.message || 'Failed to load data.');
  }
}

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

function hydrateAssignmentStaff(users) {
  const safeUsers = Array.isArray(users) ? users : [];
  const activeUsers = safeUsers.filter((user) => Boolean(user?.status));

  const housekeeping = activeUsers
    .filter((user) => normalizeRole(user?.role).includes('housekeeping'))
    .map((user) => String(user?.username || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const maintenance = activeUsers
    .filter((user) => normalizeRole(user?.role).includes('maintenance'))
    .map((user) => String(user?.username || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  state.assignmentStaff = {
    housekeeping: [...new Set(housekeeping)],
    maintenance: [...new Set(maintenance)],
  };
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function staffSelectOptions(targetModule) {
  const staff = state.assignmentStaff[targetModule] || [];
  if (!staff.length) {
    return '<option value="">No available staff</option>';
  }

  return `
    <option value="">Select staff</option>
    ${staff.map((name) => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`).join('')}
  `;
}

function renderMetrics(rows) {
  const pendingGuest = rows.filter((item) => item.source === 'GUEST' && normalize(item.status) === 'pending').length;
  const inProgress = rows.filter((item) => normalize(item.status) === 'in progress').length;
  const awaitingReview = rows.filter((item) => normalize(item.status) === 'completed' && normalize(item.supervisorDecision) !== 'approved').length;
  const approved = rows.filter((item) => normalize(item.supervisorDecision) === 'approved').length;
  const rejected = rows.filter((item) => normalize(item.supervisorDecision) === 'rejected').length;

  setMetric('pendingGuestMetric', pendingGuest);
  setMetric('inProgressTasksMetric', inProgress);
  setMetric('pendingReviewMetric', awaitingReview);
  setMetric('approvedMetric', approved);
  setMetric('rejectedMetric', rejected);
}

function assignmentFilteredRows() {
  const view = document.getElementById('viewFilter')?.value || 'guest-pending';
  const department = document.getElementById('departmentFilter')?.value || 'all';
  const query = normalize(document.getElementById('searchInput')?.value || '');

  return state.rows.filter((row) => {
    if (row.source !== 'GUEST') {
      return false;
    }

    if (view === 'guest-pending' && normalize(row.status) !== 'pending') {
      return false;
    }

    if (view === 'awaiting-review' || view === 'rejected') {
      return false;
    }

    if (department !== 'all' && department !== 'Guest Service') {
      return false;
    }

    if (!query) {
      return true;
    }

    return [row.taskCode, row.roomOrLocation, row.requestType, row.assignedTo, row.department]
      .some((value) => normalize(value).includes(query));
  });
}

function approvalRows() {
  return state.rows.filter((row) =>
    (row.source === 'HOUSEKEEPING' || row.source === 'MAINTENANCE')
    && normalize(row.status) === 'completed'
    && normalize(row.supervisorDecision) !== 'approved');
}

function renderTaskQueues() {
  renderAssignmentTable();
  renderApprovalTable();
}

function renderAssignmentTable() {
  const body = document.getElementById('assignmentTaskTableBody');
  if (!body) {
    return;
  }

  const rows = assignmentFilteredRows();

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="8">No assignment tasks found for current filters.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.taskCode)}</td>
      <td>${escapeHtml(row.itemType)}</td>
      <td>${escapeHtml(row.department)}</td>
      <td>${escapeHtml(row.roomOrLocation)}</td>
      <td>${escapeHtml(row.requestType)}</td>
      <td>${escapeHtml(row.assignedTo)}</td>
      <td><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
      <td>${rowAssignmentActions(row)}</td>
    </tr>
  `).join('');
}

function renderApprovalTable() {
  const body = document.getElementById('approvalTaskTableBody');
  if (!body) {
    return;
  }

  const rows = approvalRows();

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="9">No completed tasks currently waiting for supervisor approval.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.taskCode)}</td>
      <td>${escapeHtml(row.itemType)}</td>
      <td>${escapeHtml(row.department)}</td>
      <td>${escapeHtml(row.roomOrLocation)}</td>
      <td>${escapeHtml(row.requestType)}</td>
      <td>${escapeHtml(row.assignedTo)}</td>
      <td><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
      <td><span class="status-pill ${decisionClass(row.supervisorDecision)}">${escapeHtml(row.supervisorDecision)}</span></td>
      <td>${rowApprovalActions(row)}</td>
    </tr>
  `).join('');
}

function rowAssignmentActions(row) {
  if (row.source === 'GUEST' && normalize(row.status) === 'pending') {
    const requestCode = escapeAttr(row.taskCode);
    return `
      <div class="row-actions">
        <select class="assignment-route-select" data-requestid="${requestCode}">
          <option value="housekeeping">Housekeeping</option>
          <option value="maintenance">Maintenance</option>
        </select>
        <select class="assignment-staff-select" data-requestid="${requestCode}">
          ${staffSelectOptions('housekeeping')}
        </select>
        <button class="approve-btn" data-action="route-selected" data-requestid="${requestCode}">Assign</button>
      </div>
    `;
  }

  return '<span class="status-pill muted">No Action</span>';
}

function rowApprovalActions(row) {
  const eligibleForDecision =
    (row.source === 'HOUSEKEEPING' || row.source === 'MAINTENANCE')
    && normalize(row.status) === 'completed'
    && normalize(row.supervisorDecision) !== 'approved';

  if (eligibleForDecision) {
    return `
      <div class="row-actions">
        <button class="approve-btn" data-action="approve" data-source="${escapeHtml(row.source)}" data-id="${row.id}">Approve</button>
        <button class="approve-btn reject" data-action="reject" data-source="${escapeHtml(row.source)}" data-id="${row.id}">Reject</button>
      </div>
    `;
  }

  return '<span class="status-pill muted">No Action</span>';
}

function statusClass(status) {
  const value = normalize(status);
  if (value === 'pending') return 'inactive';
  if (value === 'in progress') return 'active';
  if (value === 'completed') return 'active';
  return 'muted';
}

function decisionClass(decision) {
  const value = normalize(decision);
  if (value === 'approved') return 'active';
  if (value === 'rejected') return 'inactive';
  return 'muted';
}

async function routeGuestRequest(requestId, targetModule, assignedStaff) {
  const data = await apiPost('/guestservice/route', {
    requestId,
    targetModule,
    assignedStaff,
    role: currentRole,
  });

  if (!data.success) {
    showMessage('taskActionMessage', data.message || 'Could not assign request.');
    return;
  }

  showMessage('taskActionMessage', data.message || 'Request assigned successfully.');
  await loadUnifiedData();
}

async function submitSupervisorDecision(source, id, decision) {
  const isReject = normalize(decision) === 'rejected';
  let reassignedTo = '';
  let rejectionReason = '';

  if (isReject) {
    rejectionReason = window.prompt('Enter rejection reason (required):', '') || '';
    reassignedTo = window.prompt('Reassign to staff member (required):', '') || '';

    if (!rejectionReason.trim() || !reassignedTo.trim()) {
      showMessage('taskActionMessage', 'Rejection reason and reassignment are required.');
      return;
    }
  }

  const endpoint = source === 'HOUSEKEEPING' ? '/housekeeping/approve' : '/maintenance/approve';
  const data = await apiPost(endpoint, {
    id,
    decision,
    reassignedTo,
    rejectionReason,
    role: currentRole,
  });

  if (!data.success) {
    showMessage('taskActionMessage', data.message || 'Failed to update supervisor decision.');
    return;
  }

  showMessage('taskActionMessage', data.message || 'Decision updated.');
  await loadUnifiedData();
}

function attachListeners() {
  document.getElementById('refreshButton')?.addEventListener('click', (event) => {
    event.preventDefault();
    window.location.reload();
  });
  document.getElementById('viewFilter')?.addEventListener('change', renderTaskQueues);
  document.getElementById('departmentFilter')?.addEventListener('change', renderTaskQueues);
  document.getElementById('searchInput')?.addEventListener('input', renderTaskQueues);

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || !target.classList.contains('assignment-route-select')) {
      return;
    }

    const requestId = target.dataset.requestid;
    if (!requestId) {
      return;
    }

    const rowActions = target.closest('.row-actions');
    const staffSelect = rowActions?.querySelector('.assignment-staff-select');
    if (!(staffSelect instanceof HTMLSelectElement)) {
      return;
    }

    staffSelect.innerHTML = staffSelectOptions(target.value);
  });

  document.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains('approve-btn')) {
      return;
    }

    const action = target.dataset.action;
    if (!action) {
      return;
    }

    if (action === 'route-selected') {
      const requestId = target.dataset.requestid;
      const rowActions = target.closest('.row-actions');
      const routeSelect = rowActions?.querySelector('.assignment-route-select');
      const staffSelect = rowActions?.querySelector('.assignment-staff-select');

      if (!(routeSelect instanceof HTMLSelectElement) || !(staffSelect instanceof HTMLSelectElement)) {
        showMessage('taskActionMessage', 'Could not read assignment inputs.');
        return;
      }

      const routeTo = routeSelect.value;
      const assignedStaff = staffSelect.value;

      if (!assignedStaff) {
        showMessage('taskActionMessage', `Please select a ${routeTo} staff member.`);
        return;
      }

      if (requestId && routeTo) {
        await routeGuestRequest(requestId, routeTo, assignedStaff);
      }
      return;
    }

    const id = Number(target.dataset.id);
    const source = target.dataset.source;

    if (!source || Number.isNaN(id)) {
      return;
    }

    if (action === 'approve') {
      await submitSupervisorDecision(source, id, 'Approved');
      return;
    }

    if (action === 'reject') {
      await submitSupervisorDecision(source, id, 'Rejected');
    }
  });
}

attachListeners();
loadUnifiedData();
