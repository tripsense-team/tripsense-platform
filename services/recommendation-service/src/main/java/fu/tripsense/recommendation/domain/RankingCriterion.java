package fu.tripsense.recommendation.domain;

public record RankingCriterion(Feature feature, Direction direction, Importance importance) {
  public enum Feature {
    RETRIEVAL_RELEVANCE,
    DISTANCE,
    RATING,
    POPULARITY,
    QUIETNESS,
    PREFERENCE,
    CONTEXT,
    HISTORY,
    SEMANTIC
  }

  public enum Direction {
    MINIMIZE,
    MAXIMIZE
  }

  public enum Importance {
    LOW,
    MEDIUM,
    HIGH
  }
}
