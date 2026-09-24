package fu.tripsense.tripservice.dto.response;

import fu.tripsense.tripservice.enums.TripInvitationStatus;
import fu.tripsense.tripservice.enums.TripMemberRole;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record TripInvitationResponse(
    UUID id,
    UUID tripId,
    String tripName,
    UUID inviterUserId,
    String inviteeEmail,
    TripMemberRole role,
    TripInvitationStatus status,
    String invitationToken,
    String message,
    Instant expiresAt,
    Instant createdAt
) {}
