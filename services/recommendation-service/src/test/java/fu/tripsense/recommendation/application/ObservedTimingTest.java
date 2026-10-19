package fu.tripsense.recommendation.application;

import static org.assertj.core.api.Assertions.*;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.AppenderBase;
import ch.qos.logback.core.read.ListAppender;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.*;
import org.slf4j.LoggerFactory;

class ObservedTimingTest {
  private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
  private final Logger logger = (Logger) LoggerFactory.getLogger(ObservedTiming.class);
  private final Logger diagnosticLogger =
      (Logger) LoggerFactory.getLogger(RequestDiagnostics.class);
  private final ListAppender<ILoggingEvent> output = new ListAppender<>();
  private final AtomicLong clock = new AtomicLong();
  private AppenderBase<ILoggingEvent> delayed;

  @BeforeEach
  void setup() {
    output.start();
    logger.addAppender(output);
    RequestDiagnostics.begin("recommendation-service", "observed-timing-test", registry);
  }

  @AfterEach
  void cleanup() {
    if (delayed != null) {
      diagnosticLogger.detachAppender(delayed);
      delayed.stop();
    }
    RequestDiagnostics.finish(200);
    logger.detachAppender(output);
    output.stop();
    registry.close();
  }

  private String summary() {
    return output.list.stream()
        .map(ILoggingEvent::getFormattedMessage)
        .filter(message -> message.contains("name=observed_timing_summary"))
        .reduce((a, b) -> b)
        .orElseThrow();
  }

  @Test
  void delayedActualLoggerAndMetricsAreAccountedWithoutDoubleCountingQuery() {
    delayed =
        new AppenderBase<>() {
          @Override
          protected void append(ILoggingEvent event) {
            clock.addAndGet(20);
          }
        };
    delayed.start();
    diagnosticLogger.addAppender(delayed);
    registry.config().onMeterAdded(meter -> clock.addAndGet(7));
    var value =
        ObservedTiming.measure(
            () -> {
              long before = ObservedTiming.diagnosticNanos();
              RequestDiagnostics.mark("observed_history_limit", 5000);
              clock.addAndGet(30); // simulated JDBC transport, no sleep or private data
              ObservedTiming.phase("observed_seen_query", 50, before);
              ObservedTiming.diagnostic(
                  true,
                  () ->
                      registry
                          .timer("synthetic.fixed")
                          .record(1, java.util.concurrent.TimeUnit.NANOSECONDS));
              before = ObservedTiming.diagnosticNanos();
              clock.addAndGet(3);
              ObservedTiming.phase("observed_profile_compose", 3, before);
              return "unchanged";
            },
            clock::get,
            () -> -1);
    assertThat(value).isEqualTo("unchanged");
    assertThat(summary())
        .contains(
            "wallNs:60,queryExclusiveNs:30,composeExclusiveNs:3,diagnosticLogNs:20,diagnosticMetricsNs:7,residualNs:0",
            "logCalls:1,metricCalls:1,threadCpuNs:-1,outcome:success");
    assertThat(output.list).hasSize(2); // summary + separately measured summary emission
    assertThat(summary()).contains("firstMarkerEnterNs:0,firstMarkerExitNs:20");
  }

  @Test
  void residualIsVisibleAndCpuTimeIsOptional() {
    AtomicLong cpu = new AtomicLong(100);
    ObservedTiming.measure(
        () -> {
          clock.addAndGet(100);
          cpu.addAndGet(10);
          return 1;
        },
        clock::get,
        cpu::get);
    assertThat(summary()).contains("wallNs:100", "residualNs:100", "threadCpuNs:10");
  }

  @Test
  void failurePreservesExceptionAndCleansThreadLocal() {
    var failure = new IllegalStateException("private-payload");
    assertThatThrownBy(
            () ->
                ObservedTiming.measure(
                    () -> {
                      ObservedTiming.diagnostic(false, () -> clock.addAndGet(5));
                      throw failure;
                    },
                    clock::get,
                    () -> -1))
        .isSameAs(failure);
    assertThat(summary())
        .contains("diagnosticLogNs:5", "outcome:error")
        .doesNotContain("private-payload");
    assertThat(ObservedTiming.diagnosticNanos()).isZero();
    ObservedTiming.measure(() -> 1, clock::get, () -> -1);
    assertThat(summary()).contains("diagnosticLogNs:0", "logCalls:0");
  }

  @Test
  void nestedMeasureDoesNotCreateOverlappingSummary() {
    ObservedTiming.measure(
        () ->
            ObservedTiming.measure(
                () -> {
                  clock.addAndGet(10);
                  return 42;
                }),
        clock::get,
        () -> -1);
    assertThat(output.list).hasSize(2);
    assertThat(summary()).contains("wallNs:10", "residualNs:10");
  }

  @Test
  void disabledRequestDoesNotEmitOrRegisterAnything() {
    RequestDiagnostics.finish(200);
    int meters = registry.getMeters().size();
    assertThat(ObservedTiming.measure(() -> 42)).isEqualTo(42);
    assertThat(output.list).isEmpty();
    assertThat(registry.getMeters()).hasSize(meters);
  }

  @Test
  void accountingErrorsAreNotSilentlyClamped() {
    ObservedTiming.measure(
        () -> {
          ObservedTiming.phase("observed_seen_query", 10, 0);
          return 42;
        },
        clock::get,
        () -> -1);
    assertThat(summary()).contains("residualNs:-10");
  }

  @Test
  void existingPhaseHooksCountQueryAndMetrics() {
    ObservedTiming.measure(() -> RequestDiagnostics.measure("observed_seen_query", () -> 42));
    assertThat(summary()).contains("metricCalls:1", "logCalls:1");
    assertThat(
            registry
                .get("tripsense.explore.phase")
                .tag("phase", "observed_seen_query")
                .timer()
                .count())
        .isEqualTo(1);
  }

  @Test
  void sequentialQueriesAccumulateAndOutputIsBoundedForLargeHistory() {
    ObservedTiming.measure(
        () -> {
          ObservedTiming.phaseStart("observed_seen_query");
          clock.addAndGet(10);
          ObservedTiming.phase("observed_seen_query", 10, 0);
          clock.addAndGet(20);
          ObservedTiming.phase("observed_affinity_query", 20, 0);
          for (int i = 0; i < 5000; i++) clock.incrementAndGet();
          return 42;
        },
        clock::get,
        () -> -1);
    assertThat(summary()).contains("queryExclusiveNs:30", "residualNs:5000", "firstQueryStartNs:0");
    assertThat(output.list).hasSize(2);
    assertThat(summary().length()).isLessThan(800);
  }
}
