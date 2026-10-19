package fu.tripsense.contextservice.application.cache;

import java.util.UUID;

public interface PreferenceSnapshotSource {
  PreferenceSnapshot.Revision revision(UUID userId);

  PreferenceSnapshot load(UUID userId, String purpose);
}
