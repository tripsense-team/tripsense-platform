package fu.tripsense.recommendation.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtService {
  private final String accessSecret;

  public JwtService(@Value("${jwt.access-secret}") String accessSecret) {
    this.accessSecret = accessSecret;
  }

  public AuthenticatedUser parseAccessToken(String token) {
    Claims claims =
        Jwts.parserBuilder().setSigningKey(signingKey()).build().parseClaimsJws(token).getBody();
    if (!"ACCESS".equals(claims.get("type", String.class))
        || claims.getExpiration() == null
        || claims.getExpiration().before(new Date())) {
      throw new IllegalArgumentException("Invalid access token");
    }
    return new AuthenticatedUser(
        UUID.fromString(claims.getSubject()), claims.get("role", String.class));
  }

  private Key signingKey() {
    return Keys.hmacShaKeyFor(accessSecret.getBytes(StandardCharsets.UTF_8));
  }
}
