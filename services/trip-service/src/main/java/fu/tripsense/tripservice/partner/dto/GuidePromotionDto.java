package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.PublicationState;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record GuidePromotionDto(
    UUID id,
    UUID businessId,
    UUID approvedRevisionId,
    PublicationState publicationState,
    boolean communityEnabled,
    UUID communityPostId,
    Long distributionVersion,
    Long version,
    GuidePromotionRevisionDto currentRevision,
    Instant createdAt,
    Instant updatedAt
) {}
