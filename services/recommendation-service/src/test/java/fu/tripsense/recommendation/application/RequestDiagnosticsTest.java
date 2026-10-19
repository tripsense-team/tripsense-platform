package fu.tripsense.recommendation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class RequestDiagnosticsTest {
  private final SimpleMeterRegistry registry = new SimpleMeterRegistry();

  @AfterEach
  void cleanup() {
    RequestDiagnostics.finish(500);
    registry.close();
  }

  @Test
  void recordsSuccessAndPreservesReturnValue() {
    RequestDiagnostics.begin("test", "test-request-123", registry);
    assertThat(RequestDiagnostics.measure("redis_lookup", () -> "value")).isEqualTo("value");
    assertThat(
            registry
                .get("tripsense.explore.phase")
                .tags("phase", "redis_lookup", "outcome", "success")
                .timer()
                .count())
        .isEqualTo(1);
    assertThat(RequestDiagnostics.requestId()).isEqualTo("test-request-123");
    RequestDiagnostics.finish(200);
    assertThat(registry.get("tripsense.explore.request").tag("status", "200").timer().count())
        .isEqualTo(1);
    assertThat(RequestDiagnostics.requestId()).isNull();
  }

  @Test
  void recordsFailureAndRethrowsTheSameException() {
    RequestDiagnostics.begin("test", "test-request-123", registry);
    var failure = new IllegalStateException("sensitive data must never be logged");
    assertThatThrownBy(
            () ->
                RequestDiagnostics.measure(
                    "provider_search",
                    () -> {
                      throw failure;
                    }))
        .isSameAs(failure);
    assertThat(
            registry
                .get("tripsense.explore.phase")
                .tags("phase", "provider_search", "outcome", "error")
                .timer()
                .count())
        .isEqualTo(1);
  }

  @Test
  void rejectsUnboundedOrUnsafeRequestIds() {
    for (String supplied : new String[] {"bad\r\nheader", "x".repeat(65), "short"}) {
      RequestDiagnostics.begin("test", supplied, registry);
      assertThat(RequestDiagnostics.requestId()).matches("[a-f0-9-]{36}").isNotEqualTo(supplied);
      RequestDiagnostics.finish(200);
    }
  }

  @Test
  void callbackPhaseFinishesOnlyOnce() {
    RequestDiagnostics.begin("test", "test-request-123", registry);
    var phase = RequestDiagnostics.start("transaction_commit");
    phase.finish(true);
    phase.finish(false);
    assertThat(
            registry
                .get("tripsense.explore.phase")
                .tags("phase", "transaction_commit", "outcome", "error")
                .timer()
                .count())
        .isEqualTo(1);
    assertThat(
            registry
                .find("tripsense.explore.phase")
                .tags("phase", "transaction_commit", "outcome", "success")
                .timer())
        .isNull();
  }

  @Test
  void doesNotCreateMetricsOutsideMonitoredRequest() {
    RequestDiagnostics.start("transaction_commit").finish(false);
    assertThat(RequestDiagnostics.measure("test", () -> 42)).isEqualTo(42);
    assertThat(registry.getMeters()).isEmpty();
    assertThat(RequestDiagnostics.requestId()).isNull();
  }
}
