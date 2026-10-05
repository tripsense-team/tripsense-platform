package fu.tripsense.recommendation.algorithm.filter;

import fu.tripsense.recommendation.application.port.CandidateFilter;
import fu.tripsense.recommendation.application.port.FilterDecision;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class BusinessStatusFilter implements CandidateFilter {
  private static final Set<String> CLOSED =
      Set.of("CLOSED_PERMANENTLY", "PERMANENTLY_CLOSED", "CLOSED");

  @Override
  public FilterDecision evaluate(RecommendationContext context, FusedCandidate candidate) {
    String status = candidate.place() == null ? null : candidate.place().businessStatus();
    return status != null && CLOSED.contains(status.trim().toUpperCase(Locale.ROOT))
        ? FilterDecision.reject("UNSUPPORTED_BUSINESS_STATUS")
        : FilterDecision.accept();
  }
}
