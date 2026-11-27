package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.domain.PlaceSnapshot;
import java.time.Instant;

public interface PlaceIndexer {
  boolean indexIfChanged(PlaceSnapshot place);

  default boolean indexIfChanged(
      PlaceSnapshot place, Long sourceVersion, Instant sourceUpdatedAt) {
    return indexIfChanged(place);
  }

  void remove(String placeId);
}
