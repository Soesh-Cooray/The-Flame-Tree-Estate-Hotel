package project.flametreehotel.Repository;

import org.springframework.data.jpa.repository.JpaRepository;

import project.flametreehotel.Model.users;

public interface authRepository extends JpaRepository<users, Integer> {
    users findByUsername(String username);

}
