package fu.tripsense.recommendation.algorithm.filter;

import fu.tripsense.recommendation.config.RecommendationProperties;
import java.text.Normalizer;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Classifies provider-specific labels through one configurable category taxonomy. */
@Component
public class PlaceCategoryTaxonomy {
  private final RecommendationProperties.Taxonomy taxonomy;

  public PlaceCategoryTaxonomy(RecommendationProperties properties) {
    this.taxonomy = properties.getTaxonomy();
  }

  public Set<String> classify(List<String> categories, String name) {
    Set<String> classified = new LinkedHashSet<>();
    if (categories != null) categories.forEach(value -> classify(value, classified));
    classify(name, classified);
    return Set.copyOf(classified);
  }

  public String canonicalRequiredCategory(String value) {
    String normalized = normalize(value);
    if (taxonomy.getCategoryAliases().keySet().stream()
        .map(this::normalize)
        .anyMatch(normalized::equals)) {
      return normalized;
    }
    return taxonomy.getCategoryAliases().entrySet().stream()
        .filter(entry -> matches(normalized, entry.getValue()))
        .map(entry -> normalize(entry.getKey()))
        .findFirst()
        .orElse(normalized);
  }

  private void classify(String value, Set<String> destination) {
    String normalized = normalize(value);
    taxonomy
        .getCategoryAliases()
        .forEach(
            (category, aliases) -> {
              if (matches(normalized, aliases)) destination.add(normalize(category));
            });
  }

  private boolean matches(String normalized, List<String> aliases) {
    return aliases.stream().map(this::normalize).anyMatch(normalized::contains);
  }

  private String normalize(String value) {
    return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
        .replaceAll("\\p{M}+", "")
        .replace('đ', 'd')
        .replace('Đ', 'd')
        .toLowerCase(Locale.ROOT)
        .trim();
  }
}
