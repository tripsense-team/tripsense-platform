package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.domain.RecommendationResult;
import java.time.Instant;

final class BudgetEvidenceFreshness {
  private BudgetEvidenceFreshness() {}

  static boolean usable(RecommendationResult result) {
    if (result == null) return false;
    Instant now = Instant.now();
    return result.items().stream().allMatch(item -> item != null
        && (item.breakdown() == null || item.breakdown().budgetPriceEvidence() == null
        || item.breakdown().budgetPriceEvidence().usableAt(now)));
  }
}
