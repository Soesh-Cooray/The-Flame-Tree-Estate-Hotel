package project.flametreehotel.Repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import project.flametreehotel.Model.inventoryApprovalNotification;

public interface inventoryApprovalNotificationRepository extends JpaRepository<inventoryApprovalNotification, Integer> {
    List<inventoryApprovalNotification> findByNotificationStatusOrderByApprovedAtDesc(String notificationStatus);

        List<inventoryApprovalNotification> findByNotificationStatusAndInventoryReviewStatusIsNullOrderByReceivedAtDesc(
                        String notificationStatus);

    List<inventoryApprovalNotification> findByNotificationStatusAndSupplierPoDismissedFalseOrderByApprovedAtDesc(
            String notificationStatus);

    List<inventoryApprovalNotification> findByNotificationStatusOrderByReceivedAtDesc(String notificationStatus);

    Optional<inventoryApprovalNotification> findFirstByInventoryIdAndNotificationStatusOrderByIdDesc(int inventoryId,
            String notificationStatus);

    Optional<inventoryApprovalNotification> findFirstByLinkedOrderIdOrderByIdDesc(int linkedOrderId);
}