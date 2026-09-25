package fu.tripsense.recommendation.algorithm.ranking;

import fu.tripsense.recommendation.application.port.Ranker;
import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.RankedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.Comparator;
import java.util.List;

/**
 * Future LTR adapter. It is intentionally not a Spring bean until a real validated artifact exists.
 */
public class LightGbmRanker implements Ranker {
  private final LearningToRankModel model;
  private final String featureVersion;
  private final HeuristicRanker fallback;

  public LightGbmRanker(
      LearningToRankModel model, String featureVersion, HeuristicRanker fallback) {
    this.model = model;
    this.featureVersion = featureVersion;
    this.fallback = fallback;
  }

  @Override
  public List<RankedCandidate> rank(
      RecommendationContext context, List<CandidateFeatures> candidates) {
    if (model == null || !featureVersion.equals(model.requiredFeatureVersion())) {
      return fallback.rank(context, candidates);
    }
    return candidates.stream()
        .map(
            features -> {
              RankedCandidate explained = fallback.score(features);
              return new RankedCandidate(
                  features, model.predict(features), explained.breakdown(), explained.reasons());
            })
        .sorted(
            Comparator.comparingDouble(RankedCandidate::score)
                .reversed()
                .thenComparing(value -> value.features().placeId()))
        .toList();
  }
}
