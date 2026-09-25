package fu.tripsense.tripservice.dto.response;

import fu.tripsense.tripservice.enums.TripMemberRole;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record TripMemberResponse(
    UUID id,
    UUID tripId,
    UUID userId,
    TripMemberRole role,
    Instant joinedAt
) {}
