package fu.tripsense.socialservice.dto.response;

import java.time.Instant;
import java.util.UUID;

public record PlaceReviewItemResponse(
    UUID id,
    PlaceReviewAuthorResponse author,
    int rating,
    String content,
    Instant createdAt,
    Instant updatedAt,
    long version,
    boolean ownedByCurrentUser) {}
