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
const itemNameOtherInput = document.getElementById('itemNameOther');
const itemNameOtherContainer = document.getElementById('itemNameOtherContainer');
const categoryInput = document.getElementById('category');
const openingQtyInput = document.getElementById('openingQty');
const minLevelInput = document.getElementById('minLevel');

const updateItemIdInput = document.getElementById('updateItemId');
const updateItemNameInput = document.getElementById('updateItemName');
const updateItemNameOtherInput = document.getElementById('updateItemNameOther');
const updateItemNameOtherContainer = document.getElementById('updateItemNameOtherContainer');
const updateCategoryInput = document.getElementById('updateCategory');
const updateStockInput = document.getElementById('updateStock');
const updateMinLevelInput = document.getElementById('updateMinLevel');
const updateDamagedInput = document.getElementById('updateDamaged');
const updateMissingInput = document.getElementById('updateMissing');
const inventoryApprovalBadge = document.getElementById('inventoryApprovalBadge');
const inventoryApprovalList = document.getElementById('inventoryApprovalList');
const inventorySupplierPoBadge = document.getElementById('inventorySupplierPoBadge');
const inventorySupplierPoList = document.getElementById('inventorySupplierPoList');
const inventoryReceivedPoBadge = document.getElementById('inventoryReceivedPoBadge');
const inventoryReceivedPoList = document.getElementById('inventoryReceivedPoList');
const inventoryUsageBadge = document.getElementById('inventoryUsageBadge');
const inventoryUsageList = document.getElementById('inventoryUsageList');
const receivedStockApprovalBadge = document.getElementById('receivedStockApprovalBadge');
const receivedStockApprovalBody = document.getElementById('receivedStockApprovalBody');
const rejectReceivedStockDialog = document.getElementById('rejectReceivedStockDialog');
const rejectReceivedStockForm = document.getElementById('rejectReceivedStockForm');
const rejectReceivedStockNotificationId = document.getElementById('rejectReceivedStockNotificationId');
const rejectReceivedStockReason = document.getElementById('rejectReceivedStockReason');
const rejectReceivedStockSummary = document.getElementById('rejectReceivedStockSummary');
const cancelRejectReceivedStockBtn = document.getElementById('cancelRejectReceivedStockBtn');
const inventoryToastStack = document.getElementById('inventoryToastStack');
const inventoryClearAlertsBtn = document.getElementById('inventoryClearAlertsBtn');

const INVENTORY_ALERT_POLL_MS = 5000;
const MAX_APPROVAL_FEED_ITEMS = 8;
const STORAGE_KEYS = {
  approvals: 'inventoryClearedApprovalIds',
  supplierPo: 'inventoryClearedSupplierPoNotificationIds',
  receivedPo: 'inventoryClearedReceivedPoNotificationIds',
  usage: 'inventoryClearedHousekeepingUsageIds'
};

let inventoryAlertTimer = null;
let inventorySyncInFlight = false;
let hasApprovalBaseline = false;
let knownApprovalIds = new Set();
let hasSupplierPoBaseline = false;
let knownSupplierPoNotificationIds = new Set();
let hasReceivedPoBaseline = false;
let knownReceivedPoNotificationIds = new Set();
let hasHousekeepingUsageBaseline = false;
let knownHousekeepingUsageIds = new Set();
let hasReceivedStockApprovalBaseline = false;
let knownReceivedStockApprovalSignatures = new Set();
let clearedApprovalIds = loadClearedIdSet(STORAGE_KEYS.approvals);
let clearedSupplierPoNotificationIds = loadClearedIdSet(STORAGE_KEYS.supplierPo);
let clearedReceivedPoNotificationIds = loadClearedIdSet(STORAGE_KEYS.receivedPo);
let clearedHousekeepingUsageIds = loadClearedIdSet(STORAGE_KEYS.usage);
let latestApprovalNotifications = [];
let latestSupplierPoNotifications = [];
let latestReceivedPoNotifications = [];
let latestHousekeepingUsageNotifications = [];
let latestReceivedStockApprovals = [];
let inventoryItemsCache = [];

function loadClearedIdSet(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    );
  } catch {
    return new Set();
  }
}

function saveClearedIdSet(storageKey, idSet) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(idSet)));
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

function persistAllClearedAlertSets() {
  saveClearedIdSet(STORAGE_KEYS.approvals, clearedApprovalIds);
  saveClearedIdSet(STORAGE_KEYS.supplierPo, clearedSupplierPoNotificationIds);
  saveClearedIdSet(STORAGE_KEYS.receivedPo, clearedReceivedPoNotificationIds);
  saveClearedIdSet(STORAGE_KEYS.usage, clearedHousekeepingUsageIds);
}

const ITEM_CATEGORY_MAP = {
  'Bath towels': 'Bathroom Essentials',
  'Face towels': 'Bathroom Essentials',
  'Bath mats': 'Bathroom Essentials',
  'Toilet paper': 'Bathroom Essentials',
  'Body wash': 'Basic toiletries',
  'Shampoo': 'Basic toiletries',
  'Conditioner': 'Basic toiletries',
  'Hand wash': 'Basic toiletries',
  'Pillows': 'Bedding & Comfort',
  'Duvets': 'Bedding & Comfort',
  'Duvet covers': 'Bedding & Comfort',
  'Water bottles': 'Consumable items'
};

function broadcastInventoryUpdate() {
  try {
    localStorage.setItem('inventoryUpdateSignal', String(Date.now()));
  } catch {
    // Storage may be blocked in some browser modes; polling still works.
  }
}

function normalizeItemName(value) {
  return String(value || '').trim().toLowerCase();
}

function isKnownItem(value) {
  const normalized = normalizeItemName(value);
  return Object.keys(ITEM_CATEGORY_MAP).some((item) => normalizeItemName(item) === normalized);
}

function resolveCategoryFromItem(value) {
  const normalized = normalizeItemName(value);
  const matchedKey = Object.keys(ITEM_CATEGORY_MAP).find((item) => normalizeItemName(item) === normalized);
  return matchedKey ? ITEM_CATEGORY_MAP[matchedKey] : '';
}

function handleItemSelection(itemSelect, otherContainer, otherInput, categorySelect) {
  const selected = itemSelect.value;
  const isOther = selected === 'Other items';

  otherContainer.style.display = isOther ? 'block' : 'none';
  otherInput.required = isOther;

  if (!isOther) {
    otherInput.value = '';
    const mappedCategory = resolveCategoryFromItem(selected);
    if (mappedCategory) {
      categorySelect.value = mappedCategory;
    }
  }
}

function getFinalItemName(itemSelect, otherInput) {
  if (itemSelect.value === 'Other items') {
    return otherInput.value.trim();
  }
  return itemSelect.value.trim();
}

function statusClass(status) {
  if (status === 'Low Stock') return 'low';
  if (status === 'Monitor') return 'watch';
  return 'ok';
}

function renderTable(items) {
  inventoryTableBody.innerHTML = '';

  if (items.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="9">No inventory items yet. Add your first item.</td>';
    inventoryTableBody.appendChild(emptyRow);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('tr');
    const cls = statusClass(item.status);
    const usableStock = Math.max(
      0,
      Number(item.inStock || 0) - Number(item.damaged || 0) - Number(item.missing || 0)
    );

    row.innerHTML = `
      <td>${item.item}</td>
      <td>${item.category}</td>
      <td>${item.inStock}</td>
      <td>${item.minLevel}</td>
      <td>${item.damaged}</td>
      <td>${item.missing}</td>
      <td>${usableStock}</td>
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

function showPopup(message) {
  window.alert(message);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function getReceivedStockSignature(notification) {
  return `${notification?.id || ''}:${notification?.receivedAt || ''}`;
}

function showInventoryToast(title, message) {
  if (!inventoryToastStack) {
    return;
  }

  const toast = document.createElement('article');
  toast.className = 'inventory-toast';
  toast.innerHTML = `<strong>${title}</strong><p>${message}</p>`;
  inventoryToastStack.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 4200);
}

function updateApprovalBadge(currentVisibleCount) {
  if (!inventoryApprovalBadge) {
    return;
  }
  inventoryApprovalBadge.textContent = String(currentVisibleCount);
}

function updateReceivedStockApprovalBadge(currentVisibleCount) {
  if (!receivedStockApprovalBadge) {
    return;
  }
  receivedStockApprovalBadge.textContent = String(currentVisibleCount);
}

function getVisibleManagerApprovalCount() {
  return latestApprovalNotifications.filter(
    (notification) => !clearedApprovalIds.has(Number(notification.id))
  ).length;
}

function getVisibleSupplierPoCount() {
  return latestSupplierPoNotifications.filter(
    (notification) => !clearedSupplierPoNotificationIds.has(Number(notification.id))
  ).length;
}

function getVisibleReceivedPoCount() {
  return latestReceivedPoNotifications.filter(
    (notification) => !clearedReceivedPoNotificationIds.has(Number(notification.id))
  ).length;
}

function getVisibleHousekeepingUsageCount() {
  return latestHousekeepingUsageNotifications.filter(
    (usage) => !clearedHousekeepingUsageIds.has(Number(usage.id))
  ).length;
}

function getVisibleReceivedStockApprovalCount() {
  return latestReceivedStockApprovals.length;
}

function updateLiveAlertsCounter() {
  const totalVisible = getVisibleManagerApprovalCount()
    + getVisibleSupplierPoCount()
    + getVisibleReceivedPoCount()
    + getVisibleHousekeepingUsageCount()
    + getVisibleReceivedStockApprovalCount();
  updateApprovalBadge(totalVisible);
}

function renderApprovalFeed(notifications) {
  if (!inventoryApprovalList) {
    return;
  }

  inventoryApprovalList.innerHTML = '';
  if (notifications.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No approvals received yet.';
    inventoryApprovalList.appendChild(li);
    return;
  }

  notifications.slice(0, MAX_APPROVAL_FEED_ITEMS).forEach((notification) => {
    const approvedQty = Number(notification?.suggestedQty ?? 1);
    const li = document.createElement('li');
    li.textContent = `Manager approved ${notification.itemName} for ${approvedQty} units at ${formatDateTime(notification.approvedAt)}.`;
    inventoryApprovalList.appendChild(li);
  });
}

function renderSupplierPoFeed(notifications) {
  if (inventorySupplierPoBadge) {
    inventorySupplierPoBadge.textContent = String(notifications.length);
  }

  if (!inventorySupplierPoList) {
    return;
  }

  inventorySupplierPoList.innerHTML = '';
  if (notifications.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No supplier PO confirmations yet.';
    inventorySupplierPoList.appendChild(li);
    return;
  }

  notifications.slice(0, MAX_APPROVAL_FEED_ITEMS).forEach((notification) => {
    const itemName = String(notification?.itemName || 'Inventory item');
    const supplier = String(notification?.supplier || 'Supplier team');
    const orderedQty = Number(notification?.orderedQty || 0);
    const poid = String(notification?.poid || '').trim();
    const poLabel = poid ? `${poid} • ` : '';

    const li = document.createElement('li');
    li.textContent = `${poLabel}${supplier} ordered ${orderedQty} units for ${itemName} at ${formatDateTime(notification?.approvedAt)}.`;
    inventorySupplierPoList.appendChild(li);
  });
}

function renderReceivedPoFeed(notifications) {
  if (inventoryReceivedPoBadge) {
    inventoryReceivedPoBadge.textContent = String(notifications.length);
  }

  if (!inventoryReceivedPoList) {
    return;
  }

  inventoryReceivedPoList.innerHTML = '';
  if (notifications.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No completed order receipts yet.';
    inventoryReceivedPoList.appendChild(li);
    return;
  }

  notifications.slice(0, MAX_APPROVAL_FEED_ITEMS).forEach((notification) => {
    const itemName = String(notification?.itemName || 'Inventory item');
    const supplier = String(notification?.supplier || 'Supplier team');
    const orderedQty = Number(notification?.orderedQty || 0);
    const poid = String(notification?.poid || '').trim();
    const poLabel = poid ? `${poid} • ` : '';
    const receivedAt = formatDateTime(notification?.receivedAt);

    const li = document.createElement('li');
    li.textContent = `${poLabel}${itemName} received from ${supplier} (${orderedQty} units) at ${receivedAt}.`;
    inventoryReceivedPoList.appendChild(li);
  });
}

function renderHousekeepingUsageFeed(notifications) {
  if (inventoryUsageBadge) {
    inventoryUsageBadge.textContent = String(notifications.length);
  }

  if (!inventoryUsageList) {
    return;
  }

  inventoryUsageList.innerHTML = '';
  if (notifications.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No housekeeping usage alerts yet.';
    inventoryUsageList.appendChild(li);
    return;
  }

  notifications.slice(0, MAX_APPROVAL_FEED_ITEMS).forEach((usage) => {
    const itemName = String(usage?.itemName || 'Inventory item');
    const staffName = String(usage?.staffName || 'Housekeeping staff');
    const usedQty = Number(usage?.usedQty || 0);
    const damagedQty = Number(usage?.damagedQty || 0);
    const usedAt = formatDateTime(usage?.usedAt);
    const damagedSuffix = damagedQty > 0 ? ` and reported ${damagedQty} damaged` : '';

    const li = document.createElement('li');
    li.textContent = `${staffName} used ${usedQty} units of ${itemName}${damagedSuffix} at ${usedAt}.`;
    inventoryUsageList.appendChild(li);
  });
}

function renderReceivedStockApprovalQueue(notifications) {
  if (!receivedStockApprovalBody) {
    return;
  }

  receivedStockApprovalBody.innerHTML = '';
  updateReceivedStockApprovalBadge(notifications.length);

  if (notifications.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No received stock is waiting for inventory approval.</td>';
    receivedStockApprovalBody.appendChild(emptyRow);
    return;
  }

  notifications.forEach((notification) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(String(notification?.itemName || 'Inventory item'))}</td>
      <td>${escapeHtml(String(notification?.supplier || 'Supplier team'))}</td>
      <td>${Number(notification?.qty || 0)}</td>
      <td>${escapeHtml(formatDateTime(notification?.receivedAt))}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="small-btn" data-action="approve-received-stock" data-notification-id="${notification.id}">Approve</button>
          <button type="button" class="small-btn delete-btn" data-action="reject-received-stock" data-notification-id="${notification.id}">Reject</button>
        </div>
      </td>
    `;
    receivedStockApprovalBody.appendChild(row);
  });
}

async function loadReceivedStockApprovals() {
  const res = await fetch('/inventory/received-stock-pending-approval');
  if (!res.ok) {
    throw new Error('Failed to load received stock approvals.');
  }

  return res.json();
}

async function pollReceivedStockApprovals() {
  try {
    const notifications = await loadReceivedStockApprovals();
    latestReceivedStockApprovals = Array.isArray(notifications) ? notifications : [];
    const currentSignatures = new Set(latestReceivedStockApprovals.map((notification) => getReceivedStockSignature(notification)));

    if (!hasReceivedStockApprovalBaseline) {
      hasReceivedStockApprovalBaseline = true;
      knownReceivedStockApprovalSignatures = currentSignatures;
      renderReceivedStockApprovalQueue(latestReceivedStockApprovals);
      updateLiveAlertsCounter();
      return;
    }

    latestReceivedStockApprovals
      .filter((notification) => !knownReceivedStockApprovalSignatures.has(getReceivedStockSignature(notification)))
      .forEach((notification) => {
        const itemName = String(notification?.itemName || 'Inventory item');
        const supplier = String(notification?.supplier || 'Supplier team');
        const qty = Number(notification?.qty || 0);
        showInventoryToast(
          'Received Stock Pending Review',
          `${itemName} from ${supplier} (${qty} units) is ready for approval.`
        );
      });

    renderReceivedStockApprovalQueue(latestReceivedStockApprovals);
    updateLiveAlertsCounter();
    knownReceivedStockApprovalSignatures = currentSignatures;
  } catch (err) {
    showMessage('Error loading received stock approvals: ' + err.message);
  }
}

function openRejectReceivedStockDialog(notification) {
  if (rejectReceivedStockNotificationId) {
    rejectReceivedStockNotificationId.value = String(notification.id);
  }

  if (rejectReceivedStockSummary) {
    const itemName = String(notification?.itemName || 'Inventory item');
    const supplier = String(notification?.supplier || 'Supplier team');
    const qty = Number(notification?.qty || 0);
    rejectReceivedStockSummary.textContent = `${itemName} from ${supplier} (${qty} units)`;
  }

  if (rejectReceivedStockReason) {
    rejectReceivedStockReason.value = '';
  }

  if (rejectReceivedStockDialog) {
    rejectReceivedStockDialog.showModal();
  }
}

async function approveReceivedStock(notificationId) {
  try {
    const res = await fetch('/inventory/received-stock/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationId,
        reviewedBy: 'Inventory'
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to approve received stock.');
    }

    showMessage(data.message || 'Received stock approved.');
    showInventoryToast('Stock Approved', data.message || 'Received stock approved.');
    await syncInventorySnapshot();
    await pollReceivedStockApprovals();
    broadcastInventoryUpdate();
  } catch (err) {
    showMessage(err.message);
  }
}

async function rejectReceivedStock(notificationId, rejectionReason) {
  try {
    const res = await fetch('/inventory/received-stock/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationId,
        rejectionReason,
        reviewedBy: 'Inventory'
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to reject received stock.');
    }

    showMessage(data.message || 'Received stock rejected.');
    showInventoryToast('Stock Rejected', data.message || 'Received stock rejected.');
    await pollReceivedStockApprovals();
    broadcastInventoryUpdate();
  } catch (err) {
    showMessage(err.message);
  }
}

async function loadManagerApprovalNotifications() {
  const res = await fetch('/inventory/approved-low-stock-notifications');
  if (!res.ok) {
    throw new Error('Failed to load manager approval notifications.');
  }

  return res.json();
}

async function pollManagerApprovals() {
  try {
    const notifications = await loadManagerApprovalNotifications();
    latestApprovalNotifications = notifications;
    const currentIds = new Set(notifications.map((notification) => Number(notification.id)));

    if (!hasApprovalBaseline) {
      knownApprovalIds = currentIds;
      hasApprovalBaseline = true;
      const visibleAtStart = notifications.filter((notification) => !clearedApprovalIds.has(Number(notification.id)));
      renderApprovalFeed(visibleAtStart);
      updateLiveAlertsCounter();
      return;
    }

    const newNotifications = notifications.filter((notification) => !knownApprovalIds.has(Number(notification.id)));
    newNotifications.forEach((notification) => {
      const approvedQty = Number(notification?.suggestedQty ?? 1);
      showInventoryToast(
        'Manager Approval Received',
        `${notification.itemName} low-stock request was approved by ${notification.approvedBy || 'Manager'} for ${approvedQty} units.`
      );
    });

    const visibleNotifications = notifications.filter((notification) => !clearedApprovalIds.has(Number(notification.id)));
    renderApprovalFeed(visibleNotifications);
    updateLiveAlertsCounter();
    knownApprovalIds = currentIds;
  } catch (err) {
    showMessage('Error loading manager approvals: ' + err.message);
  }
}

async function pollSupplierPoNotificationsForInventory() {
  try {
    const res = await fetch('/inventory/ordered-low-stock-notifications');
    if (!res.ok) {
      return;
    }

    const orderedNotifications = await res.json();
    latestSupplierPoNotifications = orderedNotifications;
    const visibleSupplierPoNotifications = orderedNotifications.filter(
      (notification) => !clearedSupplierPoNotificationIds.has(Number(notification.id))
    );
    renderSupplierPoFeed(visibleSupplierPoNotifications);
    const currentIds = new Set(orderedNotifications.map((notification) => Number(notification.id)));

    if (!hasSupplierPoBaseline) {
      knownSupplierPoNotificationIds = currentIds;
      hasSupplierPoBaseline = true;
      updateLiveAlertsCounter();
      return;
    }

    const newSupplierPoNotifications = orderedNotifications.filter(
      (notification) => !knownSupplierPoNotificationIds.has(Number(notification.id))
    );

    newSupplierPoNotifications.forEach((notification) => {
      const itemName = String(notification?.itemName || 'Inventory item');
      const orderedQty = Number(notification?.orderedQty || 0);
      const supplier = String(notification?.supplier || 'Supplier team');
      showInventoryToast(
        'Supplier PO Created',
        `${supplier} created a PO for ${itemName} with ordered quantity ${orderedQty}.`
      );
    });

    updateLiveAlertsCounter();
    knownSupplierPoNotificationIds = currentIds;
  } catch (err) {
    showMessage('Error loading supplier order notifications: ' + err.message);
  }
}

async function pollReceivedPoNotificationsForInventory() {
  try {
    const res = await fetch('/inventory/received-low-stock-notifications');
    if (!res.ok) {
      return;
    }

    const receivedNotifications = await res.json();
    latestReceivedPoNotifications = receivedNotifications;
    const visibleReceivedNotifications = receivedNotifications.filter(
      (notification) => !clearedReceivedPoNotificationIds.has(Number(notification.id))
    );
    renderReceivedPoFeed(visibleReceivedNotifications);
    const currentIds = new Set(receivedNotifications.map((notification) => Number(notification.id)));

    if (!hasReceivedPoBaseline) {
      knownReceivedPoNotificationIds = currentIds;
      hasReceivedPoBaseline = true;
      updateLiveAlertsCounter();
      return;
    }

    const newReceivedNotifications = receivedNotifications.filter(
      (notification) => !knownReceivedPoNotificationIds.has(Number(notification.id))
    );

    newReceivedNotifications.forEach((notification) => {
      const itemName = String(notification?.itemName || 'Inventory item');
      const orderedQty = Number(notification?.orderedQty || 0);
      const poid = String(notification?.poid || '').trim();
      const poLabel = poid ? ` (${poid})` : '';
      showInventoryToast(
        'Order Received',
        `Order received${poLabel}: ${itemName} quantity ${orderedQty} has been received.`
      );
    });

    updateLiveAlertsCounter();
    knownReceivedPoNotificationIds = currentIds;
  } catch (err) {
    showMessage('Error loading received order notifications: ' + err.message);
  }
}

async function pollHousekeepingUsageNotificationsForInventory() {
  try {
    const res = await fetch('/inventory/housekeeping-usage-notifications');
    if (!res.ok) {
      return;
    }

    const usageNotifications = await res.json();
    latestHousekeepingUsageNotifications = usageNotifications;
    const visibleUsageNotifications = usageNotifications.filter(
      (usage) => !clearedHousekeepingUsageIds.has(Number(usage.id))
    );
    renderHousekeepingUsageFeed(visibleUsageNotifications);

    const currentIds = new Set(usageNotifications.map((usage) => Number(usage.id)));
    if (!hasHousekeepingUsageBaseline) {
      knownHousekeepingUsageIds = currentIds;
      hasHousekeepingUsageBaseline = true;
      updateLiveAlertsCounter();
      return;
    }

    const newUsageNotifications = usageNotifications.filter(
      (usage) => !knownHousekeepingUsageIds.has(Number(usage.id))
    );

    newUsageNotifications.forEach((usage) => {
      const itemName = String(usage?.itemName || 'Inventory item');
      const staffName = String(usage?.staffName || 'Housekeeping staff');
      const usedQty = Number(usage?.usedQty || 0);
      const damagedQty = Number(usage?.damagedQty || 0);
      const damagedSuffix = damagedQty > 0 ? ` Damaged reported: ${damagedQty}.` : '';

      showInventoryToast(
        'Housekeeping Usage',
        `${staffName} used ${usedQty} units of ${itemName} during housekeeping runs.${damagedSuffix}`
      );
    });

    updateLiveAlertsCounter();
    knownHousekeepingUsageIds = currentIds;
  } catch (err) {
    showMessage('Error loading housekeeping usage notifications: ' + err.message);
  }
}

async function clearApprovalAlerts() {
  const supplierPoIdsToDismiss = latestSupplierPoNotifications
    .map((notification) => Number(notification.id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (supplierPoIdsToDismiss.length > 0) {
    try {
      await fetch('/inventory/ordered-low-stock-notifications/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: supplierPoIdsToDismiss })
      });
    } catch {
      showMessage('Could not persist Supplier PO alert dismiss.');
    }
  }

  latestApprovalNotifications.forEach((notification) => {
    clearedApprovalIds.add(Number(notification.id));
  });

  latestSupplierPoNotifications.forEach((notification) => {
    clearedSupplierPoNotificationIds.add(Number(notification.id));
  });

  latestReceivedPoNotifications.forEach((notification) => {
    clearedReceivedPoNotificationIds.add(Number(notification.id));
  });

  latestHousekeepingUsageNotifications.forEach((usage) => {
    clearedHousekeepingUsageIds.add(Number(usage.id));
  });

  persistAllClearedAlertSets();

  renderApprovalFeed([]);
  renderSupplierPoFeed([]);
  renderReceivedPoFeed([]);
  renderHousekeepingUsageFeed([]);
  updateLiveAlertsCounter();

  await pollSupplierPoNotificationsForInventory();
}

function startApprovalPolling() {
  if (inventoryAlertTimer !== null) {
    return;
  }

  syncInventorySnapshot();
  pollManagerApprovals();
  inventoryAlertTimer = window.setInterval(() => {
    syncInventorySnapshot();
    pollManagerApprovals();
    pollSupplierPoNotificationsForInventory();
    pollReceivedPoNotificationsForInventory();
    pollHousekeepingUsageNotificationsForInventory();
    pollReceivedStockApprovals();
  }, INVENTORY_ALERT_POLL_MS);

  pollSupplierPoNotificationsForInventory();
  pollReceivedPoNotificationsForInventory();
  pollHousekeepingUsageNotificationsForInventory();
  pollReceivedStockApprovals();

  window.addEventListener('beforeunload', () => {
    if (inventoryAlertTimer !== null) {
      window.clearInterval(inventoryAlertTimer);
      inventoryAlertTimer = null;
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key === 'inventoryUpdateSignal') {
      syncInventorySnapshot();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncInventorySnapshot();
    }
  });

  if (inventoryApprovalList) {
    inventoryApprovalList.addEventListener('mouseenter', () => {
      updateLiveAlertsCounter();
    });
  }

  if (inventoryClearAlertsBtn) {
    inventoryClearAlertsBtn.addEventListener('click', clearApprovalAlerts);
  }

  if (receivedStockApprovalBody) {
    receivedStockApprovalBody.addEventListener('click', async (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const action = target.getAttribute('data-action');
      const notificationIdValue = target.getAttribute('data-notification-id');
      if (!action || !notificationIdValue) {
        return;
      }

      const notificationId = Number(notificationIdValue);
      const notification = latestReceivedStockApprovals.find((item) => Number(item?.id) === notificationId);
      if (!notification) {
        showMessage('Received stock entry no longer exists.');
        await pollReceivedStockApprovals();
        return;
      }

      if (action === 'approve-received-stock') {
        await approveReceivedStock(notificationId);
        return;
      }

      if (action === 'reject-received-stock') {
        openRejectReceivedStockDialog(notification);
      }
    });
  }

  if (cancelRejectReceivedStockBtn) {
    cancelRejectReceivedStockBtn.addEventListener('click', () => {
      if (rejectReceivedStockDialog) {
        rejectReceivedStockDialog.close();
      }
    });
  }

  if (rejectReceivedStockForm) {
    rejectReceivedStockForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const notificationId = Number(rejectReceivedStockNotificationId?.value || 0);
      const rejectionReason = String(rejectReceivedStockReason?.value || '').trim();

      if (!notificationId) {
        showMessage('Received stock entry not found.');
        return;
      }

      if (!rejectionReason) {
        showMessage('Rejection reason is required.');
        return;
      }

      if (rejectReceivedStockDialog) {
        rejectReceivedStockDialog.close();
      }

      await rejectReceivedStock(notificationId, rejectionReason);
    });
  }
}

async function loadAndRender() {
  try {
    const res = await fetch('/inventory/list');
    if (!res.ok) throw new Error('Failed to load inventory.');
    const items = await res.json();
    inventoryItemsCache = Array.isArray(items) ? items : [];
    renderAll(items);
  } catch (err) {
    showMessage('Error loading inventory: ' + err.message);
  }
}

async function syncInventorySnapshot() {
  if (inventorySyncInFlight) {
    return;
  }

  inventorySyncInFlight = true;
  try {
    await loadAndRender();
  } finally {
    inventorySyncInFlight = false;
  }
}

function openUpdateDialog(item) {
  updateItemIdInput.value = String(item.id);

  if (isKnownItem(item.item)) {
    updateItemNameInput.value = item.item;
    updateItemNameOtherContainer.style.display = 'none';
    updateItemNameOtherInput.required = false;
    updateItemNameOtherInput.value = '';
  } else {
    updateItemNameInput.value = 'Other items';
    updateItemNameOtherContainer.style.display = 'block';
    updateItemNameOtherInput.required = true;
    updateItemNameOtherInput.value = item.item;
  }

  updateCategoryInput.value = item.category;
  updateStockInput.value = String(item.inStock);
  updateMinLevelInput.value = String(item.minLevel);
  updateDamagedInput.value = String(item.damaged);
  updateMissingInput.value = String(item.missing);
  updateItemDialog.showModal();
}

openAddDialogBtn.addEventListener('click', () => {
  addItemForm.reset();
  itemNameOtherContainer.style.display = 'none';
  itemNameOtherInput.required = false;
  addItemDialog.showModal();
});

cancelAddDialogBtn.addEventListener('click', () => {
  addItemDialog.close();
});

cancelUpdateDialogBtn.addEventListener('click', () => {
  updateItemDialog.close();
});

itemNameInput.addEventListener('change', () => {
  handleItemSelection(itemNameInput, itemNameOtherContainer, itemNameOtherInput, categoryInput);
});

updateItemNameInput.addEventListener('change', () => {
  handleItemSelection(updateItemNameInput, updateItemNameOtherContainer, updateItemNameOtherInput, updateCategoryInput);
});

inventoryTableBody.addEventListener('click', async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) return;

  const action = target.getAttribute('data-action');
  const idValue = target.getAttribute('data-id');

  if (!action || idValue === null) return;

  const id = Number(idValue);

  if (action === 'edit') {
    const item = inventoryItemsCache.find((i) => Number(i?.id) === id);
    if (item) {
      openUpdateDialog(item);
    } else {
      showMessage('Unable to find selected item. Please refresh the inventory list.');
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
      if (data.success) {
        inventoryItemsCache = inventoryItemsCache.filter((item) => Number(item?.id) !== id);
        renderAll(inventoryItemsCache);
        broadcastInventoryUpdate();
      }
    } catch {
      showMessage('Error deleting item.');
    }
  }
});

addItemForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const itemName = getFinalItemName(itemNameInput, itemNameOtherInput);
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
    const submitBtn = addItemForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
    }

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

    if (data.item && Number.isInteger(Number(data.item.id))) {
      const newId = Number(data.item.id);
      const exists = inventoryItemsCache.some((item) => Number(item?.id) === newId);
      if (!exists) {
        inventoryItemsCache.push(data.item);
      }
      renderAll(inventoryItemsCache);
    }

    addItemForm.reset();
    addItemDialog.close();
    showMessage(data.message || 'Item added.');
    broadcastInventoryUpdate();
  } catch {
    showMessage('Error adding item.');
  } finally {
    const submitBtn = addItemForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }
});

updateItemForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const id = Number(updateItemIdInput.value);
  const itemName = getFinalItemName(updateItemNameInput, updateItemNameOtherInput);

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

  if ((payload.damaged + payload.missing) > payload.inStock) {
    const validationMessage = 'Damaged and missing totals cannot exceed the stock level.';
    showMessage(validationMessage);
    showPopup(validationMessage);
    return;
  }

  try {
    const submitBtn = updateItemForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
    }

    const res = await fetch('/inventory/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.success) {
      const errorMessage = data.message || 'Failed to update item.';
      showMessage(errorMessage);
      if (errorMessage.includes('Damaged and missing totals cannot exceed the stock level.')) {
        showPopup(errorMessage);
      }
      return;
    }

    if (data.item && Number.isInteger(Number(data.item.id))) {
      const updatedId = Number(data.item.id);
      const existingIndex = inventoryItemsCache.findIndex((i) => Number(i?.id) === updatedId);
      if (existingIndex >= 0) {
        inventoryItemsCache[existingIndex] = data.item;
      } else {
        inventoryItemsCache.push(data.item);
      }
      renderAll(inventoryItemsCache);
    }

    updateItemForm.reset();
    updateItemDialog.close();
    showMessage(data.message || 'Item updated.');
    broadcastInventoryUpdate();
  } catch {
    showMessage('Error updating item.');
  } finally {
    const submitBtn = updateItemForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }
});

loadAndRender();
startApprovalPolling();
