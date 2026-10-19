package fu.tripsense.tripservice.partner.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.Builder;

@Builder
public record RestaurantAvailabilityDto(
    UUID businessId,
    String timeZone,
    int capacityGuests,
    int reservationDurationMinutes,
    int slotIntervalMinutes,
    int minimumLeadMinutes,
    int maximumAdvanceDays,
    int pendingHoldMinutes,
    Long version,
    Instant updatedAt,
    List<OpeningIntervalDto> openingIntervals
) {}
