package fu.tripsense.recommendation.algorithm.filter;

import fu.tripsense.recommendation.application.port.CandidateFilter;
import fu.tripsense.recommendation.application.port.FilterDecision;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import org.springframework.stereotype.Component;

@Component
public class CanonicalPlaceFilter implements CandidateFilter {
  @Override
  public FilterDecision evaluate(RecommendationContext context, FusedCandidate candidate) {
    return candidate.place() != null
            && candidate.place().id() != null
            && !candidate.place().id().isBlank()
        ? FilterDecision.accept()
        : FilterDecision.reject("CANONICAL_PLACE_REQUIRED");
  }
}
