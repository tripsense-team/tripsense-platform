package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.domain.PlaceSnapshot;

public interface PlaceIndexer {
  boolean indexIfChanged(PlaceSnapshot place);
}
