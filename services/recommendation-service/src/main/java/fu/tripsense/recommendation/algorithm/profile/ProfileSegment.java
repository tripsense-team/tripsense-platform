package fu.tripsense.recommendation.algorithm.profile;

import java.util.Map;

public record ProfileSegment(boolean available, Map<String, Double> categoryAffinities) {
  public ProfileSegment {
    categoryAffinities = categoryAffinities == null ? Map.of() : Map.copyOf(categoryAffinities);
  }

  public static ProfileSegment unavailable() {
    return new ProfileSegment(false, Map.of());
  }
}
