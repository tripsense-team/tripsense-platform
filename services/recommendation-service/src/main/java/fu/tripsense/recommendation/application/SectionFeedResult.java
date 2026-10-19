package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.domain.*;
import java.time.Instant;
import java.util.*;

public record SectionFeedResult(
    UUID seedId,
    Instant expiresAt,
    boolean seedReused,
    boolean previewOrderPreserved,
    String destinationId,
    String resultMode,
    ExploreRecommendationResult.Personalization personalization,
    boolean stale,
    RecommendationResult recommendation,
    List<Section> sections) {
  public record Section(
      DiscoveryCategory category,
      String status,
      List<String> degradations,
      List<String> placeIds) {}
}
