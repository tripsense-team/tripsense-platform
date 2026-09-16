package fu.tripsense.socialservice.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateTripShareRequest(
        @NotNull(message = "tripId is required")
        UUID tripId,

        @Size(max = 5000, message = "caption must be at most 5000 characters")
        String caption,

        String visibility
) {
}
