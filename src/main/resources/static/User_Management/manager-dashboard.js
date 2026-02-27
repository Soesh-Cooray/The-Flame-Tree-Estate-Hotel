// ── Helpers ──────────────────────────────────────────────────────────────
function showMsg(el, text, ok) {
  el.textContent = text;
  el.style.color = ok ? '#27ae60' : '#c0392b';
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function apiPut(url, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

// ── Load all users into datalist + table ─────────────────────────────────
async function loadUsers() {
  try {
    const res = await fetch('/auth/users');
    const users = await res.json();

    const datalist = document.getElementById('usernames-list');
    datalist.innerHTML = users.map(u => `<option value="${u.username}">`).join('');

    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.username}</td>
        <td style="color:var(--text-muted)">${u.staffEmail || '—'}</td>
        <td>${u.role || '—'}</td>
        <td><span class="status-pill ${u.status ? 'active' : 'inactive'}">${u.status ? 'Active' : 'Inactive'}</span></td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Could not load users', e);
  }
}

loadUsers();

// ── Create User Account ──────────────────────────────────────────────────
document.getElementById('createUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('createMsg');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  const data = await apiPost('/auth/register', {
    username: document.getElementById('newUsername').value.trim(),
    staffEmail: document.getElementById('newEmail').value.trim(),
    password: document.getElementById('tempPassword').value,
    role: document.getElementById('newRole').value
  });

  showMsg(msg, data.message, data.success);
  btn.disabled = false;
  if (data.success) {
    e.target.reset();
    loadUsers();
  }
});

// ── Assign Role ──────────────────────────────────────────────────────────
document.getElementById('assignRoleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('assignMsg');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  const data = await apiPut('/auth/assign-role', {
    username: document.getElementById('staffUser').value.trim(),
    role: document.getElementById('role').value
  });

  showMsg(msg, data.message, data.success);
  btn.disabled = false;
  if (data.success) {
    e.target.reset();
    loadUsers();
  }
});

// ── Deactivate / Activate Account ────────────────────────────────────────
async function setAccountStatus(active) {
  const username = document.getElementById('deactivateUser').value.trim();
  const msg = document.getElementById('statusMsg');

  if (!username) {
    showMsg(msg, 'Please enter a username.', false);
    return;
  }

  const data = await apiPut('/auth/status', { username, active: String(active) });
  showMsg(msg, data.message, data.success);
  if (data.success) {
    document.getElementById('statusForm').reset();
    loadUsers();
  }
}

document.getElementById('deactivateBtn').addEventListener('click', () => setAccountStatus(false));
document.getElementById('activateBtn').addEventListener('click', () => setAccountStatus(true));
