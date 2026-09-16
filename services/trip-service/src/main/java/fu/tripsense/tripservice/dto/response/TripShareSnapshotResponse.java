package fu.tripsense.tripservice.dto.response;

import fu.tripsense.tripservice.enums.TripStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record TripShareSnapshotResponse(
        UUID tripId,
        String name,
        String destinationName,
        LocalDate startDate,
        LocalDate endDate,
        String coverImageUrl,
        Integer travelerCount,
        Integer dayCount,
        Integer itineraryItemCount,
        List<TripShareHighlightResponse> highlights,
        List<TripShareItineraryDayResponse> itineraryDays,
        TripStatus status,
        Instant updatedAt
) {
}
