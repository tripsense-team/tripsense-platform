package fu.tripsense.recommendation.algorithm.feature;

import fu.tripsense.recommendation.algorithm.filter.PlaceCategoryTaxonomy;
import fu.tripsense.recommendation.application.port.FeatureExtractor;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class PreferenceFeatureExtractor implements FeatureExtractor {
  private final PlaceCategoryTaxonomy taxonomy;
  private final boolean intentPolicy;

  public PreferenceFeatureExtractor(
      PlaceCategoryTaxonomy taxonomy, RecommendationProperties properties) {
    this.taxonomy = taxonomy;
    this.intentPolicy = properties.getProfile().isObservedSignalPolicyV2Enabled();
  }

  @Override
  public int order() {
    return 30;
  }

  @Override
  public CandidateFeatures extract(
      RecommendationContext context, FusedCandidate candidate, CandidateFeatures current) {
    Set<String> preferences = new HashSet<>(context.preferredCategories());
    Set<String> dislikes = new HashSet<>(context.dislikedCategories());
    if (context.profile().personalizationEnabled()) {
      context.profile().preferredCategories().stream()
          .map(value -> value.toLowerCase(Locale.ROOT))
          .forEach(preferences::add);
      context.profile().dislikedCategories().stream()
          .map(value -> value.toLowerCase(Locale.ROOT))
          .forEach(dislikes::add);
    }
    Set<String> categories =
        new HashSet<>(taxonomy.classify(candidate.place().categories(), candidate.place().name()));
    candidate.place().categories().stream()
        .map(value -> value.toLowerCase(Locale.ROOT))
        .forEach(categories::add);
    Map<String, Double> affinities =
        context.profile().categoryAffinities().entrySet().stream()
            .filter(entry -> Double.isFinite(entry.getValue()) && entry.getValue() != 0)
            .collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    double totalAffinity = affinities.values().stream().mapToDouble(Math::abs).sum();
    double matchedAffinity =
        affinities.entrySet().stream()
            .filter(entry -> categories.contains(entry.getKey()) && entry.getValue() > 0)
            .mapToDouble(Map.Entry::getValue)
            .sum();
    long matches = preferences.stream().filter(categories::contains).count();
    double overlap =
        totalAffinity > 0
            ? Math.min(
                1, matchedAffinity / (intentPolicy ? Math.max(1, totalAffinity) : totalAffinity))
            : preferences.isEmpty() ? 0 : (double) matches / preferences.size();
    boolean conflict =
        dislikes.stream().anyMatch(categories::contains)
            || affinities.entrySet().stream()
                .anyMatch(entry -> entry.getValue() < 0 && categories.contains(entry.getKey()));
    boolean available =
        !preferences.isEmpty() || !dislikes.isEmpty() || (intentPolicy && !affinities.isEmpty());
    return current.withPreference(
        new CandidateFeatures.Preference(available, overlap, matches > 0, conflict));
  }
}
