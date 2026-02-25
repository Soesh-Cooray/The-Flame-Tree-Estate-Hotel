const STORAGE_KEY = 'flameTreeInventoryItems';

const defaultItems = [
  {
    name: 'Bath Towels',
    category: 'Towels',
    unit: 'Pieces',
    inStock: 128,
    minLevel: 70,
    damaged: 2,
    missing: 1
  },
  {
    name: 'Toilet Tissue Packs',
    category: 'Toiletries',
    unit: 'Packs',
    inStock: 45,
    minLevel: 50,
    damaged: 1,
    missing: 0
  },
  {
    name: 'Bed Sheets - King',
    category: 'Bedding',
    unit: 'Pieces',
    inStock: 66,
    minLevel: 60,
    damaged: 1,
    missing: 1
  },
  {
    name: 'Glass Cleaner',
    category: 'Cleaning Supplies',
    unit: 'Bottles',
    inStock: 22,
    minLevel: 20,
    damaged: 0,
    missing: 0
  }
];

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
const unitInput = document.getElementById('unit');
const openingQtyInput = document.getElementById('openingQty');
const minLevelInput = document.getElementById('minLevel');

const updateItemIndexInput = document.getElementById('updateItemIndex');
const updateItemNameInput = document.getElementById('updateItemName');
const updateCategoryInput = document.getElementById('updateCategory');
const updateUnitInput = document.getElementById('updateUnit');
const updateStockInput = document.getElementById('updateStock');
const updateMinLevelInput = document.getElementById('updateMinLevel');
const updateDamagedInput = document.getElementById('updateDamaged');
const updateMissingInput = document.getElementById('updateMissing');

function loadItems() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultItems));
    return [...defaultItems];
  }

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [...defaultItems];
  } catch {
    return [...defaultItems];
  }
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function statusFromItem(item) {
  if (item.inStock <= item.minLevel) {
    return { label: 'Low Stock', className: 'low' };
  }

  if (item.damaged > 0 || item.missing > 0) {
    return { label: 'Monitor', className: 'watch' };
  }

  return { label: 'Healthy', className: 'ok' };
}

function renderTable(items) {
  inventoryTableBody.innerHTML = '';

  if (items.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="8">No inventory items yet. Add your first item.</td>';
    inventoryTableBody.appendChild(emptyRow);
    return;
  }

  items.forEach((item, index) => {
    const row = document.createElement('tr');
    const status = statusFromItem(item);

    row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.category}</td>
      <td>${item.inStock}</td>
      <td>${item.minLevel}</td>
      <td>${item.damaged}</td>
      <td>${item.missing}</td>
      <td><span class="tag ${status.className}">${status.label}</span></td>
      <td>
        <div class="row-actions">
          <button type="button" class="small-btn" data-action="edit" data-index="${index}">Update</button>
          <button type="button" class="small-btn delete-btn" data-action="delete" data-index="${index}">Delete</button>
        </div>
      </td>
    `;

    inventoryTableBody.appendChild(row);
  });
}

function renderMetrics(items) {
  totalItemsMetric.textContent = String(items.length).padStart(2, '0');
  lowStockMetric.textContent = String(items.filter((item) => item.inStock <= item.minLevel).length).padStart(2, '0');
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

function openUpdateDialog(item, index) {
  updateItemIndexInput.value = String(index);
  updateItemNameInput.value = item.name;
  updateCategoryInput.value = item.category;
  updateUnitInput.value = item.unit;
  updateStockInput.value = String(item.inStock);
  updateMinLevelInput.value = String(item.minLevel);
  updateDamagedInput.value = String(item.damaged);
  updateMissingInput.value = String(item.missing);
  updateItemDialog.showModal();
}

function deleteItem(index) {
  const items = loadItems();
  const target = items[index];

  if (!target) {
    showMessage('Item not found for deletion.');
    return;
  }

  items.splice(index, 1);
  saveItems(items);
  renderAll(items);
  showMessage(`Deleted item: ${target.name}.`);
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

inventoryTableBody.addEventListener('click', (event) => {
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
  const items = loadItems();
  const item = items[index];

  if (!item) {
    showMessage('Unable to find selected item.');
    return;
  }

  if (action === 'edit') {
    openUpdateDialog(item, index);
    return;
  }

  if (action === 'delete') {
    const isConfirmed = window.confirm(`Delete ${item.name}? This cannot be undone.`);
    if (isConfirmed) {
      deleteItem(index);
    }
  }
});

addItemForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const items = loadItems();
  const itemName = itemNameInput.value.trim();

  if (!itemName) {
    showMessage('Please enter a valid item name.');
    return;
  }

  const existing = items.find((item) => item.name.toLowerCase() === itemName.toLowerCase());
  if (existing) {
    showMessage('Item already exists. Use Update on the item row.');
    return;
  }

  const openingQty = Number(openingQtyInput.value || 0);
  const minLevel = Number(minLevelInput.value || 0);

  items.push({
    name: itemName,
    category: categoryInput.value,
    unit: unitInput.value.trim() || 'Units',
    inStock: openingQty,
    minLevel,
    damaged: 0,
    missing: 0
  });

  saveItems(items);
  renderAll(items);
  addItemForm.reset();
  addItemDialog.close();
  showMessage(`Added new item: ${itemName}.`);
});

updateItemForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const items = loadItems();
  const index = Number(updateItemIndexInput.value);
  const selectedItem = items[index];

  if (!selectedItem) {
    showMessage('Item not found for update.');
    return;
  }

  selectedItem.name = updateItemNameInput.value.trim();
  selectedItem.category = updateCategoryInput.value;
  selectedItem.unit = updateUnitInput.value.trim() || 'Units';
  selectedItem.inStock = Math.max(0, Number(updateStockInput.value || 0));
  selectedItem.minLevel = Math.max(0, Number(updateMinLevelInput.value || 0));
  selectedItem.damaged = Math.max(0, Number(updateDamagedInput.value || 0));
  selectedItem.missing = Math.max(0, Number(updateMissingInput.value || 0));

  saveItems(items);
  renderAll(items);
  updateItemForm.reset();
  updateItemDialog.close();
  showMessage(`Updated ${selectedItem.name}.`);
});

renderAll(loadItems());
