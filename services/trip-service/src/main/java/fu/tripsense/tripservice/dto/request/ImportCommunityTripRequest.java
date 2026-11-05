package fu.tripsense.tripservice.dto.request;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record ImportCommunityTripRequest(
    @NotBlank @Size(max = 160) String name,
    @NotNull LocalDate startDate,
    @NotNull LocalDate endDate) {}
