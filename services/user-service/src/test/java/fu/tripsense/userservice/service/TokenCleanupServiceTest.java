package fu.tripsense.userservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import fu.tripsense.userservice.repository.RefreshTokenRepository;
import fu.tripsense.userservice.repository.SessionRepository;
import fu.tripsense.userservice.service.TokenCleanupService.CleanupResult;
import fu.tripsense.userservice.service.impl.TokenCleanupServiceImpl;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TokenCleanupServiceTest {

  @Mock private RefreshTokenRepository refreshTokenRepository;
  @Mock private SessionRepository sessionRepository;

  private TokenCleanupServiceImpl tokenCleanupService;

  @BeforeEach
  void setUp() {
    tokenCleanupService =
        new TokenCleanupServiceImpl(refreshTokenRepository, sessionRepository);
  }

  @Test
  @DisplayName("cleanupExpiredTokensAndSessions purges expired tokens and sessions and returns correct counts")
  void testCleanupExpiredTokensAndSessions_Success() {
    LocalDateTime cutoff = LocalDateTime.of(2026, 9, 24, 3, 0, 0);

    when(refreshTokenRepository.deleteExpiredOrRevokedTokens(cutoff)).thenReturn(42);
    when(sessionRepository.deleteExpiredSessions(cutoff)).thenReturn(10);

    CleanupResult result = tokenCleanupService.cleanupExpiredTokensAndSessions(cutoff);

    assertThat(result.purgedTokens()).isEqualTo(42);
    assertThat(result.purgedSessions()).isEqualTo(10);

    verify(refreshTokenRepository).deleteExpiredOrRevokedTokens(cutoff);
    verify(sessionRepository).deleteExpiredSessions(cutoff);
  }

  @Test
  @DisplayName("cleanupExpiredTokensAndSessions returns zero when no expired records exist")
  void testCleanupExpiredTokensAndSessions_ZeroDeleted() {
    LocalDateTime cutoff = LocalDateTime.of(2026, 9, 24, 3, 0, 0);

    when(refreshTokenRepository.deleteExpiredOrRevokedTokens(cutoff)).thenReturn(0);
    when(sessionRepository.deleteExpiredSessions(cutoff)).thenReturn(0);

    CleanupResult result = tokenCleanupService.cleanupExpiredTokensAndSessions(cutoff);

    assertThat(result.purgedTokens()).isZero();
    assertThat(result.purgedSessions()).isZero();

    verify(refreshTokenRepository).deleteExpiredOrRevokedTokens(cutoff);
    verify(sessionRepository).deleteExpiredSessions(cutoff);
  }
}
