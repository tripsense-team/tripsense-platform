package fu.tripsense.tripservice.dto.response;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ItineraryDayResponse(
        UUID id,
        LocalDate date,
        Integer dayNumber,
        Long version,
        List<ItineraryItemResponse> items
) implements Serializable {
}
