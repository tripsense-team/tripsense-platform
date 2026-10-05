package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.PromotionMediaState;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "partner_guide_promotion_media")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerGuidePromotionMedia {

  @Id private UUID id;

  @Column(name = "business_id", nullable = false)
  private UUID businessId;

  @Column(name = "promotion_id")
  private UUID promotionId;

  @Column(name = "object_key", nullable = false, length = 500)
  private String objectKey;

  @Column(name = "mime_type", nullable = false, length = 100)
  private String mimeType;

  @Column(name = "file_size", nullable = false)
  private Long fileSize;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  @Builder.Default
  private PromotionMediaState state = PromotionMediaState.PENDING_UPLOAD;

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
