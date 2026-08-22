package fu.tripsense.tripservice.dto.request;

import fu.tripsense.tripservice.enums.ItineraryItemType;
import jakarta.validation.constraints.*;

import java.time.LocalTime;
import java.util.UUID;

public record CreateItineraryItemRequest(
        UUID placeId,
        @NotNull ItineraryItemType type,
        @NotBlank @Size(max = 200) String title,
        LocalTime startTime,
        LocalTime endTime,
        @Min(1) @Max(1440) Integer durationMinutes,
        @Size(max = 5000) String notes
) {
}
