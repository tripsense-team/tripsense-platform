package fu.tripsense.tripservice.dto.response;

import fu.tripsense.tripservice.enums.ItineraryItemStatus;
import fu.tripsense.tripservice.enums.ItineraryItemType;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.UUID;

public record TripShareItineraryItemResponse(
        UUID id,
        UUID placeId,
        String title,
        ItineraryItemType type,
        LocalTime startTime,
        LocalTime endTime,
        Integer durationMinutes,
        Integer sortOrder,
        ItineraryItemStatus status,
        String notes,
        String placeName,
        String placeAddress,
        BigDecimal lat,
        BigDecimal lng,
        Integer dayNumber
) {
}
