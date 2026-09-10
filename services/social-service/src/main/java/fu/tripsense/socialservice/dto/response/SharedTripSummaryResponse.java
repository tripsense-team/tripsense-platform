package fu.tripsense.socialservice.dto.response;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record SharedTripSummaryResponse(
        UUID tripId,
        String name,
        String destinationName,
        LocalDate startDate,
        LocalDate endDate,
        String coverImageUrl,
        Integer travelerCount,
        Integer dayCount,
        Integer itineraryItemCount,
        List<SharedTripHighlightResponse> highlights,
        List<SharedTripItineraryDayResponse> itineraryDays
) {
}
