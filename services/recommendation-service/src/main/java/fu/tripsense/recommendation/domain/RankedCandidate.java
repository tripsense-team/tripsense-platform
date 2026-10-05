package fu.tripsense.recommendation.domain;

import java.util.List;

public record RankedCandidate(
    CandidateFeatures features,
    double score,
    ScoreBreakdown breakdown,
    List<RecommendationReason> reasons) {
  public RankedCandidate {
    reasons = reasons == null ? List.of() : List.copyOf(reasons);
  }
}
