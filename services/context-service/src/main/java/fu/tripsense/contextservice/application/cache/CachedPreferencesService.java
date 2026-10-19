package fu.tripsense.contextservice.application.cache;

import fu.tripsense.contextservice.application.ContextDiagnostics;
import fu.tripsense.contextservice.application.PreferenceSignalReader.PreferenceSignal;
import fu.tripsense.contextservice.config.PreferenceCacheProperties;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import org.springframework.stereotype.Service;

@Service
public class CachedPreferencesService {
  private final PreferenceSnapshotSource source;
  private final PreferenceSnapshotCache cache;
  private final PreferenceCacheProperties properties;
  private final MeterRegistry meters;
  private final Semaphore requests;
  private final Semaphore loads;
  // Registry size cannot exceed the fixed request admission cap, and entries are always removed.
  private final ConcurrentHashMap<RequestKey, CompletableFuture<PreferenceSnapshot>> flights =
      new ConcurrentHashMap<>();

  public CachedPreferencesService(
      PreferenceSnapshotSource source,
      PreferenceSnapshotCache cache,
      PreferenceCacheProperties properties,
      MeterRegistry meters) {
    this.source = source;
    this.cache = cache;
    this.properties = properties;
    this.meters = meters;
    this.requests = new Semaphore(properties.getMaxRequests());
    this.loads = new Semaphore(properties.getMaxLoads());
  }

  public List<PreferenceSignal> preferences(UUID userId, String purpose) {
    PreferenceSnapshot.requirePurpose(purpose);
    if (userId == null) throw new IllegalArgumentException("Authenticated owner is required");
    acquire(requests);
    try {
      boolean enabled = cache.enabled();
      ContextDiagnostics.state("context_cache_enabled", enabled);
      if (!enabled) {
        count("bypass");
        return result(load(userId, purpose));
      }
      for (int attempt = 0; attempt < 2; attempt++) {
        var revision =
            ContextDiagnostics.measure("context_metadata", () -> source.revision(userId));
        if (!revision.completed()) {
          count("not_completed");
          ContextDiagnostics.state("context_signal_count", 0);
          return List.of();
        }
        var cached =
            ContextDiagnostics.measure(
                "context_cache_get", () -> cache.get(userId, revision, purpose));
        if (cached.isPresent()) {
          count("hit");
          return result(cached.get());
        }
        count("miss");
        RequestKey key = new RequestKey(userId, revision, purpose);
        var mine = new CompletableFuture<PreferenceSnapshot>();
        var existing = flights.putIfAbsent(key, mine);
        PreferenceSnapshot snapshot;
        if (existing != null) {
          count("coalesced");
          snapshot = ContextDiagnostics.measure("context_coalesced_wait", () -> await(existing));
        } else {
          try {
            snapshot = load(userId, purpose);
            // Always address the loaded snapshot's OWN committed revision, never the earlier
            // lookup.
            var loaded = snapshot;
            ContextDiagnostics.measure(
                "context_cache_put",
                () -> {
                  cache.put(userId, loaded);
                  return null;
                });
            mine.complete(snapshot);
          } catch (RuntimeException | Error failure) {
            mine.completeExceptionally(failure);
            throw failure;
          } finally {
            flights.remove(key, mine);
          }
        }
        if (snapshot.revision().equals(revision)) return result(snapshot);
        count("revision_changed"); // Re-resolve once; do not return a different revision to
        // followers.
      }
      throw new PreferencesBusyException();
    } finally {
      requests.release();
    }
  }

  private PreferenceSnapshot load(UUID userId, String purpose) {
    acquire(loads);
    try {
      count("load");
      return ContextDiagnostics.measure(
          "context_snapshot_load", () -> source.load(userId, purpose));
    } finally {
      loads.release();
    }
  }

  private void acquire(Semaphore gate) {
    ContextDiagnostics.measure(
        "context_admission_wait",
        () -> {
          acquireGate(gate);
          return null;
        });
  }

  private void acquireGate(Semaphore gate) {
    try {
      if (!gate.tryAcquire(properties.getAdmissionWait().toMillis(), TimeUnit.MILLISECONDS)) {
        count("rejected");
        throw new PreferencesBusyException();
      }
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      count("rejected");
      throw new PreferencesBusyException();
    }
  }

  private PreferenceSnapshot await(CompletableFuture<PreferenceSnapshot> future) {
    try {
      return future.get(properties.getFollowerWait().toMillis(), TimeUnit.MILLISECONDS);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new PreferencesBusyException();
    } catch (TimeoutException timeout) {
      count("rejected");
      throw new PreferencesBusyException();
    } catch (ExecutionException failure) {
      if (failure.getCause() instanceof RuntimeException runtime) throw runtime;
      throw new PreferencesBusyException();
    }
  }

  private void count(String outcome) {
    meters.counter("tripsense.context.preferences", "outcome", outcome).increment();
    ContextDiagnostics.state("context_preferences_outcome", outcome);
  }

  private List<PreferenceSignal> result(PreferenceSnapshot snapshot) {
    ContextDiagnostics.state("context_signal_count", snapshot.signals().size());
    return snapshot.signals();
  }

  int pendingFlights() {
    return flights.size();
  }

  private record RequestKey(UUID userId, PreferenceSnapshot.Revision revision, String purpose) {}
}
