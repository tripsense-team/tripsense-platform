package fu.tripsense.recommendation.config;

import static org.assertj.core.api.Assertions.*;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

class ObservedPolicyConfigurationTest {
  @Test
  void beanValidationRejectsInvalidConfidenceIncludingNonFiniteValues() {
    try (var factory = Validation.buildDefaultValidatorFactory()) {
      var validator = factory.getValidator();
      var settings = new RecommendationProperties.Profile();
      assertThat(validator.validate(settings)).isEmpty();
      for (double invalid : new double[] {0, -1, Double.NaN, Double.POSITIVE_INFINITY}) {
        settings.setObservedConfidencePrior(invalid);
        assertThat(validator.validate(settings)).isNotEmpty();
      }
      settings.setObservedConfidencePrior(3);
      for (double invalid : new double[] {-1, 1.01, Double.NaN, Double.POSITIVE_INFINITY}) {
        settings.setObservedMaxInfluence(invalid);
        assertThat(validator.validate(settings)).isNotEmpty();
      }
      settings.setObservedMaxInfluence(0);
      assertThat(validator.validate(settings)).isEmpty();
    }
  }

  @Test
  void reportedFeatureVersionSeparatesLegacyAndIntentPolicy() {
    var properties = new RecommendationProperties();
    var catalog = new AlgorithmVersionCatalog(properties);
    var current = catalog.current();
    assertThat(current.feature()).endsWith("-observed-intent-v2");
    properties.getProfile().setObservedSignalPolicyV2Enabled(false);
    var rollback = catalog.current();
    assertThat(rollback.feature()).endsWith("-observed-legacy-v1");
    assertThat(rollback.retrieval()).isEqualTo(current.retrieval());
    assertThat(rollback.ranking()).isEqualTo(current.ranking());
  }
}
