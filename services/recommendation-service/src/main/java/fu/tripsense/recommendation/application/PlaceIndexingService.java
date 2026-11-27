package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.application.PlaceIndexResult.Status;
import fu.tripsense.recommendation.application.port.PlaceIndexer;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;

@Slf4j
@Service
public class PlaceIndexingService {
  private static final long[] DEFAULT_RATE_LIMIT_BACKOFF_MS = {2000L, 5000L, 10000L};
  private static final long DEFAULT_EMBED_PACE_MS = 150L;

  private final Optional<PlaceIndexer> indexer;
  private final ExecutorService executor;
  private final long[] rateLimitBackoffMs;
  private final long embedPaceMs;

  public PlaceIndexingService(Optional<PlaceIndexer> indexer) {
    this(indexer, null, DEFAULT_RATE_LIMIT_BACKOFF_MS, DEFAULT_EMBED_PACE_MS);
  }

  PlaceIndexingService(
      Optional<PlaceIndexer> indexer, long[] rateLimitBackoffMs, long embedPaceMs) {
    this(indexer, null, rateLimitBackoffMs, embedPaceMs);
  }

  @Autowired
  public PlaceIndexingService(
      Optional<PlaceIndexer> indexer,
      @Qualifier("placeIndexingExecutor") ExecutorService executor) {
    this(indexer, executor, DEFAULT_RATE_LIMIT_BACKOFF_MS, DEFAULT_EMBED_PACE_MS);
  }

  private PlaceIndexingService(
      Optional<PlaceIndexer> indexer,
      ExecutorService executor,
      long[] rateLimitBackoffMs,
      long embedPaceMs) {
    this.indexer = indexer;
    this.executor = executor;
    this.rateLimitBackoffMs = rateLimitBackoffMs;
    this.embedPaceMs = embedPaceMs;
  }

  public IndexOutcome indexPlaces(List<PlaceSnapshot> places) {
    if (places == null) return IndexOutcome.empty();
    return indexSubmissions(
        places.stream().map(place -> new PlaceIndexSubmission(place, null, null)).toList());
  }

  public IndexOutcome indexSubmissions(List<PlaceIndexSubmission> submissions) {
    if (submissions == null || submissions.isEmpty()) return IndexOutcome.empty();
    if (submissions.size() > 100) throw new IllegalArgumentException("Index batch exceeds limit");
    if (indexer.isEmpty()) {
      List<PlaceIndexResult> results =
          submissions.stream()
              .map(
                  value ->
                      result(value, Status.RETRYABLE_FAILURE, "SEMANTIC_INDEXING_DISABLED"))
              .toList();
      return IndexOutcome.from(results);
    }
    List<PlaceIndexResult> results =
        executor == null ? indexSequential(submissions) : indexBounded(submissions);
    IndexOutcome outcome = IndexOutcome.from(results);
    log.info(
        "Place indexing completed: submitted={}, indexed={}, unchanged={}, failed={}",
        outcome.submitted(),
        outcome.indexed(),
        outcome.unchanged(),
        outcome.failed());
    return outcome;
  }

  private List<PlaceIndexResult> indexSequential(List<PlaceIndexSubmission> submissions) {
    return submissions.stream().map(this::indexOne).toList();
  }

  private List<PlaceIndexResult> indexBounded(List<PlaceIndexSubmission> submissions) {
    List<PendingIndex> pending = new ArrayList<>(submissions.size());
    List<PlaceIndexResult> results = new ArrayList<>(submissions.size());
    for (PlaceIndexSubmission submission : submissions) {
      try {
        pending.add(new PendingIndex(submission, executor.submit(() -> indexOne(submission))));
      } catch (RejectedExecutionException rejected) {
        results.add(result(submission, Status.RETRYABLE_FAILURE, "INDEX_QUEUE_SATURATED"));
      }
    }
    for (PendingIndex value : pending) {
      try {
        results.add(value.future().get());
      } catch (InterruptedException interrupted) {
        Thread.currentThread().interrupt();
        results.add(result(value.submission(), Status.RETRYABLE_FAILURE, "INDEX_INTERRUPTED"));
      } catch (ExecutionException | CancellationException failure) {
        results.add(result(value.submission(), Status.RETRYABLE_FAILURE, "INDEX_UNAVAILABLE"));
      }
    }
    return List.copyOf(results);
  }

  private PlaceIndexResult indexOne(PlaceIndexSubmission submission) {
    if (submission == null || submission.place() == null || submission.place().id() == null) {
      return new PlaceIndexResult(null, null, Status.PERMANENT_FAILURE, "INVALID_PLACE");
    }
    try {
      boolean indexed = indexWithRateLimitRetry(submission);
      if (indexed && embedPaceMs > 0) {
        Thread.sleep(embedPaceMs);
      }
      return result(submission, indexed ? Status.INDEXED : Status.UNCHANGED, null);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      return result(submission, Status.RETRYABLE_FAILURE, "INDEX_INTERRUPTED");
    } catch (IllegalArgumentException invalid) {
      log.warn(
          "Place indexing rejected placeId={} errorType={}",
          submission.place().id(),
          invalid.getClass().getSimpleName());
      return result(submission, Status.PERMANENT_FAILURE, "INVALID_PLACE");
    } catch (RuntimeException failure) {
      log.warn(
          "Place indexing unavailable placeId={} errorType={}",
          submission.place().id(),
          failure.getClass().getSimpleName());
      return result(submission, Status.RETRYABLE_FAILURE, classify(failure));
    }
  }

  private String classify(RuntimeException failure) {
    String name = failure.getClass().getSimpleName().toLowerCase(java.util.Locale.ROOT);
    String message =
        failure.getMessage() == null
            ? ""
            : failure.getMessage().toLowerCase(java.util.Locale.ROOT);
    if (name.contains("timeout") || message.contains("timed out")) return "INDEX_TIMEOUT";
    if (message.contains("429") || message.contains("rate limit")) {
      return "EMBEDDING_RATE_LIMITED";
    }
    if (message.contains("qdrant")) return "QDRANT_UNAVAILABLE";
    if (message.contains("embedding")) return "EMBEDDING_UNAVAILABLE";
    return "INDEX_UNAVAILABLE";
  }

  private PlaceIndexResult result(
      PlaceIndexSubmission submission, Status status, String errorCode) {
    return new PlaceIndexResult(
        submission == null || submission.place() == null ? null : submission.place().id(),
        submission == null ? null : submission.sourceVersion(),
        status,
        errorCode);
  }

  private boolean indexWithRateLimitRetry(PlaceIndexSubmission submission)
      throws InterruptedException {
    int attempt = 0;
    while (true) {
      try {
        return submission.sourceVersion() == null && submission.sourceUpdatedAt() == null
            ? indexer.orElseThrow().indexIfChanged(submission.place())
            : indexer
                .orElseThrow()
                .indexIfChanged(
                    submission.place(),
                    submission.sourceVersion(),
                    submission.sourceUpdatedAt());
      } catch (RuntimeException failure) {
        if (!isRateLimitException(failure) || attempt >= rateLimitBackoffMs.length) {
          throw failure;
        }
        long waitMs = rateLimitBackoffMs[attempt++];
        log.warn(
            "Embedding provider rate-limited (429); retrying attempt {}/{} after {}ms",
            attempt,
            rateLimitBackoffMs.length,
            waitMs);
        Thread.sleep(waitMs);
      }
    }
  }

  private boolean isRateLimitException(Throwable throwable) {
    Throwable current = throwable;
    while (current != null) {
      if (current instanceof RestClientResponseException restEx
          && restEx.getStatusCode().value() == 429) {
        return true;
      }
      String name = current.getClass().getSimpleName();
      if ("TooManyRequests".equals(name)
          || (current.getMessage() != null && current.getMessage().contains("429"))) {
        return true;
      }
      current = current.getCause();
    }
    return false;
  }

  public boolean isSemanticEnabled() {
    return indexer.isPresent();
  }

  public void removePlace(String placeId) {
    if (placeId == null || placeId.isBlank() || indexer.isEmpty()) return;
    indexer.get().remove(placeId);
  }

  public record IndexOutcome(
      int submitted,
      int indexed,
      int skipped,
      int unchanged,
      int failed,
      List<PlaceIndexResult> results) {
    static IndexOutcome empty() {
      return new IndexOutcome(0, 0, 0, 0, 0, List.of());
    }

    static IndexOutcome from(List<PlaceIndexResult> results) {
      int indexed =
          (int) results.stream().filter(value -> value.status() == Status.INDEXED).count();
      int unchanged =
          (int) results.stream().filter(value -> value.status() == Status.UNCHANGED).count();
      int failed = results.size() - indexed - unchanged;
      return new IndexOutcome(
          results.size(), indexed, unchanged + failed, unchanged, failed, List.copyOf(results));
    }
  }

  private record PendingIndex(
      PlaceIndexSubmission submission, Future<PlaceIndexResult> future) {}
}
