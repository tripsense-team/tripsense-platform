package fu.tripsense.recommendation.algorithm.profile;

import fu.tripsense.recommendation.algorithm.feature.TemporalDecayCalculator;
import fu.tripsense.recommendation.config.RecommendationProperties;
import java.time.Instant;
import org.springframework.stereotype.Component;

@Component
public class InteractionWeightCalculator {
  private final RecommendationProperties.Profile properties;
  private final TemporalDecayCalculator temporalDecay;

  public InteractionWeightCalculator(
      RecommendationProperties properties, TemporalDecayCalculator temporalDecay) {
    this.properties = properties.getProfile();
    this.temporalDecay = temporalDecay;
  }

  public double weight(
      RecommendationProperties.Interaction interaction, Instant occurredAt, Instant now) {
    Double base = properties.getInteractionWeights().get(interaction);
    if (base == null) throw new IllegalArgumentException("Interaction weight is not configured");
    return temporalDecay.decay(base, occurredAt, now, properties.getTemporalDecayLambda());
  }
}
