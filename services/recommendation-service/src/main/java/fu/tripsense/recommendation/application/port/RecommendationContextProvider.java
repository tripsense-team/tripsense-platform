package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.application.RecommendationCommand;
import fu.tripsense.recommendation.domain.RecommendationContext;

public interface RecommendationContextProvider {
  RecommendationContext resolve(RecommendationCommand command);
}
