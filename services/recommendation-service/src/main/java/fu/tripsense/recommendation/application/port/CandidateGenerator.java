package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.domain.CandidateSource;
import fu.tripsense.recommendation.domain.RecommendationContext;

public interface CandidateGenerator {
  CandidateSource source();

  boolean optional();

  CandidateGenerationResult generate(RecommendationContext context);
}
