package fu.tripsense.socialservice.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TripSnapshotClientResponse(
        UUID tripId,
        String name,
        String destinationName,
        LocalDate startDate,
        LocalDate endDate,
        String coverImageUrl,
        Integer travelerCount,
        Integer dayCount,
        Integer itineraryItemCount,
        List<TripSnapshotHighlight> highlights,
        List<TripSnapshotItineraryDay> itineraryDays,
        String status,
        Instant updatedAt
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TripSnapshotHighlight(String title, String placeName, Integer dayNumber) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TripSnapshotItineraryDay(
            UUID id,
            LocalDate date,
            Integer dayNumber,
            List<TripSnapshotItineraryItem> items
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TripSnapshotItineraryItem(
            UUID id,
            UUID placeId,
            String title,
            String type,
            String startTime,
            String endTime,
            Integer durationMinutes,
            Integer sortOrder,
            String status,
            String notes,
            String placeName,
            String placeAddress,
            java.math.BigDecimal lat,
            java.math.BigDecimal lng,
            Integer dayNumber
    ) {}
}
