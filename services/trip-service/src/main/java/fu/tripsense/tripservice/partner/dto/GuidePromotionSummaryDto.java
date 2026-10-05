package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.IndicativePriceUnit;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import lombok.Builder;

@Builder
public record GuidePromotionSummaryDto(
    UUID id,
    UUID businessId,
    String title,
    String summary,
    String areaId,
    List<String> topicIds,
    List<String> skillIds,
    String experienceDuration,
    BigDecimal indicativePriceAmount,
    String indicativePriceCurrency,
    IndicativePriceUnit indicativePriceUnit,
    String coverImageRef
) {}
