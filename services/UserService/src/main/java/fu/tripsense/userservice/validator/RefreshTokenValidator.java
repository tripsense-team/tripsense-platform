package fu.tripsense.userservice.validator;

import fu.tripsense.userservice.entity.RefreshToken;
import fu.tripsense.userservice.repository.RefreshTokenRepository;
import fu.tripsense.userservice.util.JwtUtils;
import fu.tripsense.userservice.util.TokenHashUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class RefreshTokenValidator {

    private final JwtUtils jwtUtils;
    private final RefreshTokenRepository refreshTokenRepository;

    public RefreshToken validate(String refreshToken, LocalDateTime now) {
        if (refreshToken == null || refreshToken.isBlank()) {
            log.warn("Refresh token validation failed: Token is missing or empty");
            throw new BadCredentialsException("Invalid or expired refresh token");
        }

        if (!jwtUtils.validateRefreshToken(refreshToken)) {
            log.warn("Refresh token validation failed: Invalid signature, expired, or wrong token type");
            throw new BadCredentialsException("Invalid or expired refresh token");
        }

        String tokenHash = TokenHashUtils.hashToken(refreshToken);
        RefreshToken tokenEntity = refreshTokenRepository.findByTokenHashAndRevokedAtIsNull(tokenHash)
                .orElseThrow(() -> {
                    log.warn("Refresh token validation failed: Token hash not found in DB or revoked");
                    return new BadCredentialsException("Invalid or expired refresh token");
                });

        if (tokenEntity.getExpiresAt().isBefore(now)) {
            log.warn("Refresh token validation failed: Database token entity is expired");
            throw new BadCredentialsException("Invalid or expired refresh token");
        }

        return tokenEntity;
    }
}
