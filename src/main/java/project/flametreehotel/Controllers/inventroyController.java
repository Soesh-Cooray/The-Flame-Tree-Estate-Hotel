package project.flametreehotel.Controllers;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.housekeepingInventoryUsage;
import project.flametreehotel.Model.inventory;
import project.flametreehotel.Model.inventoryApprovalNotification;
import project.flametreehotel.Services.housekeepingService;
import project.flametreehotel.Services.inventoryApprovalNotificationService;
import project.flametreehotel.Services.inventoryService;
import project.flametreehotel.Services.receivedStockReviewService;

@RestController
@RequestMapping("/inventory")
@RequiredArgsConstructor
public class inventroyController {

    private final inventoryService service;
    private final inventoryApprovalNotificationService notificationService;
    private final housekeepingService housekeepingService;
    private final receivedStockReviewService receivedStockReviewService;

    /**
     * GET /inventory/list
     * Returns all inventory items from the database.
     */
    @GetMapping("/list")
    public ResponseEntity<List<inventory>> listInventory() {
        return ResponseEntity.ok(service.getAllItems());
    }

    /**
     * POST /inventory/add
     * Body: { "item": "...", "category": "...", "inStock": 0, "minLevel": 0 }
     */
    @PostMapping("/add")
    public ResponseEntity<Map<String, Object>> addInventory(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        String item = (String) body.get("item");
        String category = (String) body.get("category");

        if (item == null || item.isBlank() || category == null || category.isBlank()) {
            response.put("success", false);
            response.put("message", "Item name and category are required.");
            return ResponseEntity.badRequest().body(response);
        }

        int inStock = body.get("inStock") != null ? ((Number) body.get("inStock")).intValue() : 0;
        int minLevel = body.get("minLevel") != null ? ((Number) body.get("minLevel")).intValue() : 0;

        try {
            inventory created = service.addItem(item.trim(), category, inStock, minLevel);
            response.put("success", true);
            response.put("message", "Added new item: " + created.getItem() + ".");
            response.put("item", created);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * POST /inventory/update
     * Body: { "id": 1, "item": "...", "category": "...", "inStock": 0, "minLevel": 0, "damaged": 0, "missing": 0 }
     */
    @PostMapping("/update")
    public ResponseEntity<Map<String, Object>> updateInventory(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        if (body.get("id") == null) {
            response.put("success", false);
            response.put("message", "Item ID is required.");
            return ResponseEntity.badRequest().body(response);
        }

        int id = ((Number) body.get("id")).intValue();
        String item = (String) body.get("item");
        String category = (String) body.get("category");

        if (item == null || item.isBlank() || category == null || category.isBlank()) {
            response.put("success", false);
            response.put("message", "Item name and category are required.");
            return ResponseEntity.badRequest().body(response);
        }

        int inStock = body.get("inStock") != null ? ((Number) body.get("inStock")).intValue() : 0;
        int minLevel = body.get("minLevel") != null ? ((Number) body.get("minLevel")).intValue() : 0;
        int damaged = body.get("damaged") != null ? ((Number) body.get("damaged")).intValue() : 0;
        int missing = body.get("missing") != null ? ((Number) body.get("missing")).intValue() : 0;

        try {
            inventory updated = service.updateItem(id, item.trim(), category, inStock, minLevel, damaged, missing);
            response.put("success", true);
            response.put("message", "Updated " + updated.getItem() + ".");
            response.put("item", updated);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * POST /inventory/delete
     * Body: { "id": 1 }
     */
    @PostMapping("/delete")
    public ResponseEntity<Map<String, Object>> deleteInventory(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        if (body.get("id") == null) {
            response.put("success", false);
            response.put("message", "Item ID is required.");
            return ResponseEntity.badRequest().body(response);
        }

        int id = ((Number) body.get("id")).intValue();

        try {
            service.deleteItem(id);
            response.put("success", true);
            response.put("message", "Item deleted successfully.");
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * GET /inventory/low-stock-pending
     * Returns all low stock items awaiting manager approval.
     */
    @GetMapping("/low-stock-pending")
    public ResponseEntity<List<inventory>> getLowStockPending() {
        return ResponseEntity.ok(service.getLowStockPending());
    }

    /**
     * POST /inventory/approve
     * Body: { "id": 1, "qty": 20 }
     * Marks an item as approved and sets status to Pending.
     */
    @PostMapping("/approve")
    public ResponseEntity<Map<String, Object>> approveItem(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        if (body.get("id") == null) {
            response.put("success", false);
            response.put("message", "Item ID is required.");
            return ResponseEntity.badRequest().body(response);
        }

        if (!(body.get("qty") instanceof Number qtyNumber)) {
            response.put("success", false);
            response.put("message", "Approved quantity is required.");
            return ResponseEntity.badRequest().body(response);
        }

        int id = ((Number) body.get("id")).intValue();
        int qty = qtyNumber.intValue();

        if (qty < 1) {
            response.put("success", false);
            response.put("message", "Approved quantity must be at least 1.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            inventory approved = service.approveItem(id, qty);
            response.put("success", true);
            response.put("message", "Approved " + approved.getItem() + " for reordering.");
            response.put("item", approved);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * GET /inventory/approved-low-stock-notifications
     * Returns supplier notifications generated from manager-approved low stock items.
     */
    @GetMapping("/approved-low-stock-notifications")
    public ResponseEntity<List<inventoryApprovalNotification>> getApprovedLowStockNotifications() {
        return ResponseEntity.ok(notificationService.listPending());
    }

    /**
     * GET /inventory/ordered-low-stock-notifications
     * Returns low stock approvals that have been converted to purchase orders,
     * including ordered quantity details for manager and inventory notifications.
     */
    @GetMapping("/ordered-low-stock-notifications")
    public ResponseEntity<List<Map<String, Object>>> getOrderedLowStockNotifications() {
        return ResponseEntity.ok(notificationService.listOrderedWithOrderDetails());
    }

    /**
     * POST /inventory/ordered-low-stock-notifications/dismiss
     * Body: { "ids": [1,2,3] }
     * Persists dismissed state so Supplier PO alerts do not reappear.
     */
    @PostMapping("/ordered-low-stock-notifications/dismiss")
    public ResponseEntity<Map<String, Object>> dismissOrderedLowStockNotifications(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        Object idsObject = body.get("ids");
        if (!(idsObject instanceof List<?> rawIds)) {
            response.put("success", false);
            response.put("message", "ids array is required.");
            return ResponseEntity.badRequest().body(response);
        }

        List<Integer> ids = rawIds.stream()
                .filter(Number.class::isInstance)
                .map(Number.class::cast)
                .map(Number::intValue)
                .toList();

        int dismissedCount = notificationService.dismissOrderedNotifications(ids);
        response.put("success", true);
        response.put("message", "Dismissed " + dismissedCount + " Supplier PO alerts.");
        response.put("dismissedCount", dismissedCount);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /inventory/received-low-stock-notifications
     * Returns low stock requests where the linked supplier PO was marked complete.
     */
    @GetMapping("/received-low-stock-notifications")
    public ResponseEntity<List<Map<String, Object>>> getReceivedLowStockNotifications() {
        return ResponseEntity.ok(notificationService.listReceivedWithOrderDetails());
    }

    /**
     * GET /inventory/received-stock-pending-approval
     * Returns completed orders waiting for inventory approval or rejection.
     */
    @GetMapping("/received-stock-pending-approval")
    public ResponseEntity<List<Map<String, Object>>> getReceivedStockPendingApproval() {
        return ResponseEntity.ok(receivedStockReviewService.listPendingApprovals());
    }

    /**
     * POST /inventory/received-stock/approve
     * Body: { "notificationId": 1, "reviewedBy": "Inventory" }
     */
    @PostMapping("/received-stock/approve")
    public ResponseEntity<Map<String, Object>> approveReceivedStock(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        if (body.get("notificationId") == null) {
            response.put("success", false);
            response.put("message", "notificationId is required.");
            return ResponseEntity.badRequest().body(response);
        }

        int notificationId = ((Number) body.get("notificationId")).intValue();
        String reviewedBy = body.get("reviewedBy") == null ? "Inventory" : String.valueOf(body.get("reviewedBy"));

        try {
            return ResponseEntity.ok(receivedStockReviewService.approveReceivedStock(notificationId, reviewedBy));
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * POST /inventory/received-stock/reject
     * Body: { "notificationId": 1, "rejectionReason": "...", "reviewedBy": "Inventory" }
     */
    @PostMapping("/received-stock/reject")
    public ResponseEntity<Map<String, Object>> rejectReceivedStock(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        if (body.get("notificationId") == null) {
            response.put("success", false);
            response.put("message", "notificationId is required.");
            return ResponseEntity.badRequest().body(response);
        }

        int notificationId = ((Number) body.get("notificationId")).intValue();
        String reviewedBy = body.get("reviewedBy") == null ? "Inventory" : String.valueOf(body.get("reviewedBy"));
        String rejectionReason = body.get("rejectionReason") == null ? "" : String.valueOf(body.get("rejectionReason"));

        try {
            return ResponseEntity.ok(receivedStockReviewService.rejectReceivedStock(notificationId, rejectionReason,
                    reviewedBy));
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * GET /inventory/housekeeping-usage-notifications
     * Returns housekeeping inventory usage logs for manager/inventory alerts.
     */
    @GetMapping("/housekeeping-usage-notifications")
    public ResponseEntity<List<housekeepingInventoryUsage>> getHousekeepingUsageNotifications() {
        return ResponseEntity.ok(housekeepingService.listInventoryUsageLogs());
    }
}

