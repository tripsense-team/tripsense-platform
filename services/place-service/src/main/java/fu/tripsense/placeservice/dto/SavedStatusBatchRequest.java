package fu.tripsense.placeservice.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record SavedStatusBatchRequest(
    @NotEmpty @Size(max = 100) List<@Size(min = 1, max = 200) String> placeRefs) {}
