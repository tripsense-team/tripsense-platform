package fu.tripsense.userservice.service.impl;

import fu.tripsense.userservice.repository.RefreshTokenRepository;
import fu.tripsense.userservice.repository.SessionRepository;
import fu.tripsense.userservice.service.TokenCleanupService;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class TokenCleanupServiceImpl implements TokenCleanupService {

  private final RefreshTokenRepository refreshTokenRepository;
  private final SessionRepository sessionRepository;

  @Override
  @Transactional
  public CleanupResult cleanupExpiredTokensAndSessions(LocalDateTime now) {
    log.info("Starting background cleanup of expired auth tokens and sessions at {}", now);

    int purgedTokens = refreshTokenRepository.deleteExpiredOrRevokedTokens(now);
    int purgedSessions = sessionRepository.deleteExpiredSessions(now);

    log.info(
        "Token and session cleanup completed successfully: purged {} expired/revoked refresh tokens and {} expired sessions",
        purgedTokens,
        purgedSessions);

    return new CleanupResult(purgedTokens, purgedSessions);
  }
}
