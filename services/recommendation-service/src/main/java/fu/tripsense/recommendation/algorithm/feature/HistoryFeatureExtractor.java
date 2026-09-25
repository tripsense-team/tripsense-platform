package fu.tripsense.recommendation.algorithm.feature;

import fu.tripsense.recommendation.application.port.FeatureExtractor;
import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import org.springframework.stereotype.Component;

@Component
public class HistoryFeatureExtractor implements FeatureExtractor {
  @Override
  public int order() {
    return 70;
  }

  @Override
  public CandidateFeatures extract(
      RecommendationContext context, FusedCandidate candidate, CandidateFeatures current) {
    if (!context.profile().available()) return current;
    String id = candidate.placeId();
    return current.withHistory(
        new CandidateFeatures.History(
            true,
            context.profile().seenPlaceIds().contains(id),
            context.profile().savedPlaceIds().contains(id),
            context.profile().addedToTripPlaceIds().contains(id),
            context.profile().negativePlaceIds().contains(id)));
  }
}
