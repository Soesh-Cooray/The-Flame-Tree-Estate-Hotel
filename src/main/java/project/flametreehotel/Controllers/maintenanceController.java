package project.flametreehotel.Controllers;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.maintenance;
import project.flametreehotel.Services.maintenanceService;

@RestController
@RequestMapping("/maintenance")
@RequiredArgsConstructor
public class maintenanceController {

    private final maintenanceService service;

    /**
     * GET /maintenance/list
     * Returns all maintenance tickets from the database.
     */
    @GetMapping("/list")
    public ResponseEntity<List<maintenance>> listMaintenanceItems() {
        return ResponseEntity.ok(service.getAllTickets());
    }

    /**
     * POST /maintenance/add
     * Body: { "ticket": "...", "location": "...", "issue": "...", "assignedTo": "...", "status": "..." }
     */
    @PostMapping("/add")
    public ResponseEntity<Map<String, Object>> addMaintenanceItem(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        String ticket = (String) body.get("ticket");
        String location = (String) body.get("location");
        String issue = (String) body.get("issue");
        String assignedTo = (String) body.get("assignedTo");
        String status = (String) body.get("status");

        if (ticket == null || ticket.isBlank() || location == null || location.isBlank()
                || issue == null || issue.isBlank() || assignedTo == null || assignedTo.isBlank()
                || status == null || status.isBlank()) {
            response.put("success", false);
            response.put("message", "All fields are required.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            maintenance created = service.addTicket(ticket.trim(), location.trim(), issue.trim(), assignedTo.trim(), status);
            response.put("success", true);
            response.put("message", "Added ticket " + created.getTicket() + ".");
            response.put("ticket", created);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * POST /maintenance/update
     * Body: { "id": 1, "ticket": "...", "location": "...", "issue": "...", "assignedTo": "...", "status": "..." }
     */
    @PostMapping("/update")
    public ResponseEntity<Map<String, Object>> updateMaintenanceItem(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        if (body.get("id") == null) {
            response.put("success", false);
            response.put("message", "Record ID is required.");
            return ResponseEntity.badRequest().body(response);
        }

        int id = ((Number) body.get("id")).intValue();
        String ticket = (String) body.get("ticket");
        String location = (String) body.get("location");
        String issue = (String) body.get("issue");
        String assignedTo = (String) body.get("assignedTo");
        String status = (String) body.get("status");

        if (ticket == null || ticket.isBlank() || location == null || location.isBlank()
                || issue == null || issue.isBlank() || assignedTo == null || assignedTo.isBlank()
                || status == null || status.isBlank()) {
            response.put("success", false);
            response.put("message", "All fields are required.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            maintenance updated = service.updateTicket(id, ticket.trim(), location.trim(), issue.trim(), assignedTo.trim(), status);
            response.put("success", true);
            response.put("message", "Updated ticket " + updated.getTicket() + ".");
            response.put("ticket", updated);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * POST /maintenance/delete
     * Body: { "id": 1 }
     */
    @PostMapping("/delete")
    public ResponseEntity<Map<String, Object>> deleteMaintenanceItem(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        if (body.get("id") == null) {
            response.put("success", false);
            response.put("message", "Record ID is required.");
            return ResponseEntity.badRequest().body(response);
        }

        int id = ((Number) body.get("id")).intValue();

        try {
            service.deleteTicket(id);
            response.put("success", true);
            response.put("message", "Ticket deleted successfully.");
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
}
