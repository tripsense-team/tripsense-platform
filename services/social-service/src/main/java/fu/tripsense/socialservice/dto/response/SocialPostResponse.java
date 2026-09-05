package fu.tripsense.socialservice.dto.response;
import java.time.Instant; import java.util.*;
public record SocialPostResponse(UUID id, SocialPostAuthorResponse author, String content, List<String> mediaUrls, Instant createdAt, Instant updatedAt, int likeCount, int commentCount, boolean isLiked) { }
