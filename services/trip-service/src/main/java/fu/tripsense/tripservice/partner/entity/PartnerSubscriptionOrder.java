package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.SubscriptionPaymentStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "partner_subscription_order")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerSubscriptionOrder {

  @Id
  private UUID id;

  @Column(name = "order_code", nullable = false, unique = true)
  private Long orderCode;

  @Column(name = "business_id", nullable = false)
  private UUID businessId;

  @Column(name = "plan_id", nullable = false, length = 50)
  private String planId;

  @Column(nullable = false, precision = 12, scale = 2)
  private BigDecimal amount;

  @Enumerated(EnumType.STRING)
  @Column(name = "payment_status", nullable = false, length = 30)
  @Builder.Default
  private SubscriptionPaymentStatus paymentStatus = SubscriptionPaymentStatus.PENDING;

  @Column(name = "payos_payment_link_id", length = 100)
  private String payosPaymentLinkId;

  @Column(name = "qr_code", columnDefinition = "text")
  private String qrCode;

  @Column(name = "payment_url", columnDefinition = "text")
  private String paymentUrl;

  @Column(name = "paid_at")
  private Instant paidAt;

  @Column(name = "created_at", nullable = false)
  @Builder.Default
  private Instant createdAt = Instant.now();

  @Column(name = "updated_at", nullable = false)
  @Builder.Default
  private Instant updatedAt = Instant.now();
}
