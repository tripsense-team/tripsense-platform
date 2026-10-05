package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.domain.RecommendationContext;
import fu.tripsense.recommendation.domain.RecommendationResult;

public interface ImpressionRecorder {
  void record(RecommendationContext context, RecommendationResult result);
}
