package project.flametreehotel.Model;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.Data;

@Entity
@Data
public class housekeepingInventoryUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    private int inventoryId;
    private String itemName;
    private String staffName;
    private int usedQty;
    private int damagedQty;
    private LocalDateTime usedAt;
}
