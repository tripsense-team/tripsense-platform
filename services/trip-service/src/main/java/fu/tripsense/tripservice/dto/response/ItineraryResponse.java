package fu.tripsense.tripservice.dto.response;

import java.io.Serializable;
import java.util.List;
import java.util.UUID;

public record ItineraryResponse(
    UUID tripId,
    long revision,
    ItineraryCapabilitiesResponse capabilities,
    List<ItineraryDayResponse> days)
    implements Serializable {
  public ItineraryResponse(UUID tripId, List<ItineraryDayResponse> days) {
    this(tripId, 0L, new ItineraryCapabilitiesResponse(true, true, true), days);
  }
}
