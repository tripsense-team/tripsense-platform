package fu.tripsense.socialservice.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "social_guide_promotion")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialGuidePromotion {

  @Id
  @Column(name = "post_id")
  private UUID postId;

  @Column(name = "source_promotion_id", nullable = false, unique = true)
  private UUID sourcePromotionId;

  @Column(name = "source_business_id", nullable = false)
  private UUID sourceBusinessId;

  @Column(name = "source_owner_id", nullable = false)
  private UUID sourceOwnerId;

  @Column(name = "approved_revision_id", nullable = false)
  private UUID approvedRevisionId;

  @Column(name = "distribution_version", nullable = false)
  @Builder.Default
  private Long distributionVersion = 1L;

  @Column(name = "distribution_enabled", nullable = false)
  @Builder.Default
  private boolean distributionEnabled = true;

  @Column(name = "removed_at")
  private Instant removedAt;

  @Column(name = "removal_reason", length = 500)
  private String removalReason;

  @Column(name = "removed_by")
  private UUID removedBy;

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
