package fu.tripsense.tripservice.service;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.util.UUID;

public interface GroupVotingSseService {
    SseEmitter subscribe(UUID tripId, UUID userId);
    void publishVoteUpdate(UUID tripId, Object data);
}
