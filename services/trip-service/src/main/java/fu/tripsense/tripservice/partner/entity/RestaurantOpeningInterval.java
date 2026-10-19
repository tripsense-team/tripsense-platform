package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.*;
import java.time.LocalTime;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "restaurant_opening_interval")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RestaurantOpeningInterval {

  @Id
  private UUID id;

  @Column(name = "business_id", nullable = false)
  private UUID businessId;

  @Column(name = "day_of_week", nullable = false)
  private int dayOfWeek;

  @Column(name = "opens_at", nullable = false)
  private LocalTime opensAt;

  @Column(name = "closes_at", nullable = false)
  private LocalTime closesAt;

  @PrePersist
  void prePersist() {
    if (id == null) {
      id = UUID.randomUUID();
    }
  }
}
