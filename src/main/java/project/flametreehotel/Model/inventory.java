package project.flametreehotel.Model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import lombok.Data;

@Entity
@Data

public class inventory {
    @Id
    @GeneratedValue(strategy = jakarta.persistence.GenerationType.IDENTITY)
    private int id;
    private String item;
    private String category;
    private int inStock;
    private int minLevel;
    private int damaged;
    private int missing;
    private String status;
}
