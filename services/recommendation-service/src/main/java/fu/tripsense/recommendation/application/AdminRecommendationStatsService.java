package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.application.AdminRecommendationStatsResult.FunnelStats;
import fu.tripsense.recommendation.application.AdminRecommendationStatsResult.PersonalizationComparison;
import fu.tripsense.recommendation.application.AdminRecommendationStatsResult.PositionBucketStats;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminRecommendationStatsService {

  private static final ZoneId PLATFORM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
  private static final Set<Integer> ALLOWED_PERIODS = Set.of(7, 30, 90, 365);

  private final JdbcTemplate jdbc;

  public AdminRecommendationStatsService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional(readOnly = true)
  public AdminRecommendationStatsResult getStats(int periodDays) {
    requireAdmin();
    if (!ALLOWED_PERIODS.contains(periodDays)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "periodDays must be one of 7, 30, 90, or 365");
    }
    int days = periodDays;
    LocalDate today = LocalDate.now(PLATFORM_ZONE);
    LocalDate fromDate = today.minusDays(days - 1L);
    Timestamp tsStart = Timestamp.from(fromDate.atStartOfDay(PLATFORM_ZONE).toInstant());
    Timestamp tsEnd = Timestamp.from(today.plusDays(1).atStartOfDay(PLATFORM_ZONE).toInstant());

    long totalImpressions =
        nvl(jdbc.queryForObject("SELECT COUNT(*) FROM recommendation_impression", Long.class));
    long periodImpressions =
        nvl(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM recommendation_impression WHERE created_at >= ? AND created_at < ?",
                Long.class,
                tsStart,
                tsEnd));
    long totalRecommendedItems =
        nvl(jdbc.queryForObject("SELECT COUNT(*) FROM recommendation_impression_item", Long.class));

    Map<String, Long> eventCounts = new HashMap<>();
    jdbc.query(
        """
        SELECT event_type, COUNT(*) AS cnt
        FROM recommendation_feedback_event
        WHERE occurred_at >= ? AND occurred_at < ?
        GROUP BY event_type
        """,
        rs -> {
          eventCounts.put(rs.getString("event_type"), rs.getLong("cnt"));
        },
        tsStart,
        tsEnd);

    long impressionsEvents = eventCounts.getOrDefault("IMPRESSION", 0L);
    if (impressionsEvents == 0L) {
      impressionsEvents = periodImpressions;
    }
    long clicks = eventCounts.getOrDefault("CLICK", 0L);
    long detailViews = eventCounts.getOrDefault("DETAIL_VIEW", 0L);
    long saves = eventCounts.getOrDefault("SAVE", 0L);
    long addToTrip = eventCounts.getOrDefault("ADD_TO_TRIP", 0L);

    double ctrPercent = round2(impressionsEvents > 0 ? (clicks * 100.0) / impressionsEvents : 0.0);
    double conversionRatePercent =
        round2(impressionsEvents > 0 ? ((saves + addToTrip) * 100.0) / impressionsEvents : 0.0);

    FunnelStats funnel =
        new FunnelStats(
            impressionsEvents,
            clicks,
            detailViews,
            saves,
            addToTrip,
            ctrPercent,
            conversionRatePercent);

    Map<String, long[]> posMap = new HashMap<>();
    posMap.put("TOP_1_3", new long[] {0L, 0L});
    posMap.put("TOP_4_6", new long[] {0L, 0L});
    posMap.put("TOP_7_PLUS", new long[] {0L, 0L});

    jdbc.query(
        """
        SELECT
          CASE
            WHEN position BETWEEN 1 AND 3 THEN 'TOP_1_3'
            WHEN position BETWEEN 4 AND 6 THEN 'TOP_4_6'
            ELSE 'TOP_7_PLUS'
          END AS bucket,
          SUM(CASE WHEN event_type = 'IMPRESSION' THEN 1 ELSE 0 END) AS imp_cnt,
          SUM(CASE WHEN event_type = 'CLICK' THEN 1 ELSE 0 END) AS clk_cnt
        FROM recommendation_feedback_event
        WHERE occurred_at >= ? AND occurred_at < ?
        GROUP BY 1
        """,
        rs -> {
          String bucket = rs.getString("bucket");
          long imp = rs.getLong("imp_cnt");
          long clk = rs.getLong("clk_cnt");
          posMap.put(bucket, new long[] {imp, clk});
        },
        tsStart,
        tsEnd);

    List<PositionBucketStats> positionBuckets =
        List.of("TOP_1_3", "TOP_4_6", "TOP_7_PLUS").stream()
            .map(
                b -> {
                  long[] vals = posMap.getOrDefault(b, new long[] {0L, 0L});
                  double bucketCtr = round2(vals[0] > 0 ? (vals[1] * 100.0) / vals[0] : 0.0);
                  return new PositionBucketStats(b, vals[0], vals[1], bucketCtr);
                })
            .toList();

    long[] persAndDeg = new long[] {0L, 0L, 0L, 0L};
    jdbc.query(
        """
        SELECT
          CASE WHEN jsonb_array_length(COALESCE(i.degradation_codes, '[]'::jsonb)) = 0 THEN 'PERSONALIZED' ELSE 'DEGRADED' END AS mode,
          SUM(CASE WHEN f.event_type = 'IMPRESSION' THEN 1 ELSE 0 END) AS imp_cnt,
          SUM(CASE WHEN f.event_type = 'CLICK' THEN 1 ELSE 0 END) AS clk_cnt
        FROM recommendation_impression i
        LEFT JOIN recommendation_feedback_event f ON f.recommendation_id = i.recommendation_id
        WHERE i.created_at >= ? AND i.created_at < ?
        GROUP BY 1
        """,
        rs -> {
          String mode = rs.getString("mode");
          long imp = rs.getLong("imp_cnt");
          long clk = rs.getLong("clk_cnt");
          if ("PERSONALIZED".equals(mode)) {
            persAndDeg[0] = imp;
            persAndDeg[1] = clk;
          } else {
            persAndDeg[2] = imp;
            persAndDeg[3] = clk;
          }
        },
        tsStart,
        tsEnd);

    PersonalizationComparison personalizationComparison =
        new PersonalizationComparison(
            persAndDeg[0],
            round2(persAndDeg[0] > 0 ? (persAndDeg[1] * 100.0) / persAndDeg[0] : 0.0),
            persAndDeg[2],
            round2(persAndDeg[2] > 0 ? (persAndDeg[3] * 100.0) / persAndDeg[2] : 0.0));

    return new AdminRecommendationStatsResult(
        days,
        totalImpressions,
        periodImpressions,
        totalRecommendedItems,
        funnel,
        positionBuckets,
        personalizationComparison);
  }

  private void requireAdmin() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !auth.isAuthenticated()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
    }
    boolean isAdmin =
        auth.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .anyMatch(a -> "ROLE_ADMIN".equalsIgnoreCase(a) || "ADMIN".equalsIgnoreCase(a));
    if (!isAdmin) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
    }
  }

  private static long nvl(Long val) {
    return val == null ? 0L : val;
  }

  private static double round2(double v) {
    return Math.round(v * 100.0) / 100.0;
  }
}

