package fu.tripsense.recommendation.application;

import java.lang.management.ManagementFactory;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Fixed-size, thread-local accounting. No payloads, per-row events or background collection. */
public final class ObservedTiming {
  private static final Logger LOG = LoggerFactory.getLogger(ObservedTiming.class);
  private static final ThreadLocal<Sample> CURRENT = new ThreadLocal<>();

  private ObservedTiming() {}

  public static <T> T measure(Supplier<T> operation) {
    if (RequestDiagnostics.requestId() == null || CURRENT.get() != null) return operation.get();
    return measure(operation, System::nanoTime, ObservedTiming::cpuTime);
  }

  static <T> T measure(Supplier<T> operation, LongSupplier clock, LongSupplier cpu) {
    Sample sample = new Sample(clock, cpu);
    Sample previous = CURRENT.get();
    CURRENT.set(sample);
    boolean failed = true;
    try {
      T result = operation.get();
      failed = false;
      return result;
    } finally {
      // Detach BEFORE output: summary emission must not recursively count itself.
      if (previous == null) CURRENT.remove();
      else CURRENT.set(previous);
      long wall = clock.getAsLong() - sample.started;
      long cpuEnd = cpu.getAsLong();
      long cpuElapsed = sample.cpuStarted < 0 || cpuEnd < 0 ? -1 : cpuEnd - sample.cpuStarted;
      long residual = wall - sample.query - sample.compose - sample.log - sample.metrics;
      long emission = System.nanoTime();
      LOG.info(
          "explore_state service=recommendation-service requestId={} name=observed_timing_summary value=wallNs:{},queryExclusiveNs:{},composeExclusiveNs:{},diagnosticLogNs:{},diagnosticMetricsNs:{},residualNs:{},logCalls:{},metricCalls:{},threadCpuNs:{},outcome:{},firstMarkerEnterNs:{},firstMarkerExitNs:{},firstQueryStartNs:{}",
          RequestDiagnostics.requestId(),
          wall,
          sample.query,
          sample.compose,
          sample.log,
          sample.metrics,
          residual,
          sample.logCalls,
          sample.metricCalls,
          cpuElapsed,
          failed ? "error" : "success",
          sample.firstMarkerEnter,
          sample.firstMarkerExit,
          sample.firstQueryStart);
      long emissionElapsed = System.nanoTime() - emission;
      // This duration excludes this final line itself; outer observed_history includes both lines.
      LOG.info(
          "explore_phase service=recommendation-service requestId={} phase=observed_summary_emit durationMs={} outcome=success",
          RequestDiagnostics.requestId(),
          emissionElapsed / 1_000_000);
    }
  }

  static long diagnosticNanos() {
    Sample sample = CURRENT.get();
    return sample == null ? 0 : sample.log + sample.metrics;
  }

  static void markerBoundary(boolean entering) {
    Sample sample = CURRENT.get();
    if (sample == null) return;
    if (entering && sample.firstMarkerEnter < 0)
      sample.firstMarkerEnter = sample.clock.getAsLong() - sample.started;
    else if (!entering && sample.firstMarkerExit < 0)
      sample.firstMarkerExit = sample.clock.getAsLong() - sample.started;
  }

  static void phaseStart(String name) {
    Sample sample = CURRENT.get();
    if (sample != null && sample.firstQueryStart < 0 && name.equals("observed_seen_query"))
      sample.firstQueryStart = sample.clock.getAsLong() - sample.started;
  }

  static void phase(String name, long elapsed, long diagnosticsAtStart) {
    Sample sample = CURRENT.get();
    if (sample == null) return;
    long exclusive = elapsed - (diagnosticNanos() - diagnosticsAtStart);
    // These scopes are sequential siblings in the existing history reader, not arbitrary phases.
    if (name.equals("observed_seen_query")
        || name.equals("observed_feedback_query")
        || name.equals("observed_affinity_query")) sample.query += exclusive;
    else if (name.equals("observed_profile_compose")) sample.compose += exclusive;
  }

  static void diagnostic(boolean metric, Runnable operation) {
    Sample sample = CURRENT.get();
    if (sample == null) {
      operation.run();
      return;
    }
    long start = sample.clock.getAsLong();
    try {
      operation.run();
    } finally {
      long elapsed = sample.clock.getAsLong() - start;
      if (metric) {
        sample.metrics += elapsed;
        sample.metricCalls++;
      } else {
        sample.log += elapsed;
        sample.logCalls++;
      }
    }
  }

  private static long cpuTime() {
    try {
      var bean = ManagementFactory.getThreadMXBean();
      return bean.isCurrentThreadCpuTimeSupported() && bean.isThreadCpuTimeEnabled()
          ? bean.getCurrentThreadCpuTime()
          : -1;
    } catch (UnsupportedOperationException | SecurityException unavailable) {
      return -1;
    }
  }

  private static final class Sample {
    final LongSupplier clock;
    final long started;
    final long cpuStarted;
    long query, compose, log, metrics, logCalls, metricCalls;
    long firstMarkerEnter = -1, firstMarkerExit = -1, firstQueryStart = -1;

    Sample(LongSupplier clock, LongSupplier cpu) {
      this.clock = clock;
      cpuStarted = cpu.getAsLong();
      started = clock.getAsLong();
    }
  }
}
