package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "partner_review_audit")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerReviewAudit {

  @Id private UUID id;

  @Column(name = "business_id", nullable = false)
  private UUID businessId;

  @Column(name = "application_id")
  private UUID applicationId;

  @Column(name = "actor_id", nullable = false)
  private UUID actorId;

  @Column(nullable = false, length = 50)
  private String action;

  @Column(length = 2000)
  private String reason;

  @Column(name = "from_state", length = 50)
  private String fromState;

  @Column(name = "to_state", length = 50)
  private String toState;

  @Column(name = "business_version", nullable = false)
  private Long businessVersion;

  @Column(name = "occurred_at", nullable = false)
  private Instant occurredAt;

  @PrePersist
  void prePersist() {
    if (id == null) id = UUID.randomUUID();
    if (occurredAt == null) occurredAt = Instant.now();
  }
}
