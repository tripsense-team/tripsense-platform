package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.application.port.CandidateFilter;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class CandidateFilterPipeline {
  private final List<CandidateFilter> filters;

  public CandidateFilterPipeline(List<CandidateFilter> filters) {
    this.filters = List.copyOf(filters);
  }

  public List<FusedCandidate> filter(
      RecommendationContext context, List<FusedCandidate> candidates) {
    return filterWithEvidence(context, candidates).eligible();
  }

  public FilterOutcome filterWithEvidence(
      RecommendationContext context, List<FusedCandidate> candidates) {
    List<FusedCandidate> eligible = new java.util.ArrayList<>();
    Map<String, Integer> rejectedByReason = new LinkedHashMap<>();
    for (FusedCandidate candidate : candidates) {
      String rejection = null;
      for (CandidateFilter filter : filters) {
        var decision = filter.evaluate(context, candidate);
        if (!decision.accepted()) {
          rejection = decision.reason();
          break;
        }
      }
      if (rejection == null) eligible.add(candidate);
      else rejectedByReason.merge(rejection, 1, Integer::sum);
    }
    return new FilterOutcome(List.copyOf(eligible), Map.copyOf(rejectedByReason));
  }

  public record FilterOutcome(List<FusedCandidate> eligible, Map<String, Integer> rejectedByReason) {}
}
