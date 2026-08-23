package fu.tripsense.tripservice.dto.response;

import fu.tripsense.tripservice.enums.ItineraryItemStatus;
import fu.tripsense.tripservice.enums.ItineraryItemType;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public record ItineraryItemResponse(
        UUID id,
        UUID dayId,
        UUID placeId,
        String title,
        ItineraryItemType type,
        LocalTime startTime,
        LocalTime endTime,
        Integer durationMinutes,
        Integer sortOrder,
        ItineraryItemStatus status,
        String notes,
        String placeNameSnapshot,
        String placeAddressSnapshot,
        BigDecimal latSnapshot,
        BigDecimal lngSnapshot,
        Long version,
        List<String> warnings
) implements Serializable {
}
