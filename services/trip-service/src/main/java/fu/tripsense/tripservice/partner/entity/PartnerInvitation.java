package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.InvitationState;
import fu.tripsense.tripservice.partner.enums.MembershipRole;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "partner_invitation")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerInvitation {

  @Id private UUID id;

  @Column(name = "business_id", nullable = false)
  private UUID businessId;

  @Column(name = "recipient_email", nullable = false)
  private String recipientEmail;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private MembershipRole role;

  @Column(name = "token_hash", nullable = false, unique = true)
  private String tokenHash;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  @Builder.Default
  private InvitationState state = InvitationState.PENDING;

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @PrePersist
  void prePersist() {
    if (id == null) id = UUID.randomUUID();
    if (createdAt == null) createdAt = Instant.now();
  }

  public boolean isExpired() {
    return expiresAt.isBefore(Instant.now());
  }
}
