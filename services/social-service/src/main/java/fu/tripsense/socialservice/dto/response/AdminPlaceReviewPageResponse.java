package fu.tripsense.socialservice.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AdminPlaceReviewPageResponse(
    List<AdminPlaceReviewItem> items,
    int page,
    int size,
    long totalElements,
    int totalPages,
    Summary summary) {

  public record Summary(long total, long published, long removed, long flagged) {}

  public record AdminPlaceReviewItem(
      UUID id,
      String placeRef,
      String placeName,
      UUID authorUserId,
      String authorName,
      String authorAvatarUrl,
      int rating,
      String content,
      String status,
      long pendingReportCount,
      long totalReportCount,
      Long version,
      Instant createdAt,
      Instant updatedAt) {}
}

