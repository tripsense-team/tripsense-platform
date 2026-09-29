package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "partner_outbox")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerOutbox {

  @Id private UUID id;

  @Column(name = "event_id", nullable = false, unique = true)
  private UUID eventId;

  @Column(name = "aggregate_type", nullable = false, length = 50)
  private String aggregateType;

  @Column(name = "aggregate_id", nullable = false)
  private UUID aggregateId;

  @Column(name = "event_type", nullable = false, length = 60)
  private String eventType;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private Map<String, Object> payload;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "processed_at")
  private Instant processedAt;

  @Column(nullable = false)
  @Builder.Default
  private Integer attempts = 0;

  @Column(name = "next_attempt", nullable = false)
  private Instant nextAttempt;

  @Column(name = "dead_letter", nullable = false)
  @Builder.Default
  private boolean deadLetter = false;

  @Column(name = "last_error", length = 100)
  private String lastError;

  @PrePersist
  void prePersist() {
    if (id == null) id = UUID.randomUUID();
    if (eventId == null) eventId = UUID.randomUUID();
    Instant now = Instant.now();
    if (createdAt == null) createdAt = now;
    if (nextAttempt == null) nextAttempt = now;
  }
}
