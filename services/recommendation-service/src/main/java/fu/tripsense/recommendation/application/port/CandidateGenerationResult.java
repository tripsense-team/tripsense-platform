package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.domain.Candidate;
import fu.tripsense.recommendation.domain.CandidateSource;
import java.util.List;

public record CandidateGenerationResult(
    CandidateSource source, List<Candidate> candidates, List<String> degradations) {
  public CandidateGenerationResult {
    candidates = candidates == null ? List.of() : List.copyOf(candidates);
    degradations = degradations == null ? List.of() : List.copyOf(degradations);
  }
}
