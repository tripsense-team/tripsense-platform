package fu.tripsense.recommendation.algorithm.fusion;

import static org.assertj.core.api.Assertions.assertThat;

import fu.tripsense.recommendation.application.port.CandidateGenerationResult;
import fu.tripsense.recommendation.domain.Candidate;
import fu.tripsense.recommendation.domain.CandidateSource;
import java.util.List;
import org.junit.jupiter.api.Test;

class ReciprocalRankFusionStrategyTest {
  private final ReciprocalRankFusionStrategy strategy = new ReciprocalRankFusionStrategy(60);

  @Test
  void deduplicatesCandidatesAndRetainsAllSourceEvidence() {
    Candidate first = new Candidate("a", CandidateSource.PLACE_RETRIEVAL, 1, 0.9, null, null);
    Candidate duplicate = new Candidate("a", CandidateSource.SEMANTIC, 2, 0.8, null, null);
    Candidate second = new Candidate("b", CandidateSource.PLACE_RETRIEVAL, 2, 0.7, null, null);

    var result =
        strategy.fuse(
            List.of(
                new CandidateGenerationResult(
                    CandidateSource.PLACE_RETRIEVAL, List.of(first, second), List.of()),
                new CandidateGenerationResult(
                    CandidateSource.SEMANTIC, List.of(duplicate), List.of())));

    assertThat(result).hasSize(2);
    assertThat(result.getFirst().placeId()).isEqualTo("a");
    assertThat(result.getFirst().sources()).hasSize(2);
    assertThat(result.getFirst().fusionScore()).isEqualTo((1.0 / 61) + (1.0 / 62));
  }

  @Test
  void handlesEmptySources() {
    assertThat(strategy.fuse(List.of())).isEmpty();
  }
}
