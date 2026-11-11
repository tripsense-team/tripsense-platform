package fu.tripsense.tripservice.partner.service;

import static fu.tripsense.tripservice.partner.dto.BookingActivitySummaryDtos.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

@ExtendWith(MockitoExtension.class)
class BookingActivitySummaryServiceTest {

  @Mock private JdbcTemplate db;
  @Mock private NamedParameterJdbcTemplate namedDb;

  private BookingActivitySummaryService summaryService;
  private UUID userId;
  private AuthenticatedUser user;

  @BeforeEach
  void setUp() {
    userId = UUID.randomUUID();
    user = new AuthenticatedUser(userId, "user@tripsense.vn", "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"));
    summaryService = new BookingActivitySummaryService(db, namedDb);
  }

  @Test
  @DisplayName("getUserSummary prioritizes vertical with unread or pending booking and sums totals")
  void getUserSummary_recommendsRentalsWhenRentalUpdateUnread() {
    Instant now = Instant.now();
    when(db.queryForObject(anyString(), eq(Long.class), eq(userId))).thenReturn(1L, 0L, 1L);

    when(db.queryForList(anyString(), eq(userId))).thenAnswer(inv -> {
      String sql = inv.getArgument(0);
      if (sql.contains("hotel_notification")) {
        return List.of(Map.of("cnt", 0L));
      }
      if (sql.contains("FROM rental_booking_order")) {
        return List.of(Map.of("cnt", 1L, "latest_at", Timestamp.from(now)));
      }
      if (sql.contains("FROM hotel_booking")) {
        return List.of(Map.of("cnt", 0L));
      }
      return List.of(Map.of("cnt", 0L));
    });

    when(namedDb.queryForList(anyString(), any(SqlParameterSource.class))).thenAnswer(inv -> {
      SqlParameterSource src = inv.getArgument(1);
      @SuppressWarnings("unchecked")
      List<String> events = (List<String>) src.getValue("eventTypes");
      if (events != null && events.contains("RENTAL_BOOKING_CONFIRMED")) {
        return List.of(Map.of("cnt", 1L, "latest_at", Timestamp.from(now)));
      }
      return List.of(Map.of("cnt", 0L));
    });

    UserReservationActivitySummaryDto summary = summaryService.getUserSummary(user);

    assertThat(summary.recommendedTab()).isEqualTo("rentals");
    assertThat(summary.unreadNotificationCount()).isEqualTo(1L);
    assertThat(summary.totalAttentionCount()).isEqualTo(2L);
    assertThat(summary.verticals().get("rentals").unreadCount()).isEqualTo(1L);
    assertThat(summary.verticals().get("rentals").pendingCount()).isEqualTo(1L);
  }

  @Test
  @DisplayName("markUserVerticalSeen updates notification table and rejects unknown vertical")
  void markUserVerticalSeen_validatesVerticalAndMarksRentals() {
    assertThatThrownBy(() -> summaryService.markUserVerticalSeen(user, "UNKNOWN"))
        .isInstanceOf(TripServiceException.class)
        .satisfies(e -> assertThat(((TripServiceException) e).status()).isEqualTo(HttpStatus.BAD_REQUEST));

    when(db.queryForObject(anyString(), eq(Long.class), eq(userId))).thenReturn(0L);
    when(db.queryForList(anyString(), eq(userId))).thenReturn(List.of(Map.of("cnt", 0L)));
    when(namedDb.queryForList(anyString(), any(SqlParameterSource.class))).thenReturn(List.of(Map.of("cnt", 0L)));

    UserReservationActivitySummaryDto result = summaryService.markUserVerticalSeen(user, "RENTALS");

    verify(namedDb).update(contains("UPDATE partner_notification"), any(SqlParameterSource.class));
    assertThat(result.recommendedTab()).isEqualTo("hotels");
    assertThat(result.totalAttentionCount()).isZero();
  }

  @Test
  @DisplayName("getPartnerSummary returns empty metrics for non-partner and sums pending counts for partner businesses")
  void getPartnerSummary_aggregatesPendingByBusinessAndServiceType() {
    when(db.queryForList(contains("FROM partner_business_member"), eq(userId)))
        .thenReturn(List.of());

    PartnerBookingsSummaryDto emptySummary = summaryService.getPartnerSummary(user);
    assertThat(emptySummary.pendingTotal()).isZero();
    assertThat(emptySummary.recommendedDashboardTab()).isEqualTo("businesses");

    UUID rentalBizId = UUID.randomUUID();
    UUID restBizId = UUID.randomUUID();
    Instant latest = Instant.now();

    when(db.queryForList(contains("FROM partner_business_member"), eq(userId))).thenReturn(
        List.of(
            Map.of("business_id", rentalBizId, "kind", "RENTAL_SERVICE"),
            Map.of("business_id", restBizId, "kind", "RESTAURANT")));

    when(namedDb.queryForList(anyString(), any(SqlParameterSource.class))).thenAnswer(inv -> {
      String sql = inv.getArgument(0);
      if (sql.contains("FROM rental_booking_order")) {
        return List.of(Map.of("biz_id", rentalBizId, "cnt", 2L, "latest_at", Timestamp.from(latest)));
      }
      if (sql.contains("FROM restaurant_reservation_request")) {
        return List.of(Map.of("biz_id", restBizId, "cnt", 1L, "latest_at", Timestamp.from(latest)));
      }
      if (sql.contains("FROM partner_notification")) {
        return List.of(Map.of("biz_id", rentalBizId, "cnt", 2L));
      }
      return List.of();
    });

    PartnerBookingsSummaryDto summary = summaryService.getPartnerSummary(user);

    assertThat(summary.pendingTotal()).isEqualTo(3L);
    assertThat(summary.unreadNotificationCount()).isEqualTo(2L);
    assertThat(summary.recommendedDashboardTab()).isEqualTo("bookings");
    assertThat(summary.byServiceType().get("RENTAL")).isEqualTo(2L);
    assertThat(summary.byServiceType().get("RESTAURANT")).isEqualTo(1L);
    assertThat(summary.businesses()).hasSize(2);
  }
}

