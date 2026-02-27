const addItemForm = document.getElementById('addItemForm');
const updateItemForm = document.getElementById('updateItemForm');
const addItemDialog = document.getElementById('addItemDialog');
const updateItemDialog = document.getElementById('updateItemDialog');
const openAddDialogBtn = document.getElementById('openAddDialogBtn');
const cancelAddDialogBtn = document.getElementById('cancelAddDialogBtn');
const cancelUpdateDialogBtn = document.getElementById('cancelUpdateDialogBtn');
const inventoryTableBody = document.getElementById('inventoryTableBody');
const totalItemsMetric = document.getElementById('totalItemsMetric');
const lowStockMetric = document.getElementById('lowStockMetric');
const damagedMetric = document.getElementById('damagedMetric');
const missingMetric = document.getElementById('missingMetric');
const inventoryMessage = document.getElementById('inventoryMessage');

const itemNameInput = document.getElementById('itemName');
const categoryInput = document.getElementById('category');
const openingQtyInput = document.getElementById('openingQty');
const minLevelInput = document.getElementById('minLevel');

const updateItemIdInput = document.getElementById('updateItemId');
const updateItemNameInput = document.getElementById('updateItemName');
const updateCategoryInput = document.getElementById('updateCategory');
const updateStockInput = document.getElementById('updateStock');
const updateMinLevelInput = document.getElementById('updateMinLevel');
const updateDamagedInput = document.getElementById('updateDamaged');
const updateMissingInput = document.getElementById('updateMissing');

function statusClass(status) {
  if (status === 'Low Stock') return 'low';
  if (status === 'Monitor') return 'watch';
  return 'ok';
}

function renderTable(items) {
  inventoryTableBody.innerHTML = '';

  if (items.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="8">No inventory items yet. Add your first item.</td>';
    inventoryTableBody.appendChild(emptyRow);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('tr');
    const cls = statusClass(item.status);

    row.innerHTML = `
      <td>${item.item}</td>
      <td>${item.category}</td>
      <td>${item.inStock}</td>
      <td>${item.minLevel}</td>
      <td>${item.damaged}</td>
      <td>${item.missing}</td>
      <td><span class="tag ${cls}">${item.status}</span></td>
      <td>
        <div class="row-actions">
          <button type="button" class="small-btn" data-action="edit" data-id="${item.id}">Update</button>
          <button type="button" class="small-btn delete-btn" data-action="delete" data-id="${item.id}" data-name="${item.item}">Delete</button>
        </div>
      </td>
    `;

    inventoryTableBody.appendChild(row);
  });
}

function renderMetrics(items) {
  totalItemsMetric.textContent = String(items.length).padStart(2, '0');
  lowStockMetric.textContent = String(items.filter((item) => item.status === 'Low Stock').length).padStart(2, '0');
  damagedMetric.textContent = String(items.reduce((sum, item) => sum + Number(item.damaged || 0), 0)).padStart(2, '0');
  missingMetric.textContent = String(items.reduce((sum, item) => sum + Number(item.missing || 0), 0)).padStart(2, '0');
}

function renderAll(items) {
  renderTable(items);
  renderMetrics(items);
}

function showMessage(message) {
  inventoryMessage.textContent = message;
}

async function loadAndRender() {
  try {
    const res = await fetch('/inventory/list');
    if (!res.ok) throw new Error('Failed to load inventory.');
    const items = await res.json();
    renderAll(items);
  } catch (err) {
    showMessage('Error loading inventory: ' + err.message);
  }
}

function openUpdateDialog(item) {
  updateItemIdInput.value = String(item.id);
  updateItemNameInput.value = item.item;
  updateCategoryInput.value = item.category;
  updateStockInput.value = String(item.inStock);
  updateMinLevelInput.value = String(item.minLevel);
  updateDamagedInput.value = String(item.damaged);
  updateMissingInput.value = String(item.missing);
  updateItemDialog.showModal();
}

openAddDialogBtn.addEventListener('click', () => {
  addItemForm.reset();
  addItemDialog.showModal();
});

cancelAddDialogBtn.addEventListener('click', () => {
  addItemDialog.close();
});

cancelUpdateDialogBtn.addEventListener('click', () => {
  updateItemDialog.close();
});

inventoryTableBody.addEventListener('click', async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) return;

  const action = target.getAttribute('data-action');
  const idValue = target.getAttribute('data-id');

  if (!action || idValue === null) return;

  const id = Number(idValue);

  if (action === 'edit') {
    try {
      const res = await fetch('/inventory/list');
      const items = await res.json();
      const item = items.find((i) => i.id === id);
      if (item) {
        openUpdateDialog(item);
      } else {
        showMessage('Unable to find selected item.');
      }
    } catch {
      showMessage('Error fetching item details.');
    }
    return;
  }

  if (action === 'delete') {
    const name = target.getAttribute('data-name') || 'this item';
    const isConfirmed = window.confirm(`Delete ${name}? This cannot be undone.`);
    if (!isConfirmed) return;

    try {
      const res = await fetch('/inventory/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      showMessage(data.message || 'Item deleted.');
      await loadAndRender();
    } catch {
      showMessage('Error deleting item.');
    }
  }
});

addItemForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const itemName = itemNameInput.value.trim();
  if (!itemName) {
    showMessage('Please enter a valid item name.');
    return;
  }

  const payload = {
    item: itemName,
    category: categoryInput.value,
    inStock: Number(openingQtyInput.value || 0),
    minLevel: Number(minLevelInput.value || 0)
  };

  try {
    const res = await fetch('/inventory/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.success) {
      showMessage(data.message || 'Failed to add item.');
      return;
    }

    addItemForm.reset();
    addItemDialog.close();
    showMessage(data.message || 'Item added.');
    await loadAndRender();
  } catch {
    showMessage('Error adding item.');
  }
});

updateItemForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const id = Number(updateItemIdInput.value);
  const itemName = updateItemNameInput.value.trim();

  if (!itemName) {
    showMessage('Please enter a valid item name.');
    return;
  }

  const payload = {
    id,
    item: itemName,
    category: updateCategoryInput.value,
    inStock: Math.max(0, Number(updateStockInput.value || 0)),
    minLevel: Math.max(0, Number(updateMinLevelInput.value || 0)),
    damaged: Math.max(0, Number(updateDamagedInput.value || 0)),
    missing: Math.max(0, Number(updateMissingInput.value || 0))
  };

  try {
    const res = await fetch('/inventory/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.success) {
      showMessage(data.message || 'Failed to update item.');
      return;
    }

    updateItemForm.reset();
    updateItemDialog.close();
    showMessage(data.message || 'Item updated.');
    await loadAndRender();
  } catch {
    showMessage('Error updating item.');
  }
});

loadAndRender();
