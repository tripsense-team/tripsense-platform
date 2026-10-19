package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.PartnerAnalyticsSummaryDto;
import fu.tripsense.tripservice.partner.dto.PartnerAnalyticsDashboardDto;
import fu.tripsense.tripservice.partner.dto.PartnerAnalyticsDashboardDto.BusinessAnalytics;
import fu.tripsense.tripservice.partner.dto.PartnerAnalyticsDashboardDto.DailyAnalytics;
import fu.tripsense.tripservice.partner.dto.PartnerAnalyticsSummaryDto.ExpectedGuests;
import fu.tripsense.tripservice.partner.dto.PartnerAnalyticsSummaryDto.Metrics;
import fu.tripsense.tripservice.partner.dto.PartnerAnalyticsSummaryDto.Period;
import fu.tripsense.tripservice.partner.dto.PartnerAnalyticsSummaryDto.Rate;
import fu.tripsense.tripservice.partner.enums.BusinessKind;
import fu.tripsense.tripservice.partner.enums.MembershipRole;
import fu.tripsense.tripservice.partner.enums.MembershipState;
import fu.tripsense.tripservice.partner.enums.PartnerCapability;
import fu.tripsense.tripservice.partner.enums.PublicationState;
import fu.tripsense.tripservice.partner.repository.PartnerBusinessCapabilityRepository;
import fu.tripsense.tripservice.partner.repository.PartnerBusinessMemberRepository;
import fu.tripsense.tripservice.partner.repository.PartnerBusinessRepository;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.Set;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.scheduling.annotation.Scheduled;

@Service
@RequiredArgsConstructor
public class PartnerAnalyticsService {
  private static final ZoneId DEFAULT_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
  private static final Set<MembershipRole> ANALYTICS_ROLES = Set.of(MembershipRole.OWNER, MembershipRole.MANAGER);

  private final JdbcTemplate jdbc;
  private final PartnerBusinessRepository businessRepository;
  private final PartnerBusinessMemberRepository memberRepository;
  private final PartnerBusinessCapabilityRepository capabilityRepository;

  @Transactional(readOnly = true)
  public PartnerAnalyticsDashboardDto getDashboard(AuthenticatedUser user, UUID selectedBusinessId, int periodDays) {
    if (periodDays != 7 && periodDays != 30 && periodDays != 90) {
      throw new TripServiceException("INVALID_ANALYTICS_PERIOD", "Unsupported analytics period", HttpStatus.BAD_REQUEST);
    }
    if (user == null) throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    List<UUID> authorizedIds = memberRepository.findByIdUserIdAndState(user.id(), MembershipState.ACTIVE).stream()
        .filter(member -> ANALYTICS_ROLES.contains(member.getRole()))
        .map(member -> member.getId().getBusinessId())
        .filter(id -> selectedBusinessId == null || selectedBusinessId.equals(id))
        .toList();
    if (selectedBusinessId != null && authorizedIds.isEmpty()) throw notFound();

    var businesses = businessRepository.findAllById(authorizedIds).stream()
        .filter(b -> b.getOperationState().name().equals("ACTIVE"))
        .filter(b -> b.getKind() == BusinessKind.HOTEL || b.getKind() == BusinessKind.RESTAURANT)
        .toList();
    List<BusinessAnalytics> results = new ArrayList<>();
    for (var business : businesses) {
      String zoneName = business.getKind() == BusinessKind.RESTAURANT
          ? jdbc.query("SELECT time_zone FROM restaurant_availability WHERE business_id = ?", rs -> rs.next() ? rs.getString(1) : null, business.getId())
          : jdbc.query("SELECT time_zone FROM hotel_property WHERE business_id = ? AND status='ACTIVE' ORDER BY created_at LIMIT 1", rs -> rs.next() ? rs.getString(1) : null, business.getId());
      ZoneId zone = zoneName == null ? DEFAULT_ZONE : safeZone(zoneName);
      LocalDate today = LocalDate.now(zone);
      LocalDate from = today.minusDays(periodDays - 1L);
      Instant start = from.atStartOfDay(zone).toInstant();
      Instant end = today.plusDays(1).atStartOfDay(zone).toInstant();
      LocalDate expectedToday = LocalDate.now(zone);
      List<DailyAnalytics> daily = new ArrayList<>();
      for (LocalDate day = from; day.isBefore(today.plusDays(1)); day = day.plusDays(1)) {
        daily.add(new DailyAnalytics(day, 0, 0, BigDecimal.ZERO));
      }
      long views = 0, bookings = 0, confirmed = 0, cancelled = 0, expected = 0;
      java.util.Map<LocalDate, long[]> counts = new java.util.HashMap<>();
      boolean viewsAvailable = business.getKind() == BusinessKind.RESTAURANT;
      boolean revenueAvailable = business.getKind() == BusinessKind.HOTEL;
      if (viewsAvailable) {
        views = nvl(jdbc.queryForObject("SELECT COUNT(*) FROM partner_business_view_daily_dedupe WHERE business_id=? AND view_date>=? AND view_date<?", Long.class, business.getId(), from, today.plusDays(1)));
        jdbc.query("SELECT view_date, COUNT(*) FROM partner_business_view_daily_dedupe WHERE business_id=? AND view_date>=? AND view_date<? GROUP BY view_date", rs -> {
          while (rs.next()) counts.computeIfAbsent(rs.getDate(1).toLocalDate(), ignored -> new long[2])[0] = rs.getLong(2);
        }, business.getId(), from, today.plusDays(1));
      }
      if (business.getKind() == BusinessKind.RESTAURANT) {
        bookings = nvl(jdbc.queryForObject("SELECT COUNT(*) FROM restaurant_reservation_request WHERE business_id=? AND created_at>=? AND created_at<?", Long.class, business.getId(), Timestamp.from(start), Timestamp.from(end)));
        expected = nvl(jdbc.queryForObject("SELECT COALESCE(SUM(adults+children),0) FROM restaurant_reservation_request WHERE business_id=? AND start_at>=now() AND start_at<now()+interval '30 days' AND (state='CONFIRMED' OR (state='REQUESTED' AND hold_expires_at>now()))", Long.class, business.getId()));
        confirmed = nvl(jdbc.queryForObject("SELECT COUNT(DISTINCT r.id) FROM restaurant_reservation_request r JOIN restaurant_reservation_transition t ON t.reservation_id=r.id WHERE r.business_id=? AND r.created_at>=? AND r.created_at<? AND t.from_state='REQUESTED' AND t.to_state='CONFIRMED'", Long.class, business.getId(), Timestamp.from(start), Timestamp.from(end)));
        cancelled = nvl(jdbc.queryForObject("SELECT COUNT(*) FROM restaurant_reservation_request WHERE business_id=? AND created_at>=? AND created_at<? AND state='CANCELLED'", Long.class, business.getId(), Timestamp.from(start), Timestamp.from(end)));
        jdbc.query("SELECT (created_at AT TIME ZONE ?)::date, COUNT(*) FROM restaurant_reservation_request WHERE business_id=? AND created_at>=? AND created_at<? GROUP BY 1", rs -> {
          while (rs.next()) counts.computeIfAbsent(rs.getDate(1).toLocalDate(), ignored -> new long[2])[1] = rs.getLong(2);
        }, zone.getId(), business.getId(), Timestamp.from(start), Timestamp.from(end));
      } else {
        bookings = nvl(jdbc.queryForObject("SELECT COUNT(*) FROM hotel_booking WHERE business_id=? AND created_at>=? AND created_at<? AND status IN ('CONFIRMED','CHECKED_IN','CHECKED_OUT')", Long.class, business.getId(), Timestamp.from(start), Timestamp.from(end)));
        expected = nvl(jdbc.queryForObject("SELECT COALESCE(SUM(guests),0) FROM hotel_booking WHERE business_id=? AND status='CONFIRMED' AND check_in>=? AND check_in<?", Long.class, business.getId(), expectedToday, expectedToday.plusDays(30)));
        confirmed = bookings;
        cancelled = nvl(jdbc.queryForObject("SELECT COUNT(*) FROM hotel_booking WHERE business_id=? AND created_at>=? AND created_at<? AND status='CANCELLED'", Long.class, business.getId(), Timestamp.from(start), Timestamp.from(end)));
        jdbc.query("SELECT (created_at AT TIME ZONE ?)::date, COUNT(*) FROM hotel_booking WHERE business_id=? AND created_at>=? AND created_at<? AND status IN ('CONFIRMED','CHECKED_IN','CHECKED_OUT') GROUP BY 1", rs -> {
          while (rs.next()) counts.computeIfAbsent(rs.getDate(1).toLocalDate(), ignored -> new long[2])[1] = rs.getLong(2);
        }, zone.getId(), business.getId(), Timestamp.from(start), Timestamp.from(end));
      }
      BigDecimal revenue = BigDecimal.ZERO;
      if (revenueAvailable) {
        revenue = jdbc.queryForObject("SELECT COALESCE(SUM(amount),0) FROM financial_ledger_entry WHERE business_id=? AND entry_type='BOOKING_SETTLEMENT' AND amount>0 AND created_at>=? AND created_at<?", BigDecimal.class, business.getId(), Timestamp.from(start), Timestamp.from(end));
      }
      List<DailyAnalytics> filled = daily.stream().map(day -> {
        long[] value = counts.getOrDefault(day.date(), new long[2]);
        return new DailyAnalytics(day.date(), value[0], value[1], BigDecimal.ZERO);
      }).toList();
      if (revenueAvailable) {
        var earningsByDate = new java.util.HashMap<LocalDate, BigDecimal>();
        jdbc.query("SELECT (created_at AT TIME ZONE ?)::date, SUM(amount) FROM financial_ledger_entry WHERE business_id=? AND entry_type='BOOKING_SETTLEMENT' AND amount>0 AND created_at>=? AND created_at<? GROUP BY 1",
            rs -> { while (rs.next()) earningsByDate.put(rs.getDate(1).toLocalDate(), rs.getBigDecimal(2)); },
            zone.getId(), business.getId(), Timestamp.from(start), Timestamp.from(end));
        filled = filled.stream().map(day -> new DailyAnalytics(day.date(), day.views(), day.bookings(), earningsByDate.getOrDefault(day.date(), BigDecimal.ZERO))).toList();
      }
      results.add(new BusinessAnalytics(business.getId(), business.getDisplayName(), business.getKind().name(), views,
          viewsAvailable, bookings, expected, confirmed, cancelled, revenue, revenueAvailable, filled));
    }
    return new PartnerAnalyticsDashboardDto(periodDays, LocalDate.now(DEFAULT_ZONE).minusDays(periodDays - 1L), LocalDate.now(DEFAULT_ZONE).plusDays(1), results);
  }

  @Transactional
  public void recordRestaurantView(AuthenticatedUser user, UUID businessId, UUID sessionKey) {
    var business = businessRepository.findById(businessId)
        .filter(item -> item.getKind() == BusinessKind.RESTAURANT
            && item.getPublicationState() == PublicationState.PUBLISHED
            && item.getOperationState().name().equals("ACTIVE"))
        .orElseThrow(() -> notFound());
    boolean eligible = capabilityRepository
        .findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.RESTAURANT_LISTING)
        .filter(capability -> capability.getRevokedAt() == null)
        .isPresent() && business.isPublicEligible(true);
    if (!eligible) throw notFound();

    if (user != null && memberRepository.findByIdBusinessIdAndIdUserId(businessId, user.id())
        .filter(member -> member.getState() == MembershipState.ACTIVE).isPresent()) {
      return;
    }

    String hash = sha256(sessionKey.toString());
    jdbc.update("""
        INSERT INTO partner_business_view_daily_dedupe(business_id, view_date, session_key_hash)
        VALUES (?, ?, ?)
        ON CONFLICT (business_id, view_date, session_key_hash) DO NOTHING
        """, businessId, LocalDate.now(DEFAULT_ZONE), hash);
  }

  @Transactional(readOnly = true)
  public PartnerAnalyticsSummaryDto getSummary(AuthenticatedUser user, UUID businessId, int periodDays) {
    if (periodDays != 7 && periodDays != 30 && periodDays != 90) {
      throw new TripServiceException("INVALID_ANALYTICS_PERIOD", "Unsupported analytics period", HttpStatus.BAD_REQUEST);
    }
    if (user == null) throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    var business = businessRepository.findById(businessId)
        .filter(item -> item.getKind() == BusinessKind.RESTAURANT)
        .orElseThrow(() -> notFound());
    memberRepository.findByIdBusinessIdAndIdUserId(businessId, user.id())
        .filter(item -> item.getState() == MembershipState.ACTIVE && ANALYTICS_ROLES.contains(item.getRole()))
        .orElseThrow(() -> notFound());

    String zoneName = jdbc.query("SELECT time_zone FROM restaurant_availability WHERE business_id = ?",
        rs -> rs.next() ? rs.getString(1) : null, businessId);
    ZoneId zone = zoneName == null ? DEFAULT_ZONE : safeZone(zoneName);
    LocalDate today = LocalDate.now(zone);
    LocalDate from = today.minusDays(periodDays - 1L);
    LocalDate previousFrom = from.minusDays(periodDays);
    Instant periodStart = from.atStartOfDay(zone).toInstant();
    Instant periodEnd = today.plusDays(1).atStartOfDay(zone).toInstant();
    Instant previousStart = previousFrom.atStartOfDay(zone).toInstant();
    Instant expectedFrom = Instant.now();
    Instant expectedTo = expectedFrom.atZone(zone).plusDays(30).toInstant();

    Metrics current = metrics(businessId, from, today.plusDays(1), periodStart, periodEnd);
    Metrics previous = metrics(businessId, previousFrom, from, previousStart, periodStart);
    Long expected = jdbc.queryForObject("""
        SELECT COALESCE(SUM(adults + children), 0)
        FROM restaurant_reservation_request
        WHERE business_id = ? AND start_at >= ? AND start_at < ?
          AND (state = 'CONFIRMED' OR (state = 'REQUESTED' AND hold_expires_at > now()))
        """, Long.class, businessId, Timestamp.from(expectedFrom), Timestamp.from(expectedTo));

    return new PartnerAnalyticsSummaryDto(
        businessId, zone.getId(), new Period(periodDays, from, today.plusDays(1)), current, previous,
        new ExpectedGuests(expected == null ? 0 : expected, expectedFrom, expectedTo), Instant.now());
  }

  private Metrics metrics(UUID businessId, LocalDate from, LocalDate to, Instant start, Instant end) {
    Long views = jdbc.queryForObject("""
        SELECT COUNT(*) FROM partner_business_view_daily_dedupe
        WHERE business_id = ? AND view_date >= ? AND view_date < ?
        """, Long.class, businessId, from, to);
    Long requests = jdbc.queryForObject("""
        SELECT COUNT(*) FROM restaurant_reservation_request
        WHERE business_id = ? AND created_at >= ? AND created_at < ?
        """, Long.class, businessId, Timestamp.from(start), Timestamp.from(end));
    Long confirmed = jdbc.queryForObject("""
        SELECT COUNT(DISTINCT r.id) FROM restaurant_reservation_request r
        JOIN restaurant_reservation_transition t ON t.reservation_id = r.id
        WHERE r.business_id = ? AND r.created_at >= ? AND r.created_at < ?
          AND t.from_state = 'REQUESTED' AND t.to_state = 'CONFIRMED'
        """, Long.class, businessId, Timestamp.from(start), Timestamp.from(end));
    Long decided = jdbc.queryForObject("""
        SELECT COUNT(DISTINCT r.id) FROM restaurant_reservation_request r
        JOIN restaurant_reservation_transition t ON t.reservation_id = r.id
        WHERE r.business_id = ? AND r.created_at >= ? AND r.created_at < ?
          AND t.from_state = 'REQUESTED' AND t.to_state IN ('CONFIRMED', 'REJECTED')
        """, Long.class, businessId, Timestamp.from(start), Timestamp.from(end));
    Long cancellationDenominator = jdbc.queryForObject("""
        SELECT COUNT(DISTINCT r.id) FROM restaurant_reservation_request r
        JOIN restaurant_reservation_transition confirmed ON confirmed.reservation_id = r.id
        WHERE r.business_id = ? AND confirmed.created_at >= ? AND confirmed.created_at < ?
          AND confirmed.from_state = 'REQUESTED' AND confirmed.to_state = 'CONFIRMED'
        """, Long.class, businessId, Timestamp.from(start), Timestamp.from(end));
    Long cancelled = jdbc.queryForObject("""
        SELECT COUNT(DISTINCT r.id) FROM restaurant_reservation_request r
        JOIN restaurant_reservation_transition confirmed ON confirmed.reservation_id = r.id
        JOIN restaurant_reservation_transition cancelled ON cancelled.reservation_id = r.id
        WHERE r.business_id = ? AND confirmed.created_at >= ? AND confirmed.created_at < ?
          AND confirmed.from_state = 'REQUESTED' AND confirmed.to_state = 'CONFIRMED'
          AND cancelled.from_state = 'CONFIRMED' AND cancelled.to_state = 'CANCELLED'
          AND cancelled.created_at >= ? AND cancelled.created_at < ?
        """, Long.class, businessId, Timestamp.from(start), Timestamp.from(end), Timestamp.from(start), Timestamp.from(end));
    return new Metrics(nvl(views), nvl(requests), rate(nvl(confirmed), nvl(decided)), rate(nvl(cancelled), nvl(cancellationDenominator)));
  }

  @Scheduled(fixedDelayString = "${partner.analytics.dedupe-cleanup-delay-ms:86400000}")
  @Transactional
  public void cleanupExpiredViewDedupeRows() {
    jdbc.update("""
        DELETE FROM partner_business_view_daily_dedupe
        WHERE ctid IN (
          SELECT ctid FROM partner_business_view_daily_dedupe
          WHERE created_at < now() - INTERVAL '200 days'
          ORDER BY created_at LIMIT 5000
        )
        """);
  }

  private Rate rate(long numerator, long denominator) {
    return new Rate(numerator, denominator, denominator == 0 ? 0d : (double) numerator / denominator);
  }

  private long nvl(Long value) { return value == null ? 0L : value; }

  private ZoneId safeZone(String zone) {
    try { return ZoneId.of(zone); } catch (RuntimeException ignored) { return DEFAULT_ZONE; }
  }

  private TripServiceException notFound() {
    return new TripServiceException("RESTAURANT_NOT_FOUND", "Restaurant not found", HttpStatus.NOT_FOUND);
  }

  private String sha256(String value) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }
}
