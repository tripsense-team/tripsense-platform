package fu.tripsense.recommendation.algorithm.feature;

import org.springframework.stereotype.Component;

@Component
public class BayesianQualityCalculator {
  public double weightedRating(
      Double rating, Integer ratingCount, double priorRating, double confidenceThreshold) {
    if (rating == null || ratingCount == null || ratingCount < 0) return priorRating;
    if (confidenceThreshold <= 0) {
      throw new IllegalArgumentException("confidence threshold must be positive");
    }
    double count = ratingCount;
    return (count / (count + confidenceThreshold)) * rating
        + (confidenceThreshold / (count + confidenceThreshold)) * priorRating;
  }
}
