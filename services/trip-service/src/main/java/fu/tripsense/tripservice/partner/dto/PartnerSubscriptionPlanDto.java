package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.entity.PartnerSubscriptionPlan;
import fu.tripsense.tripservice.partner.enums.BusinessKind;
import java.math.BigDecimal;

public record PartnerSubscriptionPlanDto(
    String planId,
    BusinessKind businessKind,
    String name,
    int durationDays,
    BigDecimal priceVnd,
    BigDecimal originalPriceVnd,
    Integer discountPercent,
    String tagline,
    String badgeLabel,
    int displayOrder
) {
  public static PartnerSubscriptionPlanDto fromEntity(PartnerSubscriptionPlan entity) {
    return new PartnerSubscriptionPlanDto(
        entity.getPlanId(),
        entity.getBusinessKind(),
        entity.getName(),
        entity.getDurationDays(),
        entity.getPriceVnd(),
        entity.getOriginalPriceVnd(),
        entity.getDiscountPercent(),
        entity.getTagline(),
        entity.getBadgeLabel(),
        entity.getDisplayOrder()
    );
  }
}
