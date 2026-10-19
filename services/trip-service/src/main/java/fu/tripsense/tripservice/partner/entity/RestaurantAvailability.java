package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "restaurant_availability")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RestaurantAvailability {

  @Id
  @Column(name = "business_id", nullable = false)
  private UUID businessId;

  @Column(name = "time_zone", nullable = false, length = 80)
  private String timeZone;

  @Column(name = "capacity_guests", nullable = false)
  private int capacityGuests;

  @Column(name = "reservation_duration_minutes", nullable = false)
  private int reservationDurationMinutes;

  @Column(name = "slot_interval_minutes", nullable = false)
  private int slotIntervalMinutes;

  @Column(name = "minimum_lead_minutes", nullable = false)
  private int minimumLeadMinutes;

  @Column(name = "maximum_advance_days", nullable = false)
  private int maximumAdvanceDays;

  @Column(name = "pending_hold_minutes", nullable = false)
  private int pendingHoldMinutes;

  @Version
  @Column(nullable = false)
  @Builder.Default
  private Long version = 0L;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  @PreUpdate
  void onSave() {
    updatedAt = Instant.now();
  }
}
