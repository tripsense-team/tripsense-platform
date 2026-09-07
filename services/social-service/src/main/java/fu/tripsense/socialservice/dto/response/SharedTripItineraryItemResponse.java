package fu.tripsense.socialservice.dto.response;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.UUID;

public record SharedTripItineraryItemResponse(
        UUID id,
        UUID placeId,
        String title,
        String type,
        LocalTime startTime,
        LocalTime endTime,
        Integer durationMinutes,
        Integer sortOrder,
        String status,
        String notes,
        String placeName,
        String placeAddress,
        BigDecimal lat,
        BigDecimal lng,
        Integer dayNumber
) {
}
