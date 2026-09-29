package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "partner_checklist_result")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerChecklistResult {

  @EmbeddedId private ChecklistResultId id;

  @Column(nullable = false, length = 20)
  private String result; // PASS, FAIL, NEEDS_INFO

  @Column(length = 1000)
  private String reason;

  @Column(name = "actor_id", nullable = false)
  private UUID actorId;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @PrePersist
  void prePersist() {
    if (createdAt == null) createdAt = Instant.now();
  }
}
