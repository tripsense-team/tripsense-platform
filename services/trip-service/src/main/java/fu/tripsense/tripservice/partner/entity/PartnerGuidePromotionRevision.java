package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.ApplicationState;
import fu.tripsense.tripservice.partner.enums.IndicativePriceUnit;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "partner_guide_promotion_revision")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerGuidePromotionRevision {

  @Id private UUID id;

  @Column(name = "promotion_id", nullable = false)
  private UUID promotionId;

  @Column(name = "revision_number", nullable = false)
  private Integer revisionNumber;

  @Column(name = "approved_profile_revision_id", nullable = false)
  private UUID approvedProfileRevisionId;

  @Column(nullable = false, length = 200)
  private String title;

  @Column(nullable = false, columnDefinition = "text")
  private String summary;

  @Column(name = "area_id", nullable = false, length = 64)
  private String areaId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "topic_ids", nullable = false, columnDefinition = "jsonb")
  private List<String> topicIds;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "skill_ids", nullable = false, columnDefinition = "jsonb")
  private List<String> skillIds;

  @Column(name = "experience_duration", length = 100)
  private String experienceDuration;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private List<String> inclusions;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private List<String> exclusions;

  @Column(name = "indicative_price_amount", precision = 14, scale = 2)
  private BigDecimal indicativePriceAmount;

  @Column(name = "indicative_price_currency", length = 10)
  @Builder.Default
  private String indicativePriceCurrency = "VND";

  @Enumerated(EnumType.STRING)
  @Column(name = "indicative_price_unit", nullable = false, length = 32)
  private IndicativePriceUnit indicativePriceUnit;

  @Column(name = "cover_image_ref", length = 500)
  private String coverImageRef;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "gallery_image_refs", nullable = false, columnDefinition = "jsonb")
  private List<String> galleryImageRefs;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  @Builder.Default
  private ApplicationState state = ApplicationState.DRAFT;

  @Column(name = "review_decision_reason", columnDefinition = "text")
  private String reviewDecisionReason;

  @Column(name = "reviewed_by")
  private UUID reviewedBy;

  @Column(name = "reviewed_at")
  private Instant reviewedAt;

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
