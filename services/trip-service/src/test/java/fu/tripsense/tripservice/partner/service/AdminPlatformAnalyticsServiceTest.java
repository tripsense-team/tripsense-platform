package fu.tripsense.tripservice.partner.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.AdminPlatformAnalyticsDto;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

class AdminPlatformAnalyticsServiceTest {

  private JdbcTemplate jdbcTemplate;
  private AdminPlatformAnalyticsService service;

  @BeforeEach
  void setUp() {
    jdbcTemplate = mock(JdbcTemplate.class);
    service = new AdminPlatformAnalyticsService(jdbcTemplate);
  }

  @Test
  void requireAdmin_throwsUnauthorizedWhenUserIsNull() {
    TripServiceException ex =
        assertThrows(TripServiceException.class, () -> service.requireAdmin(null));
    assertEquals(HttpStatus.UNAUTHORIZED, ex.status());
  }

  @Test
  void requireAdmin_throwsForbiddenWhenUserIsNotAdmin() {
    AuthenticatedUser regularUser =
        new AuthenticatedUser(UUID.randomUUID(), "user@tripsense.app", "ROLE_USER");
    TripServiceException ex =
        assertThrows(TripServiceException.class, () -> service.requireAdmin(regularUser));
    assertEquals(HttpStatus.FORBIDDEN, ex.status());
  }

  @Test
  void normalizePeriodDays_acceptsSupportedBucketsAndRejectsInvalid() {
    assertEquals(30, service.normalizePeriodDays(null));
    assertEquals(7, service.normalizePeriodDays(7));
    assertEquals(30, service.normalizePeriodDays(30));
    assertEquals(90, service.normalizePeriodDays(90));
    assertEquals(365, service.normalizePeriodDays(365));

    TripServiceException ex =
        assertThrows(TripServiceException.class, () -> service.normalizePeriodDays(14));
    assertEquals(HttpStatus.BAD_REQUEST, ex.status());
  }

  @Test
  void getOverview_returnsAggregatedMetricsAndContinuousDailySeriesForAdmin() {
    AuthenticatedUser admin =
        new AuthenticatedUser(
            UUID.randomUUID(), "admin@tripsense.app", "ROLE_ADMIN", List.of("ROLE_ADMIN"));

    when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(20L);
    when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), any(), any())).thenReturn(8L);
    when(jdbcTemplate.queryForObject(anyString(), eq(Double.class))).thenReturn(2.4);
    when(jdbcTemplate.queryForObject(anyString(), eq(BigDecimal.class)))
        .thenReturn(new BigDecimal("1000000"));
    when(jdbcTemplate.queryForObject(anyString(), eq(BigDecimal.class), any(), any()))
        .thenReturn(new BigDecimal("400000"));

    AdminPlatformAnalyticsDto overview = service.getOverview(admin, 7);

    assertNotNull(overview);
    assertEquals(7, overview.period().days());
    assertEquals(7, overview.dailySeries().size());
    assertEquals(20L, overview.tripStats().totalTrips());
    assertEquals(100.0, overview.tripStats().aiAdoptionRatePercent());
    assertEquals(new BigDecimal("1100000"), overview.financeAndSubscriptionStats().totalPlatformRevenue());
  }

  @Test
  void computeGrowthPercent_handlesZeroPreviousAndPositiveChanges() {
    assertEquals(0.0, AdminPlatformAnalyticsService.computeGrowthPercent(0, 0));
    assertEquals(100.0, AdminPlatformAnalyticsService.computeGrowthPercent(5, 0));
    assertEquals(50.0, AdminPlatformAnalyticsService.computeGrowthPercent(15, 10));
    assertEquals(-25.0, AdminPlatformAnalyticsService.computeGrowthPercent(15, 20));
  }
}
