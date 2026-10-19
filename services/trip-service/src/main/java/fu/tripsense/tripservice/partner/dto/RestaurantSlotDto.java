package fu.tripsense.tripservice.partner.dto;

import java.time.Instant;
import lombok.Builder;

@Builder
public record RestaurantSlotDto(
    Instant startsAt,
    Instant endsAt,
    boolean available
) {}
