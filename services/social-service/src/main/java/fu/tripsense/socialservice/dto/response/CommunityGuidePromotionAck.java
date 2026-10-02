package fu.tripsense.socialservice.dto.response;

import java.util.UUID;

public record CommunityGuidePromotionAck(
    UUID postId,
    Long appliedVersion,
    String deliveryState
) {}
