package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.AdminPlatformAnalyticsDto;
import fu.tripsense.tripservice.partner.dto.AdminPlatformAnalyticsDto.*;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminPlatformAnalyticsService {

  private static final ZoneId PLATFORM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
  private static final Set<Integer> ALLOWED_PERIODS = Set.of(7, 30, 90, 365);

  private final JdbcTemplate jdbc;

  public int normalizePeriodDays(Integer periodDays) {
    if (periodDays == null) return 30;
    if (ALLOWED_PERIODS.contains(periodDays)) return periodDays;
    throw new TripServiceException(
        "INVALID_ANALYTICS_PERIOD",
        "periodDays must be one of 7, 30, 90, or 365",
        HttpStatus.BAD_REQUEST);
  }

  public void requireAdmin(AuthenticatedUser user) {
    if (user == null) {
      throw new TripServiceException(
          "UNAUTHORIZED", "Authentication is required", HttpStatus.UNAUTHORIZED);
    }
    if (!user.isAdmin()) {
      throw new TripServiceException(
          "FORBIDDEN", "Admin privileges are required", HttpStatus.FORBIDDEN);
    }
  }

  @Transactional(readOnly = true)
  public AdminPlatformAnalyticsDto getOverview(AuthenticatedUser admin, Integer requestedPeriodDays) {
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

    TripStats tripStats = buildTripStats(tsStart, tsEnd, tsPrevStart);
    PartnerAndBookingStats partnerAndBookingStats = buildPartnerAndBookingStats();
    FinanceAndSubscriptionStats financeStats = buildFinanceAndSubscriptionStats(tsStart, tsEnd);
    DeepTripAnalytics deepTripAnalytics = buildDeepTripAnalytics();
    List<DailyPoint> dailySeries = buildDailySeries(fromDate, today, tsStart, tsEnd);
    List<PlatformActivityItem> recentEvents = buildRecentEvents();

    return new AdminPlatformAnalyticsDto(
        new Period(periodDays, fromDate, today),
        tripStats,
        partnerAndBookingStats,
        financeStats,
        deepTripAnalytics,
        dailySeries,
        recentEvents);
  }

  private TripStats buildTripStats(Timestamp tsStart, Timestamp tsEnd, Timestamp tsPrevStart) {
    long totalTrips =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM trips WHERE deleted_at IS NULL", Long.class));
    long periodTrips =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM trips WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ?",
                Long.class,
                tsStart,
                tsEnd));
    long previousPeriodTrips =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM trips WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ?",
                Long.class,
                tsPrevStart,
                tsStart));
    double tripsGrowthPercent = computeGrowthPercent(periodTrips, previousPeriodTrips);

    long totalAiCommits =
        nvlLong(jdbc.queryForObject("SELECT COUNT(*) FROM itinerary_commit_receipts", Long.class));
    long periodAiCommits =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM itinerary_commit_receipts WHERE created_at >= ? AND created_at < ?",
                Long.class,
                tsStart,
                tsEnd));
    long previousPeriodAiCommits =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM itinerary_commit_receipts WHERE created_at >= ? AND created_at < ?",
                Long.class,
                tsPrevStart,
                tsStart));
    double aiCommitsGrowthPercent = computeGrowthPercent(periodAiCommits, previousPeriodAiCommits);

    long aiAssistedTripsCount =
        nvlLong(
            jdbc.queryForObject(
                """
                SELECT COUNT(DISTINCT r.trip_id)
                FROM itinerary_commit_receipts r
                JOIN trips t ON t.id = r.trip_id
                WHERE t.deleted_at IS NULL
                """,
                Long.class));
    long manualTripsCount = Math.max(0L, totalTrips - aiAssistedTripsCount);
    double aiAdoptionRatePercent =
        totalTrips > 0 ? round1((aiAssistedTripsCount * 100.0) / totalTrips) : 0.0;

    long distinctDestinationsCount =
        nvlLong(
            jdbc.queryForObject(
                """
                SELECT COUNT(DISTINCT lower(btrim(destination_name)))
                FROM trips
                WHERE deleted_at IS NULL
                  AND destination_name IS NOT NULL
                  AND btrim(destination_name) <> ''
                """,
                Long.class));

    Double avgCollab =
        jdbc.queryForObject(
            """
            SELECT COALESCE(AVG(member_cnt), 1.0)
            FROM (
              SELECT trip_id, COUNT(*) AS member_cnt
              FROM trip_members
              GROUP BY trip_id
            ) sub
            """,
            Double.class);
    double avgCollaboratorsPerTrip = round1(avgCollab != null ? avgCollab : 1.0);

    Map<String, Long> visMap = new HashMap<>();
    jdbc.query(
        """
        SELECT COALESCE(upper(visibility), 'PRIVATE') AS vis, COUNT(*) AS cnt
        FROM trips
        WHERE deleted_at IS NULL
        GROUP BY 1
        """,
        rs -> {
          visMap.put(rs.getString("vis"), rs.getLong("cnt"));
        });
    VisibilityBreakdown visibilityBreakdown =
        new VisibilityBreakdown(
            visMap.getOrDefault("PUBLIC", 0L),
            visMap.getOrDefault("SHARED", 0L) + visMap.getOrDefault("UNLISTED", 0L),
            visMap.getOrDefault("PRIVATE", 0L));

    List<DestinationRankItem> topDestinations =
        buildTopDestinations(totalTrips, tsStart, tsEnd, tsPrevStart);

    return new TripStats(
        totalTrips,
        periodTrips,
        previousPeriodTrips,
        tripsGrowthPercent,
        totalAiCommits,
        periodAiCommits,
        previousPeriodAiCommits,
        aiCommitsGrowthPercent,
        aiAssistedTripsCount,
        manualTripsCount,
        aiAdoptionRatePercent,
        distinctDestinationsCount,
        avgCollaboratorsPerTrip,
        visibilityBreakdown,
        topDestinations);
  }

  private List<DestinationRankItem> buildTopDestinations(
      long totalTrips, Timestamp tsStart, Timestamp tsEnd, Timestamp tsPrevStart) {
    List<DestinationRankItem> list = new ArrayList<>();
    jdbc.query(
        """
        SELECT
          MAX(btrim(destination_name)) AS dest_label,
          COUNT(*) AS total_cnt,
          COUNT(*) FILTER (WHERE created_at >= ? AND created_at < ?) AS curr_cnt,
          COUNT(*) FILTER (WHERE created_at >= ? AND created_at < ?) AS prev_cnt
        FROM trips
        WHERE deleted_at IS NULL
          AND destination_name IS NOT NULL
          AND btrim(destination_name) <> ''
        GROUP BY lower(btrim(destination_name))
        ORDER BY total_cnt DESC, dest_label ASC
        LIMIT 6
        """,
        rs -> {
          String name = rs.getString("dest_label");
          long count = rs.getLong("total_cnt");
          long curr = rs.getLong("curr_cnt");
          long prev = rs.getLong("prev_cnt");
          double share = totalTrips > 0 ? round1((count * 100.0) / totalTrips) : 0.0;
          double growth = computeGrowthPercent(curr, prev);
          list.add(new DestinationRankItem(name, count, share, growth));
        },
        tsStart,
        tsEnd,
        tsPrevStart,
        tsStart);
    return list;
  }

  private PartnerAndBookingStats buildPartnerAndBookingStats() {
    long totalBusinesses =
        nvlLong(jdbc.queryForObject("SELECT COUNT(*) FROM partner_business", Long.class));
    long publishedBusinesses =
        nvlLong(
            jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM partner_business
                WHERE publication_state = 'PUBLISHED' AND operation_state = 'ACTIVE'
                """,
                Long.class));

    Map<String, Long> kindMap = new HashMap<>();
    jdbc.query(
        "SELECT kind, COUNT(*) AS cnt FROM partner_business GROUP BY kind",
        rs -> {
          kindMap.put(rs.getString("kind"), rs.getLong("cnt"));
        });
    PartnerByKind partnerByKind =
        new PartnerByKind(
            kindMap.getOrDefault("HOTEL", 0L),
            kindMap.getOrDefault("RESTAURANT", 0L),
            kindMap.getOrDefault("TOUR_GUIDE", 0L),
            kindMap.getOrDefault("RENTAL_SERVICE", 0L));

    Map<String, Long> appMap = new HashMap<>();
    jdbc.query(
        "SELECT state, COUNT(*) AS cnt FROM partner_application GROUP BY state",
        rs -> {
          appMap.put(rs.getString("state"), rs.getLong("cnt"));
        });
    ApplicationFunnel applicationFunnel =
        new ApplicationFunnel(
            appMap.getOrDefault("SUBMITTED", 0L),
            appMap.getOrDefault("APPROVED", 0L),
            appMap.getOrDefault("CHANGES_REQUIRED", 0L),
            appMap.getOrDefault("REJECTED", 0L));

    Map<String, Long> hotelMap = new HashMap<>();
    jdbc.query(
        "SELECT status, COUNT(*) AS cnt FROM hotel_booking GROUP BY status",
        rs -> {
          hotelMap.put(rs.getString("status"), rs.getLong("cnt"));
        });
    long hotelConfirmed = hotelMap.getOrDefault("CONFIRMED", 0L);
    long hotelCheckedIn = hotelMap.getOrDefault("CHECKED_IN", 0L);
    long hotelCheckedOut = hotelMap.getOrDefault("CHECKED_OUT", 0L);
    long hotelCancelled =
        hotelMap.getOrDefault("CANCELLED", 0L) + hotelMap.getOrDefault("EXPIRED", 0L);
    long hotelHeld = hotelMap.getOrDefault("HELD", 0L);
    long hotelTotal =
        hotelConfirmed + hotelCheckedIn + hotelCheckedOut + hotelCancelled + hotelHeld;
    HotelBookingFunnel hotelBookingFunnel =
        new HotelBookingFunnel(
            hotelTotal, hotelConfirmed, hotelCheckedIn, hotelCheckedOut, hotelCancelled, hotelHeld);

    Map<String, Long> restMap = new HashMap<>();
    jdbc.query(
        "SELECT state, COUNT(*) AS cnt FROM restaurant_reservation_request GROUP BY state",
        rs -> {
          restMap.put(rs.getString("state"), rs.getLong("cnt"));
        });
    long restRequested = restMap.getOrDefault("REQUESTED", 0L);
    long restConfirmed = restMap.getOrDefault("CONFIRMED", 0L);
    long restCancelled = restMap.getOrDefault("CANCELLED", 0L);
    long restRejected = restMap.getOrDefault("REJECTED", 0L);
    long restTotal = restRequested + restConfirmed + restCancelled + restRejected;
    RestaurantReservationFunnel restaurantFunnel =
        new RestaurantReservationFunnel(
            restTotal, restRequested, restConfirmed, restCancelled, restRejected);

    Map<String, Long> rentalMap = new HashMap<>();
    jdbc.query(
        "SELECT status, COUNT(*) AS cnt FROM rental_booking_order GROUP BY status",
        rs -> {
          rentalMap.put(rs.getString("status"), rs.getLong("cnt"));
        });
    long rentalPending = rentalMap.getOrDefault("PENDING", 0L);
    long rentalConfirmed = rentalMap.getOrDefault("CONFIRMED", 0L);
    long rentalInUse = rentalMap.getOrDefault("IN_USE", 0L);
    long rentalReturned = rentalMap.getOrDefault("RETURNED", 0L);
    long rentalCancelled =
        rentalMap.getOrDefault("CANCELLED", 0L)
            + rentalMap.getOrDefault("REJECTED", 0L)
            + rentalMap.getOrDefault("EXPIRED", 0L);
    long rentalTotal =
        rentalPending + rentalConfirmed + rentalInUse + rentalReturned + rentalCancelled;
    RentalBookingFunnel rentalFunnel =
        new RentalBookingFunnel(
            rentalTotal,
            rentalPending,
            rentalConfirmed,
            rentalInUse,
            rentalReturned,
            rentalCancelled);

    Map<String, Long> guideMap = new HashMap<>();
    jdbc.query(
        "SELECT state, COUNT(*) AS cnt FROM guide_inquiry GROUP BY state",
        rs -> {
          guideMap.put(rs.getString("state"), rs.getLong("cnt"));
        });
    long guideActive =
        guideMap.getOrDefault("SUBMITTED", 0L)
            + guideMap.getOrDefault("IN_DISCUSSION", 0L)
            + guideMap.getOrDefault("PROPOSAL_SENT", 0L);
    long guideAgreed = guideMap.getOrDefault("CONTACT_AGREED", 0L);
    long guideClosed =
        guideMap.getOrDefault("DECLINED", 0L)
            + guideMap.getOrDefault("WITHDRAWN", 0L)
            + guideMap.getOrDefault("EXPIRED", 0L)
            + guideMap.getOrDefault("CLOSED", 0L);
    long guideTotal = guideActive + guideAgreed + guideClosed;
    GuideInquiryFunnel guideFunnel =
        new GuideInquiryFunnel(guideTotal, guideActive, guideAgreed, guideClosed);

    long activeVouchers =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM hotel_voucher WHERE is_active = true", Long.class));
    long redemptionsCount =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM hotel_voucher_redemption WHERE state IN ('APPLIED', 'COMMITTED')",
                Long.class));
    BigDecimal totalDiscountAmount =
        nvlDecimal(
            jdbc.queryForObject(
                "SELECT COALESCE(SUM(discount_amount), 0.00) FROM hotel_voucher_redemption WHERE state IN ('APPLIED', 'COMMITTED')",
                BigDecimal.class));
    VoucherStats voucherStats =
        new VoucherStats(activeVouchers, redemptionsCount, totalDiscountAmount);

    return new PartnerAndBookingStats(
        totalBusinesses,
        publishedBusinesses,
        partnerByKind,
        applicationFunnel,
        hotelBookingFunnel,
        restaurantFunnel,
        rentalFunnel,
        guideFunnel,
        voucherStats);
  }

  private FinanceAndSubscriptionStats buildFinanceAndSubscriptionStats(
      Timestamp tsStart, Timestamp tsEnd) {
    // Hotels operate on Request-to-Confirm (Pay at Property); TripSense does not collect hotel funds or escrow.
    BigDecimal totalHotelGmv = BigDecimal.ZERO;
    BigDecimal periodHotelGmv = BigDecimal.ZERO;
    BigDecimal escrowHolding = BigDecimal.ZERO;
    BigDecimal completedHotelGmv = BigDecimal.ZERO;
    BigDecimal hotelCommissionRevenue = BigDecimal.ZERO;

    BigDecimal subscriptionRevenue =
        nvlDecimal(
            jdbc.queryForObject(
                "SELECT COALESCE(SUM(amount), 0.00) FROM partner_subscription_order WHERE payment_status = 'PAID'",
                BigDecimal.class));
    BigDecimal periodSubscriptionRevenue =
        nvlDecimal(
            jdbc.queryForObject(
                """
                SELECT COALESCE(SUM(amount), 0.00)
                FROM partner_subscription_order
                WHERE payment_status = 'PAID'
                  AND COALESCE(paid_at, created_at) >= ?
                  AND COALESCE(paid_at, created_at) < ?
                """,
                BigDecimal.class,
                tsStart,
                tsEnd));
    long paidSubscriptionOrdersCount =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM partner_subscription_order WHERE payment_status = 'PAID'",
                Long.class));

    BigDecimal totalPlatformRevenue = subscriptionRevenue;
    BigDecimal partnerPayableBalance = BigDecimal.ZERO;

    Map<String, Long> subStatusMap = new HashMap<>();
    jdbc.query(
        "SELECT status, COUNT(*) AS cnt FROM partner_subscription GROUP BY status",
        rs -> {
          subStatusMap.put(rs.getString("status"), rs.getLong("cnt"));
        });
    long activeSubs = subStatusMap.getOrDefault("ACTIVE", 0L);
    long trialSubs = subStatusMap.getOrDefault("TRIAL", 0L);
    long expiredSubs =
        subStatusMap.getOrDefault("EXPIRED", 0L) + subStatusMap.getOrDefault("SUSPENDED", 0L);

    long pendingWithdrawalsCount =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM partner_withdrawal_request WHERE status = 'PENDING_REVIEW'",
                Long.class));
    long pendingRefundsCount =
        nvlLong(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM customer_refund_request WHERE status = 'PENDING_REVIEW'",
                Long.class));

    return new FinanceAndSubscriptionStats(
        totalHotelGmv,
        periodHotelGmv,
        escrowHolding,
        completedHotelGmv,
        hotelCommissionRevenue,
        subscriptionRevenue,
        periodSubscriptionRevenue,
        paidSubscriptionOrdersCount,
        totalPlatformRevenue,
        partnerPayableBalance,
        activeSubs,
        trialSubs,
        expiredSubs,
        pendingWithdrawalsCount,
        pendingRefundsCount);
  }

  private List<DailyPoint> buildDailySeries(
      LocalDate fromDate, LocalDate today, Timestamp tsStart, Timestamp tsEnd) {
    Map<LocalDate, long[]> countsMap = new LinkedHashMap<>();
    Map<LocalDate, BigDecimal[]> moneyMap = new LinkedHashMap<>();

    for (LocalDate d = fromDate; !d.isAfter(today); d = d.plusDays(1)) {
      countsMap.put(d, new long[] {0L, 0L, 0L});
      moneyMap.put(d, new BigDecimal[] {BigDecimal.ZERO, BigDecimal.ZERO});
    }

    String zoneId = PLATFORM_ZONE.getId();

    jdbc.query(
        "SELECT (created_at AT TIME ZONE ?)::date AS d, COUNT(*) AS cnt FROM trips WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ? GROUP BY 1",
        rs -> {
          LocalDate d = rs.getDate("d").toLocalDate();
          long[] arr = countsMap.get(d);
          if (arr != null) arr[0] += rs.getLong("cnt");
        },
        zoneId,
        tsStart,
        tsEnd);

    jdbc.query(
        "SELECT (created_at AT TIME ZONE ?)::date AS d, COUNT(*) AS cnt FROM itinerary_commit_receipts WHERE created_at >= ? AND created_at < ? GROUP BY 1",
        rs -> {
          LocalDate d = rs.getDate("d").toLocalDate();
          long[] arr = countsMap.get(d);
          if (arr != null) arr[1] += rs.getLong("cnt");
        },
        zoneId,
        tsStart,
        tsEnd);

    jdbc.query(
        "SELECT (created_at AT TIME ZONE ?)::date AS d, COUNT(*) AS cnt FROM hotel_booking WHERE created_at >= ? AND created_at < ? AND status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT') GROUP BY 1",
        rs -> {
          LocalDate d = rs.getDate("d").toLocalDate();
          long[] arr = countsMap.get(d);
          if (arr != null) arr[2] += rs.getLong("cnt");
        },
        zoneId,
        tsStart,
        tsEnd);

    jdbc.query(
        "SELECT (created_at AT TIME ZONE ?)::date AS d, COUNT(*) AS cnt FROM restaurant_reservation_request WHERE created_at >= ? AND created_at < ? GROUP BY 1",
        rs -> {
          LocalDate d = rs.getDate("d").toLocalDate();
          long[] arr = countsMap.get(d);
          if (arr != null) arr[2] += rs.getLong("cnt");
        },
        zoneId,
        tsStart,
        tsEnd);

    jdbc.query(
        "SELECT (created_at AT TIME ZONE ?)::date AS d, COUNT(*) AS cnt FROM rental_booking_order WHERE created_at >= ? AND created_at < ? GROUP BY 1",
        rs -> {
          LocalDate d = rs.getDate("d").toLocalDate();
          long[] arr = countsMap.get(d);
          if (arr != null) arr[2] += rs.getLong("cnt");
        },
        zoneId,
        tsStart,
        tsEnd);

    jdbc.query(
        """
        SELECT (COALESCE(p.paid_at, p.created_at) AT TIME ZONE ?)::date AS d,
               COALESCE(SUM(p.amount), 0) AS gmv_amt,
               COALESCE(SUM(CASE WHEN b.status = 'CHECKED_OUT' THEN p.amount ELSE 0 END), 0) AS completed_amt
        FROM hotel_payos_payment p
        JOIN hotel_booking b ON b.id = p.booking_id
        WHERE p.state = 'PAID'
          AND COALESCE(p.paid_at, p.created_at) >= ?
          AND COALESCE(p.paid_at, p.created_at) < ?
        GROUP BY 1
        """,
        rs -> {
          LocalDate d = rs.getDate("d").toLocalDate();
          BigDecimal[] arr = moneyMap.get(d);
          if (arr != null) {
            BigDecimal gmv = nvlDecimal(rs.getBigDecimal("gmv_amt"));
            BigDecimal completedGmv = nvlDecimal(rs.getBigDecimal("completed_amt"));
            arr[0] = arr[0].add(gmv);
            arr[1] =
                arr[1].add(
                    completedGmv.multiply(new BigDecimal("0.10")).setScale(0, RoundingMode.HALF_UP));
          }
        },
        zoneId,
        tsStart,
        tsEnd);

    jdbc.query(
        """
        SELECT (COALESCE(paid_at, created_at) AT TIME ZONE ?)::date AS d, COALESCE(SUM(amount), 0) AS amt
        FROM partner_subscription_order
        WHERE payment_status = 'PAID'
          AND COALESCE(paid_at, created_at) >= ?
          AND COALESCE(paid_at, created_at) < ?
        GROUP BY 1
        """,
        rs -> {
          LocalDate d = rs.getDate("d").toLocalDate();
          BigDecimal[] arr = moneyMap.get(d);
          if (arr != null) {
            BigDecimal subAmt = nvlDecimal(rs.getBigDecimal("amt"));
            arr[0] = arr[0].add(subAmt);
            arr[1] = arr[1].add(subAmt);
          }
        },
        zoneId,
        tsStart,
        tsEnd);

    List<DailyPoint> points = new ArrayList<>(countsMap.size());
    for (Map.Entry<LocalDate, long[]> entry : countsMap.entrySet()) {
      LocalDate d = entry.getKey();
      long[] counts = entry.getValue();
      BigDecimal[] money = moneyMap.get(d);
      points.add(new DailyPoint(d, counts[0], counts[1], counts[2], money[0], money[1]));
    }
    return points;
  }

  private List<PlatformActivityItem> buildRecentEvents() {
    List<PlatformActivityItem> events = new ArrayList<>();

    jdbc.query(
        """
        SELECT id, name, destination_name, visibility, created_at
        FROM trips
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 4
        """,
        rs -> {
          String id = rs.getString("id");
          String dest = rs.getString("destination_name");
          String name = rs.getString("name");
          String safeName = name != null && !name.isBlank() ? name : "Untitled trip";
          String safeDest = dest != null && !dest.isBlank() ? dest : "Unknown destination";
          Timestamp ts = rs.getTimestamp("created_at");
          events.add(
              new PlatformActivityItem(
                  "trip-" + id,
                  "TRIP_CREATED",
                  "Traveler #" + id.substring(0, 6),
                  "Created trip \"" + safeName + "\" to " + safeDest,
                  rs.getString("visibility"),
                  ts != null ? ts.toInstant() : Instant.now()));
        });

    jdbc.query(
        """
        SELECT r.id, t.destination_name, r.created_at
        FROM itinerary_commit_receipts r
        JOIN trips t ON t.id = r.trip_id
        ORDER BY r.created_at DESC
        LIMIT 3
        """,
        rs -> {
          String id = rs.getString("id");
          String dest = rs.getString("destination_name");
          String safeDest = dest != null && !dest.isBlank() ? dest : "Unknown destination";
          Timestamp ts = rs.getTimestamp("created_at");
          events.add(
              new PlatformActivityItem(
                  "ai-" + id,
                  "AI_ITINERARY_COMMITTED",
                  "AI Planner",
                  "Generated & committed AI itinerary for " + safeDest,
                  "COMMITTED",
                  ts != null ? ts.toInstant() : Instant.now()));
        });

    jdbc.query(
        """
        SELECT id, property_name, status, created_at
        FROM hotel_booking
        ORDER BY created_at DESC
        LIMIT 3
        """,
        rs -> {
          String id = rs.getString("id");
          String prop = rs.getString("property_name");
          String status = rs.getString("status");
          Timestamp ts = rs.getTimestamp("created_at");
          events.add(
              new PlatformActivityItem(
                  "hotel-" + id,
                  "HOTEL_BOOKING",
                  "Booking #" + id.substring(0, 6),
                  "Hotel reservation at " + prop,
                  status,
                  ts != null ? ts.toInstant() : Instant.now()));
        });

    jdbc.query(
        """
        SELECT a.id, b.display_name, b.kind, a.state, a.submitted_at
        FROM partner_application a
        JOIN partner_business b ON b.id = a.business_id
        ORDER BY a.submitted_at DESC
        LIMIT 3
        """,
        rs -> {
          String id = rs.getString("id");
          String bizName = rs.getString("display_name");
          String kind = rs.getString("kind");
          String state = rs.getString("state");
          Timestamp ts = rs.getTimestamp("submitted_at");
          events.add(
              new PlatformActivityItem(
                  "partner-" + id,
                  "PARTNER_APPLICATION",
                  bizName,
                  "Partner onboarding (" + kind + ")",
                  state,
                  ts != null ? ts.toInstant() : Instant.now()));
        });

    events.sort(Comparator.comparing(PlatformActivityItem::occurredAt).reversed());
    return events.size() > 8 ? events.subList(0, 8) : events;
  }

  private DeepTripAnalytics buildDeepTripAnalytics() {
    double[] aiMetrics = new double[] {0.0, 0.0};
    BigDecimal[] aiBudgets = new BigDecimal[] {BigDecimal.ZERO, BigDecimal.ZERO};
    double[] manualMetrics = new double[] {0.0, 0.0};

    jdbc.query(
        """
        SELECT
          CASE WHEN EXISTS (SELECT 1 FROM itinerary_commit_receipts r WHERE r.trip_id = t.id)
               THEN 'AI' ELSE 'MANUAL' END AS seg,
          COALESCE(AVG(GREATEST(1, (t.end_date - t.start_date) + 1)), 1.0) AS avg_days,
          COALESCE(AVG(COALESCE(t.traveler_count, 1)), 1.0) AS avg_travelers,
          COALESCE(AVG(t.budget_amount), 0) AS avg_budget
        FROM trips t
        WHERE t.deleted_at IS NULL
        GROUP BY 1
        """,
        rs -> {
          String seg = rs.getString("seg");
          double d = round1(rs.getDouble("avg_days"));
          double tr = round1(rs.getDouble("avg_travelers"));
          BigDecimal b =
              nvlDecimal(rs.getBigDecimal("avg_budget")).setScale(0, RoundingMode.HALF_UP);
          if ("AI".equals(seg)) {
            aiMetrics[0] = d;
            aiMetrics[1] = tr;
            aiBudgets[0] = b;
          } else {
            manualMetrics[0] = d;
            manualMetrics[1] = tr;
            aiBudgets[1] = b;
          }
        });

    AiVsManualComparison aiVsManual =
        new AiVsManualComparison(
            aiMetrics[0],
            manualMetrics[0],
            aiMetrics[1],
            manualMetrics[1],
            aiBudgets[0],
            aiBudgets[1]);

    long[] durCounts = new long[] {0L, 0L, 0L};
    jdbc.query(
        """
        SELECT
          CASE
            WHEN t.start_date IS NULL OR t.end_date IS NULL OR ((t.end_date - t.start_date) + 1) <= 2 THEN 'SHORT'
            WHEN ((t.end_date - t.start_date) + 1) <= 5 THEN 'MEDIUM'
            ELSE 'LONG'
          END AS bucket,
          COUNT(*) AS cnt
        FROM trips t
        WHERE t.deleted_at IS NULL
        GROUP BY 1
        """,
        rs -> {
          String b = rs.getString("bucket");
          long cnt = rs.getLong("cnt");
          if ("SHORT".equals(b)) durCounts[0] = cnt;
          else if ("MEDIUM".equals(b)) durCounts[1] = cnt;
          else durCounts[2] = cnt;
        });
    DurationDistribution durationDist =
        new DurationDistribution(durCounts[0], durCounts[1], durCounts[2]);

    double avgLeadTime =
        round1(
            nvlDouble(
                jdbc.queryForObject(
                    """
                    SELECT COALESCE(AVG(GREATEST(0, (start_date - (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date))), 0.0)
                    FROM trips
                    WHERE deleted_at IS NULL AND start_date IS NOT NULL
                    """,
                    Double.class)));

    long[] leadBuckets = new long[] {0L, 0L, 0L};
    jdbc.query(
        """
        SELECT
          CASE
            WHEN start_date IS NULL OR (start_date - (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) <= 7 THEN 'LAST_MINUTE'
            WHEN (start_date - (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) <= 30 THEN 'STANDARD'
            ELSE 'EARLY_BIRD'
          END AS bucket,
          COUNT(*) AS cnt
        FROM trips
        WHERE deleted_at IS NULL
        GROUP BY 1
        """,
        rs -> {
          String b = rs.getString("bucket");
          long c = rs.getLong("cnt");
          if ("LAST_MINUTE".equals(b)) leadBuckets[0] = c;
          else if ("STANDARD".equals(b)) leadBuckets[1] = c;
          else leadBuckets[2] = c;
        });

    String[] peakMonth = new String[] {"N/A"};
    long[] peakCount = new long[] {0L};
    jdbc.query(
        """
        SELECT to_char(COALESCE(start_date, (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date), 'YYYY-MM') AS ym,
               COUNT(*) AS cnt
        FROM trips
        WHERE deleted_at IS NULL
        GROUP BY 1
        ORDER BY cnt DESC, ym DESC
        LIMIT 1
        """,
        rs -> {
          peakMonth[0] = rs.getString("ym");
          peakCount[0] = rs.getLong("cnt");
        });

    LeadTimeAndSeasonality leadTimeAndSeasonality =
        new LeadTimeAndSeasonality(
            avgLeadTime, leadBuckets[0], leadBuckets[1], leadBuckets[2], peakMonth[0], peakCount[0]);

    long[] userTripRet = new long[] {0L, 0L};
    jdbc.query(
        """
        SELECT
          COUNT(*) AS active_creators,
          SUM(CASE WHEN trip_cnt >= 2 THEN 1 ELSE 0 END) AS repeat_creators
        FROM (
          SELECT owner_user_id, COUNT(*) AS trip_cnt
          FROM trips
          WHERE deleted_at IS NULL AND owner_user_id IS NOT NULL
          GROUP BY owner_user_id
        ) sub
        """,
        rs -> {
          userTripRet[0] = rs.getLong("active_creators");
          userTripRet[1] = rs.getLong("repeat_creators");
        });
    double repeatRate =
        userTripRet[0] > 0 ? round1((userTripRet[1] * 100.0) / userTripRet[0]) : 0.0;

    double avgSlaHours =
        round1(
            nvlDouble(
                jdbc.queryForObject(
                    """
                    SELECT COALESCE(AVG(GREATEST(0.1, EXTRACT(EPOCH FROM (decided_at - submitted_at)) / 3600.0)), 0.0)
                    FROM partner_application
                    WHERE submitted_at IS NOT NULL AND decided_at IS NOT NULL
                    """,
                    Double.class)));

    UserRetentionAndSla retentionAndSla =
        new UserRetentionAndSla(userTripRet[0], userTripRet[1], repeatRate, avgSlaHours);

    return new DeepTripAnalytics(aiVsManual, durationDist, leadTimeAndSeasonality, retentionAndSla);
  }

  public record UserTripCountsDto(Map<UUID, Long> counts) {}

  /** Returns active (non-archived, non-deleted) trip counts grouped by owner user ID. */
  @Transactional(readOnly = true)
  public UserTripCountsDto getUserTripCounts(AuthenticatedUser admin, List<UUID> userIds) {
    requireAdmin(admin);
    if (userIds == null || userIds.isEmpty()) {
      return new UserTripCountsDto(Map.of());
    }
    List<UUID> distinctIds = userIds.stream().filter(id -> id != null).distinct().toList();
    if (distinctIds.isEmpty()) {
      return new UserTripCountsDto(Map.of());
    }
    if (distinctIds.size() > 100) {
      throw new TripServiceException(
          "TOO_MANY_USER_IDS",
          "At most 100 userIds may be queried per batch",
          HttpStatus.BAD_REQUEST);
    }

    String placeholders =
        distinctIds.stream().map(id -> "?").collect(Collectors.joining(", "));
    String sql =
        """
        SELECT owner_user_id, COUNT(*) AS trip_count
        FROM trips
        WHERE deleted_at IS NULL
          AND archived_at IS NULL
          AND owner_user_id IN (%s)
        GROUP BY owner_user_id
        """
            .formatted(placeholders);

    Map<UUID, Long> counts = new LinkedHashMap<>();
    distinctIds.forEach(id -> counts.put(id, 0L));
    jdbc.query(
        sql,
        rs -> {
          UUID ownerId = rs.getObject("owner_user_id", UUID.class);
          if (ownerId != null) {
            counts.put(ownerId, rs.getLong("trip_count"));
          }
        },
        distinctIds.toArray());

    return new UserTripCountsDto(counts);
  }

  private static double nvlDouble(Double val) {
    return val != null ? val : 0.0;
  }

  static double computeGrowthPercent(long current, long previous) {
    if (previous <= 0) {
      return current > 0 ? 100.0 : 0.0;
    }
    double raw = ((current - previous) * 100.0) / previous;
    return round1(raw);
  }

  private static double round1(double val) {
    return BigDecimal.valueOf(val).setScale(1, RoundingMode.HALF_UP).doubleValue();
  }

  private static long nvlLong(Long val) {
    return val != null ? val : 0L;
  }

  private static BigDecimal nvlDecimal(BigDecimal val) {
    return val != null ? val : BigDecimal.ZERO;
  }
}

