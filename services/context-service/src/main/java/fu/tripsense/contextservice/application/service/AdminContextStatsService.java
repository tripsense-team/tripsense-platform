package fu.tripsense.contextservice.application.service;

import fu.tripsense.contextservice.adapter.in.web.dto.AdminContextStatsResponse;
import fu.tripsense.contextservice.adapter.in.web.dto.AdminContextStatsResponse.PreferenceSegmentItem;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
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
public class AdminContextStatsService {

  private static final ZoneId PLATFORM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
  private static final Set<Integer> ALLOWED_PERIODS = Set.of(7, 30, 90, 365);

  private final JdbcTemplate jdbc;

  public AdminContextStatsService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional(readOnly = true)
  public AdminContextStatsResponse getStats(int periodDays) {
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

    long totalProfiles =
        nvl(jdbc.queryForObject("SELECT COUNT(*) FROM onboarding_profiles", Long.class));
    long completedProfiles =
        nvl(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM onboarding_profiles WHERE status = 'COMPLETED' OR completed_at IS NOT NULL",
                Long.class));
    long periodProfiles =
        nvl(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM onboarding_profiles WHERE created_at >= ? AND created_at < ?",
                Long.class,
                tsStart,
                tsEnd));
    long totalSignals =
        nvl(jdbc.queryForObject("SELECT COUNT(*) FROM preference_signals", Long.class));

    List<PreferenceSegmentItem> topPreferences = new ArrayList<>();
    jdbc.query(
        """
        SELECT
          dimension_code,
          value_code,
          COUNT(*) AS cnt,
          COALESCE(AVG(confidence), 0.0) AS avg_conf
        FROM preference_signals
        GROUP BY dimension_code, value_code
        ORDER BY cnt DESC, avg_conf DESC
        LIMIT 8
        """,
        rs -> {
          topPreferences.add(
              new PreferenceSegmentItem(
                  rs.getString("dimension_code"),
                  rs.getString("value_code"),
                  rs.getLong("cnt"),
                  round2(rs.getDouble("avg_conf"))));
        });

    return new AdminContextStatsResponse(
        days, totalProfiles, completedProfiles, periodProfiles, totalSignals, topPreferences);
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

