package fu.tripsense.recommendation.api.dto;

import fu.tripsense.recommendation.domain.AlgorithmVersions;
import fu.tripsense.recommendation.application.ExploreRecommendationResult;
import java.util.List;
import java.util.UUID;

public record ExploreRecommendationResponse(
    UUID recommendationId,
    String destinationId,
    String committedQuery,
    boolean queryApplied,
    ResultMode resultMode,
    FallbackLevel fallbackLevel,
    boolean stale,
    Personalization personalization,
    int requestedCount,
    int returnedCount,
    boolean complete,
    String rankingStatus,
    List<RecommendationResponse.Item> items,
    AlgorithmVersions versions,
    List<String> degradations) {

  public static ExploreRecommendationResponse from(ExploreRecommendationResult value) {
    RecommendationResponse ranked = RecommendationResponse.from(value.recommendation());
    return new ExploreRecommendationResponse(
        ranked.recommendationId(),
        value.destinationId(),
        value.committedQuery(),
        value.queryApplied(),
        ResultMode.valueOf(value.resultMode().name()),
        FallbackLevel.valueOf(value.fallbackLevel().name()),
        value.stale(),
        new Personalization(
            value.personalization().enabled(),
            value.personalization().applied(),
            value.personalization().signalCount()),
        ranked.requestedCount(),
        ranked.returnedCount(),
        ranked.complete(),
        ranked.rankingStatus(),
        ranked.items(),
        ranked.versions(),
        ranked.degradations());
  }

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
