package project.flametreehotel.Services;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.maintenance;
import project.flametreehotel.Repository.maintenanceRepository;

@Service
@RequiredArgsConstructor
public class maintenanceService {

    private static final Pattern MCE_ID_PATTERN = Pattern.compile("MCE-(\\d+)");
    private static final String STATUS_PENDING = "Pending";
    private static final String STATUS_IN_PROGRESS = "In Progress";
    private static final String STATUS_COMPLETED = "Completed";
    private static final String DECISION_PENDING_REVIEW = "Pending Review";
    private static final String DECISION_APPROVED = "Approved";
    private static final String DECISION_REJECTED = "Rejected";

    private final maintenanceRepository repository;
    private final guestService guestService;
    private final workflowNotificationService notificationService;

    public List<maintenance> getAllTickets() {
        return repository.findAll();
    }

    public String generateNextMaintenanceTicketId() {
        int max = repository.findAll().stream()
                .map(maintenance::getTicket)
                .mapToInt(this::extractMceSequence)
                .max()
                .orElse(0);

        return String.format("MCE-%03d", max + 1);
    }

    public maintenance addTicket(String ticket, String location, String issue, String assignedTo, String status) {
        if (repository.findByTicket(ticket).isPresent()) {
            throw new RuntimeException("Ticket ID already exists. Please use a unique ticket ID.");
        }

        maintenance newTicket = new maintenance();
        newTicket.setTicket(ticket);
        newTicket.setLocation(location);
        newTicket.setIssue(issue);
        newTicket.setAssignedTo(assignedTo);
        newTicket.setStatus(normalizeStatus(status));
        newTicket.setApproved(false);
        newTicket.setSupervisorDecision(DECISION_PENDING_REVIEW);
        newTicket.setRejectionReason("");

        maintenance saved = repository.save(newTicket);

        notificationService.publishDataChange(
            List.of(
                workflowNotificationService.AUDIENCE_MAINTENANCE,
                workflowNotificationService.AUDIENCE_SUPERVISOR),
            "maintenance-ticket",
            saved.getTicket());

        return saved;
    }

    public maintenance addTicketFromGuestRequest(String guestRequestId, String location, String issue, String assignedStaff) {
        if (repository.findByGuestRequestId(guestRequestId).isPresent()) {
            throw new RuntimeException("This guest request has already been sent to maintenance.");
        }

        String ticketCode = guestRequestId;
        if (repository.findByTicket(ticketCode).isPresent()) {
            ticketCode = "MT-" + guestRequestId;
        }

        maintenance ticket = new maintenance();
        ticket.setTicket(ticketCode);
        ticket.setLocation(location);
        ticket.setIssue(issue);
        ticket.setAssignedTo(assignedStaff == null || assignedStaff.isBlank() ? "Unassigned" : assignedStaff.trim());
        ticket.setStatus(STATUS_PENDING);
        ticket.setApproved(false);
        ticket.setGuestRequestId(guestRequestId);
        ticket.setSupervisorDecision(DECISION_PENDING_REVIEW);
        ticket.setRejectionReason("");

        maintenance saved = repository.save(ticket);

        notificationService.publishDataChange(
            List.of(
                workflowNotificationService.AUDIENCE_MAINTENANCE,
                workflowNotificationService.AUDIENCE_SUPERVISOR,
                workflowNotificationService.AUDIENCE_GUEST),
            "maintenance-ticket",
            saved.getGuestRequestId());

        return saved;
    }

    public maintenance updateTicket(int id, String ticket, String location, String issue, String assignedTo, String status) {
        maintenance existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ticket not found."));
        boolean wasCompleted = STATUS_COMPLETED.equalsIgnoreCase(existing.getStatus());

        existing.setTicket(ticket);
        existing.setLocation(location);
        existing.setIssue(issue);
        existing.setAssignedTo(assignedTo);
        String normalizedStatus = normalizeStatus(status);
        existing.setStatus(normalizedStatus);
        existing.setApproved(false);
        existing.setSupervisorDecision(DECISION_PENDING_REVIEW);
        existing.setRejectionReason("");

        if (isGuestRequest(existing.getGuestRequestId())) {
            if (STATUS_PENDING.equalsIgnoreCase(normalizedStatus) || STATUS_IN_PROGRESS.equalsIgnoreCase(normalizedStatus)) {
                guestService.updateStatusByRequestId(existing.getGuestRequestId(), STATUS_IN_PROGRESS);
            }
            if (STATUS_COMPLETED.equalsIgnoreCase(normalizedStatus)) {
                guestService.updateStatusByRequestId(existing.getGuestRequestId(), STATUS_IN_PROGRESS);
            }
        }

        maintenance saved = repository.save(existing);

        if (!wasCompleted && STATUS_COMPLETED.equalsIgnoreCase(saved.getStatus())) {
                notificationService.create(
                    workflowNotificationService.AUDIENCE_SUPERVISOR,
                    "Maintenance Task Completed",
                    "Task " + safeTaskCode(saved) + " was marked Completed by maintenance.",
                    "TASK_COMPLETED",
                    safeRequestId(saved),
                    "Maintenance");
        }

            notificationService.publishDataChange(
                List.of(
                        workflowNotificationService.AUDIENCE_MAINTENANCE,
                        workflowNotificationService.AUDIENCE_SUPERVISOR,
                        workflowNotificationService.AUDIENCE_GUEST),
                "maintenance-ticket",
                safeRequestId(saved));

        return saved;
    }

    public maintenance supervisorDecision(int id, String decision, String reassignedTo, String rejectionReason) {
        maintenance existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ticket not found."));

        if (!STATUS_COMPLETED.equalsIgnoreCase(existing.getStatus())) {
            throw new RuntimeException("Only completed tickets can be reviewed by supervisor.");
        }

        String normalizedDecision = normalizeDecision(decision);

        if (DECISION_APPROVED.equalsIgnoreCase(normalizedDecision)) {
            existing.setApproved(true);
            existing.setSupervisorDecision(DECISION_APPROVED);
            existing.setRejectionReason("");
            maintenance saved = repository.save(existing);

                notificationService.create(
                workflowNotificationService.AUDIENCE_MAINTENANCE,
                "Task Approved",
                "Supervisor approved maintenance task " + safeTaskCode(saved) + ".",
                "TASK_APPROVED",
                safeRequestId(saved),
                "Maintenance");

            if (isGuestRequest(saved.getGuestRequestId())) {
                notificationService.create(
                workflowNotificationService.AUDIENCE_GUEST,
                "Request Approved",
                "Supervisor approved request " + saved.getGuestRequestId() + ".",
                "REQUEST_APPROVED",
                saved.getGuestRequestId(),
                "Maintenance");
            }

                notificationService.publishDataChange(
                List.of(
                    workflowNotificationService.AUDIENCE_SUPERVISOR,
                    workflowNotificationService.AUDIENCE_MAINTENANCE,
                    workflowNotificationService.AUDIENCE_GUEST),
                "maintenance-approval",
                safeRequestId(saved));

            if (isGuestRequest(saved.getGuestRequestId())) {
                guestService.updateStatusByRequestId(saved.getGuestRequestId(), STATUS_COMPLETED);
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
        existing.setAssignedTo(reassignedTo.trim());
        existing.setStatus(STATUS_IN_PROGRESS);
        maintenance saved = repository.save(existing);

        if (isGuestRequest(saved.getGuestRequestId())) {
            guestService.updateStatusByRequestId(saved.getGuestRequestId(), STATUS_IN_PROGRESS);
        }

        notificationService.publishDataChange(
            List.of(
                workflowNotificationService.AUDIENCE_SUPERVISOR,
                workflowNotificationService.AUDIENCE_MAINTENANCE,
                workflowNotificationService.AUDIENCE_GUEST),
            "maintenance-approval",
            safeRequestId(saved));

        return saved;
    }

    public maintenance setApproval(int id, boolean approved) {
        return supervisorDecision(id, approved ? DECISION_APPROVED : DECISION_REJECTED,
                approved ? "" : "Unassigned", approved ? "" : "Legacy rejection");
    }

    private String normalizeStatus(String status) {
        String value = status == null ? "" : status.trim();
        if (value.equalsIgnoreCase("Assigned")) {
            return STATUS_PENDING;
        }
        if (value.equalsIgnoreCase("Open")) {
            return STATUS_PENDING;
        }
        if (value.equalsIgnoreCase("Repaired")) {
            return STATUS_COMPLETED;
        }
        if (value.equalsIgnoreCase(STATUS_PENDING)) {
            return STATUS_PENDING;
        }
        if (value.equalsIgnoreCase(STATUS_IN_PROGRESS)) {
            return STATUS_IN_PROGRESS;
        }
        if (value.equalsIgnoreCase(STATUS_COMPLETED)) {
            return STATUS_COMPLETED;
        }
        throw new RuntimeException("Invalid status. Use Pending, In Progress, or Completed.");
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

    private int extractMceSequence(String ticketCode) {
        if (ticketCode == null) {
            return 0;
        }

        Matcher matcher = MCE_ID_PATTERN.matcher(ticketCode.trim().toUpperCase());
        if (!matcher.matches()) {
            return 0;
        }

        try {
            return Integer.parseInt(matcher.group(1));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    public void deleteTicket(int id) {
        maintenance existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ticket not found."));

        repository.deleteById(id);

        notificationService.publishDataChange(
                List.of(
                        workflowNotificationService.AUDIENCE_MAINTENANCE,
                        workflowNotificationService.AUDIENCE_SUPERVISOR,
                        workflowNotificationService.AUDIENCE_GUEST),
                "maintenance-ticket",
                safeRequestId(existing));
    }

    private String safeTaskCode(maintenance ticket) {
        if (ticket.getGuestRequestId() != null && !ticket.getGuestRequestId().isBlank()) {
            return ticket.getGuestRequestId();
        }
        return ticket.getTicket();
    }

    private String safeRequestId(maintenance ticket) {
        if (ticket.getGuestRequestId() != null && !ticket.getGuestRequestId().isBlank()) {
            return ticket.getGuestRequestId();
        }
        return ticket.getTicket() == null ? "" : ticket.getTicket();
    }
}
