package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.ApprovalValidity;
import fu.tripsense.tripservice.partner.enums.BusinessKind;
import fu.tripsense.tripservice.partner.enums.OperationState;
import fu.tripsense.tripservice.partner.enums.PublicationState;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "partner_business")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerBusiness {

  @Id private UUID id;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private BusinessKind kind;

  @Column(name = "owner_user_id", nullable = false)
  private UUID ownerUserId;

  @Column(name = "display_name", nullable = false)
  private String displayName;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "draft_profile_json", columnDefinition = "jsonb")
  private Map<String, Object> draftProfileJson;

  @Column(name = "draft_schema_version", nullable = false)
  @Builder.Default
  private Integer draftSchemaVersion = 1;

  @Enumerated(EnumType.STRING)
  @Column(name = "approval_validity", nullable = false, length = 20)
  @Builder.Default
  private ApprovalValidity approvalValidity = ApprovalValidity.NONE;

  @Enumerated(EnumType.STRING)
  @Column(name = "operation_state", nullable = false, length = 20)
  @Builder.Default
  private OperationState operationState = OperationState.ACTIVE;

  @Enumerated(EnumType.STRING)
  @Column(name = "publication_state", nullable = false, length = 20)
  @Builder.Default
  private PublicationState publicationState = PublicationState.HIDDEN;

  @Column(name = "accepting_new", nullable = false)
  @Builder.Default
  private boolean acceptingNew = false;

  @Column(name = "requires_reverification", nullable = false)
  @Builder.Default
  private boolean requiresReverification = false;

  @Column(name = "reverification_application_id")
  private UUID reverificationApplicationId;

  @Column(name = "suspension_version", nullable = false)
  @Builder.Default
  private int suspensionVersion = 0;

  @Column(name = "suspended_at")
  private Instant suspendedAt;

  @Column(name = "reinstated_at")
  private Instant reinstatedAt;

  @Column(name = "approved_revision_id")
  private UUID approvedRevisionId;

  @Version
  @Column(nullable = false)
  @Builder.Default
  private Long version = 0L;

  @Column(name = "contact_consent_version", length = 50)
  private String contactConsentVersion;

  @Column(name = "public_contact_consent", nullable = false)
  @Builder.Default
  private boolean publicContactConsent = false;

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

  public boolean canPublish(boolean hasValidListingCapability) {
    return approvalValidity == ApprovalValidity.VALID
        && approvedRevisionId != null
        && !requiresReverification
        && operationState == OperationState.ACTIVE
        && hasValidListingCapability;
  }

  public boolean isPublicEligible(boolean hasValidListingCapability) {
    return canPublish(hasValidListingCapability)
        && publicationState == PublicationState.PUBLISHED;
  }

  public boolean isNewIntakeEligible(
      boolean publicEligible, boolean hasValidIntakeCapability, boolean isReadinessMet) {
    return publicEligible
        && acceptingNew
        && hasValidIntakeCapability
        && isReadinessMet
        && !requiresReverification;
  }
}
