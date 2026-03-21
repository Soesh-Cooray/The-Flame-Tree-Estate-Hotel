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
import project.flametreehotel.Services.housekeepingService;
import project.flametreehotel.Services.maintenanceService;

@RestController
@RequestMapping("/guestservice")
@RequiredArgsConstructor
public class guestserviceController {

    private final guestService service;
    private final housekeepingService housekeepingService;
    private final maintenanceService maintenanceService;

    /**
     * GET /guestservice/list
     * Returns all guest service requests from the database.
     */
    @GetMapping("/list")
    public ResponseEntity<List<guest>> listGuestServices() {
        return ResponseEntity.ok(service.getAllRequests());
    }

    @GetMapping("/next-request-id")
    public ResponseEntity<Map<String, String>> nextRequestId() {
        return ResponseEntity.ok(Map.of("requestId", service.generateNextRequestId()));
    }

    @GetMapping("/routing-pending")
    public ResponseEntity<List<guest>> pendingRoutingRequests() {
        return ResponseEntity.ok(service.getPendingRoutingRequests());
    }

    @GetMapping("/supervisor/unified")
    public ResponseEntity<Map<String, Object>> supervisorUnifiedPanel() {
        Map<String, Object> response = new HashMap<>();

        List<Map<String, Object>> guestPending = service.getAllRequests().stream()
            .filter(request -> "Pending".equalsIgnoreCase(String.valueOf(request.getStatus())))
            .map(request -> buildTaskMap(
                "GUEST",
                "Guest Service",
                "Guest Request",
                request.getId(),
                request.getRequestId(),
                request.getRoomName(),
                request.getRequest(),
                request.getRoutedModule() == null || request.getRoutedModule().isBlank() ? "Unassigned" : request.getRoutedModule(),
                request.getStatus(),
                "Pending",
                ""))
            .toList();

        List<Map<String, Object>> housekeepingTasks = housekeepingService.getAllTasks().stream()
            .map(task -> {
                String decision = task.getSupervisorDecision() == null || task.getSupervisorDecision().isBlank()
                    ? (task.isApproved() ? "Approved" : "Pending Review")
                    : task.getSupervisorDecision();
                return buildTaskMap(
                    "HOUSEKEEPING",
                    "Housekeeping",
                    task.getRequestId() != null && task.getRequestId().startsWith("REQ-") ? "Guest Request" : "Department Task",
                    task.getId(),
                    task.getRequestId(),
                    task.getRoom(),
                    task.getRequestType(),
                    task.getAssignedStaff(),
                    task.getTaskStatus(),
                    decision,
                    task.getRejectionReason());
            })
            .toList();

        List<Map<String, Object>> maintenanceTasks = maintenanceService.getAllTickets().stream()
            .map(ticket -> {
                String decision = ticket.getSupervisorDecision() == null || ticket.getSupervisorDecision().isBlank()
                    ? (ticket.isApproved() ? "Approved" : "Pending Review")
                    : ticket.getSupervisorDecision();
                String code = ticket.getGuestRequestId() != null && !ticket.getGuestRequestId().isBlank()
                    ? ticket.getGuestRequestId()
                    : ticket.getTicket();
                return buildTaskMap(
                    "MAINTENANCE",
                    "Maintenance",
                    code != null && code.startsWith("REQ-") ? "Guest Request" : "Department Task",
                    ticket.getId(),
                    code == null ? "" : code,
                    ticket.getLocation(),
                    ticket.getIssue(),
                    ticket.getAssignedTo(),
                    ticket.getStatus(),
                    decision,
                    ticket.getRejectionReason());
            })
            .toList();

        response.put("success", true);
        response.put("guestPending", guestPending);
        response.put("housekeepingTasks", housekeepingTasks);
        response.put("maintenanceTasks", maintenanceTasks);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /guestservice/route
     * Body: { "requestId": "REQ-001", "targetModule": "housekeeping|maintenance", "assignedStaff": "...", "role": "Manager|Staff Supervisor" }
     */
    @PostMapping("/route")
    public ResponseEntity<Map<String, Object>> routeGuestService(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        String requestId = String.valueOf(body.getOrDefault("requestId", "")).trim();
        String targetModule = String.valueOf(body.getOrDefault("targetModule", "")).trim().toLowerCase();
        String assignedStaff = String.valueOf(body.getOrDefault("assignedStaff", "")).trim();
        String role = String.valueOf(body.getOrDefault("role", "")).trim();

        boolean allowed = isSupervisorOrManager(role);
        if (!allowed) {
            response.put("success", false);
            response.put("message", "Only manager or supervisor can route guest requests.");
            return ResponseEntity.status(403).body(response);
        }

        if (requestId.isBlank() || targetModule.isBlank()) {
            response.put("success", false);
            response.put("message", "requestId and targetModule are required.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            guest request = service.getByRequestId(requestId);

            switch (targetModule) {
                case "housekeeping" -> housekeepingService.addTaskFromGuestRequest(
                    request.getRequestId(), request.getRoomName(), request.getRequest(), assignedStaff);
                case "maintenance" -> maintenanceService.addTicketFromGuestRequest(
                    request.getRequestId(), request.getRoomName(), request.getRequest(), assignedStaff);
                default -> {
                    response.put("success", false);
                    response.put("message", "Invalid targetModule. Use housekeeping or maintenance.");
                    return ResponseEntity.badRequest().body(response);
                }
            }

            guest routed = service.markRouted(requestId, targetModule);
            response.put("success", true);
            response.put("message", "Request " + routed.getRequestId() + " routed to " + routed.getRoutedModule() + ".");
            response.put("request", routed);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }


    /**
     * POST /guestservice/add
     * Body: { "requestId": "...", "roomName": "...", "request": "..." }
     */
    @PostMapping("/add")
    public ResponseEntity<Map<String, Object>> addGuestService(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        String requestId = (String) body.get("requestId");
        String roomName = (String) body.get("roomName");
        String request = (String) body.get("request");

        if (requestId == null || requestId.isBlank() || roomName == null || roomName.isBlank()
                || request == null || request.isBlank()) {
            response.put("success", false);
            response.put("message", "All fields are required.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            guest created = service.addRequest(requestId.trim(), roomName.trim(), request.trim());
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
     * Body: { "id": 1, "requestId": "...", "roomName": "...", "request": "..." }
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
        String roomName = (String) body.get("roomName");
        String request = (String) body.get("request");

        if (requestId == null || requestId.isBlank() || roomName == null || roomName.isBlank()
                || request == null || request.isBlank()) {
            response.put("success", false);
            response.put("message", "All fields are required.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            guest updated = service.updateRequest(id, requestId.trim(), roomName.trim(), request.trim());
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

    private Map<String, Object> buildTaskMap(String source, String department, String itemType, int id,
            String taskCode, String roomOrLocation, String requestType, String assignedTo,
            String status, String supervisorDecision, String rejectionReason) {
        Map<String, Object> row = new HashMap<>();
        row.put("source", nullSafe(source));
        row.put("department", nullSafe(department));
        row.put("itemType", nullSafe(itemType));
        row.put("id", id);
        row.put("taskCode", nullSafe(taskCode));
        row.put("roomOrLocation", nullSafe(roomOrLocation));
        row.put("requestType", nullSafe(requestType));
        row.put("assignedTo", nullSafe(assignedTo));
        row.put("status", nullSafe(status));
        row.put("supervisorDecision", nullSafe(supervisorDecision));
        row.put("rejectionReason", nullSafe(rejectionReason));
        return row;
    }

    private String nullSafe(String value) {
        return value == null ? "" : value;
    }

    private boolean isSupervisorOrManager(String role) {
        if (role == null) return false;
        String normalized = role.trim().toLowerCase();
        return normalized.contains("manager") || normalized.contains("supervisor") || 
               "manager".equals(normalized) || "supervisor".equals(normalized);
    }
}
