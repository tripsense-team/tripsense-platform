package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;

public interface FeatureExtractor {
  int order();

  CandidateFeatures extract(
      RecommendationContext context, FusedCandidate candidate, CandidateFeatures current);
}
