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
import project.flametreehotel.Model.guest;
import project.flametreehotel.Services.guestService;

@RestController
@RequestMapping("/guestservice")
@RequiredArgsConstructor
public class guestserviceController {

    private final guestService service;

    /**
     * GET /guestservice/list
     * Returns all guest service requests from the database.
     */
    @GetMapping("/list")
    public ResponseEntity<List<guest>> listGuestServices() {
        return ResponseEntity.ok(service.getAllRequests());
    }

    /**
     * POST /guestservice/add
     * Body: { "requestId": "...", "guestRoom": "...", "request": "...", "assignedStaff": "...", "status": "..." }
     */
    @PostMapping("/add")
    public ResponseEntity<Map<String, Object>> addGuestService(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        String requestId = (String) body.get("requestId");
        String guestRoom = (String) body.get("guestRoom");
        String request = (String) body.get("request");
        String assignedStaff = (String) body.get("assignedStaff");
        String status = (String) body.get("status");

        if (requestId == null || requestId.isBlank() || guestRoom == null || guestRoom.isBlank()
                || request == null || request.isBlank() || assignedStaff == null || assignedStaff.isBlank()
                || status == null || status.isBlank()) {
            response.put("success", false);
            response.put("message", "All fields are required.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            guest created = service.addRequest(requestId.trim(), guestRoom.trim(), request.trim(), assignedStaff.trim(), status);
            response.put("success", true);
            response.put("message", "Added request " + created.getRequestId() + ".");
            response.put("request", created);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * POST /guestservice/update
     * Body: { "id": 1, "requestId": "...", "guestRoom": "...", "request": "...", "assignedStaff": "...", "status": "..." }
     */
    @PostMapping("/update")
    public ResponseEntity<Map<String, Object>> updateGuestService(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        if (body.get("id") == null) {
            response.put("success", false);
            response.put("message", "Record ID is required.");
            return ResponseEntity.badRequest().body(response);
        }

        int id = ((Number) body.get("id")).intValue();
        String requestId = (String) body.get("requestId");
        String guestRoom = (String) body.get("guestRoom");
        String request = (String) body.get("request");
        String assignedStaff = (String) body.get("assignedStaff");
        String status = (String) body.get("status");

        if (requestId == null || requestId.isBlank() || guestRoom == null || guestRoom.isBlank()
                || request == null || request.isBlank() || assignedStaff == null || assignedStaff.isBlank()
                || status == null || status.isBlank()) {
            response.put("success", false);
            response.put("message", "All fields are required.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            guest updated = service.updateRequest(id, requestId.trim(), guestRoom.trim(), request.trim(), assignedStaff.trim(), status);
            response.put("success", true);
            response.put("message", "Updated request " + updated.getRequestId() + ".");
            response.put("request", updated);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * POST /guestservice/delete
     * Body: { "id": 1 }
     */
    @PostMapping("/delete")
    public ResponseEntity<Map<String, Object>> deleteGuestService(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        if (body.get("id") == null) {
            response.put("success", false);
            response.put("message", "Record ID is required.");
            return ResponseEntity.badRequest().body(response);
        }

        int id = ((Number) body.get("id")).intValue();

        try {
            service.deleteRequest(id);
            response.put("success", true);
            response.put("message", "Request deleted successfully.");
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
}
