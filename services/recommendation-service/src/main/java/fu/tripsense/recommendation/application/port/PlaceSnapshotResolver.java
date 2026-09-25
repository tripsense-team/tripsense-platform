package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.domain.PlaceSnapshot;
import java.util.Optional;

public interface PlaceSnapshotResolver {
  Optional<PlaceSnapshot> find(String placeId);
}
