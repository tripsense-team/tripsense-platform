package fu.tripsense.recommendation.algorithm.filter;

import fu.tripsense.recommendation.application.port.CandidateFilter;
import fu.tripsense.recommendation.application.port.FilterDecision;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import org.springframework.stereotype.Component;

@Component
public class RequiredCategoryFilter implements CandidateFilter {
  private final PlaceCategoryTaxonomy taxonomy;

  public RequiredCategoryFilter(PlaceCategoryTaxonomy taxonomy) {
    this.taxonomy = taxonomy;
  }

  @Override
  public FilterDecision evaluate(RecommendationContext context, FusedCandidate candidate) {
    if (context.requiredCategories().isEmpty()) return FilterDecision.accept();
    var candidateCategories =
        taxonomy.classify(candidate.place().categories(), candidate.place().name());
    boolean matches =
        context.requiredCategories().stream()
            .map(taxonomy::canonicalRequiredCategory)
            .anyMatch(candidateCategories::contains);
    return matches ? FilterDecision.accept() : FilterDecision.reject("CATEGORY_MISMATCH");
  }
}
