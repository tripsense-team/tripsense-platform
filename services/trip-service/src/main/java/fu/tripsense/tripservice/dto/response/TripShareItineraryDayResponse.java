package fu.tripsense.tripservice.dto.response;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record TripShareItineraryDayResponse(
        UUID id,
        LocalDate date,
        Integer dayNumber,
        List<TripShareItineraryItemResponse> items
) {
}
