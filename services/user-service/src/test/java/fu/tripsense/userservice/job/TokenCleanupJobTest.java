package fu.tripsense.userservice.job;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import fu.tripsense.userservice.service.TokenCleanupService;
import fu.tripsense.userservice.service.TokenCleanupService.CleanupResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class TokenCleanupJobTest {

  @Mock private TokenCleanupService tokenCleanupService;

  private TokenCleanupJob tokenCleanupJob;

  @BeforeEach
  void setUp() {
    tokenCleanupJob = new TokenCleanupJob(tokenCleanupService);
    ReflectionTestUtils.setField(tokenCleanupJob, "cleanupEnabled", true);
    ReflectionTestUtils.setField(tokenCleanupJob, "cleanupOnStartup", true);
  }

  @Test
  @DisplayName("onApplicationStartup triggers cleanup when enabled")
  void testOnApplicationStartup_TriggeredWhenEnabled() {
    when(tokenCleanupService.cleanupExpiredTokensAndSessions(any()))
        .thenReturn(new CleanupResult(25, 8));

    tokenCleanupJob.onApplicationStartup();

    verify(tokenCleanupService).cleanupExpiredTokensAndSessions(any());
  }

  @Test
  @DisplayName("onApplicationStartup does not trigger cleanup when startup cleanup is disabled")
  void testOnApplicationStartup_SkippedWhenDisabled() {
    ReflectionTestUtils.setField(tokenCleanupJob, "cleanupOnStartup", false);

    tokenCleanupJob.onApplicationStartup();

    verifyNoInteractions(tokenCleanupService);
  }

  @Test
  @DisplayName("runScheduledCleanup triggers cleanup when enabled")
  void testRunScheduledCleanup_TriggeredWhenEnabled() {
    when(tokenCleanupService.cleanupExpiredTokensAndSessions(any()))
        .thenReturn(new CleanupResult(50, 12));

    tokenCleanupJob.runScheduledCleanup();

    verify(tokenCleanupService).cleanupExpiredTokensAndSessions(any());
  }

  @Test
  @DisplayName("runScheduledCleanup does not trigger cleanup when cleanup is disabled")
  void testRunScheduledCleanup_SkippedWhenDisabled() {
    ReflectionTestUtils.setField(tokenCleanupJob, "cleanupEnabled", false);

    tokenCleanupJob.runScheduledCleanup();

    verifyNoInteractions(tokenCleanupService);
  }

  @Test
  @DisplayName("executeCleanup handles exception gracefully without throwing")
  void testExecuteCleanup_HandlesExceptionGracefully() {
    when(tokenCleanupService.cleanupExpiredTokensAndSessions(any()))
        .thenThrow(new RuntimeException("Database timeout"));

    // Should not throw
    tokenCleanupJob.executeCleanup();

    verify(tokenCleanupService).cleanupExpiredTokensAndSessions(any());
  }
}
