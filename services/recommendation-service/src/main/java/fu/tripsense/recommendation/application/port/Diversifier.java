package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.domain.RankedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.List;

public interface Diversifier {
  List<RankedCandidate> diversify(
      RecommendationContext context, List<RankedCandidate> rankedCandidates, int limit);
}
