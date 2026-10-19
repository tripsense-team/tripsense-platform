package fu.tripsense.recommendation.algorithm.ranking;

import static org.assertj.core.api.Assertions.*;

import fu.tripsense.recommendation.algorithm.feature.*;
import fu.tripsense.recommendation.algorithm.filter.*;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;

class ObservedPreferenceIntegrationTest {
  private final RecommendationProperties properties = new RecommendationProperties();

  private UserProfileSnapshot profile(
      Set<String> preferred,
      Map<String, Double> affinity,
      Set<String> saved,
      Set<String> negative) {
    return new UserProfileSnapshot(
        true,
        true,
        preferred,
        Set.of(),
        affinity,
        Set.of(),
        saved,
        Set.of(),
        negative,
        Instant.EPOCH);
  }

  private RecommendationContext context(UserProfileSnapshot profile) {
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
        Set.of(),
        null,
        List.of(
            new RankingCriterion(
                RankingCriterion.Feature.PREFERENCE,
                RankingCriterion.Direction.MAXIMIZE,
                RankingCriterion.Importance.MEDIUM)),
        profile,
        null,
        10);
  }

  private FusedCandidate candidate(String id, String category) {
    return new FusedCandidate(
        id,
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
            "OPERATIONAL",
            null,
            null,
            null),
        0.02,
        List.of());
  }

  private CandidateFeatures extract(RecommendationContext context, FusedCandidate candidate) {
    return new PreferenceFeatureExtractor(new PlaceCategoryTaxonomy(properties), properties)
        .extract(context, candidate, CandidateFeatures.empty(candidate));
  }

  @Test
  void affinityOnlyIsAvailableAndSparseConfidenceSurvivesThroughFinalRanking() {
    var cafe = candidate("a", "cafe");
    var sparseContext = context(profile(Set.of(), Map.of("cafe", 0.09), Set.of(), Set.of()));
    var sparse = extract(sparseContext, cafe);
    assertThat(sparse.preference().available()).isTrue();
    assertThat(sparse.preference().categoryMatch()).isEqualTo(0.09);
    var strongerContext = context(profile(Set.of(), Map.of("cafe", 0.5), Set.of(), Set.of()));
    var stronger = extract(strongerContext, cafe);
    var ranker = new HeuristicRanker(properties);
    assertThat(ranker.rank(sparseContext, List.of(sparse)).getFirst().score())
        .isCloseTo(0.09, within(1e-12));
    assertThat(ranker.rank(strongerContext, List.of(stronger)).getFirst().score()).isEqualTo(0.5);
  }

  @Test
  void declaredPreferenceWithoutAffinityKeepsExistingFallbackAndEmptyProfileIsNotActive() {
    var cafe = candidate("a", "cafe");
    assertThat(
            extract(context(profile(Set.of("cafe"), Map.of(), Set.of(), Set.of())), cafe)
                .preference()
                .categoryMatch())
        .isEqualTo(1);
    assertThat(extract(context(UserProfileSnapshot.coldStart(true)), cafe).preference().available())
        .isFalse();
    // A fully declared café preference remains strong even if unrelated weak observed
    // evidence is also present. The result is not an exact 50% final-rank cap.
    var merged =
        context(profile(Set.of("cafe"), Map.of("cafe", 1.0, "museum", 0.09), Set.of(), Set.of()));
    assertThat(extract(merged, cafe).preference().categoryMatch())
        .isCloseTo(1 / 1.09, within(1e-12));
  }

  @Test
  void legacyFlagRestoresLegacyAvailabilityAndOverlapNormalization() {
    properties.getProfile().setObservedSignalPolicyV2Enabled(false);
    var cafe = candidate("a", "cafe");
    assertThat(
            extract(context(profile(Set.of(), Map.of("cafe", .09), Set.of(), Set.of())), cafe)
                .preference()
                .available())
        .isFalse();
    assertThat(
            extract(context(profile(Set.of("cafe"), Map.of("cafe", .09), Set.of(), Set.of())), cafe)
                .preference()
                .categoryMatch())
        .isEqualTo(1);
  }

  @Test
  void exactNegativeStillPenalizesOnlyThatPlaceAndSavedDoesNotInventQueryHistoryBoost() {
    var context = context(profile(Set.of(), Map.of("cafe", .1), Set.of("b"), Set.of("a")));
    var a = candidate("a", "cafe");
    var b = candidate("b", "cafe");
    var history = new HistoryFeatureExtractor();
    var scoredA = history.extract(context, a, extract(context, a));
    var scoredB = history.extract(context, b, extract(context, b));
    var ranked = new HeuristicRanker(properties).rank(context, List.of(scoredA, scoredB));
    assertThat(ranked).extracting(v -> v.features().placeId()).containsExactly("b", "a");
    assertThat(ranked.getFirst().score())
        .isCloseTo(.1, within(1e-12)); // no active HISTORY criterion
    assertThat(ranked.getLast().score()).isZero();
    assertThat(scoredB.preference().dislikeConflict()).isFalse();
  }

  @Test
  void explicitCategoryExclusionStillFiltersBeforeRanking() {
    var base = context(UserProfileSnapshot.coldStart(true));
    var excluded =
        new RecommendationContext(
            base.requestId(),
            base.userId(),
            null,
            "session",
            "cafe",
            null,
            null,
            Set.of(),
            Set.of("cafe"),
            Set.of(),
            null,
            List.of(),
            base.profile(),
            null,
            10);
    assertThat(new ExplicitExclusionFilter().evaluate(excluded, candidate("a", "cafe")))
        .isEqualTo(
            fu.tripsense.recommendation.application.port.FilterDecision.reject(
                "EXPLICIT_CATEGORY_EXCLUSION"));
  }
}
