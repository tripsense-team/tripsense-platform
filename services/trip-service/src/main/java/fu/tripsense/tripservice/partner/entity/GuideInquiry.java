package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.GuideInquiryState;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "guide_inquiry")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GuideInquiry {

  @Id private UUID id;

  @Column(name = "guide_business_id", nullable = false)
  private UUID guideBusinessId;

  @Column(name = "customer_id", nullable = false)
  private UUID customerId;

  @Column(name = "source_promotion_id")
  private UUID sourcePromotionId;

  @Column(name = "source_community_post_id")
  private UUID sourceCommunityPostId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "source_revision_snapshot", nullable = false, columnDefinition = "jsonb")
  private String sourceRevisionSnapshot;

  @Enumerated(EnumType.STRING)
  @Column(name = "state", nullable = false, length = 30)
  @Builder.Default
  private GuideInquiryState state = GuideInquiryState.SUBMITTED;

  @Version
  @Column(nullable = false)
  @Builder.Default
  private Long version = 0L;

  @Column(name = "bound_suspension_version", nullable = false)
  @Builder.Default
  private Integer boundSuspensionVersion = 0;

  @Column(name = "current_requirements_revision", nullable = false)
  @Builder.Default
  private Integer currentRequirementsRevision = 1;

  @Column(name = "current_proposal_id")
  private UUID currentProposalId;

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @Column(name = "close_reason", length = 500)
  private String closeReason;

  @Column(name = "created_at", nullable = false, updatable = false)
  @Builder.Default
  private Instant createdAt = Instant.now();

  @Column(name = "updated_at", nullable = false)
  @Builder.Default
  private Instant updatedAt = Instant.now();

  @PreUpdate
  public void preUpdate() {
    this.updatedAt = Instant.now();
  }
}
