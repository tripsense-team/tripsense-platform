package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.domain.GeoPoint;
import fu.tripsense.recommendation.domain.GeographicScope;
import fu.tripsense.recommendation.domain.RankingCriterion;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public record RecommendationCommand(
    UUID userId,
    String accessToken,
    String query,
    UUID tripId,
    String sessionId,
    GeoPoint anchor,
    Integer radiusMeters,
    Set<String> preferredCategories,
    Set<String> dislikedCategories,
    Set<String> requiredCategories,
    GeographicScope geographicScope,
    List<RankingCriterion> rankingCriteria,
    int limit) {}
