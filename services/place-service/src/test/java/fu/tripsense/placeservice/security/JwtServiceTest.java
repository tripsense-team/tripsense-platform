package fu.tripsense.placeservice.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

  private static final String SECRET =
      "thisIsAVeryLongSecretKeyUsedForUnitTestingMustBeAtLeast32Bytes!";
  private JwtService jwtService;

  @BeforeEach
  void setUp() {
    jwtService = new JwtService(SECRET);
  }

  @Test
  void parseAccessToken_validToken_returnsAuthenticatedUser() {
    UUID userId = UUID.randomUUID();
    String token =
        Jwts.builder()
            .setSubject(userId.toString())
            .claim("role", "ROLE_ADMIN")
            .claim("type", "ACCESS")
            .setExpiration(new Date(System.currentTimeMillis() + 60000))
            .signWith(
                Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)),
                SignatureAlgorithm.HS256)
            .compact();

    AuthenticatedUser user = jwtService.parseAccessToken(token);

    assertThat(user).isNotNull();
    assertThat(user.id()).isEqualTo(userId);
    assertThat(user.role()).isEqualTo("ROLE_ADMIN");
  }

  @Test
  void parseAccessToken_missingSecret_throwsIllegalStateException() {
    JwtService unconfigured = new JwtService("");
    assertThatThrownBy(() -> unconfigured.parseAccessToken("any-token"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("JWT access secret is not configured");
  }

  @Test
  void parseAccessToken_invalidType_throwsIllegalArgumentException() {
    UUID userId = UUID.randomUUID();
    String token =
        Jwts.builder()
            .setSubject(userId.toString())
            .claim("role", "ROLE_ADMIN")
            .claim("type", "REFRESH")
            .setExpiration(new Date(System.currentTimeMillis() + 60000))
            .signWith(
                Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)),
                SignatureAlgorithm.HS256)
            .compact();

    assertThatThrownBy(() -> jwtService.parseAccessToken(token))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Invalid access token");
  }

  @Test
  void parseAccessToken_expiredToken_throwsException() {
    UUID userId = UUID.randomUUID();
    String token =
        Jwts.builder()
            .setSubject(userId.toString())
            .claim("role", "ROLE_ADMIN")
            .claim("type", "ACCESS")
            .setExpiration(new Date(System.currentTimeMillis() - 10000))
            .signWith(
                Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)),
                SignatureAlgorithm.HS256)
            .compact();

    assertThatThrownBy(() -> jwtService.parseAccessToken(token)).isInstanceOf(Exception.class);
  }
}
