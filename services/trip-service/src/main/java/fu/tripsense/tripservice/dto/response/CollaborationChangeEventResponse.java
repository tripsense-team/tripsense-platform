package fu.tripsense.tripservice.dto.response;

import fu.tripsense.tripservice.enums.CollaborationChangeType;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record CollaborationChangeEventResponse(
    UUID eventId,
    short schemaVersion,
    UUID tripId,
    long revision,
    CollaborationChangeType type,
    UUID actorUserId,
    Instant occurredAt,
    Map<String, Object> payload) {}
