package fu.tripsense.contextservice.config;

import fu.tripsense.contextservice.application.ContextDiagnostics;
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
public class ContextDiagnosticsFilter extends OncePerRequestFilter {
  private final boolean enabled;

  public ContextDiagnosticsFilter(@Value("${context.diagnostics.enabled:true}") boolean enabled) {
    this.enabled = enabled;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !enabled
        || !"GET".equals(request.getMethod())
        || !"/api/context/preferences".equals(request.getServletPath());
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String id = ContextDiagnostics.begin(request.getHeader(ContextDiagnostics.HEADER));
    response.setHeader(ContextDiagnostics.HEADER, id);
    int status = 500;
    try {
      chain.doFilter(request, response);
      status = response.getStatus();
    } finally {
      ContextDiagnostics.finish(status);
    }
  }
}
