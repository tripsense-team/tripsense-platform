package fu.tripsense.recommendation.algorithm.fusion;

import fu.tripsense.recommendation.application.port.CandidateFusionStrategy;
import fu.tripsense.recommendation.application.port.CandidateGenerationResult;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.Candidate;
import fu.tripsense.recommendation.domain.CandidateSourceEvidence;
import fu.tripsense.recommendation.domain.FusedCandidate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class ReciprocalRankFusionStrategy implements CandidateFusionStrategy {
  private final int k;

  @Autowired
  public ReciprocalRankFusionStrategy(RecommendationProperties properties) {
    this(properties.getRetrieval().getRrfK());
  }

  ReciprocalRankFusionStrategy(int k) {
    if (k < 1) throw new IllegalArgumentException("RRF k must be positive");
    this.k = k;
  }

  @Override
  public List<FusedCandidate> fuse(List<CandidateGenerationResult> sourceResults) {
    Map<String, Accumulator> accumulated = new LinkedHashMap<>();
    for (CandidateGenerationResult sourceResult : sourceResults) {
      for (Candidate candidate : sourceResult.candidates()) {
        Accumulator value =
            accumulated.computeIfAbsent(candidate.placeId(), ignored -> new Accumulator(candidate));
        value.score += reciprocalRank(candidate.sourceRank());
        value.evidence.add(
            new CandidateSourceEvidence(
                candidate.source(),
                candidate.sourceRank(),
                candidate.sourceScore(),
                candidate.retrievalEvidence()));
      }
    }
    return accumulated.values().stream()
        .map(
            value ->
                new FusedCandidate(
                    value.first.placeId(), value.first.place(), value.score, value.evidence))
        .sorted(
            Comparator.comparingDouble(FusedCandidate::fusionScore)
                .reversed()
                .thenComparing(FusedCandidate::placeId))
        .toList();
  }

  double reciprocalRank(int rank) {
    if (rank < 1) throw new IllegalArgumentException("rank must be positive");
    return 1.0 / (k + rank);
  }

  private static final class Accumulator {
    private final Candidate first;
    private final List<CandidateSourceEvidence> evidence = new ArrayList<>();
    private double score;

    private Accumulator(Candidate first) {
      this.first = first;
    }
  }
}
