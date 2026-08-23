package fu.tripsense.tripservice.entity;

import fu.tripsense.tripservice.enums.ItineraryItemStatus;
import fu.tripsense.tripservice.enums.ItineraryItemType;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "itinerary_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ItineraryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "day_id", nullable = false)
    private UUID dayId;

    @Column(name = "place_id")
    private UUID placeId;

    @Column(nullable = false, length = 200)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false, length = 32)
    private ItineraryItemType type;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ItineraryItemStatus status;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "place_name_snapshot")
    private String placeNameSnapshot;

    @Column(name = "place_address_snapshot", length = 512)
    private String placeAddressSnapshot;

    @Column(name = "lat_snapshot", precision = 10, scale = 7)
    private BigDecimal latSnapshot;

    @Column(name = "lng_snapshot", precision = 10, scale = 7)
    private BigDecimal lngSnapshot;

    @Version
    private Long version;

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
            status = ItineraryItemStatus.PLANNED;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
