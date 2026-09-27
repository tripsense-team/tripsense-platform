package fu.tripsense.tripservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record ProposeDestinationRequest(
    UUID placeId,
    
    @NotBlank(message = "Destination name cannot be blank")
    String name
) {}
