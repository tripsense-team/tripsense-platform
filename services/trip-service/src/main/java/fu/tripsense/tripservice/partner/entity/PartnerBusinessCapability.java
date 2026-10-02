package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "partner_business_capability")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerBusinessCapability {

  @EmbeddedId private PartnerBusinessCapabilityId id;

  @Column(name = "application_id")
  private UUID applicationId;

  @Column(name = "granted_at", nullable = false)
  private Instant grantedAt;

  @Column(name = "granted_by", nullable = false)
  private UUID grantedBy;

  @Column(name = "expires_at")
  private Instant expiresAt;

  @Column(name = "revoked_at")
  private Instant revokedAt;

  @PrePersist
  void prePersist() {
    if (grantedAt == null) grantedAt = Instant.now();
  }

  public boolean isActive() {
    if (revokedAt != null) return false;
    if (expiresAt != null && expiresAt.isBefore(Instant.now())) return false;
    return true;
  }
}
