package fu.tripsense.tripservice.partner.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import lombok.Builder;

@Builder
public record PublicGuideProfileDto(
    UUID businessId,
    String displayName,
    String bio,
    List<GuideLanguageDto> languages,
    List<String> skillIds,
    List<GuideExpertiseDto> expertise,
    List<String> audienceTags,
    List<String> serviceLimitations,
    Integer yearsExperience,
    IndicativePriceDto indicativePrice,
    List<GuidePromotionSummaryDto> promotions
) {
  public record GuideLanguageDto(String code, String selfAssessedLevel) {}
  public record GuideExpertiseDto(String areaId, String topicId, String description, String experience) {}
  public record IndicativePriceDto(BigDecimal amount, String currency, String unit) {}
}
