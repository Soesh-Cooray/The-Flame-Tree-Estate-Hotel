package project.flametreehotel.Services;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.inventory;
import project.flametreehotel.Model.inventoryApprovalNotification;
import project.flametreehotel.Model.orders;
import project.flametreehotel.Repository.inventoryApprovalNotificationRepository;
import project.flametreehotel.Repository.ordersRepository;

@Service
@RequiredArgsConstructor
public class inventoryApprovalNotificationService {

    private static final String STATUS_PENDING = "Pending";
    private static final String STATUS_ORDERED = "Ordered";
    private static final String STATUS_RECEIVED = "Received";
    private static final String DECISION_APPROVED = "Approved";
    private static final String DECISION_REJECTED = "Rejected";

    private final inventoryApprovalNotificationRepository repository;
    private final ordersRepository ordersRepository;

    public inventoryApprovalNotification createFromApprovedInventory(inventory item, String approvedBy, int approvedQty) {
        int normalizedApprovedQty = Math.max(1, approvedQty);
        String approver = approvedBy == null || approvedBy.isBlank() ? "Manager" : approvedBy;

        return repository.findFirstByInventoryIdAndNotificationStatusOrderByIdDesc(item.getId(), STATUS_PENDING)
                .map(notification -> {
                    notification.setItemName(item.getItem());
                    notification.setCategory(item.getCategory());
                    notification.setInStock(item.getInStock());
                    notification.setMinLevel(item.getMinLevel());
                    notification.setSuggestedQty(normalizedApprovedQty);
                    notification.setApprovedAt(LocalDateTime.now());
                    notification.setApprovedBy(approver);
                    notification.setSupplierPoDismissed(false);
                    return repository.save(notification);
                })
                .orElseGet(() -> {
                    inventoryApprovalNotification notification = new inventoryApprovalNotification();
                    notification.setInventoryId(item.getId());
                    notification.setItemName(item.getItem());
                    notification.setCategory(item.getCategory());
                    notification.setInStock(item.getInStock());
                    notification.setMinLevel(item.getMinLevel());
                    notification.setSuggestedQty(normalizedApprovedQty);
                    notification.setApprovedAt(LocalDateTime.now());
                    notification.setApprovedBy(approver);
                    notification.setNotificationStatus(STATUS_PENDING);
                    notification.setSupplierPoDismissed(false);
                    notification.setLinkedOrderId(null);
                    return repository.save(notification);
                });
    }

    public List<inventoryApprovalNotification> listPending() {
        return repository.findByNotificationStatusOrderByApprovedAtDesc(STATUS_PENDING);
    }

    public List<Map<String, Object>> listReceivedPendingApproval() {
        return repository.findByNotificationStatusAndInventoryReviewStatusIsNullOrderByReceivedAtDesc(STATUS_RECEIVED).stream()
                .map(notification -> buildReceivedApprovalMap(notification, findLinkedOrder(notification)))
                .toList();
    }

    public List<Map<String, Object>> listOrderedWithOrderDetails() {
        return repository.findByNotificationStatusAndSupplierPoDismissedFalseOrderByApprovedAtDesc(STATUS_ORDERED).stream()
                .map(notification -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("id", notification.getId());
                    row.put("inventoryId", notification.getInventoryId());
                    row.put("itemName", notification.getItemName());
                    row.put("category", notification.getCategory());
                    row.put("approvedAt", notification.getApprovedAt());
                    row.put("approvedBy", notification.getApprovedBy());
                    row.put("linkedOrderId", notification.getLinkedOrderId());

                    orders linkedOrder = null;
                    if (notification.getLinkedOrderId() != null) {
                        linkedOrder = ordersRepository.findById(notification.getLinkedOrderId()).orElse(null);
                    }

                    row.put("orderedQty", linkedOrder == null ? 0 : linkedOrder.getQty());
                    row.put("supplier", linkedOrder == null ? "" : linkedOrder.getSupplier());
                    row.put("poid", linkedOrder == null ? "" : linkedOrder.getPoid());
                    return row;
                })
                .filter(row -> Number.class.cast(row.get("orderedQty")).intValue() > 0)
                .toList();
    }

    public int dismissOrderedNotifications(List<Integer> ids) {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }

        List<Integer> cleanedIds = new ArrayList<>(
                ids.stream().filter(id -> id != null && id > 0).distinct().toList());

        if (cleanedIds.isEmpty()) {
            return 0;
        }

        List<inventoryApprovalNotification> notifications = repository.findAllById(cleanedIds);
        int updated = 0;
        for (inventoryApprovalNotification notification : notifications) {
            if (STATUS_ORDERED.equals(notification.getNotificationStatus()) && !notification.isSupplierPoDismissed()) {
                notification.setSupplierPoDismissed(true);
                updated += 1;
            }
        }

        if (updated > 0) {
            repository.saveAll(notifications);
        }

        return updated;
    }

    public List<Map<String, Object>> listReceivedWithOrderDetails() {
        return repository.findByNotificationStatusOrderByReceivedAtDesc(STATUS_RECEIVED).stream()
                .map(notification -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("id", notification.getId());
                    row.put("inventoryId", notification.getInventoryId());
                    row.put("itemName", notification.getItemName());
                    row.put("category", notification.getCategory());
                    row.put("approvedAt", notification.getApprovedAt());
                    row.put("approvedBy", notification.getApprovedBy());
                    row.put("receivedAt", notification.getReceivedAt());
                    row.put("inventoryReviewStatus", notification.getInventoryReviewStatus());
                    row.put("inventoryRejectionReason", notification.getInventoryRejectionReason());
                    row.put("inventoryReviewedAt", notification.getInventoryReviewedAt());
                    row.put("inventoryReviewedBy", notification.getInventoryReviewedBy());
                    row.put("linkedOrderId", notification.getLinkedOrderId());

                    orders linkedOrder = null;
                    if (notification.getLinkedOrderId() != null) {
                        linkedOrder = ordersRepository.findById(notification.getLinkedOrderId()).orElse(null);
                    }

                    row.put("orderedQty", linkedOrder == null ? 0 : linkedOrder.getQty());
                    row.put("supplier", linkedOrder == null ? "" : linkedOrder.getSupplier());
                    row.put("poid", linkedOrder == null ? "" : linkedOrder.getPoid());
                    return row;
                })
                .toList();
    }

    public void markOrdered(int notificationId, int orderId) {
        inventoryApprovalNotification notification = repository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found."));

        if (!STATUS_PENDING.equals(notification.getNotificationStatus())) {
            throw new RuntimeException("Notification has already been processed.");
        }

        notification.setNotificationStatus(STATUS_ORDERED);
        notification.setLinkedOrderId(orderId);
        repository.save(notification);
    }

    public void markReceivedByOrderId(int orderId) {
        inventoryApprovalNotification notification = repository.findFirstByLinkedOrderIdOrderByIdDesc(orderId)
                .orElseGet(() -> createManualReceivedNotification(orderId));

        if (!STATUS_ORDERED.equals(notification.getNotificationStatus()) && !STATUS_RECEIVED.equals(notification.getNotificationStatus())) {
            throw new RuntimeException("Notification is not in ordered state.");
        }

        notification.setNotificationStatus(STATUS_RECEIVED);
        notification.setReceivedAt(LocalDateTime.now());
        notification.setInventoryReviewStatus(null);
        notification.setInventoryRejectionReason(null);
        notification.setInventoryReviewedAt(null);
        notification.setInventoryReviewedBy(null);
        repository.save(notification);
    }

    public inventoryApprovalNotification createManualReceivedNotification(int orderId) {
        orders linkedOrder = ordersRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found for the given order."));

        if (linkedOrder.getInventoryReviewStatus() != null) {
            throw new RuntimeException("This order has already been reviewed.");
        }

        inventoryApprovalNotification notification = repository.findFirstByLinkedOrderIdOrderByIdDesc(orderId)
                .orElseGet(inventoryApprovalNotification::new);

        notification.setInventoryId(0);
        notification.setItemName(linkedOrder.getItem());
        notification.setCategory("");
        notification.setInStock(0);
        notification.setMinLevel(0);
        notification.setSuggestedQty(linkedOrder.getQty());
        notification.setApprovedAt(LocalDateTime.now());
        notification.setApprovedBy("Supplier");
        notification.setNotificationStatus(STATUS_RECEIVED);
        notification.setReceivedAt(LocalDateTime.now());
        notification.setInventoryReviewStatus(null);
        notification.setInventoryReviewedAt(null);
        notification.setInventoryReviewedBy(null);
        notification.setInventoryRejectionReason(null);
        notification.setSupplierPoDismissed(false);
        notification.setLinkedOrderId(orderId);

        return repository.save(notification);
    }

    public Map<String, Object> recordReceivedStockDecision(int notificationId, String decision, String rejectionReason,
            String reviewedBy) {
        inventoryApprovalNotification notification = repository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found."));

        if (!STATUS_RECEIVED.equals(notification.getNotificationStatus())) {
            throw new RuntimeException("Only received stock can be reviewed.");
        }

        if (notification.getInventoryReviewStatus() != null) {
            throw new RuntimeException("This received stock has already been reviewed.");
        }

        String normalizedDecision = normalizeDecision(decision);
        if (DECISION_REJECTED.equals(normalizedDecision) && (rejectionReason == null || rejectionReason.isBlank())) {
            throw new RuntimeException("Rejection reason is required.");
        }

        orders linkedOrder = findLinkedOrder(notification);
        String reviewer = reviewedBy == null || reviewedBy.isBlank() ? "Inventory" : reviewedBy.trim();

        notification.setInventoryReviewStatus(normalizedDecision);
        notification.setInventoryReviewedBy(reviewer);
        notification.setInventoryReviewedAt(LocalDateTime.now());
        notification.setInventoryRejectionReason(DECISION_REJECTED.equals(normalizedDecision)
                ? rejectionReason.trim()
                : null);
        repository.save(notification);

        if (linkedOrder != null) {
            linkedOrder.setInventoryReviewStatus(normalizedDecision);
            linkedOrder.setInventoryReviewedBy(reviewer);
            linkedOrder.setInventoryReviewedAt(notification.getInventoryReviewedAt());
            linkedOrder.setInventoryRejectionReason(notification.getInventoryRejectionReason());
            ordersRepository.save(linkedOrder);
        }

        return buildDecisionMap(notification, linkedOrder);
    }

    private String normalizeDecision(String decision) {
        if (decision == null) {
            throw new RuntimeException("Decision is required.");
        }

        if (DECISION_APPROVED.equalsIgnoreCase(decision)) {
            return DECISION_APPROVED;
        }

        if (DECISION_REJECTED.equalsIgnoreCase(decision)) {
            return DECISION_REJECTED;
        }

        throw new RuntimeException("Decision must be Approved or Rejected.");
    }

    private orders findLinkedOrder(inventoryApprovalNotification notification) {
        if (notification.getLinkedOrderId() == null) {
            return null;
        }

        return ordersRepository.findById(notification.getLinkedOrderId()).orElse(null);
    }

    private Map<String, Object> buildReceivedApprovalMap(inventoryApprovalNotification notification, orders linkedOrder) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", notification.getId());
        row.put("notificationId", notification.getId());
        row.put("inventoryId", notification.getInventoryId());
        row.put("itemName", notification.getItemName());
        row.put("category", notification.getCategory());
        row.put("receivedAt", notification.getReceivedAt());
        row.put("linkedOrderId", notification.getLinkedOrderId());
        row.put("qty", linkedOrder == null ? 0 : linkedOrder.getQty());
        row.put("supplier", linkedOrder == null ? "" : linkedOrder.getSupplier());
        row.put("poid", linkedOrder == null ? "" : linkedOrder.getPoid());
        return row;
    }

    private Map<String, Object> buildDecisionMap(inventoryApprovalNotification notification, orders linkedOrder) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", notification.getId());
        row.put("notificationId", notification.getId());
        row.put("orderId", notification.getLinkedOrderId());
        row.put("itemName", notification.getItemName());
        row.put("supplier", linkedOrder == null ? "" : linkedOrder.getSupplier());
        row.put("qty", linkedOrder == null ? 0 : linkedOrder.getQty());
        row.put("poid", linkedOrder == null ? "" : linkedOrder.getPoid());
        row.put("decision", notification.getInventoryReviewStatus());
        row.put("reviewedAt", notification.getInventoryReviewedAt());
        row.put("reviewedBy", notification.getInventoryReviewedBy());
        row.put("rejectionReason", notification.getInventoryRejectionReason());
        return row;
    }

}