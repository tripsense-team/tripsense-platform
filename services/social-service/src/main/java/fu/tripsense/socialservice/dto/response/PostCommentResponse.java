package fu.tripsense.socialservice.dto.response;

import java.time.Instant;
import java.util.UUID;

public record PostCommentResponse(
    UUID id,
    UUID postId,
    UUID parentId,
    SocialPostAuthorResponse author,
    String content,
    Instant createdAt,
    int likeCount,
    boolean isLiked,
    String replyToAuthorName,
    Integer submittedUnderRevision) {

  public PostCommentResponse(
      UUID id,
      UUID postId,
      UUID parentId,
      SocialPostAuthorResponse author,
      String content,
      Instant createdAt,
      int likeCount,
      boolean isLiked,
      String replyToAuthorName) {
    this(id, postId, parentId, author, content, createdAt, likeCount, isLiked, replyToAuthorName, null);
  }
}
