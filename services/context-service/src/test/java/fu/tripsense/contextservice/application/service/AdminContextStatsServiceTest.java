package fu.tripsense.contextservice.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fu.tripsense.contextservice.adapter.in.web.dto.AdminContextStatsResponse;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

class AdminContextStatsServiceTest {

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
    AdminContextStatsService service = new AdminContextStatsService(new StubJdbcTemplate());

    assertThatThrownBy(() -> service.getStats(30)).isInstanceOf(ResponseStatusException.class);
  }

  @Test
  void getStats_returnsOnboardingAndSignalCountsForAdmin() {
    SecurityContextHolder.getContext()
        .setAuthentication(
            new UsernamePasswordAuthenticationToken(
                "admin", "tok", List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
    AdminContextStatsService service = new AdminContextStatsService(new StubJdbcTemplate());

    AdminContextStatsResponse res = service.getStats(30);
    assertThat(res.periodDays()).isEqualTo(30);
    assertThat(res.totalOnboardingProfiles()).isEqualTo(19L);
    assertThat(res.totalPreferenceSignals()).isEqualTo(137L);
  }

  static class StubJdbcTemplate extends JdbcTemplate {
    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType) {
      if (sql.contains("FROM preference_signals")) {
        return requiredType.cast(137L);
      }
      return requiredType.cast(19L);
    }

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
      return requiredType.cast(12L);
    }

    @Override
    public void query(String sql, RowCallbackHandler rch) {
      // no-op for stub
    }
  }
}

