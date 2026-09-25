package fu.tripsense.recommendation.application;

import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class RecommendationObservability {
  private final DistributionSummary candidateCount;
  private final Timer latency;
  private final MeterRegistry registry;

  public RecommendationObservability(MeterRegistry registry) {
    this.registry = registry;
    this.candidateCount =
        DistributionSummary.builder("tripsense.recommendation.candidate.count")
            .description("Number of fused recommendation candidates")
            .register(registry);
    this.latency =
        Timer.builder("tripsense.recommendation.latency")
            .description("End-to-end recommendation latency")
            .register(registry);
  }

  public void record(int candidates, long elapsedNanos, List<String> degradations) {
    candidateCount.record(candidates);
    latency.record(Duration.ofNanos(elapsedNanos));
    degradations.forEach(
        code ->
            registry
                .counter("tripsense.recommendation.degradation.count", "code", code)
                .increment());
  }
}
