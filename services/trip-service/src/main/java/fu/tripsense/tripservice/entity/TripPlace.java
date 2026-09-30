package fu.tripsense.tripservice.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(
    name = "trip_places",
    uniqueConstraints = @UniqueConstraint(name = "uq_trip_places_trip_ref", columnNames = {"trip_id", "place_ref"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TripPlace {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(name = "trip_id", nullable = false)
  private UUID tripId;

  @Column(name = "place_ref", nullable = false, length = 200)
  private String placeRef;

  @Column(name = "place_name_snapshot", nullable = false, length = 255)
  private String placeNameSnapshot;

  @Column(name = "place_address_snapshot", length = 512)
  private String placeAddressSnapshot;

  @Column(name = "lat_snapshot", precision = 10, scale = 7)
  private BigDecimal latSnapshot;

  @Column(name = "lng_snapshot", precision = 10, scale = 7)
  private BigDecimal lngSnapshot;

  @Column(name = "added_by_user_id", nullable = false)
  private UUID addedByUserId;

  @Version private Long version;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  void prePersist() {
    Instant now = Instant.now();
    createdAt = now;
    updatedAt = now;
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = Instant.now();
  }
}
