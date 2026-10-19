package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import lombok.Builder;

@Builder
public record UpdateRestaurantAvailabilityRequest(
    Long expectedVersion,
    @NotBlank String timeZone,
    @Min(1) @Max(500) int capacityGuests,
    @Min(15) @Max(480) int reservationDurationMinutes,
    @Min(5) @Max(240) int slotIntervalMinutes,
    @Min(0) int minimumLeadMinutes,
    @Min(1) @Max(365) int maximumAdvanceDays,
    @Min(5) @Max(1440) int pendingHoldMinutes,
    @NotNull @Valid List<OpeningIntervalDto> openingIntervals
) {}
