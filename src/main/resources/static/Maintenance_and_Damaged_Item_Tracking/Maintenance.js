const STORAGE_KEY = 'flameTreeMaintenanceTickets';

const defaultTickets = [
  {
    ticket: 'MT-2026-011',
    location: 'Room 202',
    issue: 'Leaking faucet',
    assignedTo: 'R. Silva',
    status: 'In Progress'
  },
  {
    ticket: 'MT-2026-012',
    location: 'Room 118',
    issue: 'Damaged reading lamp',
    assignedTo: 'M. Khan',
    status: 'Replacement Needed'
  },
  {
    ticket: 'MT-2026-013',
    location: 'Lobby',
    issue: 'AC not cooling',
    assignedTo: 'T. Perera',
    status: 'Open'
  }
];

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

const updateTicketIndexInput = document.getElementById('updateTicketIndex');
const updateTicketIdInput = document.getElementById('updateTicketId');
const updateLocationInput = document.getElementById('updateLocation');
const updateIssueInput = document.getElementById('updateIssue');
const updateAssignedToInput = document.getElementById('updateAssignedTo');
const updateStatusInput = document.getElementById('updateStatus');

function loadTickets() {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultTickets));
    return [...defaultTickets];
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [...defaultTickets];
  } catch {
    return [...defaultTickets];
  }
}

function saveTickets(tickets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

function statusClass(status) {
  if (status === 'In Progress') {
    return 'in-progress';
  }
  if (status === 'Replacement Needed') {
    return 'replacement';
  }
  if (status === 'Repaired') {
    return 'open';
  }
  return 'open';
}

function renderMetrics(tickets) {
  openIssuesMetric.textContent = String(tickets.filter((ticket) => ticket.status === 'Open').length).padStart(2, '0');
  inProgressMetric.textContent = String(tickets.filter((ticket) => ticket.status === 'In Progress').length).padStart(2, '0');
  repairedMetric.textContent = String(tickets.filter((ticket) => ticket.status === 'Repaired').length).padStart(2, '0');
  replacementMetric.textContent = String(tickets.filter((ticket) => ticket.status === 'Replacement Needed').length).padStart(2, '0');
}

function renderTable(tickets) {
  maintenanceTableBody.innerHTML = '';

  if (tickets.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="6">No tickets found. Add your first maintenance ticket.</td>';
    maintenanceTableBody.appendChild(emptyRow);
    return;
  }

  tickets.forEach((ticket, index) => {
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
          <button type="button" class="small-btn" data-action="edit" data-index="${index}">Update</button>
          <button type="button" class="small-btn delete-btn" data-action="delete" data-index="${index}">Delete</button>
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

function openUpdateDialog(ticket, index) {
  updateTicketIndexInput.value = String(index);
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

addTicketForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const tickets = loadTickets();
  const ticketId = ticketIdInput.value.trim();

  if (!ticketId) {
    showMessage('Please enter a valid ticket ID.');
    return;
  }

  const exists = tickets.some((ticket) => ticket.ticket.toLowerCase() === ticketId.toLowerCase());
  if (exists) {
    showMessage('Ticket ID already exists. Please use a unique ticket ID.');
    return;
  }

  tickets.push({
    ticket: ticketId,
    location: locationInput.value.trim(),
    issue: issueInput.value.trim(),
    assignedTo: assignedToInput.value.trim(),
    status: statusInput.value
  });

  saveTickets(tickets);
  renderAll(tickets);
  addTicketDialog.close();
  addTicketForm.reset();
  showMessage(`Added ticket ${ticketId}.`);
});

updateTicketForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const tickets = loadTickets();
  const index = Number(updateTicketIndexInput.value);
  const target = tickets[index];

  if (!target) {
    showMessage('Unable to update ticket.');
    return;
  }

  target.ticket = updateTicketIdInput.value.trim();
  target.location = updateLocationInput.value.trim();
  target.issue = updateIssueInput.value.trim();
  target.assignedTo = updateAssignedToInput.value.trim();
  target.status = updateStatusInput.value;

  saveTickets(tickets);
  renderAll(tickets);
  updateTicketDialog.close();
  updateTicketForm.reset();
  showMessage(`Updated ticket ${target.ticket}.`);
});

maintenanceTableBody.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.getAttribute('data-action');
  const indexValue = target.getAttribute('data-index');

  if (!action || indexValue === null) {
    return;
  }

  const index = Number(indexValue);
  const tickets = loadTickets();
  const ticket = tickets[index];

  if (!ticket) {
    showMessage('Selected ticket not found.');
    return;
  }

  if (action === 'edit') {
    openUpdateDialog(ticket, index);
    return;
  }

  if (action === 'delete') {
    const confirmed = window.confirm(`Delete ticket ${ticket.ticket}?`);
    if (!confirmed) {
      return;
    }

    tickets.splice(index, 1);
    saveTickets(tickets);
    renderAll(tickets);
    showMessage(`Deleted ticket ${ticket.ticket}.`);
  }
});

renderAll(loadTickets());
