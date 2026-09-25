package fu.tripsense.recommendation.algorithm.filter;

import fu.tripsense.recommendation.application.port.CandidateFilter;
import fu.tripsense.recommendation.application.port.FilterDecision;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.text.Normalizer;
import java.util.Locale;
import org.springframework.stereotype.Component;

@Component
public class RequiredCategoryFilter implements CandidateFilter {
  @Override
  public FilterDecision evaluate(RecommendationContext context, FusedCandidate candidate) {
    if (context.requiredCategories().isEmpty()) return FilterDecision.accept();
    boolean matches =
        context.requiredCategories().stream()
            .allMatch(
                required ->
                    candidate.place().categories().stream()
                        .map(this::canonicalCategory)
                        .anyMatch(requiredCategory -> requiredCategory.equals(canonicalCategory(required))));
    return matches ? FilterDecision.accept() : FilterDecision.reject("CATEGORY_MISMATCH");
  }

  private String canonicalCategory(String value) {
    String normalized =
        Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .toLowerCase(Locale.ROOT)
            .trim();
    if (normalized.contains("cafe") || normalized.contains("coffee") || normalized.contains("ca phe")) {
      return "cafe";
    }
    if (normalized.contains("restaurant") || normalized.contains("quan an")) return "restaurant";
    if (normalized.contains("hotel")
        || normalized.contains("lodging")
        || normalized.contains("accommodation")
        || normalized.contains("resort")
        || normalized.contains("motel")
        || normalized.contains("homestay")
        || normalized.contains("guest house")
        || normalized.contains("khach san")
        || normalized.contains("khu nghi duong")
        || normalized.contains("luu tru")) return "hotel";
    if (normalized.contains("attraction")
        || normalized.contains("tourist")
        || normalized.contains("temple")
        || normalized.contains("pagoda")
        || normalized.contains("chua")) return "attraction";
    return normalized;
  }
}
