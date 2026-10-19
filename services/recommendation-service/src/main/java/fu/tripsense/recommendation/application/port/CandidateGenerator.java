package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.domain.CandidateSource;
import fu.tripsense.recommendation.domain.RecommendationContext;

public interface CandidateGenerator {
  default CandidateGenerationResult generateBounded(
      fu.tripsense.recommendation.domain.RecommendationContext context, int maximumCandidates) {
    return generate(context);
  }

  CandidateSource source();

  boolean optional();

  CandidateGenerationResult generate(RecommendationContext context);
}
