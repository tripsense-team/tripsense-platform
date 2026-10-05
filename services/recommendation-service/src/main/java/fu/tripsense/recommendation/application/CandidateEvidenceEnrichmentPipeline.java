package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Normalization boundary for typed evidence already included in the widened Place response.
 * Deliberately performs no per-candidate network calls.
 */
@Component
public class CandidateEvidenceEnrichmentPipeline {
  public List<FusedCandidate> enrich(
      RecommendationContext context, List<FusedCandidate> candidates) {
    return List.copyOf(candidates);
  }
}
