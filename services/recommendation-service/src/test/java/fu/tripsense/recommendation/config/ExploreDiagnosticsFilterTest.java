package fu.tripsense.recommendation.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fu.tripsense.recommendation.application.RequestDiagnostics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class ExploreDiagnosticsFilterTest {
  @Test
  void propagatesIdAndRecordsStatusWithoutLeakingThreadState() throws Exception {
    var registry = new SimpleMeterRegistry();
    var filter = new ExploreDiagnosticsFilter(registry, true);
    var request = request("/api/recommendations/explore-for-you");
    request.addHeader("X-Request-ID", "test-request-123");
    var response = new MockHttpServletResponse();
    filter.doFilter(
        request,
        response,
        (req, res) -> {
          assertThat(RequestDiagnostics.requestId()).isEqualTo("test-request-123");
          ((jakarta.servlet.http.HttpServletResponse) res).setStatus(503);
        });
    assertThat(response.getHeader("X-Request-ID")).isEqualTo("test-request-123");
    assertThat(registry.get("tripsense.explore.request").tag("status", "503").timer().count())
        .isEqualTo(1);
    assertThat(RequestDiagnostics.requestId()).isNull();
  }

  @Test
  void recordsUnhandledFailureAndCleansUp() {
    var registry = new SimpleMeterRegistry();
    var filter = new ExploreDiagnosticsFilter(registry, true);
    assertThatThrownBy(
            () ->
                filter.doFilter(
                    request("/api/recommendations/explore-for-you"),
                    new MockHttpServletResponse(),
                    (req, res) -> {
                      throw new ServletException("failure");
                    }))
        .isInstanceOf(ServletException.class);
    assertThat(registry.get("tripsense.explore.request").tag("status", "500").timer().count())
        .isEqualTo(1);
    assertThat(RequestDiagnostics.requestId()).isNull();
  }

  @Test
  void skipsOtherEndpointsAndCanBeDisabled() throws Exception {
    var registry = new SimpleMeterRegistry();
    for (var filter :
        new ExploreDiagnosticsFilter[] {
          new ExploreDiagnosticsFilter(registry, false),
          new ExploreDiagnosticsFilter(registry, true)
        }) {
      var response = new MockHttpServletResponse();
      filter.doFilter(request("/actuator/health"), response, (req, res) -> {});
      assertThat(response.getHeader("X-Request-ID")).isNull();
    }
    new ExploreDiagnosticsFilter(registry, false)
        .doFilter(
            request("/api/recommendations/explore-for-you"),
            new MockHttpServletResponse(),
            (req, res) -> {});
    assertThat(registry.getMeters()).isEmpty();
  }

  private MockHttpServletRequest request(String path) {
    var request = new MockHttpServletRequest("POST", path);
    request.setServletPath(path);
    return request;
  }
}
