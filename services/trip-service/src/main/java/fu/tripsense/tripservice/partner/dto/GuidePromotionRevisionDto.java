package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.ApplicationState;
import fu.tripsense.tripservice.partner.enums.IndicativePriceUnit;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.Builder;

@Builder
public record GuidePromotionRevisionDto(
    UUID id,
    UUID promotionId,
    int revisionNumber,
    UUID approvedProfileRevisionId,
    String title,
    String summary,
    String areaId,
    List<String> topicIds,
    List<String> skillIds,
    String experienceDuration,
    List<String> inclusions,
    List<String> exclusions,
    BigDecimal indicativePriceAmount,
    String indicativePriceCurrency,
    IndicativePriceUnit indicativePriceUnit,
    String coverImageRef,
    List<String> galleryImageRefs,
    ApplicationState state,
    String reviewDecisionReason,
    UUID reviewedBy,
    Instant reviewedAt,
    Instant createdAt,
    Instant updatedAt
) {}
