package project.flametreehotel.Model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import lombok.Data;

@Entity
@Data
public class housekeeping {
    @Id
    @GeneratedValue(strategy = jakarta.persistence.GenerationType.IDENTITY)
    private int id;

    @Column(name = "requestid")
    private String requestId;

    private String room;

    @Column(name = "requestType")
    private String requestType;

    @Column(name = "assingedStaff")
    private String assignedStaff;

    private String taskStatus;
}
