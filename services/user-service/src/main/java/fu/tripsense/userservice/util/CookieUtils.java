package fu.tripsense.userservice.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class CookieUtils {

    @Value("${jwt.refresh-token-cookie-name}")
    private String refreshTokenCookieName;

    @Value("${jwt.cookie-secure}")
    private boolean cookieSecure;

    public ResponseCookie createRefreshTokenCookie(String rawRefreshToken, long maxAgeSeconds) {
        return ResponseCookie.from(refreshTokenCookieName, rawRefreshToken)
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(Duration.ofSeconds(maxAgeSeconds))
                .sameSite("Lax")
                .build();
    }

    public ResponseCookie cleanRefreshTokenCookie() {
        return ResponseCookie.from(refreshTokenCookieName, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();
    }
}
