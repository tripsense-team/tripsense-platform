package fu.tripsense.contextservice.application.service;

import fu.tripsense.contextservice.adapter.in.web.dto.AdminContextStatsResponse;
import fu.tripsense.contextservice.adapter.in.web.dto.AdminContextStatsResponse.PreferenceSegmentItem;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminContextStatsService {

  private static final Set<Integer> ALLOWED_PERIODS = Set.of(7, 30, 90, 365);

  private final JdbcTemplate jdbc;

  public AdminContextStatsService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public AdminContextStatsResponse getStats(int periodDays) {
    requireAdmin();
    int days = ALLOWED_PERIODS.contains(periodDays) ? periodDays : 30;
    Instant now = Instant.now();
    Timestamp tsStart = Timestamp.from(now.minus(days, ChronoUnit.DAYS));
    Timestamp tsEnd = Timestamp.from(now.plus(1, ChronoUnit.DAYS));

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
          while (rs.next()) {
            topPreferences.add(
                new PreferenceSegmentItem(
                    rs.getString("dimension_code"),
                    rs.getString("value_code"),
                    rs.getLong("cnt"),
                    round2(rs.getDouble("avg_conf"))));
          }
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

