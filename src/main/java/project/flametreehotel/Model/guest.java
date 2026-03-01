package project.flametreehotel.Model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import lombok.Data;

@Entity
@Data
public class guest {
    @jakarta.persistence.Id
    @GeneratedValue(strategy = jakarta.persistence.GenerationType.IDENTITY)
    private int id;
    private String requestId;
    private String guestRoom;
    private String request;
    private String assignedStaff;
    private String status;

}
