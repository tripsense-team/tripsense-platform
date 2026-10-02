package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.GuideProposalState;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record GuideProposalDto(
    UUID id,
    UUID inquiryId,
    int revision,
    int requirementsRevision,
    String offeredAreaId,
    List<String> offeredTopicIds,
    List<String> offeredSkillIds,
    String languageCode,
    List<String> unmetSoftRequirements,
    String explanation,
    Instant proposedStartAt,
    String timeZone,
    int durationMinutes,
    String program,
    List<String> inclusions,
    List<String> exclusions,
    BigDecimal estimatedTotalVnd,
    Instant validUntil,
    GuideProposalState state,
    List<String> matchedRequirements,
    List<String> unmetRequirements,
    boolean isCurrent,
    boolean canAgreeToContact,
    List<String> blockedReasons,
    Instant createdAt
) {}
