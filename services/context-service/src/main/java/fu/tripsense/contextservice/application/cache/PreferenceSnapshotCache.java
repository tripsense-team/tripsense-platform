package fu.tripsense.contextservice.application.cache;

import java.util.Optional;
import java.util.UUID;

public interface PreferenceSnapshotCache {
  boolean enabled();

  Optional<PreferenceSnapshot> get(
      UUID userId, PreferenceSnapshot.Revision revision, String purpose);

  void put(UUID userId, PreferenceSnapshot snapshot);
}
