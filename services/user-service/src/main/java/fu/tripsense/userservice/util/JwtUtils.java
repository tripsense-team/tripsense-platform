package fu.tripsense.userservice.util;

import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.enums.TokenType;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;
import java.util.UUID;

@Component
public class JwtUtils {

    @Value("${jwt.access-secret}")
    private String accessSecret;

    @Value("${jwt.refresh-secret}")
    private String refreshSecret;

    @Value("${jwt.access-token-expiration-ms}")
    private long accessTokenExpirationMs;

    private Key getAccessSigningKey() {
        byte[] keyBytes = accessSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    private Key getRefreshSigningKey() {
        byte[] keyBytes = refreshSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    /**
     * Generates a short-lived stateless JWT Access Token with type = ACCESS.
     */
    public String generateAccessToken(User user) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + accessTokenExpirationMs);

        return Jwts.builder()
                .setSubject(user.getId().toString())
                .claim("email", user.getEmail())
                .claim("role", user.getRole())
                .claim(TokenType.TYPE_CLAIM, TokenType.ACCESS.name())
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(getAccessSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * Generates a signed JWT Refresh Token with type = REFRESH and jti.
     */
    public String generateRefreshToken(User user, UUID jti, Date expiryDate) {
        Date now = new Date();

        return Jwts.builder()
                .setSubject(user.getId().toString())
                .setId(jti.toString())
                .claim(TokenType.TYPE_CLAIM, TokenType.REFRESH.name())
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(getRefreshSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public Claims parseAccessClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getAccessSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public Claims parseRefreshClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getRefreshSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public String extractEmailFromAccessToken(String token) {
        Claims claims = parseAccessClaims(token);
        String email = claims.get("email", String.class);
        return email != null ? email : claims.getSubject();
    }

    public String extractEmail(String token) {
        return extractEmailFromAccessToken(token);
    }

    public String extractUserIdFromRefreshToken(String token) {
        Claims claims = parseRefreshClaims(token);
        return claims.getSubject();
    }

    public String extractJtiFromRefreshToken(String token) {
        Claims claims = parseRefreshClaims(token);
        return claims.getId();
    }

    public boolean validateAccessToken(String token, UserDetails userDetails) {
        try {
            Claims claims = parseAccessClaims(token);
            String tokenType = claims.get(TokenType.TYPE_CLAIM, String.class);
            if (!TokenType.ACCESS.name().equals(tokenType)) {
                return false;
            }
            String email = extractEmailFromAccessToken(token);
            boolean isExpired = claims.getExpiration().before(new Date());
            return (email.equals(userDetails.getUsername()) && !isExpired);
        } catch (Exception e) {
            return false;
        }
    }

    public boolean validateRefreshToken(String token) {
        try {
            Claims claims = parseRefreshClaims(token);
            String tokenType = claims.get(TokenType.TYPE_CLAIM, String.class);
            if (!TokenType.REFRESH.name().equals(tokenType)) {
                return false;
            }
            return !claims.getExpiration().before(new Date());
        } catch (Exception e) {
            return false;
        }
    }

    public boolean validateToken(String token, UserDetails userDetails) {
        return validateAccessToken(token, userDetails);
    }

    public long getAccessTokenExpirationSeconds() {
        return accessTokenExpirationMs / 1000;
    }
}
