package fu.tripsense.tripservice.service.impl;

import fu.tripsense.tripservice.service.GroupVotingSseService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
@Slf4j
public class GroupVotingSseServiceImpl implements GroupVotingSseService {

    private final Map<UUID, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    @Override
    public SseEmitter subscribe(UUID tripId, UUID userId) {
        SseEmitter emitter = new SseEmitter(3600000L); // 1 hour timeout
        List<SseEmitter> tripEmitters = emitters.computeIfAbsent(tripId, k -> new CopyOnWriteArrayList<>());
        tripEmitters.add(emitter);

        emitter.onCompletion(() -> tripEmitters.remove(emitter));
        emitter.onTimeout(() -> tripEmitters.remove(emitter));
        emitter.onError(e -> tripEmitters.remove(emitter));

        log.info("User {} subscribed to trip {} voting events", userId, tripId);
        
        // Send initial dummy event to establish connection
        try {
            emitter.send(SseEmitter.event().name("init").data("connected"));
        } catch (IOException e) {
            tripEmitters.remove(emitter);
        }

        return emitter;
    }

    @Override
    public void publishVoteUpdate(UUID tripId, Object data) {
        List<SseEmitter> tripEmitters = emitters.get(tripId);
        if (tripEmitters != null) {
            List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();
            tripEmitters.forEach(emitter -> {
                try {
                    emitter.send(SseEmitter.event().name("vote-update").data(data));
                } catch (IOException e) {
                    deadEmitters.add(emitter);
                }
            });
            tripEmitters.removeAll(deadEmitters);
        }
    }
}
