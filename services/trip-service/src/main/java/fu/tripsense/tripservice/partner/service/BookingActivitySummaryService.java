package fu.tripsense.tripservice.partner.service;

import static fu.tripsense.tripservice.partner.dto.BookingActivitySummaryDtos.*;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Aggregates lightweight unread/pending booking counts and smart tab recommendations
 * for both Traveler (/reservations) and Partner (/partner) views.
 */
@Service
public class BookingActivitySummaryService {

  private static final List<String> RESTAURANT_DECISION_EVENTS = List.of(
      "RESTAURANT_RESERVATION_CONFIRMED",
      "RESTAURANT_RESERVATION_REJECTED",
      "RESTAURANT_RESERVATION_CANCELLED");

  private static final List<String> RESTAURANT_USER_EVENTS = List.of(
      "RESTAURANT_RESERVATION_PLACED",
      "RESTAURANT_RESERVATION_CONFIRMED",
      "RESTAURANT_RESERVATION_REJECTED",
      "RESTAURANT_RESERVATION_CANCELLED");

  private static final List<String> RENTAL_DECISION_EVENTS = List.of(
      "RENTAL_BOOKING_CONFIRMED",
      "RENTAL_BOOKING_REJECTED",
      "RENTAL_BOOKING_HANDED_OVER",
      "RENTAL_BOOKING_RETURNED");

  private static final List<String> RENTAL_USER_EVENTS = List.of(
      "RENTAL_BOOKING_PLACED",
      "RENTAL_BOOKING_CONFIRMED",
      "RENTAL_BOOKING_REJECTED",
      "RENTAL_BOOKING_HANDED_OVER",
      "RENTAL_BOOKING_RETURNED",
      "RENTAL_BOOKING_CANCELLED");

  private static final List<String> PARTNER_BOOKING_ALERT_EVENTS = List.of(
      "HOTEL_BOOKING_REQUESTED",
      "HOTEL_BOOKING_CANCELLED_BY_CUSTOMER",
      "RESTAURANT_RESERVATION_REQUESTED",
      "RENTAL_BOOKING_REQUESTED",
      "RENTAL_BOOKING_CANCELLED");

  private final JdbcTemplate db;
  private final NamedParameterJdbcTemplate namedDb;

  @Autowired
  public BookingActivitySummaryService(JdbcTemplate db) {
    this(db, new NamedParameterJdbcTemplate(db));
  }

  BookingActivitySummaryService(JdbcTemplate db, NamedParameterJdbcTemplate namedDb) {
    this.db = db;
    this.namedDb = namedDb;
  }

  @Transactional(readOnly = true)
  public UserReservationActivitySummaryDto getUserSummary(AuthenticatedUser user) {
    if (user == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }

    UUID userId = user.id();
    UserVerticalActivityDto hotels = loadHotelUserActivity(userId);
    UserVerticalActivityDto restaurants = loadRestaurantUserActivity(userId);
    UserVerticalActivityDto rentals = loadRentalUserActivity(userId);

    Map<String, UserVerticalActivityDto> verticals = new LinkedHashMap<>();
    verticals.put("hotels", hotels);
    verticals.put("restaurants", restaurants);
    verticals.put("rentals", rentals);

    long totalAttention = hotels.attentionCount() + restaurants.attentionCount() + rentals.attentionCount();
    long totalUnread = hotels.unreadCount() + restaurants.unreadCount() + rentals.unreadCount();
    String recommended = pickRecommendedUserTab(verticals);

    return UserReservationActivitySummaryDto.builder()
        .totalAttentionCount(totalAttention)
        .unreadNotificationCount(totalUnread)
        .recommendedTab(recommended)
        .verticals(verticals)
        .build();
  }

  @Transactional
  public UserReservationActivitySummaryDto markUserVerticalSeen(
      AuthenticatedUser user, String rawVertical) {
    if (user == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    String vertical = rawVertical == null ? "" : rawVertical.trim().toUpperCase(Locale.ROOT);
    switch (vertical) {
      case "HOTELS" ->
          db.update(
              "UPDATE hotel_notification SET read_at = COALESCE(read_at, clock_timestamp()) WHERE recipient_id = ? AND read_at IS NULL",
              user.id());
      case "RESTAURANTS" -> markPartnerNotificationsReadByEvent(user.id(), RESTAURANT_USER_EVENTS);
      case "RENTALS" -> markPartnerNotificationsReadByEvent(user.id(), RENTAL_USER_EVENTS);
      default ->
          throw new TripServiceException(
              "INVALID_VERTICAL",
              "Vertical must be one of HOTELS, RESTAURANTS, RENTALS",
              HttpStatus.BAD_REQUEST);
    }
    return getUserSummary(user);
  }

  @Transactional(readOnly = true)
  public PartnerBookingsSummaryDto getPartnerSummary(AuthenticatedUser user) {
    if (user == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }

    List<Map<String, Object>> memberBusinesses =
        db.queryForList(
            """
            SELECT DISTINCT b.id AS business_id, b.kind
            FROM partner_business_member m
            JOIN partner_business b ON b.id = m.business_id
            WHERE m.user_id = ? AND m.state = 'ACTIVE'
            """,
            user.id());

    if (memberBusinesses.isEmpty()) {
      return PartnerBookingsSummaryDto.builder()
          .pendingTotal(0)
          .unreadNotificationCount(0)
          .recommendedDashboardTab("businesses")
          .byServiceType(Map.of("HOTEL", 0L, "RESTAURANT", 0L, "RENTAL", 0L))
          .businesses(List.of())
          .build();
    }

    List<UUID> bizIds = new ArrayList<>();
    Map<UUID, String> kindByBiz = new LinkedHashMap<>();
    for (Map<String, Object> row : memberBusinesses) {
      UUID bizId = (UUID) row.get("business_id");
      String kind = Objects.toString(row.get("kind"), "");
      bizIds.add(bizId);
      kindByBiz.put(bizId, kind);
    }

    Map<UUID, CountAndLatest> hotelPending = queryPartnerHotelPending(bizIds);
    Map<UUID, CountAndLatest> restPending = queryPartnerRestaurantPending(bizIds);
    Map<UUID, CountAndLatest> rentalPending = queryPartnerRentalPending(bizIds);
    Map<UUID, Long> unreadByBiz = queryPartnerUnreadByBusiness(user.id(), bizIds);

    long hotelTotal = 0;
    long restTotal = 0;
    long rentalTotal = 0;
    long unreadTotal = 0;
    List<PartnerBusinessActivityDto> businessActivities = new ArrayList<>();

    for (UUID bizId : bizIds) {
      String kind = kindByBiz.getOrDefault(bizId, "");
      CountAndLatest stats = switch (kind) {
        case "HOTEL" -> hotelPending.getOrDefault(bizId, CountAndLatest.EMPTY);
        case "RESTAURANT" -> restPending.getOrDefault(bizId, CountAndLatest.EMPTY);
        case "RENTAL_SERVICE" -> rentalPending.getOrDefault(bizId, CountAndLatest.EMPTY);
        default -> CountAndLatest.EMPTY;
      };
      long bizUnread = unreadByBiz.getOrDefault(bizId, 0L);

      switch (kind) {
        case "HOTEL" -> hotelTotal += stats.count();
        case "RESTAURANT" -> restTotal += stats.count();
        case "RENTAL_SERVICE" -> rentalTotal += stats.count();
        default -> {}
      }
      unreadTotal += bizUnread;

      businessActivities.add(
          PartnerBusinessActivityDto.builder()
              .businessId(bizId)
              .kind(kind)
              .pendingCount(stats.count())
              .unreadNotificationCount(bizUnread)
              .latestPendingAt(stats.latest())
              .build());
    }

    long pendingTotal = hotelTotal + restTotal + rentalTotal;
    String recommendedDashboardTab =
        (pendingTotal > 0 || unreadTotal > 0) ? "bookings" : "businesses";

    Map<String, Long> byServiceType = new LinkedHashMap<>();
    byServiceType.put("HOTEL", hotelTotal);
    byServiceType.put("RESTAURANT", restTotal);
    byServiceType.put("RENTAL", rentalTotal);

    return PartnerBookingsSummaryDto.builder()
        .pendingTotal(pendingTotal)
        .unreadNotificationCount(unreadTotal)
        .recommendedDashboardTab(recommendedDashboardTab)
        .byServiceType(byServiceType)
        .businesses(businessActivities)
        .build();
  }

  private UserVerticalActivityDto loadHotelUserActivity(UUID userId) {
    CountAndLatest pending =
        queryCountAndLatest(
            """
            SELECT COUNT(*) AS cnt, MAX(created_at) AS latest_at
            FROM hotel_booking
            WHERE customer_id = ? AND status = 'HELD'
              AND (expires_at IS NULL OR expires_at > clock_timestamp())
            """,
            userId);
    CountAndLatest active =
        queryCountAndLatest(
            """
            SELECT COUNT(*) AS cnt, MAX(created_at) AS latest_at
            FROM hotel_booking
            WHERE customer_id = ? AND status IN ('HELD', 'CONFIRMED', 'CHECKED_IN')
            """,
            userId);
    long total = countOne("SELECT COUNT(*) FROM hotel_booking WHERE customer_id = ?", userId);
    CountAndLatest unread =
        queryCountAndLatest(
            """
            SELECT COUNT(*) AS cnt, MAX(created_at) AS latest_at
            FROM hotel_notification
            WHERE recipient_id = ? AND read_at IS NULL
            """,
            userId);
    return toVerticalDto(unread, pending, active, total);
  }

  private UserVerticalActivityDto loadRestaurantUserActivity(UUID userId) {
    CountAndLatest pending =
        queryCountAndLatest(
            """
            SELECT COUNT(*) AS cnt, MAX(created_at) AS latest_at
            FROM restaurant_reservation_request
            WHERE customer_id = ? AND state = 'REQUESTED' AND start_at >= clock_timestamp()
            """,
            userId);
    CountAndLatest active =
        queryCountAndLatest(
            """
            SELECT COUNT(*) AS cnt, MAX(created_at) AS latest_at
            FROM restaurant_reservation_request
            WHERE customer_id = ? AND state IN ('REQUESTED', 'CONFIRMED')
            """,
            userId);
    long total =
        countOne("SELECT COUNT(*) FROM restaurant_reservation_request WHERE customer_id = ?", userId);
    CountAndLatest unread = queryUnreadPartnerEvents(userId, RESTAURANT_DECISION_EVENTS);
    return toVerticalDto(unread, pending, active, total);
  }

  private UserVerticalActivityDto loadRentalUserActivity(UUID userId) {
    CountAndLatest pending =
        queryCountAndLatest(
            """
            SELECT COUNT(*) AS cnt, MAX(created_at) AS latest_at
            FROM rental_booking_order
            WHERE customer_id = ? AND status = 'PENDING' AND pickup_at >= clock_timestamp()
            """,
            userId);
    CountAndLatest active =
        queryCountAndLatest(
            """
            SELECT COUNT(*) AS cnt, MAX(created_at) AS latest_at
            FROM rental_booking_order
            WHERE customer_id = ? AND status IN ('PENDING', 'CONFIRMED', 'IN_USE')
            """,
            userId);
    long total = countOne("SELECT COUNT(*) FROM rental_booking_order WHERE customer_id = ?", userId);
    CountAndLatest unread = queryUnreadPartnerEvents(userId, RENTAL_DECISION_EVENTS);
    return toVerticalDto(unread, pending, active, total);
  }

  private static UserVerticalActivityDto toVerticalDto(
      CountAndLatest unread, CountAndLatest pending, CountAndLatest active, long total) {
    Instant latest = maxInstant(unread.latest(), maxInstant(pending.latest(), active.latest()));
    return UserVerticalActivityDto.builder()
        .unreadCount(unread.count())
        .pendingCount(pending.count())
        .activeCount(active.count())
        .totalCount(total)
        .attentionCount(unread.count() + pending.count())
        .latestActivityAt(latest)
        .build();
  }

  private String pickRecommendedUserTab(Map<String, UserVerticalActivityDto> verticals) {
    return verticals.entrySet().stream()
        .max(
            Comparator.comparingInt((Map.Entry<String, UserVerticalActivityDto> e) -> priorityTier(e.getValue()))
                .thenComparing(
                    e -> e.getValue().latestActivityAt(),
                    Comparator.nullsFirst(Comparator.naturalOrder())))
        .filter(e -> priorityTier(e.getValue()) > 0)
        .map(Map.Entry::getKey)
        .orElse("hotels");
  }

  private static int priorityTier(UserVerticalActivityDto v) {
    if (v.unreadCount() > 0) return 3;
    if (v.pendingCount() > 0) return 2;
    if (v.activeCount() > 0) return 1;
    return 0;
  }

  private CountAndLatest queryUnreadPartnerEvents(UUID recipientId, List<String> eventTypes) {
    MapSqlParameterSource params =
        new MapSqlParameterSource()
            .addValue("recipientId", recipientId)
            .addValue("eventTypes", eventTypes);
    List<Map<String, Object>> rows =
        namedDb.queryForList(
            """
            SELECT COUNT(*) AS cnt, MAX(created_at) AS latest_at
            FROM partner_notification
            WHERE recipient_id = :recipientId AND read_at IS NULL AND event_type IN (:eventTypes)
            """,
            params);
    return toCountAndLatest(rows);
  }

  private void markPartnerNotificationsReadByEvent(UUID recipientId, List<String> eventTypes) {
    MapSqlParameterSource params =
        new MapSqlParameterSource()
            .addValue("recipientId", recipientId)
            .addValue("eventTypes", eventTypes);
    namedDb.update(
        """
        UPDATE partner_notification
        SET read_at = COALESCE(read_at, clock_timestamp())
        WHERE recipient_id = :recipientId AND read_at IS NULL AND event_type IN (:eventTypes)
        """,
        params);
  }

  private Map<UUID, CountAndLatest> queryPartnerHotelPending(List<UUID> bizIds) {
    List<Map<String, Object>> rows =
        namedDb.queryForList(
            """
            SELECT COALESCE(b.business_id, p.business_id) AS biz_id,
                   COUNT(*) AS cnt,
                   MAX(b.created_at) AS latest_at
            FROM hotel_booking b
            JOIN hotel_property p ON p.id = b.property_id
            WHERE COALESCE(b.business_id, p.business_id) IN (:bizIds)
              AND b.status = 'HELD'
              AND (b.expires_at IS NULL OR b.expires_at > clock_timestamp())
            GROUP BY COALESCE(b.business_id, p.business_id)
            """,
            new MapSqlParameterSource("bizIds", bizIds));
    return mapGroupedCounts(rows);
  }

  private Map<UUID, CountAndLatest> queryPartnerRestaurantPending(List<UUID> bizIds) {
    List<Map<String, Object>> rows =
        namedDb.queryForList(
            """
            SELECT business_id AS biz_id, COUNT(*) AS cnt, MAX(created_at) AS latest_at
            FROM restaurant_reservation_request
            WHERE business_id IN (:bizIds)
              AND state = 'REQUESTED'
              AND start_at >= clock_timestamp()
            GROUP BY business_id
            """,
            new MapSqlParameterSource("bizIds", bizIds));
    return mapGroupedCounts(rows);
  }

  private Map<UUID, CountAndLatest> queryPartnerRentalPending(List<UUID> bizIds) {
    List<Map<String, Object>> rows =
        namedDb.queryForList(
            """
            SELECT business_id AS biz_id, COUNT(*) AS cnt, MAX(created_at) AS latest_at
            FROM rental_booking_order
            WHERE business_id IN (:bizIds)
              AND status = 'PENDING'
              AND pickup_at >= clock_timestamp()
            GROUP BY business_id
            """,
            new MapSqlParameterSource("bizIds", bizIds));
    return mapGroupedCounts(rows);
  }

  private Map<UUID, Long> queryPartnerUnreadByBusiness(UUID userId, List<UUID> bizIds) {
    MapSqlParameterSource params =
        new MapSqlParameterSource()
            .addValue("recipientId", userId)
            .addValue("bizIds", bizIds)
            .addValue("eventTypes", PARTNER_BOOKING_ALERT_EVENTS);
    List<Map<String, Object>> rows =
        namedDb.queryForList(
            """
            SELECT business_id AS biz_id, COUNT(*) AS cnt
            FROM partner_notification
            WHERE recipient_id = :recipientId
              AND read_at IS NULL
              AND business_id IN (:bizIds)
              AND event_type IN (:eventTypes)
            GROUP BY business_id
            """,
            params);
    Map<UUID, Long> out = new HashMap<>();
    for (Map<String, Object> r : rows) {
      UUID bizId = (UUID) r.get("biz_id");
      if (bizId != null) {
        out.put(bizId, ((Number) r.get("cnt")).longValue());
      }
    }
    return out;
  }

  private CountAndLatest queryCountAndLatest(String sql, UUID userId) {
    return toCountAndLatest(db.queryForList(sql, userId));
  }

  private long countOne(String sql, UUID userId) {
    Long value = db.queryForObject(sql, Long.class, userId);
    return value != null ? value : 0L;
  }

  private static CountAndLatest toCountAndLatest(List<Map<String, Object>> rows) {
    if (rows == null || rows.isEmpty()) {
      return CountAndLatest.EMPTY;
    }
    Map<String, Object> first = rows.getFirst();
    long count = first.get("cnt") instanceof Number n ? n.longValue() : 0L;
    Instant latest = toInstant(first.get("latest_at"));
    return new CountAndLatest(count, latest);
  }

  private static Map<UUID, CountAndLatest> mapGroupedCounts(List<Map<String, Object>> rows) {
    Map<UUID, CountAndLatest> result = new HashMap<>();
    if (rows == null) return result;
    for (Map<String, Object> row : rows) {
      UUID bizId = (UUID) row.get("biz_id");
      if (bizId == null) continue;
      long count = row.get("cnt") instanceof Number n ? n.longValue() : 0L;
      Instant latest = toInstant(row.get("latest_at"));
      result.put(bizId, new CountAndLatest(count, latest));
    }
    return result;
  }

  private static Instant toInstant(Object val) {
    if (val instanceof Instant instant) return instant;
    if (val instanceof Timestamp ts) return ts.toInstant();
    return null;
  }

  private static Instant maxInstant(Instant a, Instant b) {
    if (a == null) return b;
    if (b == null) return a;
    return a.isAfter(b) ? a : b;
  }

  private record CountAndLatest(long count, Instant latest) {
    static final CountAndLatest EMPTY = new CountAndLatest(0L, null);
  }
}
