const openIssuesMetric = document.getElementById('openIssuesMetric');
const inProgressMetric = document.getElementById('inProgressMetric');
const repairedMetric = document.getElementById('repairedMetric');
const replacementMetric = document.getElementById('replacementMetric');
const maintenanceTableBody = document.getElementById('maintenanceTableBody');
const maintenanceMessage = document.getElementById('maintenanceMessage');

const openAddDialogBtn = document.getElementById('openAddDialogBtn');
const addTicketDialog = document.getElementById('addTicketDialog');
const updateTicketDialog = document.getElementById('updateTicketDialog');
const cancelAddDialogBtn = document.getElementById('cancelAddDialogBtn');
const cancelUpdateDialogBtn = document.getElementById('cancelUpdateDialogBtn');

const addTicketForm = document.getElementById('addTicketForm');
const updateTicketForm = document.getElementById('updateTicketForm');

const ticketIdInput = document.getElementById('ticketId');
const locationInput = document.getElementById('location');
const issueInput = document.getElementById('issue');
const assignedToInput = document.getElementById('assignedTo');
const statusInput = document.getElementById('status');

const updateTicketDbIdInput = document.getElementById('updateTicketDbId');
const updateTicketIdInput = document.getElementById('updateTicketId');
const updateLocationInput = document.getElementById('updateLocation');
const updateIssueInput = document.getElementById('updateIssue');
const updateAssignedToInput = document.getElementById('updateAssignedTo');
const updateStatusInput = document.getElementById('updateStatus');

function statusClass(status) {
  if (status === 'In Progress') return 'in-progress';
  if (status === 'Replacement Needed') return 'replacement';
  return 'open';
}

function renderMetrics(tickets) {
  openIssuesMetric.textContent = String(tickets.filter((t) => t.status === 'Open').length).padStart(2, '0');
  inProgressMetric.textContent = String(tickets.filter((t) => t.status === 'In Progress').length).padStart(2, '0');
  repairedMetric.textContent = String(tickets.filter((t) => t.status === 'Repaired').length).padStart(2, '0');
  replacementMetric.textContent = String(tickets.filter((t) => t.status === 'Replacement Needed').length).padStart(2, '0');
}

function renderTable(tickets) {
  maintenanceTableBody.innerHTML = '';

  if (tickets.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="6">No tickets found. Add your first maintenance ticket.</td>';
    maintenanceTableBody.appendChild(emptyRow);
    return;
  }

  tickets.forEach((ticket) => {
    const row = document.createElement('tr');
    const tagClass = statusClass(ticket.status);

    row.innerHTML = `
      <td>${ticket.ticket}</td>
      <td>${ticket.location}</td>
      <td>${ticket.issue}</td>
      <td>${ticket.assignedTo}</td>
      <td><span class="tag ${tagClass}">${ticket.status}</span></td>
      <td>
        <div class="row-actions">
          <button type="button" class="small-btn" data-action="edit" data-id="${ticket.id}">Update</button>
          <button type="button" class="small-btn delete-btn" data-action="delete" data-id="${ticket.id}" data-ticket="${ticket.ticket}">Delete</button>
        </div>
      </td>
    `;

    maintenanceTableBody.appendChild(row);
  });
}

function renderAll(tickets) {
  renderMetrics(tickets);
  renderTable(tickets);
}

function showMessage(message) {
  maintenanceMessage.textContent = message;
}

async function loadAndRender() {
  try {
    const res = await fetch('/maintenance/list');
    if (!res.ok) throw new Error('Failed to load tickets.');
    const tickets = await res.json();
    renderAll(tickets);
  } catch (err) {
    showMessage('Error loading tickets: ' + err.message);
  }
}

function openUpdateDialog(ticket) {
  updateTicketDbIdInput.value = String(ticket.id);
  updateTicketIdInput.value = ticket.ticket;
  updateLocationInput.value = ticket.location;
  updateIssueInput.value = ticket.issue;
  updateAssignedToInput.value = ticket.assignedTo;
  updateStatusInput.value = ticket.status;
  updateTicketDialog.showModal();
}

openAddDialogBtn.addEventListener('click', () => {
  addTicketForm.reset();
  addTicketDialog.showModal();
});

cancelAddDialogBtn.addEventListener('click', () => {
  addTicketDialog.close();
});

cancelUpdateDialogBtn.addEventListener('click', () => {
  updateTicketDialog.close();
});

addTicketForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const ticketId = ticketIdInput.value.trim();
  if (!ticketId) {
    showMessage('Please enter a valid ticket ID.');
    return;
  }

  const payload = {
    ticket: ticketId,
    location: locationInput.value.trim(),
    issue: issueInput.value.trim(),
    assignedTo: assignedToInput.value.trim(),
    status: statusInput.value
  };

  try {
    const res = await fetch('/maintenance/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.success) {
      showMessage(data.message || 'Failed to add ticket.');
      return;
    }

    addTicketDialog.close();
    addTicketForm.reset();
    showMessage(data.message || 'Ticket added.');
    await loadAndRender();
  } catch {
    showMessage('Error adding ticket.');
  }
});

updateTicketForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const id = Number(updateTicketDbIdInput.value);
  const ticketId = updateTicketIdInput.value.trim();

  if (!ticketId) {
    showMessage('Please enter a valid ticket ID.');
    return;
  }

  const payload = {
    id,
    ticket: ticketId,
    location: updateLocationInput.value.trim(),
    issue: updateIssueInput.value.trim(),
    assignedTo: updateAssignedToInput.value.trim(),
    status: updateStatusInput.value
  };

  try {
    const res = await fetch('/maintenance/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.success) {
      showMessage(data.message || 'Failed to update ticket.');
      return;
    }

    updateTicketDialog.close();
    updateTicketForm.reset();
    showMessage(data.message || 'Ticket updated.');
    await loadAndRender();
  } catch {
    showMessage('Error updating ticket.');
  }
});

maintenanceTableBody.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.getAttribute('data-action');
  const idValue = target.getAttribute('data-id');

  if (!action || idValue === null) return;

  const id = Number(idValue);

  if (action === 'edit') {
    try {
      const res = await fetch('/maintenance/list');
      const tickets = await res.json();
      const ticket = tickets.find((t) => t.id === id);
      if (ticket) {
        openUpdateDialog(ticket);
      } else {
        showMessage('Selected ticket not found.');
      }
    } catch {
      showMessage('Error fetching ticket details.');
    }
    return;
  }

  if (action === 'delete') {
    const ticketLabel = target.getAttribute('data-ticket') || 'this ticket';
    const confirmed = window.confirm(`Delete ticket ${ticketLabel}?`);
    if (!confirmed) return;

    try {
      const res = await fetch('/maintenance/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      showMessage(data.message || 'Ticket deleted.');
      await loadAndRender();
    } catch {
      showMessage('Error deleting ticket.');
    }
  }
});

loadAndRender();
