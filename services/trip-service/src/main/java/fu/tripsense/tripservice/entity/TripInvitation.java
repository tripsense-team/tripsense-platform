package fu.tripsense.tripservice.entity;

import fu.tripsense.tripservice.enums.TripInvitationStatus;
import fu.tripsense.tripservice.enums.TripMemberRole;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "trip_invitations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TripInvitation {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "trip_id", nullable = false)
  private Trip trip;

  @Column(name = "inviter_user_id", nullable = false)
  private UUID inviterUserId;

  @Column(name = "invitee_email", nullable = false)
  private String inviteeEmail;

  @Column(name = "invitee_user_id")
  private UUID inviteeUserId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  @Builder.Default
  private TripMemberRole role = TripMemberRole.EDITOR;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  @Builder.Default
  private TripInvitationStatus status = TripInvitationStatus.PENDING;

  @Column(name = "invitation_token", nullable = false, unique = true)
  private String invitationToken;

  @Column(columnDefinition = "TEXT")
  private String message;

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  void prePersist() {
    Instant now = Instant.now();
    createdAt = now;
    updatedAt = now;
    if (status == null) {
      status = TripInvitationStatus.PENDING;
    }
    if (role == null) {
      role = TripMemberRole.EDITOR;
    }
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = Instant.now();
  }
}
