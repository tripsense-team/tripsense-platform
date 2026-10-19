package fu.tripsense.recommendation.application;

import io.micrometer.core.instrument.MeterRegistry;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Request-local diagnostics: bounded metadata only, never payloads, URLs, tokens or query text. */
public final class RequestDiagnostics {
  public static final String HEADER = "X-Request-ID";
  private static final Logger LOG = LoggerFactory.getLogger(RequestDiagnostics.class);
  private static final ThreadLocal<Context> CURRENT = new ThreadLocal<>();

  private RequestDiagnostics() {}

  public static String requestId() {
    Context context = CURRENT.get();
    return context == null ? null : context.requestId();
  }

  /** Capture only diagnostics, never servlet/security state; always restore pooled worker state. */
  public static <T> java.util.concurrent.Callable<T> wrap(
      java.util.concurrent.Callable<T> operation) {
    Context captured = CURRENT.get();
    return () -> {
      Context previous = CURRENT.get();
      if (captured == null) CURRENT.remove();
      else CURRENT.set(captured);
      try {
        return operation.call();
      } finally {
        if (previous == null) CURRENT.remove();
        else CURRENT.set(previous);
      }
    };
  }

  public static void begin(String service, String suppliedId, MeterRegistry registry) {
    // Restrict public input to a bounded identifier to prevent log injection.
    String id =
        suppliedId != null && suppliedId.matches("[A-Za-z0-9_-]{8,64}")
            ? suppliedId
            : UUID.randomUUID().toString();
    CURRENT.set(new Context(service, id, registry, System.nanoTime()));
    LOG.info("explore_request_started service={} requestId={}", service, id);
  }

  public static <T> T measure(String phase, Supplier<T> operation) {
    if (CURRENT.get() == null) return operation.get();
    Phase sample = start(phase);
    boolean failed = false;
    try {
      return operation.get();
    } catch (RuntimeException | Error failure) {
      failed = true;
      throw failure;
    } finally {
      sample.finish(failed);
    }
  }

  /** Supports framework callbacks whose start and end are outside one supplier. */
  public static Phase start(String phase) {
    ObservedTiming.phaseStart(phase);
    return new Phase(CURRENT.get(), phase, System.nanoTime());
  }

  /** Inclusive boundary from the diagnostic filter; not time before the filter or an SQL phase. */
  public static void checkpoint(String name) {
    Context context = CURRENT.get();
    if (context != null) mark(name, (System.nanoTime() - context.started()) / 1_000_000);
  }

  public static final class Phase {
    private final Context context;
    private final String name;
    private final long started;
    private final long diagnosticsAtStart;
    private boolean finished;

    private Phase(Context context, String name, long started) {
      this.context = context;
      this.name = name;
      this.started = started;
      this.diagnosticsAtStart = ObservedTiming.diagnosticNanos();
    }

    public void finish(boolean failed) {
      if (finished) return;
      finished = true;
      if (context == null) return;
      long elapsed = System.nanoTime() - started;
      ObservedTiming.phase(name, elapsed, diagnosticsAtStart);
      String outcome = failed ? "error" : "success";
      ObservedTiming.diagnostic(
          false,
          () ->
              LOG.info(
                  "explore_phase service={} requestId={} phase={} durationMs={} outcome={}",
                  context.service(),
                  context.requestId(),
                  name,
                  elapsed / 1_000_000,
                  outcome));
      ObservedTiming.diagnostic(
          true,
          () ->
              context
                  .registry()
                  .timer("tripsense.explore.phase", "phase", name, "outcome", outcome)
                  .record(elapsed, TimeUnit.NANOSECONDS));
    }
  }

  public static void run(String phase, Runnable operation) {
    measure(
        phase,
        () -> {
          operation.run();
          return null;
        });
  }

  public static void mark(String name, Object value) {
    Context context = CURRENT.get();
    if (context != null) {
      ObservedTiming.markerBoundary(true);
      try {
        ObservedTiming.diagnostic(
            false,
            () ->
                LOG.info(
                    "explore_state service={} requestId={} name={} value={}",
                    context.service(),
                    context.requestId(),
                    name,
                    value));
      } finally {
        ObservedTiming.markerBoundary(false);
      }
    }
  }

  public static void finish(int status) {
    Context context = CURRENT.get();
    if (context == null) return;
    try {
      long elapsed = System.nanoTime() - context.started();
      LOG.info(
          "explore_request_completed service={} requestId={} status={} durationMs={}",
          context.service(),
          context.requestId(),
          status,
          elapsed / 1_000_000);
      context
          .registry()
          .timer("tripsense.explore.request", "status", Integer.toString(status))
          .record(elapsed, TimeUnit.NANOSECONDS);
    } finally {
      CURRENT.remove();
    }
  }

  private record Context(String service, String requestId, MeterRegistry registry, long started) {}
}
