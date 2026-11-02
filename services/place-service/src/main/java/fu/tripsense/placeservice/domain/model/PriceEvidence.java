package fu.tripsense.placeservice.domain.model;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;

/** A curated, sourced adult per-person price, never inferred from categories or reviews. */
public record PriceEvidence(Long amountVnd, String basis, String sourceUrl, Instant observedAt) {
  public boolean validAt(Instant now) {
    if (amountVnd == null || amountVnd < 0 || amountVnd > 1_000_000_000L
        || !("PER_PERSON_VISIT".equals(basis) || "PER_PERSON_NIGHT".equals(basis))
        || observedAt == null || observedAt.isAfter(now)) return false;
    try {
      URI uri = URI.create(sourceUrl);
      return sourceUrl.length() <= 2048 && "https".equalsIgnoreCase(uri.getScheme())
          && uri.getHost() != null && uri.getUserInfo() == null;
    } catch (RuntimeException invalid) {
      return false;
    }
  }

  public boolean usableAt(Instant now) {
    return validAt(now) && !observedAt.isBefore(now.minus(Duration.ofDays(30)));
  }
}
