package fu.tripsense.recommendation.algorithm.filter;

import fu.tripsense.recommendation.application.port.CandidateFilter;
import fu.tripsense.recommendation.application.port.FilterDecision;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.GeographicScope;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.text.Normalizer;
import java.util.Locale;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class StrictNamedAreaFilter implements CandidateFilter {
  @Override
  public FilterDecision evaluate(RecommendationContext context, FusedCandidate candidate) {
    GeographicScope scope = context.geographicScope();
    if (scope == null || !scope.strictNamedArea() || blank(scope.district())) {
      return FilterDecision.accept();
    }
    String candidateDistrict = candidate.place().district();
    if (blank(candidateDistrict)) {
      candidateDistrict = explicitDistrict(candidate.place().address());
    }
    if (blank(candidateDistrict)) return FilterDecision.accept();
    return normalize(candidateDistrict).equals(normalize(scope.district()))
        ? FilterDecision.accept()
        : FilterDecision.reject("ADMIN_LOCATION_CONFLICT");
  }

  private boolean blank(String value) {
    return value == null || value.isBlank();
  }

  private String normalize(String value) {
    return Normalizer.normalize(value, Normalizer.Form.NFD)
        .replaceAll("\\p{M}+", "")
        .replace('đ', 'd')
        .replace('Đ', 'd')
        .toLowerCase(Locale.ROOT)
        .trim();
  }

  private String explicitDistrict(String address) {
    if (blank(address)) return null;
    String normalizedAddress = normalize(address);
    return List.of("Sơn Trà", "Hải Châu", "Ngũ Hành Sơn", "Thanh Khê", "Liên Chiểu", "Cẩm Lệ")
        .stream()
        .filter(district -> normalizedAddress.contains(normalize(district)))
        .findFirst()
        .orElse(null);
  }
}
