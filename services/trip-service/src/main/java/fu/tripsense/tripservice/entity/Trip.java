package fu.tripsense.tripservice.entity;

import fu.tripsense.tripservice.enums.TripStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "trips")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Trip {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "owner_user_id", nullable = false)
    private UUID ownerUserId;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(name = "destination_name", nullable = false)
    private String destinationName;

    @Column(name = "destination_place_id")
    private UUID destinationPlaceId;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private TripStatus status;

    @Column(name = "traveler_count")
    private Integer travelerCount;

    @Column(name = "budget_amount", precision = 14, scale = 2)
    private BigDecimal budgetAmount;

    @Column(name = "budget_currency", length = 3)
    private String budgetCurrency;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "cover_image_url", columnDefinition = "TEXT")
    private String coverImageUrl;

    @Version
    private Long version;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

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
            status = TripStatus.DRAFT;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
