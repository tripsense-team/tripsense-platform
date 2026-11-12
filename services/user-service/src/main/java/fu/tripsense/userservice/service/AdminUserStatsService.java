package fu.tripsense.userservice.service;

import fu.tripsense.userservice.dto.response.AdminUserStatsDto;
import fu.tripsense.userservice.dto.response.AdminUserStatsDto.AuthProviderBreakdown;
import fu.tripsense.userservice.dto.response.AdminUserStatsDto.DailyUserPoint;
import fu.tripsense.userservice.dto.response.AdminUserStatsDto.Period;
import fu.tripsense.userservice.dto.response.AdminUserStatsDto.RoleBreakdown;
import fu.tripsense.userservice.entity.User;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AdminUserStatsService {

  private static final ZoneId PLATFORM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
  private static final Set<Integer> ALLOWED_PERIODS = Set.of(7, 30, 90, 365);

  private final JdbcTemplate jdbc;

  public void requireAdmin(User currentUser) {
    if (currentUser == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required");
    }
    List<String> roles = currentUser.getRoles();
    if (roles == null || (!roles.contains("ROLE_ADMIN") && !roles.contains("ADMIN"))) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin privileges are required");
    }
  }

  public int normalizePeriodDays(Integer periodDays) {
    if (periodDays == null) return 30;
    if (ALLOWED_PERIODS.contains(periodDays)) return periodDays;
    throw new ResponseStatusException(
        HttpStatus.BAD_REQUEST, "periodDays must be one of 7, 30, 90, or 365");
  }

  @Transactional(readOnly = true)
  public AdminUserStatsDto getStats(User currentUser, Integer requestedPeriodDays) {
    requireAdmin(currentUser);
    int periodDays = normalizePeriodDays(requestedPeriodDays);

    LocalDate today = LocalDate.now(PLATFORM_ZONE);
    LocalDate fromDate = today.minusDays(periodDays - 1L);
    LocalDate prevFromDate = fromDate.minusDays(periodDays);

    LocalDateTime startLdt = fromDate.atStartOfDay();
    LocalDateTime endLdt = today.plusDays(1).atStartOfDay();
    LocalDateTime prevStartLdt = prevFromDate.atStartOfDay();

    Timestamp tsStart = Timestamp.valueOf(startLdt);
    Timestamp tsEnd = Timestamp.valueOf(endLdt);
    Timestamp tsPrevStart = Timestamp.valueOf(prevStartLdt);

    long totalUsers =
        nvlLong(jdbc.queryForObject("SELECT COUNT(*) FROM users", Long.class));

    Map<String, Long> statusMap = new HashMap<>();
    jdbc.query(
        "SELECT status, COUNT(*) AS cnt FROM users GROUP BY status",
        rs -> {
          while (rs.next()) {
            statusMap.put(rs.getString("status"), rs.getLong("cnt"));
          }
        });
    long activeUsers = statusMap.getOrDefault("ACTIVE", 0L);
    long unverifiedUsers = statusMap.getOrDefault("UNVERIFIED", 0L);
    long inactiveUsers = statusMap.getOrDefault("INACTIVE", 0L);

    long periodNewUsers =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE created_at >= ? AND created_at < ?",
                Long.class,
                tsStart,
                tsEnd));
    long previousPeriodNewUsers =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE created_at >= ? AND created_at < ?",
                Long.class,
                tsPrevStart,
                tsStart));
    double userGrowthPercent = computeGrowthPercent(periodNewUsers, previousPeriodNewUsers);

    long adminsCount =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE upper(role) IN ('ADMIN', 'ROLE_ADMIN')",
                Long.class));
    long partnersCount =
        nvlLong(
            jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM users
                WHERE upper(role) NOT IN ('ADMIN', 'ROLE_ADMIN')
                  AND (partner_enrolled = true OR upper(role) IN ('PARTNER', 'ROLE_PARTNER'))
                """,
                Long.class));
    long travelersCount = Math.max(0L, totalUsers - adminsCount - partnersCount);
    RoleBreakdown roleBreakdown = new RoleBreakdown(travelersCount, partnersCount, adminsCount);

    Map<String, Long> providerMap = new HashMap<>();
    jdbc.query(
        "SELECT COALESCE(upper(auth_provider), 'LOCAL') AS prov, COUNT(*) AS cnt FROM users GROUP BY 1",
        rs -> {
          while (rs.next()) {
            providerMap.put(rs.getString("prov"), rs.getLong("cnt"));
          }
        });
    AuthProviderBreakdown authBreakdown =
        new AuthProviderBreakdown(
            providerMap.getOrDefault("LOCAL", 0L), providerMap.getOrDefault("GOOGLE", 0L));

    Map<LocalDate, Long> dailyMap = new LinkedHashMap<>();
    for (LocalDate d = fromDate; !d.isAfter(today); d = d.plusDays(1)) {
      dailyMap.put(d, 0L);
    }

    jdbc.query(
        "SELECT created_at::date AS d, COUNT(*) AS cnt FROM users WHERE created_at >= ? AND created_at < ? GROUP BY 1",
        rs -> {
          while (rs.next()) {
            LocalDate d = rs.getDate("d").toLocalDate();
            if (dailyMap.containsKey(d)) {
              dailyMap.put(d, rs.getLong("cnt"));
            }
          }
        },
        tsStart,
        tsEnd);

    List<DailyUserPoint> dailyPoints = new ArrayList<>(dailyMap.size());
    for (Map.Entry<LocalDate, Long> entry : dailyMap.entrySet()) {
      dailyPoints.add(new DailyUserPoint(entry.getKey(), entry.getValue()));
    }

    return new AdminUserStatsDto(
        new Period(periodDays, fromDate, today),
        totalUsers,
        activeUsers,
        unverifiedUsers,
        inactiveUsers,
        periodNewUsers,
        previousPeriodNewUsers,
        userGrowthPercent,
        roleBreakdown,
        authBreakdown,
        dailyPoints);
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

