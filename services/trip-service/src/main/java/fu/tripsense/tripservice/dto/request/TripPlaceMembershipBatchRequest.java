package fu.tripsense.tripservice.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record TripPlaceMembershipBatchRequest(
    @NotEmpty @Size(max = 100) List<@Size(min = 1, max = 200) String> placeRefs) {}
