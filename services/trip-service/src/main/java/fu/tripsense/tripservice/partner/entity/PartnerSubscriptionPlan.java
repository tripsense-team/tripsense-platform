package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.BusinessKind;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "partner_subscription_plan")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerSubscriptionPlan {

  @Id
  @Column(name = "plan_id", length = 50)
  private String planId;

  @Enumerated(EnumType.STRING)
  @Column(name = "business_kind", nullable = false, length = 30)
  private BusinessKind businessKind;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(name = "duration_days", nullable = false)
  private int durationDays;

  @Column(name = "price_vnd", nullable = false, precision = 12, scale = 2)
  private BigDecimal priceVnd;

  @Column(name = "original_price_vnd", precision = 12, scale = 2)
  private BigDecimal originalPriceVnd;

  @Column(name = "discount_percent")
  @Builder.Default
  private Integer discountPercent = 0;

  @Column(length = 255)
  private String tagline;

  @Column(name = "badge_label", length = 50)
  private String badgeLabel;

  @Column(name = "is_active", nullable = false)
  @Builder.Default
  private boolean active = true;

  @Column(name = "display_order")
  @Builder.Default
  private int displayOrder = 0;

  @Column(name = "created_at", nullable = false)
  @Builder.Default
  private Instant createdAt = Instant.now();
}
