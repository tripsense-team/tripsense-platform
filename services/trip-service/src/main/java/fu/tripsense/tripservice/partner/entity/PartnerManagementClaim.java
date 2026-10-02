package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.ManagementClaimState;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "partner_management_claim")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerManagementClaim {

  @Id private UUID id;

  @Column(name = "applicant_user_id", nullable = false)
  private UUID applicantUserId;

  @Column(name = "target_business_id", nullable = false)
  private UUID targetBusinessId;

  @Column(nullable = false, length = 2000)
  private String reason;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  @Builder.Default
  private ManagementClaimState state = ManagementClaimState.SUBMITTED;

  @Version
  @Column(nullable = false)
  @Builder.Default
  private Long version = 0L;

  @Column(name = "decision_outcome", length = 50)
  private String decisionOutcome;

  @Column(name = "decision_reason", length = 2000)
  private String decisionReason;

  @Column(name = "decided_by")
  private UUID decidedBy;

  @Column(name = "decided_at")
  private Instant decidedAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  void prePersist() {
    if (id == null) id = UUID.randomUUID();
    Instant now = Instant.now();
    if (createdAt == null) createdAt = now;
    if (updatedAt == null) updatedAt = now;
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = Instant.now();
  }
}
