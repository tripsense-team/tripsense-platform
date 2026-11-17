package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.application.port.PlaceIndexer;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;

@Slf4j
@Service
public class PlaceIndexingService {
  private static final long[] DEFAULT_RATE_LIMIT_BACKOFF_MS = {2000L, 5000L, 10000L};
  private static final long DEFAULT_EMBED_PACE_MS = 150L;

  private final Optional<PlaceIndexer> indexer;
  private final long[] rateLimitBackoffMs;
  private final long embedPaceMs;

  @Autowired
  public PlaceIndexingService(Optional<PlaceIndexer> indexer) {
    this(indexer, DEFAULT_RATE_LIMIT_BACKOFF_MS, DEFAULT_EMBED_PACE_MS);
  }

  PlaceIndexingService(
      Optional<PlaceIndexer> indexer, long[] rateLimitBackoffMs, long embedPaceMs) {
    this.indexer = indexer;
    this.rateLimitBackoffMs = rateLimitBackoffMs;
    this.embedPaceMs = embedPaceMs;
  }

  public IndexOutcome indexPlaces(List<PlaceSnapshot> places) {
    if (places == null || places.isEmpty()) {
      return new IndexOutcome(0, 0, 0);
    }
    if (indexer.isEmpty()) {
      log.debug("Semantic indexing is disabled; skipping {} places", places.size());
      return new IndexOutcome(places.size(), 0, places.size());
    }
    int indexed = 0;
    int skipped = 0;
    int failed = 0;
    for (PlaceSnapshot place : places) {
      if (Thread.currentThread().isInterrupted()) {
        failed++;
        skipped++;
        continue;
      }
      try {
        boolean updated = indexWithRateLimitRetry(indexer.get(), place);
        if (updated) {
          indexed++;
          if (embedPaceMs > 0) {
            Thread.sleep(embedPaceMs);
          }
        } else {
          skipped++;
        }
      } catch (InterruptedException interrupted) {
        Thread.currentThread().interrupt();
        failed++;
        skipped++;
      } catch (Exception e) {
        log.error("Place indexing failed: errorType={}", e.getClass().getSimpleName());
        failed++;
        skipped++;
      }
    }
    log.info(
        "Place indexing completed: submitted={}, indexed={}, unchangedOrSkipped={}, failed={}",
        places.size(),
        indexed,
        skipped,
        failed);
    return new IndexOutcome(places.size(), indexed, skipped);
  }

  private boolean indexWithRateLimitRetry(PlaceIndexer activeIndexer, PlaceSnapshot place)
      throws InterruptedException {
    int attempt = 0;
    while (true) {
      try {
        return activeIndexer.indexIfChanged(place);
      } catch (RuntimeException ex) {
        if (!isRateLimitException(ex) || attempt >= rateLimitBackoffMs.length) {
          throw ex;
        }
        long waitMs = rateLimitBackoffMs[attempt];
        attempt++;
        log.warn(
            "Embedding provider rate-limited (429); retrying attempt {}/{} after {}ms",
            attempt,
            rateLimitBackoffMs.length,
            waitMs);
        Thread.sleep(waitMs);
      }
    }
  }

  private boolean isRateLimitException(Throwable throwable) {
    Throwable current = throwable;
    while (current != null) {
      if (current instanceof RestClientResponseException restEx
          && restEx.getStatusCode().value() == 429) {
        return true;
      }
      String name = current.getClass().getSimpleName();
      if ("TooManyRequests".equals(name)
          || (current.getMessage() != null && current.getMessage().contains("429"))) {
        return true;
      }
      current = current.getCause();
    }
    return false;
  }

  public boolean isSemanticEnabled() {
    return indexer.isPresent();
  }

  public void removePlace(String placeId) {
    if (placeId == null || placeId.isBlank() || indexer.isEmpty()) return;
    indexer.get().remove(placeId);
  }

  public record IndexOutcome(int submitted, int indexed, int skipped) {}
}
