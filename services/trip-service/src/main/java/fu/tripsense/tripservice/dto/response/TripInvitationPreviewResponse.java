package fu.tripsense.tripservice.dto.response;

import fu.tripsense.tripservice.enums.TripInvitationStatus;
import fu.tripsense.tripservice.enums.TripMemberRole;
import java.time.Instant;

public record TripInvitationPreviewResponse(
    String tripName,
    String inviteeEmail,
    TripMemberRole role,
    TripInvitationStatus status,
    Instant expiresAt) {}
