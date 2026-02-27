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
import project.flametreehotel.Model.housekeeping;
import project.flametreehotel.Services.housekeepingService;

@RestController
@RequestMapping("/housekeeping")
@RequiredArgsConstructor
public class housekeepingController {

    private final housekeepingService service;

    /**
     * GET /housekeeping/list
     * Returns all housekeeping tasks from the database.
     */
    @GetMapping("/list")
    public ResponseEntity<List<housekeeping>> listHousekeeping() {
        return ResponseEntity.ok(service.getAllTasks());
    }

    /**
     * POST /housekeeping/add
     * Body: { "requestId": "...", "room": "...", "requestType": "...", "assignedStaff": "...", "taskStatus": "..." }
     */
    @PostMapping("/add")
    public ResponseEntity<Map<String, Object>> addHousekeeping(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        String requestId = (String) body.get("requestId");
        String room = (String) body.get("room");
        String requestType = (String) body.get("requestType");
        String assignedStaff = (String) body.get("assignedStaff");
        String taskStatus = (String) body.get("taskStatus");

        if (requestId == null || requestId.isBlank() || room == null || room.isBlank()
                || requestType == null || requestType.isBlank() || assignedStaff == null || assignedStaff.isBlank()
                || taskStatus == null || taskStatus.isBlank()) {
            response.put("success", false);
            response.put("message", "All fields are required.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            housekeeping created = service.addTask(requestId.trim(), room.trim(), requestType, assignedStaff.trim(), taskStatus);
            response.put("success", true);
            response.put("message", "Added task " + created.getRequestId() + ".");
            response.put("task", created);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * POST /housekeeping/update
     * Body: { "id": 1, "requestId": "...", "room": "...", "requestType": "...", "assignedStaff": "...", "taskStatus": "..." }
     */
    @PostMapping("/update")
    public ResponseEntity<Map<String, Object>> updateHousekeeping(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        if (body.get("id") == null) {
            response.put("success", false);
            response.put("message", "Task ID is required.");
            return ResponseEntity.badRequest().body(response);
        }

        int id = ((Number) body.get("id")).intValue();
        String requestId = (String) body.get("requestId");
        String room = (String) body.get("room");
        String requestType = (String) body.get("requestType");
        String assignedStaff = (String) body.get("assignedStaff");
        String taskStatus = (String) body.get("taskStatus");

        if (requestId == null || requestId.isBlank() || room == null || room.isBlank()
                || requestType == null || requestType.isBlank() || assignedStaff == null || assignedStaff.isBlank()
                || taskStatus == null || taskStatus.isBlank()) {
            response.put("success", false);
            response.put("message", "All fields are required.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            housekeeping updated = service.updateTask(id, requestId.trim(), room.trim(), requestType, assignedStaff.trim(), taskStatus);
            response.put("success", true);
            response.put("message", "Updated task " + updated.getRequestId() + ".");
            response.put("task", updated);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * POST /housekeeping/delete
     * Body: { "id": 1 }
     */
    @PostMapping("/delete")
    public ResponseEntity<Map<String, Object>> deleteHousekeeping(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        if (body.get("id") == null) {
            response.put("success", false);
            response.put("message", "Task ID is required.");
            return ResponseEntity.badRequest().body(response);
        }

        int id = ((Number) body.get("id")).intValue();

        try {
            service.deleteTask(id);
            response.put("success", true);
            response.put("message", "Task deleted successfully.");
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
}
