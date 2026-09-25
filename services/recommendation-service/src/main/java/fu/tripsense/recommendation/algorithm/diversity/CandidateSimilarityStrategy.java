package fu.tripsense.recommendation.algorithm.diversity;

import fu.tripsense.recommendation.domain.RankedCandidate;

public interface CandidateSimilarityStrategy {
  double similarity(RankedCandidate first, RankedCandidate second);
}
