package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.InvitationState;
import fu.tripsense.tripservice.partner.enums.MembershipRole;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record InvitationDto(
    UUID id,
    UUID businessId,
    String recipientEmail,
    MembershipRole role,
    InvitationState state,
    Instant expiresAt,
    Instant createdAt,
    String token
) {}
