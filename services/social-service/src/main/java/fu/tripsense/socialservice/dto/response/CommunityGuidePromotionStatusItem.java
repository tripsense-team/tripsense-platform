package fu.tripsense.socialservice.dto.response;

import java.time.Instant;
import java.util.UUID;

public record CommunityGuidePromotionStatusItem(
    UUID promotionId,
    UUID postId,
    Long lastAppliedVersion,
    String deliveryState,
    Instant removedAt,
    String removalReason
) {}
