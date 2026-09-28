package fu.tripsense.recommendation.application;

public record ExploreRecommendationCommand(
    String destinationId, String query, String sessionId, Integer limit) {
  public int effectiveLimit() {
    return limit == null ? 20 : limit;
  }

  public String normalizedQuery() {
    return query == null ? "" : query.trim();
  }
}
