package project.flametreehotel.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import project.flametreehotel.Model.inventory;

import java.util.Optional;

public interface inventoryRepository extends JpaRepository<inventory, Integer> {
    Optional<inventory> findByItem(String item);
}
