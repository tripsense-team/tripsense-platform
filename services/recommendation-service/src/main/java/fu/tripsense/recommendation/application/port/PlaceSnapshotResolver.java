package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.domain.PlaceSnapshot;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface PlaceSnapshotResolver {
  Optional<PlaceSnapshot> find(String placeId);

  default Map<String, PlaceSnapshot> resolveBatch(List<String> placeIds) {
    if (placeIds == null || placeIds.isEmpty()) {
      return Map.of();
    }
    Map<String, PlaceSnapshot> result = new HashMap<>();
    for (String placeId : placeIds) {
      find(placeId).ifPresent(snapshot -> result.put(placeId, snapshot));
    }
    return result;
  }
}
