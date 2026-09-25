package fu.tripsense.recommendation.algorithm.feature;

import fu.tripsense.recommendation.application.port.FeatureExtractor;
import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class PreferenceFeatureExtractor implements FeatureExtractor {
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
    Set<String> categories = new HashSet<>();
    candidate.place().categories().stream()
        .map(value -> value.toLowerCase(Locale.ROOT))
        .forEach(categories::add);
    long matches = preferences.stream().filter(categories::contains).count();
    double overlap = preferences.isEmpty() ? 0 : (double) matches / preferences.size();
    boolean conflict = dislikes.stream().anyMatch(categories::contains);
    boolean available = !preferences.isEmpty() || !dislikes.isEmpty();
    return current.withPreference(
        new CandidateFeatures.Preference(available, overlap, matches > 0, conflict));
  }
}
