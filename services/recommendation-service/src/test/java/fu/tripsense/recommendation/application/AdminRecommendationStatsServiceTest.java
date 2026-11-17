package fu.tripsense.recommendation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

class AdminRecommendationStatsServiceTest {

  @AfterEach
  void tearDown() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void getStats_rejectsNonAdmin() {
    SecurityContextHolder.getContext()
        .setAuthentication(
            new UsernamePasswordAuthenticationToken(
                "user", "tok", List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    AdminRecommendationStatsService service =
        new AdminRecommendationStatsService(new StubJdbcTemplate());

    assertThatThrownBy(() -> service.getStats(30)).isInstanceOf(ResponseStatusException.class);
  }

  @Test
  void getStats_computesFunnelAndCtrForAdmin() {
    SecurityContextHolder.getContext()
        .setAuthentication(
            new UsernamePasswordAuthenticationToken(
                "admin", "tok", List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
    AdminRecommendationStatsService service =
        new AdminRecommendationStatsService(new StubJdbcTemplate());

    AdminRecommendationStatsResult res = service.getStats(30);
    assertThat(res.periodDays()).isEqualTo(30);
    assertThat(res.totalImpressions()).isEqualTo(325L);
    assertThat(res.totalRecommendedItems()).isEqualTo(7578L);
    assertThat(res.positionBuckets()).hasSize(3);
  }

  static class StubJdbcTemplate extends JdbcTemplate {
    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType) {
      if (sql.contains("FROM recommendation_impression_item")) {
        return requiredType.cast(7578L);
      }
      return requiredType.cast(325L);
    }

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
      return requiredType.cast(120L);
    }

    @Override
    public void query(String sql, RowCallbackHandler rch) {
      // no-op for stub
    }

    @Override
    public void query(String sql, RowCallbackHandler rch, Object... args) {
      // no-op for stub
    }
  }
}

