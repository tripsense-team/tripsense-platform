package fu.tripsense.tripservice.dto.response;

import java.time.Instant;
import java.util.UUID;

public record AdminTripArchiveResponse(
    UUID id,
    String status,
    boolean archived,
    Instant archivedAt,
    Long version,
    Instant updatedAt) {}

