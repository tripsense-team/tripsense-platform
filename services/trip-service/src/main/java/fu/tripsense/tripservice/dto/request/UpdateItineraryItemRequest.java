package fu.tripsense.tripservice.dto.request;

import fu.tripsense.tripservice.enums.ItineraryItemStatus;
import fu.tripsense.tripservice.enums.ItineraryItemType;
import jakarta.validation.constraints.*;

import java.time.LocalTime;
import java.util.UUID;

public record UpdateItineraryItemRequest(
        UUID placeId,
        ItineraryItemType type,
        @Size(max = 200) String title,
        LocalTime startTime,
        LocalTime endTime,
        @Min(1) @Max(1440) Integer durationMinutes,
        ItineraryItemStatus status,
        @Size(max = 5000) String notes,
        Long version
) {
}
