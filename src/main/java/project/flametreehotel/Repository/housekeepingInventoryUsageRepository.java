package project.flametreehotel.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import project.flametreehotel.Model.housekeepingInventoryUsage;

public interface housekeepingInventoryUsageRepository extends JpaRepository<housekeepingInventoryUsage, Integer> {
    List<housekeepingInventoryUsage> findAllByOrderByUsedAtDesc();
}
