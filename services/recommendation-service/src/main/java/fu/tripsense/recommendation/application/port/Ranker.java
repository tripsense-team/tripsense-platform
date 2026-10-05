package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.RankedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.List;

public interface Ranker {
  List<RankedCandidate> rank(RecommendationContext context, List<CandidateFeatures> candidates);
}
