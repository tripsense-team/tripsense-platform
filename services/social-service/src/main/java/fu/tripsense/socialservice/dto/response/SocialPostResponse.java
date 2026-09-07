package fu.tripsense.socialservice.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SocialPostResponse(
        UUID id,
        String type,
        SocialPostAuthorResponse author,
        String content,
        List<String> mediaUrls,
        String visibility,
        SharedTripSummaryResponse trip,
        Instant createdAt,
        Instant updatedAt,
        int likeCount,
        int commentCount,
        boolean isLiked
) {
    public SocialPostResponse(
            UUID id,
            SocialPostAuthorResponse author,
            String content,
            List<String> mediaUrls,
            Instant createdAt,
            Instant updatedAt,
            int likeCount,
            int commentCount,
            boolean isLiked
    ) {
        this(id, "STANDARD", author, content, mediaUrls, "PUBLIC", null, createdAt, updatedAt, likeCount, commentCount, isLiked);
    }
}
