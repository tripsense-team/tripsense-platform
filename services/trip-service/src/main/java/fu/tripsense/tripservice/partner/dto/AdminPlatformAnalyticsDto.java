package fu.tripsense.tripservice.partner.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record AdminPlatformAnalyticsDto(
    Period period,
    TripStats tripStats,
    PartnerAndBookingStats partnerAndBookingStats,
    FinanceAndSubscriptionStats financeAndSubscriptionStats,
    List<DailyPoint> dailySeries,
    List<PlatformActivityItem> recentEvents) {

  public record Period(int days, LocalDate from, LocalDate to) {}

  public record TripStats(
      long totalTrips,
      long periodTrips,
      long previousPeriodTrips,
      double tripsGrowthPercent,
      long totalAiCommits,
      long periodAiCommits,
      long previousPeriodAiCommits,
      double aiCommitsGrowthPercent,
      long aiAssistedTripsCount,
      long manualTripsCount,
      double aiAdoptionRatePercent,
      long distinctDestinationsCount,
      double avgCollaboratorsPerTrip,
      VisibilityBreakdown visibilityBreakdown,
      List<DestinationRankItem> topDestinations) {}

  public record VisibilityBreakdown(long publicCount, long sharedCount, long privateCount) {}

  public record DestinationRankItem(
      String destinationName, long tripsCount, double sharePercent, double growthPercent) {}

  public record PartnerAndBookingStats(
      long totalPartnerBusinesses,
      long publishedPartnerBusinesses,
      PartnerByKind partnerByKind,
      ApplicationFunnel applicationFunnel,
      HotelBookingFunnel hotelBookingFunnel,
      RestaurantReservationFunnel restaurantReservationFunnel,
      RentalBookingFunnel rentalBookingFunnel,
      GuideInquiryFunnel guideInquiryFunnel,
      VoucherStats voucherStats) {}

  public record PartnerByKind(
      long hotelCount, long restaurantCount, long tourGuideCount, long rentalCount) {}

  public record ApplicationFunnel(
      long submittedCount,
      long approvedCount,
      long changesRequiredCount,
      long rejectedCount) {}

  public record HotelBookingFunnel(
      long total,
      long confirmed,
      long checkedIn,
      long checkedOut,
      long cancelled,
      long held) {}

  public record RestaurantReservationFunnel(
      long total, long requested, long confirmed, long cancelled, long rejected) {}

  public record RentalBookingFunnel(
      long total,
      long pending,
      long confirmed,
      long inUse,
      long returned,
      long cancelled) {}

  public record GuideInquiryFunnel(
      long total, long active, long contactAgreed, long closedOrDeclined) {}

  public record VoucherStats(
      long totalActiveVouchers, long redemptionsCount, BigDecimal totalDiscountAmount) {}

  public record FinanceAndSubscriptionStats(
      BigDecimal totalHotelGmv,
      BigDecimal periodHotelGmv,
      BigDecimal escrowHoldingAmount,
      BigDecimal completedHotelGmv,
      BigDecimal hotelCommissionRevenue,
      BigDecimal subscriptionRevenue,
      BigDecimal periodSubscriptionRevenue,
      long paidSubscriptionOrdersCount,
      BigDecimal totalPlatformRevenue,
      BigDecimal partnerPayableBalance,
      long activeSubscriptionsCount,
      long trialSubscriptionsCount,
      long expiredSubscriptionsCount,
      long pendingWithdrawalsCount,
      long pendingRefundsCount) {}

  public record DailyPoint(
      LocalDate date,
      long tripsCreated,
      long aiCommits,
      long bookingsCreated,
      BigDecimal gmvAmount,
      BigDecimal platformRevenueAmount) {}

  public record PlatformActivityItem(
      String id,
      String category,
      String actorLabel,
      String description,
      String status,
      Instant occurredAt) {}
}

