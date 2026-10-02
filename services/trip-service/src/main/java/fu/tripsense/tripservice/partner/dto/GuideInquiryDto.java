package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.GuideInquiryState;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record GuideInquiryDto(
    UUID id,
    UUID guideBusinessId,
    UUID customerId,
    UUID sourcePromotionId,
    UUID sourceCommunityPostId,
    GuideInquiryState state,
    Long version,
    int boundSuspensionVersion,
    int currentRequirementsRevision,
    UUID currentProposalId,
    Instant expiresAt,
    String closeReason,
    GuideInquiryRequirementsDto currentRequirements,
    GuideProposalDto currentProposal,
    List<GuideInquiryEntryDto> entries,
    Instant createdAt,
    Instant updatedAt
) {}
