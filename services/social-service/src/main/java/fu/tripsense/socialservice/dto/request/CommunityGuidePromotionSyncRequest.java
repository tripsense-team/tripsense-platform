package fu.tripsense.socialservice.dto.request;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CommunityGuidePromotionSyncRequest(
    @NotNull UUID eventId,
    @NotNull Long distributionVersion,
    @NotNull UUID businessId,
    @NotNull UUID ownerUserId,
    @NotNull UUID approvedRevisionId,
    boolean enabled
) {}
