package fu.tripsense.recommendation.algorithm.ranking;

import static org.assertj.core.api.Assertions.assertThat;

import fu.tripsense.recommendation.algorithm.feature.PreferenceFeatureExtractor;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import fu.tripsense.recommendation.domain.RankingCriterion;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HeuristicRankerTest {
  private final RecommendationProperties properties = new RecommendationProperties();
  private final HeuristicRanker ranker = new HeuristicRanker(properties);
  private final PreferenceFeatureExtractor preferences = new PreferenceFeatureExtractor();

  @Test
  void sameCandidateSetRanksDifferentlyForDifferentContexts() {
    FusedCandidate cafe = candidate("cafe", "cafe");
    FusedCandidate museum = candidate("museum", "museum");

    assertThat(rank(context("cafe"), cafe, museum)).containsExactly("cafe", "museum");
    assertThat(rank(context("museum"), cafe, museum)).containsExactly("museum", "cafe");
  }

  @Test
  void coldStartStillRanksUsingRetrievalAndQualitySignals() {
    CandidateFeatures stronger = base(candidate("strong", "park"), 0.04);
    CandidateFeatures weaker = base(candidate("weak", "park"), 0.01);

    assertThat(ranker.rank(context(null), List.of(weaker, stronger)))
        .extracting(value -> value.features().placeId())
        .containsExactly("strong", "weak");
  }

  @Test
  void dislikeConflictReceivesConfiguredPenalty() {
    CandidateFeatures disliked =
        base(candidate("bar", "bar"), 0.04)
            .withPreference(new CandidateFeatures.Preference(true, 0, false, true));
    CandidateFeatures neutral = base(candidate("museum", "museum"), 0.01);

    assertThat(
            ranker.rank(context(null), List.of(disliked, neutral)).getFirst().features().placeId())
        .isEqualTo("museum");
  }

  @Test
  void unavailableRatingIsExcludedInsteadOfReceivingZeroOrPriorScore() {
    CandidateFeatures distanceOnly =
        base(candidate("distance-only", "cafe"), 0.02)
            .withGeographic(new CandidateFeatures.Geographic(true, 0.5, 0.9))
            .withQuality(new CandidateFeatures.Quality(false, true, null, 57, 0, 0.6));
    RecommendationContext context =
        new RecommendationContext(
            UUID.randomUUID(),
            UUID.randomUUID(),
            null,
            "session",
            "cafe",
            null,
            null,
            Set.of(),
            Set.of(),
            Set.of("cafe"),
            null,
            List.of(
                new RankingCriterion(
                    RankingCriterion.Feature.DISTANCE,
                    RankingCriterion.Direction.MINIMIZE,
                    RankingCriterion.Importance.HIGH),
                new RankingCriterion(
                    RankingCriterion.Feature.RATING,
                    RankingCriterion.Direction.MAXIMIZE,
                    RankingCriterion.Importance.HIGH)),
            null,
            null,
            5);

    var ranked = ranker.rank(context, List.of(distanceOnly)).getFirst();

    assertThat(ranked.score()).isEqualTo(0.9);
    assertThat(ranked.breakdown().quality()).isZero();
    assertThat(ranked.breakdown().evidenceCoverage()).isEqualTo(0.5);
  }

  @Test
  void requestedDirectionChangesRankingWhileDistanceKeepsMinimizeSemantics() {
    CandidateFeatures highRating =
        base(candidate("high", "cafe"), 0.02)
            .withQuality(new CandidateFeatures.Quality(true, false, 5.0, null, 0.9, 0));
    CandidateFeatures lowRating =
        base(candidate("low", "cafe"), 0.02)
            .withQuality(new CandidateFeatures.Quality(true, false, 2.0, null, 0.2, 0));

    assertThat(
            ranker.rank(
                ratingContext(RankingCriterion.Direction.MAXIMIZE), List.of(lowRating, highRating)))
        .extracting(value -> value.features().placeId())
        .containsExactly("high", "low");
    assertThat(
            ranker.rank(
                ratingContext(RankingCriterion.Direction.MINIMIZE), List.of(lowRating, highRating)))
        .extracting(value -> value.features().placeId())
        .containsExactly("low", "high");
  }

  private RecommendationContext ratingContext(RankingCriterion.Direction direction) {
    return new RecommendationContext(
        UUID.randomUUID(),
        UUID.randomUUID(),
        null,
        "session",
        "cafe",
        null,
        null,
        Set.of(),
        Set.of(),
        Set.of("cafe"),
        null,
        List.of(
            new RankingCriterion(
                RankingCriterion.Feature.RATING, direction, RankingCriterion.Importance.HIGH)),
        null,
        null,
        5);
  }

  private List<String> rank(
      RecommendationContext context, FusedCandidate first, FusedCandidate second) {
    return ranker
        .rank(
            context,
            List.of(
                preferences.extract(context, first, base(first, 0.02)),
                preferences.extract(context, second, base(second, 0.02))))
        .stream()
        .map(value -> value.features().placeId())
        .toList();
  }

  private CandidateFeatures base(FusedCandidate candidate, double rrf) {
    CandidateFeatures empty = CandidateFeatures.empty(candidate);
    return empty.withRetrieval(new CandidateFeatures.Retrieval(rrf, 1, null));
  }

  private RecommendationContext context(String preferred) {
    return new RecommendationContext(
        UUID.randomUUID(),
        UUID.randomUUID(),
        null,
        "session",
        "places",
        null,
        null,
        preferred == null ? Set.of() : Set.of(preferred),
        Set.of(),
        null,
        null,
        10);
  }

  private FusedCandidate candidate(String id, String category) {
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
            4.0,
            10,
            List.of(),
            null,
            "OPERATIONAL",
            null,
            null,
            null);
    return new FusedCandidate(id, place, 0.02, List.of());
  }
}
