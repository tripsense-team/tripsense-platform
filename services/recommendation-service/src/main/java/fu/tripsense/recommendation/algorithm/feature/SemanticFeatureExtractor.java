package fu.tripsense.recommendation.algorithm.feature;

import fu.tripsense.recommendation.application.port.FeatureExtractor;
import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.CandidateSource;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.Objects;
import org.springframework.stereotype.Component;

@Component
public class SemanticFeatureExtractor implements FeatureExtractor {
  @Override
  public int order() {
    return 20;
  }

  @Override
  public CandidateFeatures extract(
      RecommendationContext context, FusedCandidate candidate, CandidateFeatures current) {
    Double score =
        candidate.sources().stream()
            .filter(value -> value.source() == CandidateSource.SEMANTIC)
            .map(value -> value.sourceScore())
            .filter(Objects::nonNull)
            .max(Double::compareTo)
            .orElse(null);
    return score == null
        ? current
        : current.withSemantic(new CandidateFeatures.Semantic(true, clamp(score), 0));
  }

  private double clamp(double value) {
    return Math.max(0, Math.min(1, value));
  }
}
