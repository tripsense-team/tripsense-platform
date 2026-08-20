package fu.tripsense.tripservice.util;

import fu.tripsense.tripservice.security.AuthenticatedUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;
import java.util.UUID;

@Component
public class JwtService {

    private static final String ACCESS_TYPE = "ACCESS";

    @Value("${jwt.access-secret}")
    private String accessSecret;

    public AuthenticatedUser parseAccessToken(String token) {
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(signingKey())
                .build()
                .parseClaimsJws(token)
                .getBody();

        String type = claims.get("type", String.class);
        if (!ACCESS_TYPE.equals(type)) {
            throw new IllegalArgumentException("Token is not an access token");
        }
        if (claims.getExpiration() == null || claims.getExpiration().before(new Date())) {
            throw new IllegalArgumentException("Token is expired");
        }

        return new AuthenticatedUser(
                UUID.fromString(claims.getSubject()),
                claims.get("email", String.class),
                claims.get("role", String.class)
        );
    }

    private Key signingKey() {
        return Keys.hmacShaKeyFor(accessSecret.getBytes(StandardCharsets.UTF_8));
    }
}
