package project.flametreehotel.Model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
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
    @Column(name = "guestRoom")
    private String roomName;
    private String request;
    private String status;
    private LocalDateTime requestDateTime;
    private String routedModule;

}
