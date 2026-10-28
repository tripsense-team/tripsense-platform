package fu.tripsense.recommendation.application;

import static org.assertj.core.api.Assertions.*;
import fu.tripsense.recommendation.domain.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class BudgetEvidenceFreshnessTest {
  @Test void expiredEvidenceCannotBeServedFromFreshOrLastKnownGoodResults() {
    assertThat(BudgetEvidenceFreshness.usable(result(Instant.now()))).isTrue();
    assertThat(BudgetEvidenceFreshness.usable(result(Instant.now().minus(Duration.ofDays(31))))).isFalse();
    assertThat(BudgetEvidenceFreshness.usable(result(Instant.now().plusSeconds(60)))).isFalse();
  }
  private RecommendationResult result(Instant observed) {
    var price = new PriceEvidence(1000000L, "PER_PERSON_VISIT", "https://example.org/tariff", observed);
    var breakdown = new ScoreBreakdown(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, -0.045, price);
    return new RecommendationResult(UUID.randomUUID(), UUID.randomUUID(),
        List.of(new RankedCandidate(null, 0, breakdown, List.of())), null, List.of());
  }
}
