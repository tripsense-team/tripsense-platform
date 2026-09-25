package fu.tripsense.recommendation.domain;

import java.util.Locale;
import java.util.Set;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

public record RecommendationContext(
    UUID requestId,
    UUID userId,
    UUID tripId,
    String sessionId,
    String query,
    GeoPoint anchor,
    Integer radiusMeters,
    Set<String> preferredCategories,
    Set<String> dislikedCategories,
    Set<String> requiredCategories,
    GeographicScope geographicScope,
    List<RankingCriterion> rankingCriteria,
    UserProfileSnapshot profile,
    TripContextSnapshot trip,
    int limit) {
  public RecommendationContext {
    preferredCategories = normalize(preferredCategories);
    dislikedCategories = normalize(dislikedCategories);
    requiredCategories = normalize(requiredCategories);
    rankingCriteria = rankingCriteria == null ? List.of() : List.copyOf(rankingCriteria);
    profile = profile == null ? UserProfileSnapshot.coldStart(false) : profile;
    if (limit < 1) throw new IllegalArgumentException("limit must be positive");
  }

  public RecommendationContext(
      UUID requestId,
      UUID userId,
      UUID tripId,
      String sessionId,
      String query,
      GeoPoint anchor,
      Integer radiusMeters,
      Set<String> preferredCategories,
      Set<String> dislikedCategories,
      UserProfileSnapshot profile,
      TripContextSnapshot trip,
      int limit) {
    this(
        requestId,
        userId,
        tripId,
        sessionId,
        query,
        anchor,
        radiusMeters,
        preferredCategories,
        dislikedCategories,
        Set.of(),
        null,
        List.of(),
        profile,
        trip,
        limit);
  }

  private static Set<String> normalize(Set<String> values) {
    if (values == null) return Set.of();
    return values.stream()
        .filter(value -> value != null && !value.isBlank())
        .map(value -> value.trim().toLowerCase(Locale.ROOT))
        .collect(Collectors.toUnmodifiableSet());
  }
}
