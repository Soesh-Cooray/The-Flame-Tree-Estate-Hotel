package project.flametreehotel.Model;

import java.time.LocalDateTime;

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
    private String approvedBy;
    private String notificationStatus;
    private Integer linkedOrderId;
}