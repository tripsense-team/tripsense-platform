package fu.tripsense.contextservice.adapter.out.persistence;

import fu.tripsense.contextservice.application.PreferenceSignalPublisher;
import fu.tripsense.contextservice.application.PreferenceSignalReader;
import fu.tripsense.contextservice.domain.OnboardingProfile;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class JpaPreferenceSignalPublisher
    implements PreferenceSignalPublisher, PreferenceSignalReader {
  private static final String ONBOARDING_SOURCE = "ONBOARDING";
  private static final String DERIVED_SOURCE = "ONBOARDING_DERIVED_V1";
  private final SpringPreferenceSignalJpaRepository repository;

  public JpaPreferenceSignalPublisher(SpringPreferenceSignalJpaRepository repository) {
    this.repository = repository;
  }

  @Override
  public void replaceFor(OnboardingProfile profile) {
    repository.deleteByUserIdAndSource(profile.userId(), ONBOARDING_SOURCE);
    repository.deleteByUserIdAndSource(profile.userId(), DERIVED_SOURCE);
    Instant now = Instant.now();
    profile
        .selections()
        .forEach(
            (dimension, values) ->
                values.forEach(
                    value -> {
                      save(
                          profile.userId(),
                          dimension,
                          value,
                          1.0,
                          ONBOARDING_SOURCE,
                          profile.version(),
                          now);
                    }));
    deriveExploreAffinities(profile.freeText())
        .forEach(
            (value, confidence) ->
                save(
                    profile.userId(),
                    "EXPLORE_AFFINITY",
                    value,
                    confidence,
                    DERIVED_SOURCE,
                    profile.version(),
                    now));
  }

  @Override
  public void deleteForUser(UUID userId) {
    repository.deleteByUserIdAndSource(userId, ONBOARDING_SOURCE);
    repository.deleteByUserIdAndSource(userId, DERIVED_SOURCE);
  }

  @Override
  public java.util.List<PreferenceSignal> findForUser(UUID userId) {
    return repository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
        .map(
            signal ->
                new PreferenceSignal(
                    signal.dimensionCode,
                    signal.valueCode,
                    signal.confidence != null ? signal.confidence.doubleValue() : 1.0,
                    signal.source,
                    signal.updatedAt))
        .toList();
  }

  private void save(
      UUID userId,
      String dimension,
      String value,
      double confidence,
      String source,
      long version,
      Instant now) {
    PreferenceSignalEntity signal = new PreferenceSignalEntity();
    signal.id = UUID.randomUUID();
    signal.userId = userId;
    signal.dimensionCode = dimension;
    signal.valueCode = value;
    signal.confidence = BigDecimal.valueOf(confidence);
    signal.source = source;
    signal.sourceVersion = version;
    signal.updatedAt = now;
    repository.save(signal);
  }

  /** Deterministic allowlisted extraction; raw free text never leaves context-service. */
  static java.util.Map<String, Double> deriveExploreAffinities(String freeText) {
    if (freeText == null || freeText.isBlank()) return java.util.Map.of();
    String normalized =
        java.text.Normalizer.normalize(freeText, java.text.Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .replace('đ', 'd')
            .replace('Đ', 'd')
            .toLowerCase(java.util.Locale.ROOT);
    java.util.Map<String, Double> result = new java.util.LinkedHashMap<>();
    putIfContains(result, normalized, "CAFE", "cafe", "ca phe", "coffee");
    putIfContains(result, normalized, "NATURE", "thien nhien", "nature");
    putIfContains(result, normalized, "HIKING", "trek", "hiking", "leo nui");
    putIfContains(result, normalized, "CULTURE", "van hoa", "lich su", "culture", "history");
    putIfContains(result, normalized, "BEACH", "bai bien", "di bien", "beach");
    putIfContains(result, normalized, "NIGHTLIFE", "nightlife", "ve dem", "bar pub");
    return java.util.Map.copyOf(result);
  }

  private static void putIfContains(
      java.util.Map<String, Double> target, String text, String value, String... keywords) {
    if (java.util.Arrays.stream(keywords).anyMatch(text::contains)) target.put(value, 0.70);
  }
}
