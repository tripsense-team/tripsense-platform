package fu.tripsense.recommendation.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Slf4j
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
  private final JwtService jwtService;

  public JwtAuthenticationFilter(JwtService jwtService) {
    this.jwtService = jwtService;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String authorization = request.getHeader("Authorization");
    if (authorization == null || authorization.isBlank()) {
      chain.doFilter(request, response);
      return;
    }
    if (!authorization.startsWith("Bearer ")) {
      response.sendError(HttpStatus.UNAUTHORIZED.value(), "Invalid authorization header");
      return;
    }
    try {
      String token = authorization.substring(7);
      AuthenticatedUser user = jwtService.parseAccessToken(token);
      String role = user.role() == null ? "USER" : user.role();
      String authority = role.startsWith("ROLE_") ? role : "ROLE_" + role;
      SecurityContextHolder.getContext()
          .setAuthentication(
              new UsernamePasswordAuthenticationToken(
                  user, token, List.of(new SimpleGrantedAuthority(authority))));
    } catch (RuntimeException exception) {
      log.warn("Recommendation authentication failed: invalid access token");
      SecurityContextHolder.clearContext();
      response.sendError(HttpStatus.UNAUTHORIZED.value(), "Invalid access token");
      return;
    }
    chain.doFilter(request, response);
  }
}
