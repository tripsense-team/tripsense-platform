package fu.tripsense.tripservice.dto.response;

import java.io.Serializable;
import java.util.List;
import java.util.UUID;

public record ItineraryResponse(
        UUID tripId,
        List<ItineraryDayResponse> days
) implements Serializable {
}
