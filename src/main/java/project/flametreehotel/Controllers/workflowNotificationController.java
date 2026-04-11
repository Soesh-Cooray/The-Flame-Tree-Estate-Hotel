package project.flametreehotel.Controllers;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
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
}
