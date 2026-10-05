package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.PublicationState;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "partner_guide_promotion")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerGuidePromotion {

  @Id private UUID id;

  @Column(name = "business_id", nullable = false)
  private UUID businessId;

  @Column(name = "approved_revision_id")
  private UUID approvedRevisionId;

  @Enumerated(EnumType.STRING)
  @Column(name = "publication_state", nullable = false, length = 32)
  @Builder.Default
  private PublicationState publicationState = PublicationState.HIDDEN;

  @Column(name = "community_enabled", nullable = false)
  @Builder.Default
  private boolean communityEnabled = false;

  @Column(name = "community_post_id")
  private UUID communityPostId;

  @Column(name = "distribution_version", nullable = false)
  @Builder.Default
  private Long distributionVersion = 0L;

  @Version
  @Column(nullable = false)
  @Builder.Default
  private Long version = 0L;

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
