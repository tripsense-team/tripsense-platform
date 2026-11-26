package fu.tripsense.tripservice.partner.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.AdminFinanceDtos.SubscriptionOrderItemDto;
import fu.tripsense.tripservice.partner.dto.AdminFinanceDtos.SubscriptionOrderPageDto;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class AdminSubscriptionOrderServiceTest {

  private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
  private final AdminSubscriptionOrderService service = new AdminSubscriptionOrderService(jdbc);

  private AuthenticatedUser adminUser() {
    return new AuthenticatedUser(UUID.randomUUID(), "admin@tripsense.dev", "ROLE_ADMIN");
  }

  private AuthenticatedUser normalUser() {
    return new AuthenticatedUser(UUID.randomUUID(), "user@tripsense.dev", "ROLE_USER");
  }

  @Test
  void rejectsUnauthenticatedCaller() {
    TripServiceException ex =
        assertThrows(
            TripServiceException.class,
            () -> service.listSubscriptionOrders(null, null, null, 0, 20));
    assertEquals(HttpStatus.UNAUTHORIZED, ex.status());
  }

  @Test
  void rejectsNonAdminCaller() {
    TripServiceException ex =
        assertThrows(
            TripServiceException.class,
            () -> service.listSubscriptionOrders(normalUser(), null, null, 0, 20));
    assertEquals(HttpStatus.FORBIDDEN, ex.status());
  }

  @Test
  void rejectsInvalidStatusFilter() {
    TripServiceException ex =
        assertThrows(
            TripServiceException.class,
            () -> service.listSubscriptionOrders(adminUser(), "INVALID", null, 0, 20));
    assertEquals(HttpStatus.BAD_REQUEST, ex.status());
  }

  @Test
  @SuppressWarnings("unchecked")
  void returnsPaginatedSubscriptionOrdersWithFilters() {
    SubscriptionOrderItemDto item =
        new SubscriptionOrderItemDto(
            UUID.randomUUID(),
            30000012L,
            UUID.randomUUID(),
            "Sunrise Hotel",
            "HOTEL",
            "HOTEL_PLAN_1_MONTH",
            "Goi Linh Hoat",
            30,
            new BigDecimal("399000.00"),
            "PAID",
            Instant.now(),
            Instant.now());

    when(jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class))).thenReturn(1L);
    when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
        .thenReturn(List.of(item));

    SubscriptionOrderPageDto result =
        service.listSubscriptionOrders(adminUser(), "paid", "hotel", 0, 20);

    assertEquals(1L, result.totalElements());
    assertEquals(1, result.totalPages());
    assertEquals(1, result.items().size());
    assertEquals(30000012L, result.items().get(0).orderCode());
    verify(jdbc).queryForObject(anyString(), eq(Long.class), any(Object[].class));
  }
}

