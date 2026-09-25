package fu.tripsense.recommendation.domain;

import java.util.List;
import java.util.UUID;
import java.util.Map;

public record RecommendationResult(
    UUID recommendationId,
    UUID requestId,
    List<RankedCandidate> items,
    AlgorithmVersions versions,
    List<String> degradations,
    int requestedCount,
    List<RankingCriterion.Feature> requestedCriteria,
    int retrievedCount,
    Map<String, Integer> rejectedByReason) {
  public RecommendationResult {
    items = items == null ? List.of() : List.copyOf(items);
    degradations = degradations == null ? List.of() : List.copyOf(degradations);
    requestedCriteria = requestedCriteria == null ? List.of() : List.copyOf(requestedCriteria);
    rejectedByReason = rejectedByReason == null ? Map.of() : Map.copyOf(rejectedByReason);
  }

  public RecommendationResult(UUID recommendationId, UUID requestId, List<RankedCandidate> items,
      AlgorithmVersions versions, List<String> degradations) {
    this(recommendationId, requestId, items, versions, degradations, items == null ? 0 : items.size(),
        List.of(), items == null ? 0 : items.size(), Map.of());
  }
}
