package fu.tripsense.socialservice.dto.response;

import java.time.LocalDate;

public record AdminSocialStatsResponse(
    Period period,
    long totalPosts,
    long periodPosts,
    double postsGrowthPercent,
    long totalComments,
    long totalReactions,
    long totalSharedTrips,
    PlaceReviewStats placeReviewStats,
    ModerationStats moderationStats) {

  public record Period(int days, LocalDate from, LocalDate to) {}

  public record PlaceReviewStats(
      long totalPublishedReviews,
      long periodReviews,
      double averageRating,
      long fiveStarCount,
      long fourStarCount,
      long threeStarCount,
      long twoStarCount,
      long oneStarCount) {}

  public record ModerationStats(
      long totalReports,
      long pendingReportsCount,
      long actionedReportsCount,
      long dismissedReportsCount,
      long postReportsCount,
      long commentReportsCount,
      long reviewReportsCount,
      long chatReportsCount) {}
}

