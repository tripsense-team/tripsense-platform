package fu.tripsense.recommendation.api.dto;

import fu.tripsense.recommendation.domain.DiscoveryCategory;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SectionFeedResponse(
    UUID recommendationId,
    UUID seedId,
    Instant expiresAt,
    boolean seedReused,
    boolean previewOrderPreserved,
    String destinationId,
    String resultMode,
    ExploreRecommendationResponse.Personalization personalization,
    boolean stale,
    int requestedCount,
    int returnedCount,
    List<Section> sections) {
  public static SectionFeedResponse from(
      fu.tripsense.recommendation.application.SectionFeedResult result) {
    var ranked = RecommendationResponse.from(result.recommendation());
    var p = result.personalization();
    return new SectionFeedResponse(
        ranked.recommendationId(),
        result.seedId(),
        result.expiresAt(),
        result.seedReused(),
        result.previewOrderPreserved(),
        result.destinationId(),
        result.resultMode(),
        new ExploreRecommendationResponse.Personalization(
            p.enabled(), p.applied(), p.signalCount()),
        result.stale(),
        ranked.requestedCount(),
        ranked.returnedCount(),
        result.sections().stream()
            .map(
                s ->
                    new Section(
                        s.category(),
                        s.status(),
                        s.degradations(),
                        ranked.items().stream()
                            .filter(i -> s.placeIds().contains(i.place().id()))
                            .toList()))
            .toList());
  }

  public record Section(
      DiscoveryCategory category,
      String status,
      List<String> degradations,
      List<RecommendationResponse.Item> items) {}
}
