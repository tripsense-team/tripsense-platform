package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "restaurant_reservation_transition")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RestaurantReservationTransition {

  @Id private UUID id;

  @Column(name = "reservation_id", nullable = false)
  private UUID reservationId;

  @Column(name = "actor_id", nullable = false)
  private UUID actorId;

  @Column(name = "actor_role", nullable = false, length = 20)
  private String actorRole;

  @Column(name = "from_state", nullable = false, length = 16)
  private String fromState;

  @Column(name = "to_state", nullable = false, length = 16)
  private String toState;

  @Column(length = 500)
  private String reason;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @PrePersist
  void prePersist() {
    if (id == null) id = UUID.randomUUID();
    if (createdAt == null) createdAt = Instant.now();
  }
}
