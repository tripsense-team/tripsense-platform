package fu.tripsense.recommendation.algorithm.diversity;

import static org.assertj.core.api.Assertions.assertThat;

import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import fu.tripsense.recommendation.domain.RankedCandidate;
import fu.tripsense.recommendation.domain.ScoreBreakdown;
import java.util.List;
import org.junit.jupiter.api.Test;

class MmrDiversifierTest {
  private final MmrDiversifier diversifier =
      new MmrDiversifier(new CategorySimilarityStrategy(), 0.5, true);

  @Test
  void returnsEmptyAndHandlesOneCandidateAndShortLists() {
    assertThat(diversifier.diversify(null, List.of(), 5)).isEmpty();
    RankedCandidate only = ranked("a", 1, "cafe");
    assertThat(diversifier.diversify(null, List.of(only), 5)).containsExactly(only);
  }

  @Test
  void choosesCategoryDiversityAfterHighestRelevanceItem() {
    RankedCandidate firstCafe = ranked("a", 1.0, "cafe");
    RankedCandidate secondCafe = ranked("b", 0.95, "cafe");
    RankedCandidate museum = ranked("c", 0.80, "museum");

    assertThat(diversifier.diversify(null, List.of(firstCafe, secondCafe, museum), 2))
        .extracting(value -> value.features().placeId())
        .containsExactly("a", "c");
  }

  private RankedCandidate ranked(String id, double score, String category) {
    PlaceSnapshot place =
        new PlaceSnapshot(
            id,
            null,
            null,
            id,
            null,
            null,
            null,
            null,
            List.of(category),
            null,
            null,
            List.of(),
            null,
            null,
            null,
            null,
            null);
    CandidateFeatures features =
        new CandidateFeatures(
            id,
            place,
            List.of(),
            new CandidateFeatures.Retrieval(0, 1, null),
            new CandidateFeatures.Semantic(false, 0, 0),
            new CandidateFeatures.Preference(false, 0, false, false),
            new CandidateFeatures.Geographic(false, null, 0),
            new CandidateFeatures.Quality(false, null, 0, 0, 0),
            new CandidateFeatures.Contextual(false, 0, 0),
            new CandidateFeatures.History(false, false, false, false, false));
    return new RankedCandidate(
        features, score, new ScoreBreakdown(0, 0, 0, 0, 0, 0, 0, 0, score), List.of());
  }
}
