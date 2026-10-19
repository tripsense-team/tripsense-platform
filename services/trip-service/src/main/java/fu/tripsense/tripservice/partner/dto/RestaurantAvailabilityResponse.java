package fu.tripsense.tripservice.partner.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.Builder;

@Builder
public record RestaurantAvailabilityResponse(
    UUID businessId,
    LocalDate date,
    String timeZone,
    int partySize,
    List<RestaurantSlotDto> slots
) {}
