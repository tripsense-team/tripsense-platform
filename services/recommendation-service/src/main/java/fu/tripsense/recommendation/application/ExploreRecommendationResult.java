package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.domain.RecommendationResult;

public record ExploreRecommendationResult(
    String destinationId,
    String committedQuery,
    boolean queryApplied,
    ResultMode resultMode,
    FallbackLevel fallbackLevel,
    boolean stale,
    Personalization personalization,
    RecommendationResult recommendation) {

  public enum ResultMode {
    PERSONALIZED,
    QUERY_PERSONALIZED,
    GENERIC_DESTINATION
  }

  public enum FallbackLevel {
    EXACT,
    RELAXED_RETRIEVAL,
    DESTINATION_BASELINE,
    LAST_KNOWN_GOOD
  }

  public record Personalization(boolean enabled, boolean applied, int signalCount) {}
}
