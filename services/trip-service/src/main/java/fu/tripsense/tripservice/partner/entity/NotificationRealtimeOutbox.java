package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "notification_realtime_outbox")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationRealtimeOutbox {

  @Id
  private UUID id;

  @Column(name = "notification_id", nullable = false, unique = true)
  private UUID notificationId;

  @Column(name = "recipient_id", nullable = false)
  private UUID recipientId;

  @Column(name = "event_type", nullable = false, length = 60)
  private String eventType;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "published_at")
  private Instant publishedAt;

  @Column(nullable = false)
  @Builder.Default
  private int attempts = 0;

  @Column(name = "next_attempt_at", nullable = false)
  private Instant nextAttemptAt;

  @Column(name = "lease_until")
  private Instant leaseUntil;

  @Column(name = "lease_token")
  private UUID leaseToken;

  @Column(name = "last_error_code", length = 60)
  private String lastErrorCode;

  @PrePersist
  void prePersist() {
    if (id == null) id = UUID.randomUUID();
    Instant now = Instant.now();
    if (createdAt == null) createdAt = now;
    if (nextAttemptAt == null) nextAttemptAt = now;
  }
}
