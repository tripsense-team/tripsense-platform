package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.ContactConsentState;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "partner_inquiry_contact_consent")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerInquiryContactConsent {

  @EmbeddedId private PartnerInquiryContactConsentId id;

  @Column(name = "grantee_user_id", nullable = false)
  private UUID granteeUserId;

  @Enumerated(EnumType.STRING)
  @Column(name = "state", nullable = false, length = 20)
  @Builder.Default
  private ContactConsentState state = ContactConsentState.ACTIVE;

  @Column(name = "consented_at", nullable = false, updatable = false)
  @Builder.Default
  private Instant consentedAt = Instant.now();

  @Column(name = "revoked_at")
  private Instant revokedAt;

  @Column(name = "revoked_reason", length = 500)
  private String revokedReason;
}
