package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.application.port.PlaceIndexer;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class PlaceIndexingService {
  private final Optional<PlaceIndexer> indexer;

  public PlaceIndexingService(Optional<PlaceIndexer> indexer) {
    this.indexer = indexer;
  }

  public IndexOutcome indexPlaces(List<PlaceSnapshot> places) {
    if (places == null || places.isEmpty()) {
      return new IndexOutcome(0, 0, 0);
    }
    if (indexer.isEmpty()) {
      log.debug("Semantic indexing is disabled; skipping {} places", places.size());
      return new IndexOutcome(places.size(), 0, places.size());
    }
    AtomicInteger indexed = new AtomicInteger();
    AtomicInteger skipped = new AtomicInteger();
    places.parallelStream().forEach(place -> {
      try {
        if (indexer.get().indexIfChanged(place)) {
          indexed.incrementAndGet();
        } else {
          skipped.incrementAndGet();
        }
      } catch (Exception e) {
        log.error(
            "Place indexing failed: errorType={}", e.getClass().getSimpleName());
        skipped.incrementAndGet();
      }
    });
    log.info(
        "Place indexing completed: submitted={}, indexed={}, skipped={}",
        places.size(),
        indexed.get(),
        skipped.get());
    return new IndexOutcome(places.size(), indexed.get(), skipped.get());
  }

  public boolean isSemanticEnabled() {
    return indexer.isPresent();
  }

  public record IndexOutcome(int submitted, int indexed, int skipped) {}
}
