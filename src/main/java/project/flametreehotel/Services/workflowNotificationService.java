package project.flametreehotel.Services;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.workflowNotification;
import project.flametreehotel.Repository.workflowNotificationRepository;

@Service
@RequiredArgsConstructor
public class workflowNotificationService {

    public static final String AUDIENCE_GUEST = "GUEST";
    public static final String AUDIENCE_SUPERVISOR = "SUPERVISOR";
    public static final String AUDIENCE_MANAGER = "MANAGER";
    public static final String AUDIENCE_HOUSEKEEPING = "HOUSEKEEPING";
    public static final String AUDIENCE_MAINTENANCE = "MAINTENANCE";

    private final workflowNotificationRepository repository;
    private final workflowRealtimeService realtimeService;

    public workflowNotification create(String audience, String title, String message,
            String notificationType, String requestId, String department) {
        workflowNotification notification = new workflowNotification();
        notification.setAudience(normalizeAudience(audience));
        notification.setTitle(safe(title));
        notification.setMessage(safe(message));
        notification.setNotificationType(safe(notificationType));
        notification.setRequestId(requestId == null ? "" : requestId.trim());
        notification.setDepartment(department == null ? "" : department.trim());
        notification.setCreatedAt(LocalDateTime.now());

        workflowNotification saved = repository.save(notification);

        realtimeService.publishNotification(saved.getAudience(), Map.of(
                "id", saved.getId(),
                "audience", saved.getAudience(),
                "title", saved.getTitle(),
                "message", saved.getMessage(),
                "notificationType", saved.getNotificationType(),
                "requestId", saved.getRequestId(),
                "department", saved.getDepartment(),
                "createdAt", saved.getCreatedAt().toString()));

        return saved;
    }

    public List<workflowNotification> listRecentByAudience(String audience) {
        return repository.findTop40ByAudienceOrderByCreatedAtDesc(normalizeAudience(audience));
    }

    @Transactional
    public long clearByAudience(String audience) {
        String normalizedAudience = normalizeAudience(audience);
        long deletedCount = repository.deleteByAudience(normalizedAudience);

        publishDataChange(List.of(normalizedAudience), "notifications", "");
        return deletedCount;
    }

    public void publishDataChange(List<String> audiences, String entity, String requestId) {
        if (audiences == null || audiences.isEmpty()) {
            return;
        }

        for (String audience : audiences) {
            realtimeService.publishDataChange(normalizeAudience(audience), safe(entity), requestId);
        }
    }

    private String normalizeAudience(String audience) {
        if (audience == null || audience.isBlank()) {
            return AUDIENCE_SUPERVISOR;
        }
        return audience.trim().toUpperCase();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
