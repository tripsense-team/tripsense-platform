package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.entity.PartnerSubscription;
import fu.tripsense.tripservice.partner.enums.BusinessKind;
import fu.tripsense.tripservice.partner.enums.SubscriptionStatus;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

public record PartnerSubscriptionDto(
    UUID businessId,
    BusinessKind businessKind,
    SubscriptionStatus status,
    PartnerSubscriptionPlanDto currentPlan,
    Instant validFrom,
    Instant validTo,
    long daysRemaining,
    boolean isActive,
    String badgeLabel
) {
  public static PartnerSubscriptionDto of(
      PartnerSubscription sub,
      BusinessKind kind,
      PartnerSubscriptionPlanDto planDto
  ) {
    Instant now = Instant.now();
    boolean active = sub != null 
        && sub.getStatus() == SubscriptionStatus.ACTIVE 
        && sub.getValidTo() != null 
        && sub.getValidTo().isAfter(now);
    
    long remaining = 0;
    if (sub != null && sub.getValidTo() != null && sub.getValidTo().isAfter(now)) {
      remaining = Duration.between(now, sub.getValidTo()).toDays();
      if (remaining == 0 && Duration.between(now, sub.getValidTo()).toHours() > 0) {
        remaining = 1;
      }
    }

    String badge = planDto != null ? planDto.badgeLabel() : (active ? "Verified Partner" : null);

    return new PartnerSubscriptionDto(
        sub != null ? sub.getBusinessId() : null,
        kind,
        sub != null ? sub.getStatus() : SubscriptionStatus.TRIAL,
        planDto,
        sub != null ? sub.getValidFrom() : null,
        sub != null ? sub.getValidTo() : null,
        remaining,
        active,
        badge
    );
  }
}
