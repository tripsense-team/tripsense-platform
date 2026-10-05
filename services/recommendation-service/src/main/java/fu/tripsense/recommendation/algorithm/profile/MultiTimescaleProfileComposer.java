package fu.tripsense.recommendation.algorithm.profile;

import fu.tripsense.recommendation.config.RecommendationProperties;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class MultiTimescaleProfileComposer {
  private final double longTermWeight;
  private final double tripWeight;
  private final double sessionWeight;

  @Autowired
  public MultiTimescaleProfileComposer(RecommendationProperties properties) {
    this(
        properties.getProfile().getLongTermWeight(),
        properties.getProfile().getTripWeight(),
        properties.getProfile().getSessionWeight());
  }

  MultiTimescaleProfileComposer(double longTermWeight, double tripWeight, double sessionWeight) {
    if (longTermWeight < 0 || tripWeight < 0 || sessionWeight < 0) {
      throw new IllegalArgumentException("Profile weights cannot be negative");
    }
    this.longTermWeight = longTermWeight;
    this.tripWeight = tripWeight;
    this.sessionWeight = sessionWeight;
  }

  public Map<String, Double> compose(
      ProfileSegment longTerm, ProfileSegment trip, ProfileSegment session) {
    Map<String, Double> result = new HashMap<>();
    double activeWeight = 0;
    activeWeight += add(result, longTerm, longTermWeight);
    activeWeight += add(result, trip, tripWeight);
    activeWeight += add(result, session, sessionWeight);
    if (activeWeight == 0) return Map.of();
    double denominator = activeWeight;
    result.replaceAll((ignored, value) -> value / denominator);
    return Map.copyOf(result);
  }

  private double add(Map<String, Double> target, ProfileSegment segment, double weight) {
    if (segment == null || !segment.available() || weight == 0) return 0;
    segment
        .categoryAffinities()
        .forEach((category, affinity) -> target.merge(category, affinity * weight, Double::sum));
    return weight;
  }
}
