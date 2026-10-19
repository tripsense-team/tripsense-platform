package fu.tripsense.recommendation.config;

import fu.tripsense.recommendation.application.RequestDiagnostics;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class ExploreDiagnosticsFilter extends OncePerRequestFilter {
  private final MeterRegistry registry;
  private final boolean enabled;

  public ExploreDiagnosticsFilter(
      MeterRegistry registry,
      @Value("${tripsense.explore-diagnostics.enabled:true}") boolean enabled) {
    this.registry = registry;
    this.enabled = enabled;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !enabled
        || !"POST".equals(request.getMethod())
        || !("/api/recommendations/explore-for-you".equals(request.getServletPath())
            || "/api/recommendations/explore-for-you/sections".equals(request.getServletPath()));
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    RequestDiagnostics.begin(
        "recommendation-service", request.getHeader(RequestDiagnostics.HEADER), registry);
    response.setHeader(RequestDiagnostics.HEADER, RequestDiagnostics.requestId());
    int status = 500;
    try {
      chain.doFilter(request, response);
      status = response.getStatus();
    } finally {
      RequestDiagnostics.finish(status);
    }
  }
}
