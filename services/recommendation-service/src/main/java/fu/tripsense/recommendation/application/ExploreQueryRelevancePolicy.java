package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.CandidateSource;
import fu.tripsense.recommendation.domain.RankedCandidate;
import fu.tripsense.recommendation.domain.RecommendationResult;
import java.util.ArrayList;
import org.springframework.stereotype.Component;

@Component
public class ExploreQueryRelevancePolicy {
  private final double minimumScore;
  private final int maximumProviderRank;

  public ExploreQueryRelevancePolicy(RecommendationProperties properties) {
    this.minimumScore = properties.getExplore().getMinimumQueryRelevance();
    this.maximumProviderRank = properties.getExplore().getMaximumProviderQueryRank();
  }

  public RecommendationApplicationService.PreparedRecommendation apply(
      RecommendationApplicationService.PreparedRecommendation prepared) {
    var result = prepared.result();
    var eligible = result.items().stream().filter(this::isEligible).toList();
    if (eligible.size() == result.items().size()) return prepared;

    var degradations = new ArrayList<>(result.degradations());
    degradations.add("QUERY_RELEVANCE_FILTERED");
    var filtered =
        new RecommendationResult(
            result.recommendationId(),
            result.requestId(),
            eligible,
            result.versions(),
            degradations.stream().distinct().toList(),
            result.requestedCount(),
            result.requestedCriteria(),
            result.retrievedCount(),
            result.rejectedByReason());
    return new RecommendationApplicationService.PreparedRecommendation(
        prepared.context(), filtered);
  }

  boolean isEligible(RankedCandidate candidate) {
    var features = candidate.features();
    Double lexical = features.retrieval().lexicalRelevance();
    if (lexical != null && lexical >= minimumScore) return true;
    if (features.semantic().available() && features.semantic().querySimilarity() >= minimumScore)
      return true;
    return features.sourceEvidence().stream()
        .anyMatch(
            evidence ->
                evidence.source() == CandidateSource.PLACE_RETRIEVAL
                    && evidence.rank() <= maximumProviderRank);
  }
}
