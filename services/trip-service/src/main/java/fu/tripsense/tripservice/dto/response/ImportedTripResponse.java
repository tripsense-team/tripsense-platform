package fu.tripsense.tripservice.dto.response;

import java.time.Instant;
import java.util.UUID;

public record ImportedTripResponse(
    UUID tripId,
    UUID sourcePostId,
    String name,
    int dayCount,
    int itemCount,
    Instant importedAt) {}
