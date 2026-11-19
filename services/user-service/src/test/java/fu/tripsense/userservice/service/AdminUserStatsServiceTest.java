package fu.tripsense.userservice.service;

import static org.junit.jupiter.api.Assertions.*;

import fu.tripsense.userservice.dto.response.AdminUserStatsDto;
import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.enums.UserStatus;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.web.server.ResponseStatusException;

class AdminUserStatsServiceTest {

  private AdminUserStatsService service;

  @BeforeEach
  void setUp() {
    JdbcTemplate stubJdbc =
        new JdbcTemplate() {
          @Override
          public <T> T queryForObject(String sql, Class<T> requiredType)
              throws DataAccessException {
            if (sql.contains("SELECT COUNT(*) FROM users WHERE upper(role) IN ('ADMIN'")) {
              return requiredType.cast(2L);
            }
            if (sql.contains("partner_enrolled = true")) {
              return requiredType.cast(18L);
            }
            return requiredType.cast(100L);
          }

          @Override
          public <T> T queryForObject(String sql, Class<T> requiredType, Object... args)
              throws DataAccessException {
            return requiredType.cast(12L);
          }

          @Override
          public void query(String sql, RowCallbackHandler rch) throws DataAccessException {
            // No-op for grouped breakdown in unit test
          }

          @Override
          public void query(String sql, RowCallbackHandler rch, Object... args)
              throws DataAccessException {
            // No-op for daily series in unit test
          }
        };
    service = new AdminUserStatsService(stubJdbc);
  }

  @Test
  void requireAdmin_rejectsNonAdminUsers() {
    User regularUser =
        User.builder()
            .id(UUID.randomUUID())
            .email("traveler@tripsense.app")
            .role("USER")
            .status(UserStatus.ACTIVE)
            .build();

    ResponseStatusException ex =
        assertThrows(ResponseStatusException.class, () -> service.requireAdmin(regularUser));
    assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
  }

  @Test
  void getStats_returnsUserBreakdownAndDailySeriesForAdmin() {
    User adminUser =
        User.builder()
            .id(UUID.randomUUID())
            .email("admin@tripsense.app")
            .role("ADMIN")
            .status(UserStatus.ACTIVE)
            .build();

    AdminUserStatsDto dto = service.getStats(adminUser, 7);

    assertNotNull(dto);
    assertEquals(7, dto.period().days());
    assertEquals(100L, dto.totalUsers());
    assertEquals(80L, dto.roleBreakdown().travelersCount());
    assertEquals(18L, dto.roleBreakdown().partnersCount());
    assertEquals(2L, dto.roleBreakdown().adminsCount());
    assertEquals(7, dto.dailyRegistrations().size());
  }
}
