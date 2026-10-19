package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.observability.RequestDiagnostics;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Optional Redis I/O cannot consume the canonical category retrieval budget. */
@Component
public class CategoryCacheAccess {
  private final PlaceCacheService cache;
  private final ThreadPoolExecutor reads;
  private final ThreadPoolExecutor writes;
  private final Duration wait;

  public CategoryCacheAccess(
      PlaceCacheService cache,
      @Qualifier("categoryCacheReadExecutor") ThreadPoolExecutor reads,
      @Qualifier("categoryCacheWriteExecutor") ThreadPoolExecutor writes,
      @Value("${tripsense.places.category-cache-read-budget:100ms}") Duration wait) {
    if (wait == null
        || wait.compareTo(Duration.ofMillis(10)) < 0
        || wait.compareTo(Duration.ofMillis(250)) > 0)
      throw new IllegalArgumentException("Invalid category cache wait budget");
    this.cache = cache;
    this.reads = reads;
    this.writes = writes;
    this.wait = wait;
  }

  public Optional<List<PlaceDto>> getSearchResults(
      String key, double lat, double lng, int radius, int limit) {
    Future<Optional<List<PlaceDto>>> task = null;
    long deadline = System.nanoTime() + wait.toNanos();
    try {
      task =
          reads.submit(
              RequestDiagnostics.wrap(
                  () -> {
                    RequestDiagnostics.mark("category_cache_io_async", true);
                    return RequestDiagnostics.measure(
                        "category_cache_io_read",
                        () -> cache.getSearchResults(key, lat, lng, radius, limit));
                  }));
      return task.get(Math.max(0, deadline - System.nanoTime()), TimeUnit.NANOSECONDS);
    } catch (TimeoutException timeout) {
      RequestDiagnostics.mark("category_cache_read_outcome", "timeout");
    } catch (RejectedExecutionException overloaded) {
      RequestDiagnostics.mark("category_cache_read_outcome", "overloaded");
    } catch (ExecutionException | CancellationException failure) {
      RequestDiagnostics.mark("category_cache_read_outcome", "error");
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      RequestDiagnostics.mark("category_cache_read_outcome", "interrupted");
    } finally {
      // Do not abort a running cold handshake: it can finish under its finite driver
      // timeout and warm the shared connection. Queued cancelled work is purged.
      if (task != null && !task.isDone()) task.cancel(false);
      reads.purge();
    }
    return Optional.empty();
  }

  public void putSearchResults(
      String key, double lat, double lng, int radius, int limit, List<PlaceDto> places) {
    if (places == null || places.isEmpty()) return;
    var snapshot = List.copyOf(places);
    try {
      writes.submit(
          RequestDiagnostics.wrap(
              () -> {
                RequestDiagnostics.mark("category_cache_io_async", true);
                try {
                  RequestDiagnostics.run(
                      "category_cache_io_write",
                      () -> cache.putSearchResults(key, lat, lng, radius, limit, snapshot));
                } catch (RuntimeException failure) {
                  RequestDiagnostics.mark("category_cache_write_outcome", "error");
                }
                return null;
              }));
      RequestDiagnostics.mark("category_cache_write_outcome", "queued");
    } catch (RejectedExecutionException overloaded) {
      RequestDiagnostics.mark("category_cache_write_outcome", "overloaded");
    }
  }
}
