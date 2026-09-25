package fu.tripsense.recommendation.algorithm.filter;

import fu.tripsense.recommendation.application.port.CandidateFilter;
import fu.tripsense.recommendation.application.port.FilterDecision;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.Locale;
import org.springframework.stereotype.Component;

@Component
public class ExplicitExclusionFilter implements CandidateFilter {
  @Override
  public FilterDecision evaluate(RecommendationContext context, FusedCandidate candidate) {
    boolean conflict =
        candidate.place().categories().stream()
            .map(value -> value.toLowerCase(Locale.ROOT))
            .anyMatch(context.dislikedCategories()::contains);
    return conflict
        ? FilterDecision.reject("EXPLICIT_CATEGORY_EXCLUSION")
        : FilterDecision.accept();
  }
}
