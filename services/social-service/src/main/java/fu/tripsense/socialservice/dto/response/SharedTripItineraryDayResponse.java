package fu.tripsense.socialservice.dto.response;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record SharedTripItineraryDayResponse(
        UUID id,
        LocalDate date,
        Integer dayNumber,
        List<SharedTripItineraryItemResponse> items
) {
}
