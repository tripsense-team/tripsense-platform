package fu.tripsense.tripservice.partner.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record PartnerAnalyticsDashboardDto(
    int periodDays,
    LocalDate from,
    LocalDate toExclusive,
    List<BusinessAnalytics> businesses) {
  public record BusinessAnalytics(
      UUID businessId,
      String displayName,
      String kind,
      long views,
      boolean viewsAvailable,
      long bookings,
      long expectedGuests,
      long confirmedBookings,
      long cancelledBookings,
      BigDecimal settledPartnerEarnings,
      boolean revenueAvailable,
      List<DailyAnalytics> daily) {}

  public record DailyAnalytics(LocalDate date, long views, long bookings, BigDecimal settledPartnerEarnings) {}
}
