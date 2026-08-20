package fu.tripsense.tripservice.dto.response;

import fu.tripsense.tripservice.enums.DisplayStatus;
import fu.tripsense.tripservice.enums.TripStatus;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record TripResponse(
        UUID id,
        String name,
        String destinationName,
        UUID destinationPlaceId,
        LocalDate startDate,
        LocalDate endDate,
        TripStatus status,
        DisplayStatus displayStatus,
        UUID ownerId,
        Integer travelerCount,
        BigDecimal budgetAmount,
        String budgetCurrency,
        String notes,
        String coverImageUrl,
        Long version,
        Instant createdAt,
        Instant updatedAt
) implements Serializable {
}
