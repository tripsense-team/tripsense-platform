package fu.tripsense.userservice.dto.response;

import java.time.LocalDate;
import java.util.List;

public record AdminUserStatsDto(
    Period period,
    long totalUsers,
    long activeUsers,
    long unverifiedUsers,
    long inactiveUsers,
    long periodNewUsers,
    long previousPeriodNewUsers,
    double userGrowthPercent,
    RoleBreakdown roleBreakdown,
    AuthProviderBreakdown authProviderBreakdown,
    List<DailyUserPoint> dailyRegistrations) {

  public record Period(int days, LocalDate from, LocalDate to) {}

  public record RoleBreakdown(long travelersCount, long partnersCount, long adminsCount) {}

  public record AuthProviderBreakdown(long localCount, long googleCount) {}

  public record DailyUserPoint(LocalDate date, long newUsers) {}
}

