package fu.tripsense.recommendation.algorithm.feature;

import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Component;

@Component
public class TemporalDecayCalculator {
  public double decay(double eventWeight, Instant occurredAt, Instant now, double lambdaPerDay) {
    if (lambdaPerDay < 0) throw new IllegalArgumentException("temporal lambda cannot be negative");
    if (occurredAt == null || now == null)
      throw new IllegalArgumentException("timestamps required");
    double ageDays = Math.max(0, Duration.between(occurredAt, now).toSeconds() / 86_400.0);
    return eventWeight * Math.exp(-lambdaPerDay * ageDays);
  }
}
