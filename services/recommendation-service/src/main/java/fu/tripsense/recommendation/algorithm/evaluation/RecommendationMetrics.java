package fu.tripsense.recommendation.algorithm.evaluation;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class RecommendationMetrics {
  public double recallAtK(List<String> ranked, Set<String> relevant, int k) {
    validateK(k);
    if (ranked == null || relevant == null || relevant.isEmpty()) return 0;
    long hits = ranked.stream().limit(k).filter(relevant::contains).distinct().count();
    return (double) hits / relevant.size();
  }

  public double precisionAtK(List<String> ranked, Set<String> relevant, int k) {
    validateK(k);
    if (ranked == null || ranked.isEmpty() || relevant == null || relevant.isEmpty()) return 0;
    long hits = ranked.stream().limit(k).filter(relevant::contains).distinct().count();
    return (double) hits / Math.min(k, ranked.size());
  }

  public double meanReciprocalRank(List<String> ranked, Set<String> relevant) {
    if (ranked == null || relevant == null) return 0;
    for (int index = 0; index < ranked.size(); index++) {
      if (relevant.contains(ranked.get(index))) return 1.0 / (index + 1);
    }
    return 0;
  }

  public double ndcgAtK(List<String> ranked, Map<String, Integer> relevance, int k) {
    validateK(k);
    if (ranked == null || relevance == null || relevance.isEmpty()) return 0;
    double actual = dcg(ranked.stream().limit(k).map(id -> relevance.getOrDefault(id, 0)).toList());
    List<Integer> ideal =
        relevance.values().stream().sorted(java.util.Comparator.reverseOrder()).limit(k).toList();
    double maximum = dcg(ideal);
    return maximum == 0 ? 0 : actual / maximum;
  }

  public double intraListDiversity(List<Set<String>> categorySets) {
    if (categorySets == null || categorySets.size() < 2) return 0;
    double total = 0;
    int pairs = 0;
    for (int left = 0; left < categorySets.size(); left++) {
      for (int right = left + 1; right < categorySets.size(); right++) {
        total += 1 - jaccard(categorySets.get(left), categorySets.get(right));
        pairs++;
      }
    }
    return pairs == 0 ? 0 : total / pairs;
  }

  public int categoryCoverage(List<Set<String>> categorySets) {
    Set<String> categories = new HashSet<>();
    if (categorySets != null) categorySets.forEach(categories::addAll);
    return categories.size();
  }

  private double dcg(List<Integer> values) {
    double result = 0;
    for (int index = 0; index < values.size(); index++) {
      result += (Math.pow(2, values.get(index)) - 1) / (Math.log(index + 2) / Math.log(2));
    }
    return result;
  }

  private double jaccard(Set<String> first, Set<String> second) {
    if ((first == null || first.isEmpty()) && (second == null || second.isEmpty())) return 0;
    Set<String> intersection = new HashSet<>(first == null ? Set.of() : first);
    intersection.retainAll(second == null ? Set.of() : second);
    Set<String> union = new HashSet<>(first == null ? Set.of() : first);
    union.addAll(second == null ? Set.of() : second);
    return union.isEmpty() ? 0 : (double) intersection.size() / union.size();
  }

  private void validateK(int k) {
    if (k < 1) throw new IllegalArgumentException("k must be positive");
  }
}
