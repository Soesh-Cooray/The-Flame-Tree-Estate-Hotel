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
                .orElseThrow(() -> new RuntimeException("Notification not found for the given order."));

        if (STATUS_RECEIVED.equals(notification.getNotificationStatus())) {
            return;
        }

        if (!STATUS_ORDERED.equals(notification.getNotificationStatus())) {
            throw new RuntimeException("Notification is not in ordered state.");
        }

        notification.setNotificationStatus(STATUS_RECEIVED);
        notification.setReceivedAt(LocalDateTime.now());
        repository.save(notification);
    }

}