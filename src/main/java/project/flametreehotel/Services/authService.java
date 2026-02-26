package project.flametreehotel.Services;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.users;
import project.flametreehotel.Repository.authRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
public class authService {

    private final authRepository repository;

    /**
     * Validates login credentials.
     * Returns null if username not found, account inactive, wrong password, or role mismatch.
     */
    public users login(String username, String password, String role) {
        users user = repository.findByUsername(username);
        if (user == null) return null;
        if (!user.isStatus()) return null;
        if (!user.getPassword().equals(password)) return null;
        if (!user.getRole().equals(role)) return null;
        return user;
    }

    /**
     * Creates a new user account. Throws if the username is already taken.
     */
    public users createUser(String username, String staffEmail, String password, String role) {
        if (repository.findByUsername(username) != null) {
            throw new RuntimeException("Username already exists: " + username);
        }
        users newUser = new users();
        newUser.setUsername(username);
        newUser.setStaffEmail(staffEmail);
        newUser.setPassword(password);
        newUser.setRole(role != null ? role : "");
        newUser.setStatus(true);
        return repository.save(newUser);
    }

    /**
     * Assigns a role to an existing user.
     */
    public users assignRole(String username, String role) {
        users user = repository.findByUsername(username);
        if (user == null) throw new RuntimeException("User not found: " + username);
        user.setRole(role);
        return repository.save(user);
    }

    /**
     * Activates or deactivates a user account.
     */
    public users setStatus(String username, boolean active) {
        users user = repository.findByUsername(username);
        if (user == null) throw new RuntimeException("User not found: " + username);
        user.setStatus(active);
        return repository.save(user);
    }

    /**
     * Returns all users in the system.
     */
    public List<users> getAllUsers() {
        return repository.findAll();
    }
}
