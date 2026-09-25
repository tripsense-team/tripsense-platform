package fu.tripsense.recommendation.algorithm.feature;

import fu.tripsense.recommendation.application.port.FeatureExtractor;
import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.CandidateSource;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.Objects;
import org.springframework.stereotype.Component;

@Component
public class RetrievalFeatureExtractor implements FeatureExtractor {
  @Override
  public int order() {
    return 10;
  }

  @Override
  public CandidateFeatures extract(
      RecommendationContext context, FusedCandidate candidate, CandidateFeatures current) {
    Double lexical =
        candidate.sources().stream()
            .filter(value -> value.source() == CandidateSource.PLACE_RETRIEVAL)
            .map(value -> value.sourceScore())
            .filter(Objects::nonNull)
            .max(Double::compareTo)
            .orElse(null);
    return current.withRetrieval(
        new CandidateFeatures.Retrieval(
            candidate.fusionScore(), candidate.sources().size(), lexical));
  }
}
