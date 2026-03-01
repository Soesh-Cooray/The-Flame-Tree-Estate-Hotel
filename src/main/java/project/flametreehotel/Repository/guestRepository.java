package project.flametreehotel.Repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import project.flametreehotel.Model.guest;

public interface guestRepository extends JpaRepository<guest, Integer> {
    Optional<guest> findByRequestId(String requestId);
}
