package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record InternalGuideSummaryBatchRequest(
    @NotEmpty @Size(max = 50) List<UUID> promotionIds
) {}
