package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.GuideProposalState;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "guide_proposal")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GuideProposal {

  @Id private UUID id;

  @Column(name = "inquiry_id", nullable = false)
  private UUID inquiryId;

  @Column(name = "revision", nullable = false)
  private Integer revision;

  @Column(name = "requirements_revision", nullable = false)
  private Integer requirementsRevision;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "proposal_data", nullable = false, columnDefinition = "jsonb")
  private String proposalData;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "guide_consent_snapshot", nullable = false, columnDefinition = "jsonb")
  private String guideConsentSnapshot;

  @Column(name = "author_id", nullable = false)
  private UUID authorId;

  @Column(name = "valid_until", nullable = false)
  private Instant validUntil;

  @Enumerated(EnumType.STRING)
  @Column(name = "state", nullable = false, length = 32)
  @Builder.Default
  private GuideProposalState state = GuideProposalState.PENDING;

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
