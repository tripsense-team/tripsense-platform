package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.ManagementClaimState;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record ManagementClaimDto(
    UUID id,
    UUID applicantUserId,
    UUID targetBusinessId,
    String reason,
    ManagementClaimState state,
    Long version,
    String decisionOutcome,
    String decisionReason,
    UUID decidedBy,
    Instant decidedAt,
    Instant createdAt,
    Instant updatedAt
) {}
