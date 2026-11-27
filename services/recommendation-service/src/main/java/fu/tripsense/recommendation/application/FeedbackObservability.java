package fu.tripsense.recommendation.application;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import org.springframework.stereotype.Component;

@Component
public class FeedbackObservability {
  private final MeterRegistry meters;

  public FeedbackObservability(MeterRegistry meters) {
    this.meters = meters;
  }

  public void recordBatch(FeedbackBatchResult result) {
    meters.summary("tripsense.recommendation.feedback.batch.size").record(result.submitted());
    increment("accepted", result.accepted());
    increment("duplicate", result.duplicate());
    increment("rejected", result.rejected());
  }

  public void recordSingle() {
    meters.counter("tripsense.recommendation.feedback.requests", "mode", "single").increment();
  }

  private void increment(String status, int count) {
    if (count > 0) {
      meters
          .counter(
              "tripsense.recommendation.feedback.events",
              Tags.of("status", status, "mode", "batch"))
          .increment(count);
    }
  }
}
