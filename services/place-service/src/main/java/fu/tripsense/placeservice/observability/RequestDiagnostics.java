package fu.tripsense.placeservice.observability;

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

  public static String requestId() {
    Context context = CURRENT.get();
    return context == null ? null : context.requestId();
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
    Context context = CURRENT.get();
    if (context == null) return operation.get();
    long started = System.nanoTime();
    String outcome = "success";
    try {
      return operation.get();
    } catch (RuntimeException | Error failure) {
      outcome = "error";
      throw failure;
    } finally {
      long elapsed = System.nanoTime() - started;
      LOG.info(
          "explore_phase service={} requestId={} phase={} durationMs={} outcome={}",
          context.service(),
          context.requestId(),
          phase,
          elapsed / 1_000_000,
          outcome);
      context
          .registry()
          .timer("tripsense.explore.phase", "phase", phase, "outcome", outcome)
          .record(elapsed, TimeUnit.NANOSECONDS);
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
      LOG.info(
          "explore_state service={} requestId={} name={} value={}",
          context.service(),
          context.requestId(),
          name,
          value);
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
