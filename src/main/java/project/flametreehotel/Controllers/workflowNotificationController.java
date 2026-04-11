package project.flametreehotel.Controllers;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.workflowNotification;
import project.flametreehotel.Services.workflowNotificationService;
import project.flametreehotel.Services.workflowRealtimeService;

@RestController
@RequestMapping("/workflow")
@RequiredArgsConstructor
public class workflowNotificationController {

    private final workflowNotificationService notificationService;
    private final workflowRealtimeService realtimeService;

    @GetMapping("/notifications")
    public ResponseEntity<List<workflowNotification>> listNotifications(
            @RequestParam(defaultValue = "SUPERVISOR") String audience) {
        return ResponseEntity.ok(notificationService.listRecentByAudience(audience));
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@RequestParam(defaultValue = "SUPERVISOR") String audience) {
        return realtimeService.register(audience);
    }

    @PostMapping("/notifications/clear")
    public ResponseEntity<Map<String, Object>> clearNotifications(@RequestBody Map<String, Object> body) {
        String audience = String.valueOf(body.getOrDefault("audience", "SUPERVISOR"));
        long deletedCount = notificationService.clearByAudience(audience);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Notifications cleared.");
        response.put("deletedCount", deletedCount);
        return ResponseEntity.ok(response);
    }
}
