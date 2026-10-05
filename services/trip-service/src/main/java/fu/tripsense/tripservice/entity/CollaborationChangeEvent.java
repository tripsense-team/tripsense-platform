package fu.tripsense.tripservice.entity;

import fu.tripsense.tripservice.enums.CollaborationChangeType;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(
    name = "collaboration_change_events",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_collaboration_event_trip_revision",
            columnNames = {"trip_id", "revision"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CollaborationChangeEvent {

  @Id
  @Column(name = "event_id")
  private UUID eventId;

  @Column(name = "trip_id", nullable = false)
  private UUID tripId;

  @Column(nullable = false)
  private Long revision;

  @Enumerated(EnumType.STRING)
  @Column(name = "event_type", nullable = false, length = 40)
  private CollaborationChangeType eventType;

  @Column(name = "actor_user_id", nullable = false)
  private UUID actorUserId;

  @Column(name = "schema_version", nullable = false)
  private Short schemaVersion;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private Map<String, Object> payload;

  @Column(name = "occurred_at", nullable = false)
  private Instant occurredAt;

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @PrePersist
  void prePersist() {
    if (eventId == null) eventId = UUID.randomUUID();
    if (schemaVersion == null) schemaVersion = (short) 1;
    if (occurredAt == null) occurredAt = Instant.now();
  }
}
