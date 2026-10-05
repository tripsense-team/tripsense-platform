package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.application.port.FeatureExtractor;
import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class FeaturePipeline {
  private final List<FeatureExtractor> extractors;

  public FeaturePipeline(List<FeatureExtractor> extractors) {
    this.extractors =
        extractors.stream().sorted(Comparator.comparingInt(FeatureExtractor::order)).toList();
  }

  public List<CandidateFeatures> extract(
      RecommendationContext context, List<FusedCandidate> candidates) {
    return candidates.stream()
        .map(
            candidate -> {
              CandidateFeatures features = CandidateFeatures.empty(candidate);
              for (FeatureExtractor extractor : extractors) {
                features = extractor.extract(context, candidate, features);
              }
              return features;
            })
        .toList();
  }
}
