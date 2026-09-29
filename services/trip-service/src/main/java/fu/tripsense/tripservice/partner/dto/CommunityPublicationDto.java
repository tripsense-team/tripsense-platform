package fu.tripsense.tripservice.partner.dto;

import java.util.UUID;

public record CommunityPublicationDto(
    UUID promotionId,
    Long distributionVersion,
    boolean desiredEnabled,
    String syncState,
    UUID postId
) {}
