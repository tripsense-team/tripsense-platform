package fu.tripsense.socialservice.dto.response;

import java.util.UUID;

public record PlaceReviewAuthorResponse(UUID userId, String displayName, String avatarUrl) {}
