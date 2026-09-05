package fu.tripsense.socialservice.dto.response;
import java.time.Instant; import java.util.UUID;
public record PostCommentResponse(UUID id, UUID postId, UUID parentId, SocialPostAuthorResponse author, String content, Instant createdAt, int likeCount, boolean isLiked, String replyToAuthorName) { }
