package fu.tripsense.recommendation.algorithm.diversity;

import fu.tripsense.recommendation.application.port.Diversifier;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.RankedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class MmrDiversifier implements Diversifier {
  private final CandidateSimilarityStrategy similarity;
  private final double lambda;
  private final boolean enabled;

  @Autowired
  public MmrDiversifier(
      CandidateSimilarityStrategy similarity, RecommendationProperties properties) {
    this(similarity, properties.getDiversity().getLambda(), properties.getDiversity().isEnabled());
  }

  MmrDiversifier(CandidateSimilarityStrategy similarity, double lambda, boolean enabled) {
    if (lambda < 0 || lambda > 1) throw new IllegalArgumentException("MMR lambda must be [0,1]");
    this.similarity = similarity;
    this.lambda = lambda;
    this.enabled = enabled;
  }

  @Override
  public List<RankedCandidate> diversify(
      RecommendationContext context, List<RankedCandidate> rankedCandidates, int limit) {
    if (limit <= 0 || rankedCandidates.isEmpty()) return List.of();
    if (!enabled) return rankedCandidates.stream().limit(limit).toList();
    List<RankedCandidate> remaining = new ArrayList<>(rankedCandidates);
    List<RankedCandidate> selected = new ArrayList<>();
    while (!remaining.isEmpty() && selected.size() < limit) {
      RankedCandidate best =
          remaining.stream()
              .max(
                  Comparator.<RankedCandidate>comparingDouble(value -> mmr(value, selected))
                      .thenComparing(
                          value -> value.features().placeId(), Comparator.reverseOrder()))
              .orElseThrow();
      selected.add(best);
      remaining.remove(best);
    }
    return List.copyOf(selected);
  }

  private double mmr(RankedCandidate candidate, List<RankedCandidate> selected) {
    double maximumSimilarity =
        selected.stream()
            .mapToDouble(value -> similarity.similarity(candidate, value))
            .max()
            .orElse(0);
    return lambda * candidate.score() - (1 - lambda) * maximumSimilarity;
  }
}
