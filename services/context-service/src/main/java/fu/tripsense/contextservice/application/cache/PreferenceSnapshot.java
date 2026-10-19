package fu.tripsense.contextservice.application.cache;

import fu.tripsense.contextservice.application.PreferenceSignalReader.PreferenceSignal;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Immutable, purpose-filtered projection; never an onboarding entity or free-text payload. */
public record PreferenceSnapshot(
    Revision revision, String purpose, List<PreferenceSignal> signals) {
  public PreferenceSnapshot {
    requirePurpose(purpose);
    signals =
        signals.stream()
            .sorted(
                Comparator.comparing(PreferenceSignal::dimensionCode)
                    .thenComparing(PreferenceSignal::valueCode)
                    .thenComparing(PreferenceSignal::source))
            .toList();
  }

  public static void requirePurpose(String purpose) {
    if (!Set.of("TRIP_PLANNING", "EXPLORE_RECOMMENDATION").contains(purpose)) {
      throw new IllegalArgumentException("Unsupported preference purpose");
    }
  }

  public record Revision(
      UUID profileId, long version, String status, int schemaVersion, String catalogHash) {
    public boolean completed() {
      return profileId != null && "COMPLETED".equals(status);
    }

    public static Revision absent() {
      return new Revision(null, 0, "ABSENT", 1, "");
    }
  }
}
