/**
 * Manager Dashboard - Account Creation & Management
 * Dynamic account creation with localStorage persistence
 */

const ACCOUNTS_STORAGE_KEY = 'staffAccounts';

const defaultAccounts = [
  {
    id: 1,
    username: 'silva.nimal',
    email: 'silva.nimal@flametreehotel.local',
    role: 'Housekeeping Staff',
    createdDate: '2026-02-15',
    status: 'Active'
  },
  {
    id: 2,
    username: 'perera.asha',
    email: 'perera.asha@flametreehotel.local',
    role: 'Inventory / Store Manager',
    createdDate: '2026-02-10',
    status: 'Active'
  },
  {
    id: 3,
    username: 'fernando.rex',
    email: 'fernando.rex@flametreehotel.local',
    role: 'Maintenance Staff',
    createdDate: '2026-02-08',
    status: 'Active'
  }
];

document.addEventListener('DOMContentLoaded', () => {
  loadAccounts();
  renderAccountsList();
  attachFormListeners();
  updateUsernamesDatalist();
});

function loadAccounts() {
  const stored = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(defaultAccounts));
  }
}

function getAccounts() {
  const stored = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
  return stored ? JSON.parse(stored) : defaultAccounts;
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}

function getNextId() {
  const accounts = getAccounts();
  return accounts.length > 0 ? Math.max(...accounts.map((a) => a.id)) + 1 : 1;
}

function renderAccountsList() {
  const accounts = getAccounts();
  const listContainer = document.getElementById('accountsList');

  if (!listContainer) {
    const accessControlSection = document.getElementById('access-control');
    const listHtml = `
      <div style="margin-top: 20px;">
        <h3>Created Staff Accounts</h3>
        <div id="accountsList" style="border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 12px; background: rgba(255, 255, 255, 0.02);"></div>
      </div>
    `;
    accessControlSection.insertAdjacentHTML('beforeend', listHtml);
  }

  const container = document.getElementById('accountsList');
  container.innerHTML = '';

  if (accounts.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); margin: 0;">No accounts created yet.</p>';
    return;
  }

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.innerHTML = `
    <thead>
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.12);">
        <th style="text-align: left; padding: 8px; color: var(--tone-gold); font-weight: 700;">Username</th>
        <th style="text-align: left; padding: 8px; color: var(--tone-gold); font-weight: 700;">Email</th>
        <th style="text-align: left; padding: 8px; color: var(--tone-gold); font-weight: 700;">Role</th>
        <th style="text-align: left; padding: 8px; color: var(--tone-gold); font-weight: 700;">Status</th>
        <th style="text-align: left; padding: 8px; color: var(--tone-gold); font-weight: 700;">Actions</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');

  accounts.forEach((account) => {
    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid rgba(255, 255, 255, 0.12)';

    const isActive = account.status === 'Active';
    const actionButtonText = isActive ? 'Deactivate' : 'Activate';
    const actionButtonClass = isActive ? 'deactivate-btn' : 'activate-btn';
    const buttonColor = isActive
      ? 'background: rgba(255, 95, 95, 0.25); color: #ff5f5f;'
      : 'background: rgba(159, 224, 185, 0.25); color: #9fe0b9;';
    const statusPillStyle = isActive
      ? 'background: rgba(159, 224, 185, 0.18); color: #9fe0b9;'
      : 'background: rgba(255, 95, 95, 0.18); color: #ff5f5f;';

    row.innerHTML = `
      <td style="padding: 8px; color: var(--text-main);">${escapeHtml(account.username)}</td>
      <td style="padding: 8px; color: var(--text-muted); font-size: 0.9rem;">${escapeHtml(account.email)}</td>
      <td style="padding: 8px; color: var(--text-main); font-size: 0.9rem;">${escapeHtml(account.role || '(No role assigned)')}</td>
      <td style="padding: 8px;">
        <span style="display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 0.8rem; font-weight: 700; ${statusPillStyle}">
          ${account.status}
        </span>
      </td>
      <td style="padding: 8px;">
        <button
          class="${actionButtonClass}"
          data-id="${account.id}"
          style="padding: 4px 8px; font-size: 0.8rem; border: none; border-radius: 6px; ${buttonColor} font-weight: 700; cursor: pointer;"
        >
          ${actionButtonText}
        </button>
      </td>
    `;

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);

  document.querySelectorAll('.deactivate-btn, .activate-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.currentTarget.dataset.id, 10);
      handleToggleAccountStatus(id);
    });
  });
}

function attachFormListeners() {
  const createAccountForm = document.getElementById('newUsername')?.closest('form');

  if (createAccountForm) {
    createAccountForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const username = document.getElementById('newUsername').value.trim();
      const email = document.getElementById('newEmail').value.trim();
      const password = document.getElementById('tempPassword').value.trim();

      if (!username || !email || !password) {
        alert('Please fill in all fields');
        return;
      }

      const accounts = getAccounts();
      const usernameExists = accounts.some((a) => a.username.toLowerCase() === username.toLowerCase());

      if (usernameExists) {
        alert('Username already exists');
        return;
      }

      const newAccount = {
        id: getNextId(),
        username,
        email,
        role: '',
        createdDate: new Date().toISOString().split('T')[0],
        status: 'Active'
      };

      accounts.push(newAccount);
      saveAccounts(accounts);
      createAccountForm.reset();
      renderAccountsList();
      updateUsernamesDatalist();
      showNotification(`Account created for ${username}`);
    });
  }

  const assignRoleForm = document.getElementById('staffUser')?.closest('form');

  if (assignRoleForm) {
    const staffUserInput = document.getElementById('staffUser');
    const roleSelect = document.getElementById('role');

    assignRoleForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const selectedUsername = staffUserInput.value.trim();
      const selectedRole = roleSelect.value;

      if (!selectedUsername || !selectedRole) {
        alert('Please select a username and role');
        return;
      }

      const accounts = getAccounts();
      const account = accounts.find(
        (a) => a.username.toLowerCase() === selectedUsername.toLowerCase()
      );

      if (!account) {
        alert('User not found');
        return;
      }

      account.role = selectedRole;
      saveAccounts(accounts);
      renderAccountsList();
      updateUsernamesDatalist();
      assignRoleForm.reset();
      showNotification(`Role assigned: ${account.username} is now ${selectedRole}`);
    });
  }

  const deactivateAccountForm = document.getElementById('deactivateUser')?.closest('form');

  if (deactivateAccountForm) {
    const deactivateUserInput = document.getElementById('deactivateUser');
    const reasonInput = document.getElementById('reason');

    if (deactivateUserInput) {
      deactivateUserInput.setAttribute('list', 'usernames-list');
    }

    deactivateAccountForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const username = deactivateUserInput.value.trim();
      const reason = reasonInput.value.trim();

      if (!username || !reason) {
        alert('Please enter a username and reason');
        return;
      }

      const accounts = getAccounts();
      const account = accounts.find((a) => a.username.toLowerCase() === username.toLowerCase());

      if (!account) {
        alert('User not found');
        return;
      }

      if (account.status === 'Inactive') {
        showNotification(`Account is already inactive: ${account.username}`);
        return;
      }

      account.status = 'Inactive';
      saveAccounts(accounts);
      renderAccountsList();
      deactivateAccountForm.reset();
      showNotification(`Account deactivated for ${account.username}`);
    });
  }
}

function updateUsernamesDatalist() {
  const staffUserInput = document.getElementById('staffUser');
  if (!staffUserInput) return;

  let datalist = document.getElementById('usernames-list');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'usernames-list';
    document.body.appendChild(datalist);
    staffUserInput.setAttribute('list', 'usernames-list');
  }

  const accounts = getAccounts();
  datalist.innerHTML = '';

  accounts.forEach((account) => {
    const option = document.createElement('option');
    option.value = account.username;
    datalist.appendChild(option);
  });
}

function handleToggleAccountStatus(id) {
  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === id);

  if (!account) return;

  const newStatus = account.status === 'Active' ? 'Inactive' : 'Active';
  const action = newStatus === 'Inactive' ? 'deactivated' : 'reactivated';

  account.status = newStatus;
  saveAccounts(accounts);
  renderAccountsList();
  showNotification(`Account ${action} for ${account.username}`);
}

function showNotification(message) {
  let notification = document.getElementById('managerNotification');

  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'managerNotification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(159, 224, 185, 0.2);
      border: 1px solid #9fe0b9;
      border-radius: 8px;
      padding: 12px 16px;
      color: #9fe0b9;
      font-weight: 700;
      z-index: 1000;
      max-width: 300px;
    `;
    document.body.appendChild(notification);
  }

  notification.textContent = message;
  notification.style.display = 'block';

  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
