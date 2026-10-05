package fu.tripsense.recommendation.application;

import static org.assertj.core.api.Assertions.assertThat;

import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.CandidateSource;
import fu.tripsense.recommendation.domain.CandidateSourceEvidence;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RankedCandidate;
import fu.tripsense.recommendation.domain.ScoreBreakdown;
import java.util.List;
import org.junit.jupiter.api.Test;

class ExploreQueryRelevancePolicyTest {
  private final ExploreQueryRelevancePolicy policy =
      new ExploreQueryRelevancePolicy(new RecommendationProperties());

  @Test
  void acceptsProviderQueryEvidenceWithinBoundedRank() {
    assertThat(policy.isEligible(candidate(null, false, 0, 12))).isTrue();
    assertThat(policy.isEligible(candidate(null, false, 0, 41))).isFalse();
  }

  @Test
  void acceptsScoredEvidenceAndRejectsProfileOnlyCandidates() {
    assertThat(policy.isEligible(candidate(0.20, false, 0, null))).isTrue();
    assertThat(policy.isEligible(candidate(null, true, 0.20, null))).isTrue();
    assertThat(policy.isEligible(candidate(null, false, 0, null))).isFalse();
  }

  private RankedCandidate candidate(
      Double lexical, boolean semanticAvailable, double semantic, Integer providerRank) {
    var sources =
        providerRank == null
            ? List.<CandidateSourceEvidence>of()
            : List.of(
                new CandidateSourceEvidence(
                    CandidateSource.PLACE_RETRIEVAL, providerRank, null, null));
    FusedCandidate fused = new FusedCandidate("place-1", null, 0.1, sources);
    CandidateFeatures features =
        CandidateFeatures.empty(fused)
            .withRetrieval(new CandidateFeatures.Retrieval(0.1, sources.size(), lexical))
            .withSemantic(new CandidateFeatures.Semantic(semanticAvailable, semantic, 0));
    ScoreBreakdown breakdown = new ScoreBreakdown(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    return new RankedCandidate(features, 0.1, breakdown, List.of());
  }
}
