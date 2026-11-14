package fu.tripsense.socialservice.service;

import fu.tripsense.socialservice.dto.response.AdminSocialStatsResponse;
import fu.tripsense.socialservice.dto.response.AdminSocialStatsResponse.ModerationStats;
import fu.tripsense.socialservice.dto.response.AdminSocialStatsResponse.Period;
import fu.tripsense.socialservice.dto.response.AdminSocialStatsResponse.PlaceReviewStats;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminSocialStatsService {

  private static final ZoneId PLATFORM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
  private static final Set<Integer> ALLOWED_PERIODS = Set.of(7, 30, 90, 365);

  private final JdbcTemplate jdbc;

  public void requireAdmin(AuthenticatedUser user) {
    if (user == null) {
      throw new SocialException(
          HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Authentication is required");
    }
    if (!"ROLE_ADMIN".equals(user.role()) && !"ADMIN".equals(user.role())) {
      throw new SocialException(
          HttpStatus.FORBIDDEN, "ADMIN_REQUIRED", "Admin privileges are required");
    }
  }

  public int normalizePeriodDays(Integer periodDays) {
    if (periodDays == null) return 30;
    if (ALLOWED_PERIODS.contains(periodDays)) return periodDays;
    throw new SocialException(
        HttpStatus.BAD_REQUEST,
        "INVALID_ANALYTICS_PERIOD",
        "periodDays must be one of 7, 30, 90, or 365");
  }

  @Transactional(readOnly = true)
  public AdminSocialStatsResponse getStats(AuthenticatedUser admin, Integer requestedPeriodDays) {
    requireAdmin(admin);
    int periodDays = normalizePeriodDays(requestedPeriodDays);

    LocalDate today = LocalDate.now(PLATFORM_ZONE);
    LocalDate fromDate = today.minusDays(periodDays - 1L);
    LocalDate prevFromDate = fromDate.minusDays(periodDays);

    Instant periodStart = fromDate.atStartOfDay(PLATFORM_ZONE).toInstant();
    Instant periodEnd = today.plusDays(1).atStartOfDay(PLATFORM_ZONE).toInstant();
    Instant prevPeriodStart = prevFromDate.atStartOfDay(PLATFORM_ZONE).toInstant();

    Timestamp tsStart = Timestamp.from(periodStart);
    Timestamp tsEnd = Timestamp.from(periodEnd);
    Timestamp tsPrevStart = Timestamp.from(prevPeriodStart);

    long totalPosts =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM social_posts WHERE deleted_at IS NULL", Long.class));
    long periodPosts =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM social_posts WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ?",
                Long.class,
                tsStart,
                tsEnd));
    long prevPeriodPosts =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM social_posts WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ?",
                Long.class,
                tsPrevStart,
                tsStart));
    double postsGrowthPercent = computeGrowthPercent(periodPosts, prevPeriodPosts);

    long totalComments =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM social_comments WHERE deleted_at IS NULL", Long.class));
    long totalReactions =
        nvlLong(jdbc.queryForObject("SELECT COUNT(*) FROM social_reactions", Long.class));
    long totalSharedTrips =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM social_trip_shares WHERE removed_at IS NULL", Long.class));

    long totalPublishedReviews =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM place_reviews WHERE status = 'PUBLISHED' AND deleted_at IS NULL",
                Long.class));
    long periodReviews =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM place_reviews WHERE status = 'PUBLISHED' AND deleted_at IS NULL AND created_at >= ? AND created_at < ?",
                Long.class,
                tsStart,
                tsEnd));
    Double avgRatingObj =
        jdbc.queryForObject(
            "SELECT COALESCE(AVG(rating), 0.0) FROM place_reviews WHERE status = 'PUBLISHED' AND deleted_at IS NULL",
            Double.class);
    double averageRating =
        BigDecimal.valueOf(avgRatingObj != null ? avgRatingObj : 0.0)
            .setScale(2, RoundingMode.HALF_UP)
            .doubleValue();

    Map<Integer, Long> ratingMap = new HashMap<>();
    jdbc.query(
        """
        SELECT rating, COUNT(*) AS cnt
        FROM place_reviews
        WHERE status = 'PUBLISHED' AND deleted_at IS NULL
        GROUP BY rating
        """,
        rs -> {
          while (rs.next()) {
            ratingMap.put(rs.getInt("rating"), rs.getLong("cnt"));
          }
        });

    PlaceReviewStats reviewStats =
        new PlaceReviewStats(
            totalPublishedReviews,
            periodReviews,
            averageRating,
            ratingMap.getOrDefault(5, 0L),
            ratingMap.getOrDefault(4, 0L),
            ratingMap.getOrDefault(3, 0L),
            ratingMap.getOrDefault(2, 0L),
            ratingMap.getOrDefault(1, 0L));

    Map<String, Long> reportStatusMap = new HashMap<>();
    jdbc.query(
        "SELECT status, COUNT(*) AS cnt FROM social_reports GROUP BY status",
        rs -> {
          while (rs.next()) {
            reportStatusMap.put(rs.getString("status"), rs.getLong("cnt"));
          }
        });

    Map<String, Long> reportTypeMap = new HashMap<>();
    jdbc.query(
        "SELECT target_type, COUNT(*) AS cnt FROM social_reports GROUP BY target_type",
        rs -> {
          while (rs.next()) {
            reportTypeMap.put(rs.getString("target_type"), rs.getLong("cnt"));
          }
        });

    long pendingReports = reportStatusMap.getOrDefault("PENDING", 0L);
    long actionedReports = reportStatusMap.getOrDefault("ACTIONED", 0L);
    long dismissedReports = reportStatusMap.getOrDefault("DISMISSED", 0L);
    long totalReports = pendingReports + actionedReports + dismissedReports;

    long postReports = reportTypeMap.getOrDefault("POST", 0L);
    long commentReports = reportTypeMap.getOrDefault("COMMENT", 0L);
    long reviewReports = reportTypeMap.getOrDefault("PLACE_REVIEW", 0L);
    long chatReports =
        reportTypeMap.getOrDefault("CHAT_MESSAGE", 0L)
            + reportTypeMap.getOrDefault("CHAT_USER", 0L);

    ModerationStats moderationStats =
        new ModerationStats(
            totalReports,
            pendingReports,
            actionedReports,
            dismissedReports,
            postReports,
            commentReports,
            reviewReports,
            chatReports);

    return new AdminSocialStatsResponse(
        new Period(periodDays, fromDate, today),
        totalPosts,
        periodPosts,
        postsGrowthPercent,
        totalComments,
        totalReactions,
        totalSharedTrips,
        reviewStats,
        moderationStats);
  }

  static double computeGrowthPercent(long current, long previous) {
    if (previous <= 0) {
      return current > 0 ? 100.0 : 0.0;
    }
    double raw = ((current - previous) * 100.0) / previous;
    return BigDecimal.valueOf(raw).setScale(1, RoundingMode.HALF_UP).doubleValue();
  }

  private static long nvlLong(Long val) {
    return val != null ? val : 0L;
  }
}

