package fu.tripsense.socialservice.service;

import static org.junit.jupiter.api.Assertions.*;

import fu.tripsense.socialservice.dto.response.AdminSocialStatsResponse;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;

class AdminSocialStatsServiceTest {

  private AdminSocialStatsService service;

  @BeforeEach
  void setUp() {
    JdbcTemplate stubJdbc =
        new JdbcTemplate() {
          @Override
          public <T> T queryForObject(String sql, Class<T> requiredType)
              throws DataAccessException {
            if (requiredType == Double.class) {
              return requiredType.cast(4.65);
            }
            return requiredType.cast(45L);
          }

          @Override
          public <T> T queryForObject(String sql, Class<T> requiredType, Object... args)
              throws DataAccessException {
            return requiredType.cast(15L);
          }

          @Override
          public void query(String sql, RowCallbackHandler rch) throws DataAccessException {
            // No-op for grouped rows in unit test
          }
        };
    service = new AdminSocialStatsService(stubJdbc);
  }

  @Test
  void requireAdmin_rejectsNonAdminUsers() {
    AuthenticatedUser user =
        new AuthenticatedUser(UUID.randomUUID(), "user@tripsense.app", "ROLE_USER");
    SocialException ex =
        assertThrows(SocialException.class, () -> service.requireAdmin(user));
    assertEquals(HttpStatus.FORBIDDEN, ex.status());
  }

  @Test
  void getStats_returnsCommunityAndReviewMetricsForAdmin() {
    AuthenticatedUser admin =
        new AuthenticatedUser(UUID.randomUUID(), "admin@tripsense.app", "ROLE_ADMIN");

    AdminSocialStatsResponse res = service.getStats(admin, 30);

    assertNotNull(res);
    assertEquals(30, res.period().days());
    assertEquals(45L, res.totalPosts());
    assertEquals(4.65, res.placeReviewStats().averageRating());
  }
}
