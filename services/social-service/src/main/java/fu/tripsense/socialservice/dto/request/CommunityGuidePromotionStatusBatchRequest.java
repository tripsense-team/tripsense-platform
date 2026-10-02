package fu.tripsense.socialservice.dto.request;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.UUID;

public record CommunityGuidePromotionStatusBatchRequest(
    @NotEmpty List<UUID> promotionIds
) {}
