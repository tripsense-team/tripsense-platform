package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;

public interface CandidateFilter {
  FilterDecision evaluate(RecommendationContext context, FusedCandidate candidate);
}
