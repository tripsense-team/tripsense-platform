package fu.tripsense.recommendation.algorithm.feature;

import fu.tripsense.recommendation.application.port.FeatureExtractor;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import org.springframework.stereotype.Component;

@Component
public class GeographicFeatureExtractor implements FeatureExtractor {
  private final GeoDistanceCalculator calculator;
  private final double tauKm;

  public GeographicFeatureExtractor(
      GeoDistanceCalculator calculator, RecommendationProperties properties) {
    this.calculator = calculator;
    this.tauKm = properties.getFeatures().getDistanceTauKm();
  }

  @Override
  public int order() {
    return 40;
  }

  @Override
  public CandidateFeatures extract(
      RecommendationContext context, FusedCandidate candidate, CandidateFeatures current) {
    if (context.anchor() == null || candidate.place().location() == null) return current;
    double distanceKm = calculator.kilometers(context.anchor(), candidate.place().location());
    return current.withGeographic(
        new CandidateFeatures.Geographic(
            true, distanceKm, calculator.exponentialDecay(distanceKm, tauKm)));
  }
}
