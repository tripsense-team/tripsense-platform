package fu.tripsense.recommendation.algorithm.diversity;

import fu.tripsense.recommendation.domain.RankedCandidate;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class CategorySimilarityStrategy implements CandidateSimilarityStrategy {
  @Override
  public double similarity(RankedCandidate first, RankedCandidate second) {
    Set<String> left = normalized(first);
    Set<String> right = normalized(second);
    if (left.isEmpty() || right.isEmpty()) return 0;
    Set<String> intersection = new HashSet<>(left);
    intersection.retainAll(right);
    Set<String> union = new HashSet<>(left);
    union.addAll(right);
    return (double) intersection.size() / union.size();
  }

  private Set<String> normalized(RankedCandidate candidate) {
    Set<String> result = new HashSet<>();
    candidate.features().place().categories().stream()
        .map(value -> value.toLowerCase(Locale.ROOT))
        .forEach(result::add);
    return result;
  }
}
