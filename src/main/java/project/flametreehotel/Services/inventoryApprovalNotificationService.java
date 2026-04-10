package project.flametreehotel.Services;

import java.time.LocalDateTime;
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

    private final inventoryApprovalNotificationRepository repository;
    private final ordersRepository ordersRepository;

    public inventoryApprovalNotification createFromApprovedInventory(inventory item, String approvedBy) {
        return repository.findFirstByInventoryIdAndNotificationStatusOrderByIdDesc(item.getId(), STATUS_PENDING)
                .orElseGet(() -> {
                    inventoryApprovalNotification notification = new inventoryApprovalNotification();
                    notification.setInventoryId(item.getId());
                    notification.setItemName(item.getItem());
                    notification.setCategory(item.getCategory());
                    notification.setInStock(item.getInStock());
                    notification.setMinLevel(item.getMinLevel());
                    notification.setSuggestedQty(calculateSuggestedQty(item));
                    notification.setApprovedAt(LocalDateTime.now());
                    notification.setApprovedBy(approvedBy == null || approvedBy.isBlank() ? "Manager" : approvedBy);
                    notification.setNotificationStatus(STATUS_PENDING);
                    notification.setLinkedOrderId(null);
                    return repository.save(notification);
                });
    }

    public List<inventoryApprovalNotification> listPending() {
        return repository.findByNotificationStatusOrderByApprovedAtDesc(STATUS_PENDING);
    }

    public List<Map<String, Object>> listOrderedWithOrderDetails() {
        return repository.findByNotificationStatusOrderByApprovedAtDesc(STATUS_ORDERED).stream()
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

    private int calculateSuggestedQty(inventory item) {
        int usableStock = Math.max(0, item.getInStock() - Math.max(0, item.getDamaged()) - Math.max(0, item.getMissing()));
        int targetLevel = Math.max(0, item.getMinLevel()) + 10;
        return Math.max(1, targetLevel - usableStock);
    }
}