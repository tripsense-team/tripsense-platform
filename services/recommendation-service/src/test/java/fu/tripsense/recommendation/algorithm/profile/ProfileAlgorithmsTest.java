package fu.tripsense.recommendation.algorithm.profile;

import static org.assertj.core.api.Assertions.assertThat;

import fu.tripsense.recommendation.algorithm.feature.TemporalDecayCalculator;
import fu.tripsense.recommendation.config.RecommendationProperties;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import org.assertj.core.data.Offset;
import org.junit.jupiter.api.Test;

class ProfileAlgorithmsTest {
  @Test
  void composesOnlyAvailableTimescalesAndRenormalizesWeights() {
    MultiTimescaleProfileComposer composer = new MultiTimescaleProfileComposer(0.5, 0.3, 0.2);
    Map<String, Double> result =
        composer.compose(
            new ProfileSegment(true, Map.of("cafe", 1.0)),
            ProfileSegment.unavailable(),
            new ProfileSegment(true, Map.of("museum", 1.0)));

    assertThat(result.get("cafe")).isCloseTo(5.0 / 7.0, Offset.offset(1e-12));
    assertThat(result.get("museum")).isCloseTo(2.0 / 7.0, Offset.offset(1e-12));
  }

  @Test
  void interactionWeightsComeFromConfigurationAndDecayOverTime() {
    RecommendationProperties properties = new RecommendationProperties();
    properties.getProfile().setTemporalDecayLambda(0.1);
    InteractionWeightCalculator calculator =
        new InteractionWeightCalculator(properties, new TemporalDecayCalculator());
    Instant now = Instant.parse("2026-09-24T00:00:00Z");

    assertThat(
            calculator.weight(
                RecommendationProperties.Interaction.SAVE, now.minus(10, ChronoUnit.DAYS), now))
        .isCloseTo(Math.exp(-1), Offset.offset(1e-12));
  }
}
