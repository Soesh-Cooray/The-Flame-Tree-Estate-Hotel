package project.flametreehotel.Model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import lombok.Data;

@Entity
@Data
public class inventoryApprovalNotification {

    @Id
    @GeneratedValue(strategy = jakarta.persistence.GenerationType.IDENTITY)
    private int id;
    private int inventoryId;
    private String itemName;
    private String category;
    private int inStock;
    private int minLevel;
    private int suggestedQty;
    private LocalDateTime approvedAt;
    private LocalDateTime receivedAt;
    private String approvedBy;
    private String notificationStatus;
    private String inventoryReviewStatus;
    private LocalDateTime inventoryReviewedAt;
    private String inventoryReviewedBy;

    @Column(length = 500)
    private String inventoryRejectionReason;
    private boolean supplierPoDismissed;
    private Integer linkedOrderId;
}