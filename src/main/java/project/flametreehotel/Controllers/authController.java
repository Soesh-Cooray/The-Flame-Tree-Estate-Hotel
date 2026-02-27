package project.flametreehotel.Controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.users;
import project.flametreehotel.Services.authService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class authController {

    private final authService service;

    /**
     * POST /auth/login
     * Body: { "username": "...", "password": "...", "role": "..." }
     * Returns { "success": true } or { "success": false, "message": "..." }
     */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> body) {
        Map<String, Object> response = new HashMap<>();
        String username = body.get("username");
        String password = body.get("password");
        String role = body.get("role");

        if (username == null || password == null || role == null) {
            response.put("success", false);
            response.put("message", "Username, password, and role are required.");
            return ResponseEntity.badRequest().body(response);
        }

        users user = service.login(username, password, role);
        if (user == null) {
            response.put("success", false);
            response.put("message", "Invalid credentials, incorrect role, or account is inactive.");
            return ResponseEntity.status(401).body(response);
        }

        response.put("success", true);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /auth/register
     * Body: { "username": "...", "staffEmail": "...", "password": "...", "role": "..." }
     * Returns { "success": true } or { "success": false, "message": "..." }
     */
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, String> body) {
        Map<String, Object> response = new HashMap<>();
        String username = body.get("username");
        String staffEmail = body.get("staffEmail");
        String password = body.get("password");
        String role = body.get("role");

        if (username == null || staffEmail == null || password == null) {
            response.put("success", false);
            response.put("message", "Username, staff email, and password are required.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            service.createUser(username, staffEmail, password, role);
            response.put("success", true);
            response.put("message", "Account created successfully.");
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * PUT /auth/assign-role
     * Body: { "username": "...", "role": "..." }
     * Returns { "success": true } or { "success": false, "message": "..." }
     */
    @PutMapping("/assign-role")
    public ResponseEntity<Map<String, Object>> assignRole(@RequestBody Map<String, String> body) {
        Map<String, Object> response = new HashMap<>();
        String username = body.get("username");
        String role = body.get("role");

        if (username == null || role == null || role.isEmpty()) {
            response.put("success", false);
            response.put("message", "Username and role are required.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            service.assignRole(username, role);
            response.put("success", true);
            response.put("message", "Role assigned successfully.");
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * PUT /auth/status
     * Body: { "username": "...", "active": "true" or "false" }
     * Returns { "success": true } or { "success": false, "message": "..." }
     */
    @PutMapping("/status")
    public ResponseEntity<Map<String, Object>> setStatus(@RequestBody Map<String, String> body) {
        Map<String, Object> response = new HashMap<>();
        String username = body.get("username");
        String activeStr = body.get("active");

        if (username == null || activeStr == null) {
            response.put("success", false);
            response.put("message", "Username and active status are required.");
            return ResponseEntity.badRequest().body(response);
        }

        boolean active = Boolean.parseBoolean(activeStr);

        try {
            service.setStatus(username, active);
            response.put("success", true);
            response.put("message", "Account " + (active ? "activated" : "deactivated") + " successfully.");
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * GET /auth/users
     * Returns a list of all users (username, role, status) for manager dashboard.
     */
    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> getAllUsers() {
        List<users> users = service.getAllUsers();
        List<Map<String, Object>> result = users.stream().map(u -> {
            Map<String, Object> map = new HashMap<>();
            map.put("username", u.getUsername());
            map.put("staffEmail", u.getStaffEmail());
            map.put("role", u.getRole());
            map.put("status", u.isStatus());
            return map;
        }).toList();
        return ResponseEntity.ok(result);
    }
}
