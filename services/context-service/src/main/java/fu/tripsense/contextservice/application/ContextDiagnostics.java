package fu.tripsense.contextservice.application;

import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Request-local diagnostics; only call with fixed names and non-personal aggregate values. */
public final class ContextDiagnostics {
  public static final String HEADER = "X-Request-ID";
  private static final Logger LOG = LoggerFactory.getLogger(ContextDiagnostics.class);
  private static final ThreadLocal<Context> CURRENT = new ThreadLocal<>();

  private record Context(String id, long started) {}

  private ContextDiagnostics() {}

  public static String begin(String supplied) {
    String id =
        supplied != null && supplied.matches("[A-Za-z0-9_-]{8,64}")
            ? supplied
            : UUID.randomUUID().toString();
    CURRENT.set(new Context(id, System.nanoTime()));
    LOG.info("explore_request_started service=context-service requestId={}", id);
    return id;
  }

  public static String requestId() {
    Context context = CURRENT.get();
    return context == null ? null : context.id();
  }

  public static <T> T measure(String phase, Supplier<T> operation) {
    Context context = CURRENT.get();
    if (context == null) return operation.get();
    long started = System.nanoTime();
    boolean failed = false;
    try {
      return operation.get();
    } catch (RuntimeException | Error failure) {
      failed = true;
      throw failure;
    } finally {
      LOG.info(
          "explore_phase service=context-service requestId={} phase={} durationMs={} outcome={}",
          context.id(),
          phase,
          (System.nanoTime() - started) / 1_000_000,
          failed ? "error" : "success");
    }
  }

  public static void state(String name, Object value) {
    Context context = CURRENT.get();
    if (context != null)
      LOG.info(
          "explore_state service=context-service requestId={} name={} value={}",
          context.id(),
          name,
          value);
  }

  public static void finish(int status) {
    Context context = CURRENT.get();
    if (context == null) return;
    try {
      LOG.info(
          "explore_request_completed service=context-service requestId={} status={} durationMs={}",
          context.id(),
          status,
          (System.nanoTime() - context.started()) / 1_000_000);
    } finally {
      CURRENT.remove();
    }
  }
}
