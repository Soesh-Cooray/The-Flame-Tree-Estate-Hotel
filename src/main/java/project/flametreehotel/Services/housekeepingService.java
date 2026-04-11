package project.flametreehotel.Services;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.housekeeping;
import project.flametreehotel.Model.housekeepingInventoryUsage;
import project.flametreehotel.Model.inventory;
import project.flametreehotel.Repository.housekeepingInventoryUsageRepository;
import project.flametreehotel.Repository.housekeepingRepository;

@Service
@RequiredArgsConstructor
public class housekeepingService {

    private static final Pattern HKP_ID_PATTERN = Pattern.compile("HKP-(\\d+)");
    private static final String STATUS_PENDING = "Pending";
    private static final String STATUS_IN_PROGRESS = "In Progress";
    private static final String STATUS_COMPLETED = "Completed";
    private static final String DECISION_PENDING_REVIEW = "Pending Review";
    private static final String DECISION_APPROVED = "Approved";
    private static final String DECISION_REJECTED = "Rejected";

    private final housekeepingRepository repository;
    private final housekeepingInventoryUsageRepository usageRepository;
    private final guestService guestService;
    private final inventoryService inventoryService;
    private final workflowNotificationService notificationService;

    public List<housekeeping> getAllTasks() {
        return repository.findAll();
    }

    public String generateNextHousekeepingTaskId() {
        int max = repository.findAll().stream()
                .map(housekeeping::getRequestId)
                .mapToInt(this::extractHkpSequence)
                .max()
                .orElse(0);

        return String.format("HKP-%03d", max + 1);
    }

    public housekeeping addTask(String requestId, String room, String requestType, String assignedStaff, String taskStatus) {
        if (repository.findByRequestId(requestId).isPresent()) {
            throw new RuntimeException("Request ID already exists. Please use a unique request ID.");
        }

        housekeeping task = new housekeeping();
        task.setRequestId(requestId);
        task.setRoom(room);
        task.setRequestType(requestType);
        task.setAssignedStaff(assignedStaff);
        task.setTaskStatus(normalizeTaskStatus(taskStatus));
        task.setApproved(false);
        task.setSupervisorDecision(DECISION_PENDING_REVIEW);
        task.setRejectionReason("");

        housekeeping saved = repository.save(task);

        notificationService.publishDataChange(
            List.of(
                workflowNotificationService.AUDIENCE_HOUSEKEEPING,
                workflowNotificationService.AUDIENCE_SUPERVISOR),
            "housekeeping-task",
            saved.getRequestId());

        return saved;
    }

    public housekeeping addTaskFromGuestRequest(String requestId, String room, String requestType, String assignedStaff) {
        if (repository.findByRequestId(requestId).isPresent()) {
            throw new RuntimeException("This guest request has already been sent to housekeeping.");
        }

        housekeeping task = new housekeeping();
        task.setRequestId(requestId);
        task.setRoom(room);
        task.setRequestType(requestType);
        task.setAssignedStaff(assignedStaff == null || assignedStaff.isBlank() ? "Unassigned" : assignedStaff.trim());
        task.setTaskStatus(STATUS_PENDING);
        task.setApproved(false);
        task.setSupervisorDecision(DECISION_PENDING_REVIEW);
        task.setRejectionReason("");

        housekeeping saved = repository.save(task);

        notificationService.publishDataChange(
            List.of(
                workflowNotificationService.AUDIENCE_HOUSEKEEPING,
                workflowNotificationService.AUDIENCE_SUPERVISOR,
                workflowNotificationService.AUDIENCE_GUEST),
            "housekeeping-task",
            saved.getRequestId());

        return saved;
    }

    public housekeeping updateTask(int id, String requestId, String room, String requestType, String assignedStaff, String taskStatus) {
        housekeeping existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found."));
        boolean wasCompleted = STATUS_COMPLETED.equalsIgnoreCase(existing.getTaskStatus());

        existing.setRequestId(requestId);
        existing.setRoom(room);
        existing.setRequestType(requestType);
        existing.setAssignedStaff(assignedStaff);
        String normalizedStatus = normalizeTaskStatus(taskStatus);
        existing.setTaskStatus(normalizedStatus);
        existing.setApproved(false);
        existing.setSupervisorDecision(DECISION_PENDING_REVIEW);
        existing.setRejectionReason("");

        if (isGuestRequest(existing.getRequestId())) {
            if (STATUS_IN_PROGRESS.equalsIgnoreCase(normalizedStatus) || STATUS_PENDING.equalsIgnoreCase(normalizedStatus)) {
                guestService.updateStatusByRequestId(existing.getRequestId(), STATUS_IN_PROGRESS);
            }
            if (STATUS_COMPLETED.equalsIgnoreCase(normalizedStatus)) {
                guestService.updateStatusByRequestId(existing.getRequestId(), STATUS_IN_PROGRESS);
            }
        }

        housekeeping saved = repository.save(existing);

        if (!wasCompleted && STATUS_COMPLETED.equalsIgnoreCase(saved.getTaskStatus())) {
                notificationService.create(
                    workflowNotificationService.AUDIENCE_SUPERVISOR,
                    "Housekeeping Task Completed",
                    "Task " + saved.getRequestId() + " was marked Completed by housekeeping.",
                    "TASK_COMPLETED",
                    saved.getRequestId(),
                    "Housekeeping");
        }

            notificationService.publishDataChange(
                List.of(
                        workflowNotificationService.AUDIENCE_HOUSEKEEPING,
                        workflowNotificationService.AUDIENCE_SUPERVISOR,
                        workflowNotificationService.AUDIENCE_GUEST),
                "housekeeping-task",
                saved.getRequestId());

        return saved;
    }

    public housekeeping supervisorDecision(int id, String decision, String reassignedTo, String rejectionReason) {
        housekeeping existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found."));

        if (!STATUS_COMPLETED.equalsIgnoreCase(existing.getTaskStatus())) {
            throw new RuntimeException("Only completed tasks can be reviewed by supervisor.");
        }

        String normalizedDecision = normalizeDecision(decision);

        if (DECISION_APPROVED.equalsIgnoreCase(normalizedDecision)) {
            existing.setApproved(true);
            existing.setSupervisorDecision(DECISION_APPROVED);
            existing.setRejectionReason("");
            housekeeping saved = repository.save(existing);

                notificationService.create(
                workflowNotificationService.AUDIENCE_HOUSEKEEPING,
                "Task Approved",
                "Supervisor approved housekeeping task " + saved.getRequestId() + ".",
                "TASK_APPROVED",
                saved.getRequestId(),
                "Housekeeping");

            if (isGuestRequest(saved.getRequestId())) {
                notificationService.create(
                workflowNotificationService.AUDIENCE_GUEST,
                "Request Approved",
                "Supervisor approved request " + saved.getRequestId() + ".",
                "REQUEST_APPROVED",
                saved.getRequestId(),
                "Housekeeping");
            }

                notificationService.publishDataChange(
                List.of(
                    workflowNotificationService.AUDIENCE_SUPERVISOR,
                    workflowNotificationService.AUDIENCE_HOUSEKEEPING,
                    workflowNotificationService.AUDIENCE_GUEST),
                "housekeeping-approval",
                saved.getRequestId());

            if (isGuestRequest(saved.getRequestId())) {
                guestService.updateStatusByRequestId(saved.getRequestId(), STATUS_COMPLETED);
            }
            return saved;
        }

        if (reassignedTo == null || reassignedTo.isBlank()) {
            throw new RuntimeException("Reassignment is required when rejecting a task.");
        }
        if (rejectionReason == null || rejectionReason.isBlank()) {
            throw new RuntimeException("Rejection reason is required when rejecting a task.");
        }

        existing.setApproved(false);
        existing.setSupervisorDecision(DECISION_REJECTED);
        existing.setRejectionReason(rejectionReason.trim());
        existing.setAssignedStaff(reassignedTo.trim());
        existing.setTaskStatus(STATUS_IN_PROGRESS);
        housekeeping saved = repository.save(existing);

        if (isGuestRequest(saved.getRequestId())) {
            guestService.updateStatusByRequestId(saved.getRequestId(), STATUS_IN_PROGRESS);
        }

        notificationService.publishDataChange(
            List.of(
                workflowNotificationService.AUDIENCE_SUPERVISOR,
                workflowNotificationService.AUDIENCE_HOUSEKEEPING,
                workflowNotificationService.AUDIENCE_GUEST),
            "housekeeping-approval",
            saved.getRequestId());

        return saved;
    }

    public housekeeping setApproval(int id, boolean approved) {
        return supervisorDecision(id, approved ? DECISION_APPROVED : DECISION_REJECTED,
                approved ? "" : "Unassigned", approved ? "" : "Legacy rejection");
    }

    private String normalizeTaskStatus(String taskStatus) {
        String value = taskStatus == null ? "" : taskStatus.trim();
        if (value.equalsIgnoreCase("Assigned")) {
            return STATUS_PENDING;
        }
        if (value.equalsIgnoreCase("Pending")) {
            return STATUS_PENDING;
        }
        if (value.equalsIgnoreCase(STATUS_IN_PROGRESS)) {
            return STATUS_IN_PROGRESS;
        }
        if (value.equalsIgnoreCase(STATUS_COMPLETED)) {
            return STATUS_COMPLETED;
        }
        throw new RuntimeException("Invalid task status. Use Pending, In Progress, or Completed.");
    }

    private String normalizeDecision(String decision) {
        String value = decision == null ? "" : decision.trim();
        if (DECISION_APPROVED.equalsIgnoreCase(value) || "approve".equalsIgnoreCase(value)) {
            return DECISION_APPROVED;
        }
        if (DECISION_REJECTED.equalsIgnoreCase(value) || "reject".equalsIgnoreCase(value)) {
            return DECISION_REJECTED;
        }
        throw new RuntimeException("Invalid decision. Use Approved or Rejected.");
    }

    private boolean isGuestRequest(String requestId) {
        return requestId != null && requestId.trim().toUpperCase().startsWith("REQ-");
    }

    private int extractHkpSequence(String requestId) {
        if (requestId == null) {
            return 0;
        }

        Matcher matcher = HKP_ID_PATTERN.matcher(requestId.trim().toUpperCase());
        if (!matcher.matches()) {
            return 0;
        }

        try {
            return Integer.parseInt(matcher.group(1));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    public void deleteTask(int id) {
        housekeeping existing = repository.findById(id)
            .orElseThrow(() -> new RuntimeException("Task not found."));

        repository.deleteById(id);

        notificationService.publishDataChange(
            List.of(
                workflowNotificationService.AUDIENCE_HOUSEKEEPING,
                workflowNotificationService.AUDIENCE_SUPERVISOR,
                workflowNotificationService.AUDIENCE_GUEST),
            "housekeeping-task",
            existing.getRequestId());
    }

    public housekeepingInventoryUsage logInventoryUsage(int inventoryId, String staffName, int usedQty) {
        if (staffName == null || staffName.isBlank()) {
            throw new RuntimeException("Housekeeping staff is required.");
        }

        inventory updatedInventory = inventoryService.consumeStock(inventoryId, usedQty);

        housekeepingInventoryUsage usage = new housekeepingInventoryUsage();
        usage.setInventoryId(updatedInventory.getId());
        usage.setItemName(updatedInventory.getItem());
        usage.setStaffName(staffName.trim());
        usage.setUsedQty(usedQty);
        usage.setUsedAt(java.time.LocalDateTime.now());

        return usageRepository.save(usage);
    }

    public List<housekeepingInventoryUsage> listInventoryUsageLogs() {
        return usageRepository.findAllByOrderByUsedAtDesc();
    }
}
