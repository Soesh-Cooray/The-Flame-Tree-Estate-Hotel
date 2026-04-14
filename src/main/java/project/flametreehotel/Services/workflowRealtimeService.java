package project.flametreehotel.Services;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class workflowRealtimeService {

    private final Map<String, CopyOnWriteArrayList<SseEmitter>> emittersByAudience = new ConcurrentHashMap<>();

    public SseEmitter register(String audience) {
        String key = normalizeAudience(audience);
        SseEmitter emitter = new SseEmitter(0L);
        emittersByAudience.computeIfAbsent(key, ignored -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(key, emitter));
        emitter.onTimeout(() -> removeEmitter(key, emitter));
        emitter.onError(error -> removeEmitter(key, emitter));

        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data(Map.of(
                            "audience", key,
                            "connectedAt", LocalDateTime.now().toString())));
        } catch (IOException | IllegalStateException ex) {
            safelyRemoveEmitter(key, emitter);
        }

        return emitter;
    }

    public void publishNotification(String audience, Map<String, Object> payload) {
        sendEvent(normalizeAudience(audience), "notification", payload);
    }

    public void publishDataChange(String audience, String entity, String requestId) {
        sendEvent(normalizeAudience(audience), "data-change", Map.of(
                "entity", entity,
                "requestId", requestId == null ? "" : requestId,
                "sentAt", LocalDateTime.now().toString()));
    }

    private void sendEvent(String audience, String eventName, Object payload) {
        List<SseEmitter> emitters = emittersByAudience.getOrDefault(audience, new CopyOnWriteArrayList<>());
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(payload));
            } catch (IOException | IllegalStateException ex) {
                safelyRemoveEmitter(audience, emitter);
            }
        }
    }

    private void safelyRemoveEmitter(String audience, SseEmitter emitter) {
        removeEmitter(audience, emitter);
        try {
            emitter.complete();
        } catch (Exception ignored) {
            // Ignore completion failures for disconnected clients.
        }
    }

    private void removeEmitter(String audience, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> emitters = emittersByAudience.get(audience);
        if (emitters == null) {
            return;
        }
        emitters.remove(emitter);
        if (emitters.isEmpty()) {
            emittersByAudience.remove(audience);
        }
    }

    private String normalizeAudience(String audience) {
        return audience == null || audience.isBlank()
                ? "SUPERVISOR"
                : audience.trim().toUpperCase();
    }
}
