package fu.tripsense.socialservice.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.List;

@Component @RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || header.isBlank()) { chain.doFilter(request, response); return; }
        if (!header.startsWith("Bearer ")) { response.sendError(HttpStatus.UNAUTHORIZED.value(), "Invalid authorization header"); return; }
        try {
            AuthenticatedUser user = jwtService.parseAccessToken(header.substring(7));
            String role = user.role() == null ? "ROLE_USER" : user.role().startsWith("ROLE_") ? user.role() : "ROLE_" + user.role();
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, header.substring(7), List.of(new SimpleGrantedAuthority(role))));
            chain.doFilter(request, response);
        } catch (RuntimeException ex) { SecurityContextHolder.clearContext(); response.sendError(HttpStatus.UNAUTHORIZED.value(), "Invalid access token"); }
    }
}
