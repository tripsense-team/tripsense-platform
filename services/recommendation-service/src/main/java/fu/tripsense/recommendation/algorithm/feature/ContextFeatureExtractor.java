package fu.tripsense.recommendation.algorithm.feature;

import fu.tripsense.recommendation.application.port.FeatureExtractor;
import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.Locale;
import org.springframework.stereotype.Component;

@Component
public class ContextFeatureExtractor implements FeatureExtractor {
  @Override
  public int order() {
    return 60;
  }

  @Override
  public CandidateFeatures extract(
      RecommendationContext context, FusedCandidate candidate, CandidateFeatures current) {
    if (context.trip() == null || context.trip().destinationName() == null) return current;
    String destination = context.trip().destinationName().toLowerCase(Locale.ROOT);
    boolean match =
        contains(candidate.place().city(), destination)
            || contains(candidate.place().district(), destination)
            || contains(candidate.place().address(), destination);
    return current.withContextual(new CandidateFeatures.Contextual(true, match ? 1.0 : 0.0, 0.0));
  }

  private boolean contains(String value, String expected) {
    return value != null && value.toLowerCase(Locale.ROOT).contains(expected);
  }
}
