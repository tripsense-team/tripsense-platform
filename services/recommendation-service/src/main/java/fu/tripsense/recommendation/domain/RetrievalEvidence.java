package fu.tripsense.recommendation.domain;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record RetrievalEvidence(
    String status,
    boolean queryResolved,
    int candidateCount,
    int eligibleCount,
    Map<String, Double> requiredFieldCoverage,
    double geographicCoverage,
    String freshness,
    Set<String> sourceSet,
    Instant retrievedAt,
    String providerStatus,
    boolean refreshPerformed,
    List<String> reasonCodes,
    String rankingVersion) {
  public RetrievalEvidence {
    requiredFieldCoverage =
        requiredFieldCoverage == null ? Map.of() : Map.copyOf(requiredFieldCoverage);
    sourceSet = sourceSet == null ? Set.of() : Set.copyOf(sourceSet);
    reasonCodes = reasonCodes == null ? List.of() : List.copyOf(reasonCodes);
  }
}
