package fu.tripsense.contextservice.application;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface PreferenceSignalReader {
  List<PreferenceSignal> findForUser(UUID userId);

  record PreferenceSignal(
      String dimensionCode,
      String valueCode,
      double confidence,
      String source,
      Instant updatedAt) {}
}
