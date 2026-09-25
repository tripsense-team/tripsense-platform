package fu.tripsense.userservice.service;

import java.time.LocalDateTime;

public interface TokenCleanupService {

  CleanupResult cleanupExpiredTokensAndSessions(LocalDateTime now);

  record CleanupResult(int purgedTokens, int purgedSessions) {}
}
