package fu.tripsense.recommendation.algorithm.filter;

import fu.tripsense.recommendation.algorithm.feature.GeoDistanceCalculator;
import fu.tripsense.recommendation.application.port.CandidateFilter;
import fu.tripsense.recommendation.application.port.FilterDecision;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import org.springframework.stereotype.Component;

@Component
public class MaximumRadiusFilter implements CandidateFilter {
  private final GeoDistanceCalculator distance;

  public MaximumRadiusFilter(GeoDistanceCalculator distance) {
    this.distance = distance;
  }

  @Override
  public FilterDecision evaluate(RecommendationContext context, FusedCandidate candidate) {
    if (context.radiusMeters() == null) return FilterDecision.accept();
    if (context.anchor() == null || candidate.place().location() == null) {
      return FilterDecision.reject("RADIUS_EVIDENCE_MISSING");
    }
    double meters = distance.kilometers(context.anchor(), candidate.place().location()) * 1000;
    return meters <= context.radiusMeters()
        ? FilterDecision.accept()
        : FilterDecision.reject("OUTSIDE_MAXIMUM_RADIUS");
  }
}
