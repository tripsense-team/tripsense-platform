package fu.tripsense.recommendation.algorithm.ranking;

import static org.assertj.core.api.Assertions.*;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.*;
import java.time.Instant;
import java.time.Duration;
import java.util.*;
import org.junit.jupiter.api.Test;

class DailyBudgetRankingTest {
  private final HeuristicRanker ranker = new HeuristicRanker(new RecommendationProperties());

  @Test
  void sourcedCostOverDailyBudgetIsDemotedWithoutChangingUnknownOrCheaperScores() {
    var cheap = candidate("cheap", price(100000L, Instant.now()));
    var expensive = candidate("expensive", price(1000000L, Instant.now()));
    var unknown = candidate("unknown", null);
    var context = context(700000L);
    var result = ranker.rank(context, List.of(expensive, cheap, unknown));
    assertThat(result.getLast().features().placeId()).isEqualTo("expensive");
    assertThat(result.getLast().breakdown().budgetAdjustment()).isCloseTo(-0.045, within(0.000001));
    assertThat(result.getLast().reasons()).extracting(RecommendationReason::code)
        .contains(RecommendationReasonCode.DAILY_BUDGET_EXCEEDED);
    assertThat(ranker.rank(context, List.of(cheap)).getFirst().score())
        .isEqualTo(ranker.rank(context(null), List.of(cheap)).getFirst().score());
    assertThat(ranker.rank(context, List.of(unknown)).getFirst().breakdown().budgetPriceEvidence()).isNull();
  }

  @Test
  void staleFutureIncompatibleAndAbsentEvidenceNeverChangesScore() {
    for (var evidence : List.of(price(1000000L, Instant.now().minus(Duration.ofDays(31))),
        price(1000000L, Instant.now().plusSeconds(300)),
        new PriceEvidence(1000000L, "PER_ROOM_NIGHT", "https://example.org/tariff", Instant.now()),
        new PriceEvidence(1000000L, "PER_PERSON_VISIT", "javascript:alert(1)", Instant.now()))) {
      var item = ranker.rank(context(700000L), List.of(candidate("invalid", evidence))).getFirst();
      assertThat(item.breakdown().budgetAdjustment()).isZero();
      assertThat(item.breakdown().budgetPriceEvidence()).isNull();
    }
    assertThat(ranker.rank(context(700000L), List.of(candidate("equal", price(700000L, Instant.now()))))
        .getFirst().breakdown().budgetAdjustment()).isZero();
    var settings = new RecommendationProperties();
    settings.getRanking().setBudgetMaximumPenalty(0);
    assertThat(new HeuristicRanker(settings).rank(context(1L),
        List.of(candidate("disabled", price(1000000000L, Instant.now()))))
        .getFirst().breakdown().budgetAdjustment()).isZero();
  }

  private static PriceEvidence price(long amount, Instant at) {
    return new PriceEvidence(amount, "PER_PERSON_VISIT", "https://example.org/tariff", at);
  }

  private static RecommendationContext context(Long budget) {
    var profile = new UserProfileSnapshot(true, true, Set.of(), Set.of(), Map.of(), Set.of(),
        Set.of(), Set.of(), Set.of(), null, budget, "MID_RANGE");
    return new RecommendationContext(UUID.randomUUID(), UUID.randomUUID(), null, "session", "museum",
        null, null, Set.of(), Set.of(), profile, null, 10);
  }

  private static CandidateFeatures candidate(String id, PriceEvidence price) {
    var place = new PlaceSnapshot(id, "test", id, "Museum", null, null, null, null,
        List.of("museum"), null, null, null, List.of(), null, "OPERATIONAL", null,
        Instant.now(), "FRESH", "museum", price);
    return CandidateFeatures.empty(new FusedCandidate(id, place, 0.02, List.of()));
  }
}
