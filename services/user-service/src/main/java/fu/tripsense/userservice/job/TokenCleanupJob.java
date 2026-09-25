package fu.tripsense.userservice.job;

import fu.tripsense.userservice.service.TokenCleanupService;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class TokenCleanupJob {

  private final TokenCleanupService tokenCleanupService;

  @Value("${auth.cleanup.enabled:true}")
  private boolean cleanupEnabled;

  @Value("${auth.cleanup.on-startup:true}")
  private boolean cleanupOnStartup;

  /**
   * Executes automatically on application startup to purge stale tokens and dead sessions.
   */
  @EventListener(ApplicationReadyEvent.class)
  public void onApplicationStartup() {
    if (!cleanupEnabled || !cleanupOnStartup) {
      log.info("Token cleanup on application startup is disabled by configuration");
      return;
    }
    log.info("ApplicationReadyEvent received: Triggering initial auth token and session cleanup...");
    executeCleanup();
  }

  /**
   * Scheduled cron job running daily at 3:00 AM (default: 0 0 3 * * ?).
   */
  @Scheduled(cron = "${auth.cleanup.cron:0 0 3 * * ?}")
  public void runScheduledCleanup() {
    if (!cleanupEnabled) {
      log.debug("Scheduled token cleanup is disabled by configuration");
      return;
    }
    log.info("Scheduled cron trigger: Running daily auth token and session cleanup...");
    executeCleanup();
  }

  public void executeCleanup() {
    try {
      LocalDateTime now = LocalDateTime.now();
      TokenCleanupService.CleanupResult result =
          tokenCleanupService.cleanupExpiredTokensAndSessions(now);
      log.info(
          "Token cleanup executed: {} expired tokens, {} expired sessions purged",
          result.purgedTokens(),
          result.purgedSessions());
    } catch (Exception ex) {
      log.error("Failed to execute token and session cleanup: {}", ex.getMessage());
    }
  }
}
