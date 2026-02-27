package project.flametreehotel.Repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import project.flametreehotel.Model.housekeeping;

public interface housekeepingRepository extends JpaRepository<housekeeping, Integer> {
    Optional<housekeeping> findByRequestId(String requestId);
}
