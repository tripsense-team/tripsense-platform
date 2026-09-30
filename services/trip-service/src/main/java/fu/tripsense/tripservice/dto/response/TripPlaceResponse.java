package fu.tripsense.tripservice.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TripPlaceResponse(
    UUID id,
    UUID tripId,
    String placeRef,
    String placeNameSnapshot,
    String placeAddressSnapshot,
    BigDecimal latSnapshot,
    BigDecimal lngSnapshot,
    Instant addedAt,
    Long version) {}
