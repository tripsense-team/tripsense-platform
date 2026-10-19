package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "restaurant_reservation_request")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RestaurantReservation {

  @Id private UUID id;

  @Column(name = "business_id", nullable = false)
  private UUID businessId;

  @Column(name = "customer_id", nullable = false)
  private UUID customerId;

  @Column(name = "customer_email", length = 160)
  private String customerEmail;

  @Column(name = "customer_name", length = 120)
  private String customerName;

  @Column(name = "business_name_snapshot", nullable = false, length = 160)
  private String businessNameSnapshot;

  @Column(name = "start_at", nullable = false)
  private Instant startAt;

  @Column(name = "ends_at")
  private Instant endsAt;

  @Column(name = "hold_expires_at")
  private Instant holdExpiresAt;

  @Column(name = "time_zone", nullable = false, length = 80)
  private String timeZone;

  @Column(nullable = false)
  private int adults;

  @Column(nullable = false)
  private int children;

  @Column(length = 1000)
  private String notes;

  @Column(nullable = false, length = 16)
  private String state;

  @Column(name = "cancellation_reason", length = 500)
  private String cancellationReason;

  @Column(name = "decision_reason", length = 500)
  private String decisionReason;

  @Column(name = "request_key", length = 100)
  private String requestKey;

  @Column(name = "request_hash", length = 64)
  private String requestHash;

  @Version
  @Column(nullable = false)
  private Long version;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  void prePersist() {
    if (id == null) id = UUID.randomUUID();
    Instant now = Instant.now();
    if (createdAt == null) createdAt = now;
    if (updatedAt == null) updatedAt = now;
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = Instant.now();
  }
}
