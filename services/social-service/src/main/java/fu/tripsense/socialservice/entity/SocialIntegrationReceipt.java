package fu.tripsense.socialservice.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "social_integration_receipt")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialIntegrationReceipt {

  @Id
  @Column(name = "event_id")
  private UUID eventId;

  @Column(nullable = false, length = 50)
  private String source;

  @Column(name = "payload_hash", nullable = false, length = 64)
  private String payloadHash;

  @Column(name = "source_promotion_id", nullable = false)
  private UUID sourcePromotionId;

  @Column(name = "applied_version", nullable = false)
  private Long appliedVersion;

  @Column(name = "received_at", nullable = false, updatable = false)
  @Builder.Default
  private Instant receivedAt = Instant.now();
}
