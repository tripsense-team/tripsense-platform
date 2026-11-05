package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.SubscriptionStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "partner_subscription")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerSubscription {

  @Id
  private UUID id;

  @Column(name = "business_id", nullable = false, unique = true)
  private UUID businessId;

  @Column(name = "current_plan_id", length = 50)
  private String currentPlanId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  @Builder.Default
  private SubscriptionStatus status = SubscriptionStatus.TRIAL;

  @Column(name = "valid_from")
  private Instant validFrom;

  @Column(name = "valid_to")
  private Instant validTo;

  @Column(name = "last_payment_at")
  private Instant lastPaymentAt;

  @Column(name = "created_at", nullable = false)
  @Builder.Default
  private Instant createdAt = Instant.now();

  @Column(name = "updated_at", nullable = false)
  @Builder.Default
  private Instant updatedAt = Instant.now();
}
