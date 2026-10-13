package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.*;
import java.time.Instant;

public record CreateRestaurantReservationRequest(
    @NotNull Instant startAt,
    @NotBlank @Size(max = 80) String timeZone,
    @Min(1) @Max(20) int adults,
    @Min(0) @Max(20) int children,
    @Size(max = 1000) String notes
) {}
