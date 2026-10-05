package fu.tripsense.recommendation.algorithm.evaluation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.assertj.core.data.Offset;
import org.junit.jupiter.api.Test;

class RecommendationMetricsTest {
  private final RecommendationMetrics metrics = new RecommendationMetrics();

  @Test
  void computesRetrievalAndRankingMetrics() {
    List<String> ranked = List.of("a", "b", "c");
    Set<String> relevant = Set.of("b", "c", "d");

    assertThat(metrics.recallAtK(ranked, relevant, 2)).isEqualTo(1.0 / 3.0);
    assertThat(metrics.precisionAtK(ranked, relevant, 2)).isEqualTo(0.5);
    assertThat(metrics.meanReciprocalRank(ranked, relevant)).isEqualTo(0.5);
    assertThat(metrics.ndcgAtK(ranked, Map.of("a", 0, "b", 3, "c", 1), 3)).isBetween(0.0, 1.0);
  }

  @Test
  void computesDiversityAndCategoryCoverage() {
    List<Set<String>> categories =
        List.of(Set.of("cafe"), Set.of("museum"), Set.of("cafe", "food"));

    assertThat(metrics.intraListDiversity(categories)).isCloseTo(5.0 / 6.0, Offset.offset(1e-12));
    assertThat(metrics.categoryCoverage(categories)).isEqualTo(3);
  }

  @Test
  void emptyEvaluationInputsReturnZero() {
    assertThat(metrics.recallAtK(List.of(), Set.of(), 10)).isZero();
    assertThat(metrics.precisionAtK(List.of("a"), null, 10)).isZero();
    assertThat(metrics.meanReciprocalRank(null, Set.of("a"))).isZero();
    assertThat(metrics.ndcgAtK(List.of(), Map.of(), 10)).isZero();
  }
}
