package project.flametreehotel.Services;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class receivedStockReviewService {

    private final inventoryApprovalNotificationService notificationService;
    private final inventoryService inventoryService;

    public List<Map<String, Object>> listPendingApprovals() {
        return notificationService.listReceivedPendingApproval();
    }

    @Transactional
    public Map<String, Object> approveReceivedStock(int notificationId, String reviewedBy) {
        Map<String, Object> decision = notificationService.recordReceivedStockDecision(notificationId, "Approved", null,
                reviewedBy);
        String itemName = String.valueOf(decision.getOrDefault("itemName", ""));
        int qty = Number.class.cast(decision.getOrDefault("qty", 0)).intValue();

        try {
            inventoryService.receiveStock(itemName, qty);
            decision.put("inventoryUpdated", true);
            decision.put("success", true);
            decision.put("message", itemName + " approved and added to inventory.");
        } catch (RuntimeException ex) {
            decision.put("inventoryUpdated", false);
            decision.put("success", true);
            if ("Inventory item not found for received stock.".equals(ex.getMessage())) {
                decision.put("message", "This entry item is not on the inventory list. Please add it manually");
            } else {
                decision.put("message", "Stock was approved, but inventory could not be updated automatically.");
            }
        }

        return decision;
    }

    @Transactional
    public Map<String, Object> rejectReceivedStock(int notificationId, String rejectionReason, String reviewedBy) {
        Map<String, Object> decision = notificationService.recordReceivedStockDecision(notificationId, "Rejected",
                rejectionReason, reviewedBy);
        decision.put("success", true);
        decision.put("message", String.valueOf(decision.getOrDefault("itemName", "Stock")) + " rejected.");
        return decision;
    }
}