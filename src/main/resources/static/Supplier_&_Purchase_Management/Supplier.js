/**
 * Supplier & Purchase Management
 * Dynamic CRUD operations with localStorage persistence
 */

const STORAGE_KEY = 'purchaseOrders';

// Default sample data
const defaultPos = [
  {
    poId: 'PO-2026-048',
    supplierName: 'Island Linen Co.',
    itemName: 'Bath Towels',
    orderedQty: 120,
    poStatus: 'Complete',
  },
  {
    poId: 'PO-2026-049',
    supplierName: 'PureCare Supplies',
    itemName: 'Toiletry Kits',
    orderedQty: 300,
    poStatus: 'Partial',
  },
  {
    poId: 'PO-2026-050',
    supplierName: 'CleanPro Lanka',
    itemName: 'Floor Cleaner',
    orderedQty: 80,
    poStatus: 'Pending',
  },
];

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  loadPos();
  renderMetrics();
  renderTable();
  attachEventListeners();
});

// Load POs from localStorage
function loadPos() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultPos));
  }
}

// Get POs from storage
function getPos() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : defaultPos;
}

// Save POs to storage
function savePos(pos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
}

// Render summary metrics
function renderMetrics() {
  const pos = getPos();

  const totalPos = pos.length;
  const pendingCount = pos.filter((p) => p.poStatus === 'Pending').length;
  const partialCount = pos.filter((p) => p.poStatus === 'Partial').length;
  const completeCount = pos.filter((p) => p.poStatus === 'Complete').length;

  document.getElementById('totalPosMetric').textContent = totalPos;
  document.getElementById('pendingMetric').textContent = pendingCount;
  document.getElementById('partialMetric').textContent = partialCount;
  document.getElementById('completeMetric').textContent = completeCount;
}

// Get status tag styling
function statusFromPo(status) {
  const statusMap = {
    'Pending': 'pending',
    'Partial': 'partial',
    'Complete': 'done',
  };
  return statusMap[status] || 'pending';
}

// Render dynamic table
function renderTable() {
  const pos = getPos();
  const tbody = document.getElementById('posTableBody');
  tbody.innerHTML = '';

  if (pos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">
          No purchase orders recorded. Click "Add PO" to create one.
        </td>
      </tr>
    `;
    return;
  }

  pos.forEach((po, index) => {
    const statusClass = statusFromPo(po.poStatus);
    const row = document.createElement('tr');
    row.dataset.index = index;
    row.innerHTML = `
      <td>${escapeHtml(po.poId)}</td>
      <td>${escapeHtml(po.supplierName)}</td>
      <td>${escapeHtml(po.itemName)}</td>
      <td>${po.orderedQty}</td>
      <td><span class="tag ${statusClass}">${escapeHtml(po.poStatus)}</span></td>
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
  // Add PO button
  document.getElementById('openAddDialogBtn').addEventListener('click', openAddDialog);

  // Cancel buttons
  document.getElementById('cancelAddDialogBtn').addEventListener('click', () => {
    document.getElementById('addPoDialog').close();
  });

  document.getElementById('cancelUpdateDialogBtn').addEventListener('click', () => {
    document.getElementById('updatePoDialog').close();
  });

  // Add form submission
  document.getElementById('addPoForm').addEventListener('submit', handleAddSubmit);

  // Update form submission
  document.getElementById('updatePoForm').addEventListener('submit', handleUpdateSubmit);

  // Row action delegation
  document.getElementById('posTableBody').addEventListener('click', (e) => {
    if (e.target.dataset.action === 'edit') {
      openUpdateDialog(parseInt(e.target.dataset.index));
    } else if (e.target.dataset.action === 'delete') {
      handleDelete(parseInt(e.target.dataset.index));
    }
  });
}

// Open add dialog
function openAddDialog() {
  document.getElementById('addPoForm').reset();
  document.getElementById('addPoDialog').showModal();
}

// Open update dialog
function openUpdateDialog(index) {
  const pos = getPos();
  const po = pos[index];

  if (!po) return;

  document.getElementById('updatePoIndex').value = index;
  document.getElementById('updatePoId').value = po.poId;
  document.getElementById('updateSupplierName').value = po.supplierName;
  document.getElementById('updateItemName').value = po.itemName;
  document.getElementById('updateOrderedQty').value = po.orderedQty;
  document.getElementById('updatePoStatus').value = po.poStatus;

  document.getElementById('updatePoDialog').showModal();
}

// Handle add form submission
function handleAddSubmit(e) {
  e.preventDefault();

  const pos = getPos();
  const newPo = {
    poId: document.getElementById('poId').value,
    supplierName: document.getElementById('supplierName').value,
    itemName: document.getElementById('itemName').value,
    orderedQty: parseInt(document.getElementById('orderedQty').value),
    poStatus: document.getElementById('poStatus').value,
  };

  pos.push(newPo);
  savePos(pos);

  renderMetrics();
  renderTable();
  document.getElementById('addPoDialog').close();
  showMessage('Purchase order added successfully!');
}

// Handle update form submission
function handleUpdateSubmit(e) {
  e.preventDefault();

  const index = parseInt(document.getElementById('updatePoIndex').value);
  const pos = getPos();

  if (index >= 0 && index < pos.length) {
    pos[index] = {
      poId: document.getElementById('updatePoId').value,
      supplierName: document.getElementById('updateSupplierName').value,
      itemName: document.getElementById('updateItemName').value,
      orderedQty: parseInt(document.getElementById('updateOrderedQty').value),
      poStatus: document.getElementById('updatePoStatus').value,
    };

    savePos(pos);
    renderMetrics();
    renderTable();
    document.getElementById('updatePoDialog').close();
    showMessage('Purchase order updated successfully!');
  }
}

// Handle delete
function handleDelete(index) {
  if (!confirm('Are you sure you want to delete this purchase order?')) {
    return;
  }

  const pos = getPos();
  if (index >= 0 && index < pos.length) {
    pos.splice(index, 1);
    savePos(pos);
    renderMetrics();
    renderTable();
    showMessage('Purchase order deleted successfully!');
  }
}

// Show temporary message
function showMessage(message) {
  const messageEl = document.getElementById('poMessage');
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
