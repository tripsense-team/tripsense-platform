package fu.tripsense.tripservice.dto.request;

import fu.tripsense.tripservice.enums.ItineraryItemStatus;
import fu.tripsense.tripservice.enums.ItineraryItemType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public record ItineraryBatchOperation(
        @Pattern(regexp = "ADD|UPDATE|DELETE|REORDER") String type,
        UUID dayId,
        UUID itemId,
        Long expectedItemVersion,
        @Pattern(regexp = "^[A-Za-z0-9._:-]{1,200}$") String placeRef,
        @Size(max = 200) String title,
        ItineraryItemType itemType,
        LocalTime startTime,
        LocalTime endTime,
        @Min(1) @Max(1440) Integer durationMinutes,
        Integer sortOrder,
        ItineraryItemStatus status,
        @Size(max = 5000) String notes,
        @Size(max = 200) List<UUID> orderedItemIds
) {
}
