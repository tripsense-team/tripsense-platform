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
    GuidePromotionSummaryResponse guidePromotion,
    String guideAvailability,
    Instant createdAt,
    Instant updatedAt,
    int likeCount,
    int commentCount,
    boolean isLiked) {

  public SocialPostResponse(
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
      boolean isLiked) {
    this(
        id,
        type,
        author,
        content,
        mediaUrls,
        visibility,
        trip,
        null,
        null,
        createdAt,
        updatedAt,
        likeCount,
        commentCount,
        isLiked);
  }

  public SocialPostResponse(
      UUID id,
      SocialPostAuthorResponse author,
      String content,
      List<String> mediaUrls,
      Instant createdAt,
      Instant updatedAt,
      int likeCount,
      int commentCount,
      boolean isLiked) {
    this(
        id,
        "STANDARD",
        author,
        content,
        mediaUrls,
        "PUBLIC",
        null,
        null,
        null,
        createdAt,
        updatedAt,
        likeCount,
        commentCount,
        isLiked);
  }
}
