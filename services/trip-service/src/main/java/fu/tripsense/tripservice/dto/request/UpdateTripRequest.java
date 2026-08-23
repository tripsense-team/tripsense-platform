package fu.tripsense.tripservice.dto.request;

import fu.tripsense.tripservice.enums.DateChangePolicy;
import fu.tripsense.tripservice.enums.TripStatus;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record UpdateTripRequest(
        @Size(max = 160) String name,
        @Size(max = 255) String destinationName,
        UUID destinationPlaceId,
        LocalDate startDate,
        LocalDate endDate,
        DateChangePolicy dateChangePolicy,
        TripStatus status,
        @Min(1) @Max(100) Integer travelerCount,
        @DecimalMin("0.0") BigDecimal budgetAmount,
        @Pattern(regexp = "^[A-Z]{3}$", message = "budgetCurrency must be a 3-letter uppercase currency code") String budgetCurrency,
        @Size(max = 5000) String notes,
        @Size(max = 2000000) String coverImageUrl
) {
}
