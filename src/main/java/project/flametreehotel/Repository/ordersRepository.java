package project.flametreehotel.Repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import project.flametreehotel.Model.orders;

public interface ordersRepository extends JpaRepository<orders, Integer> {
    Optional<orders> findByPoid(String poid);
}
