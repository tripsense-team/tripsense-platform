package fu.tripsense.socialservice.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "social_trip_shares")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialTripShare {

    @Id
    @Column(name = "post_id")
    private UUID postId;

    @Column(name = "author_id", nullable = false)
    private UUID authorId;

    @Column(name = "source_trip_id", nullable = false)
    private UUID sourceTripId;

    @Column(nullable = false, length = 32)
    private String visibility;

    @Column(name = "trip_name", nullable = false)
    private String tripName;

    @Column(name = "destination_name")
    private String destinationName;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "cover_image_url")
    private String coverImageUrl;

    @Column(name = "traveler_count")
    private Integer travelerCount;

    @Column(name = "day_count")
    private Integer dayCount;

    @Column(name = "itinerary_item_count")
    private Integer itineraryItemCount;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "highlights_json", columnDefinition = "jsonb")
    private String highlightsJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "itinerary_json", columnDefinition = "jsonb")
    private String itineraryJson;

    @Column(name = "snapshot_created_at", nullable = false)
    private Instant snapshotCreatedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "removed_at")
    private Instant removedAt;
}
