package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.BatchEnrichmentProgressDto;
import fu.tripsense.placeservice.dto.BatchEnrichmentRequest;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.dto.PlaceStatsDto;
import fu.tripsense.placeservice.providers.ziomap.ZioMapProvider;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class PlaceBatchEnrichmentService {

  private static final int MAX_LOGS = 40;
  private static final DateTimeFormatter TIME_FMT =
      DateTimeFormatter.ofPattern("HH:mm:ss").withZone(ZoneId.systemDefault());

  private final PlaceRepository repository;
  private final PlaceDetailsService placeDetailsService;
  private final ZioMapProvider zioMapProvider;

  // Job State
  private volatile String jobId = "";
  private volatile String status = "IDLE";
  private volatile Instant startedAt;
  private volatile Instant finishedAt;
  private volatile String currentPlaceName = "";
  private final AtomicInteger total = new AtomicInteger(0);
  private final AtomicInteger processed = new AtomicInteger(0);
  private final AtomicInteger success = new AtomicInteger(0);
  private final AtomicInteger failed = new AtomicInteger(0);
  private final AtomicBoolean cancelled = new AtomicBoolean(false);
  private final ConcurrentLinkedDeque<String> recentLogs = new ConcurrentLinkedDeque<>();
  private ExecutorService activeExecutor;

  public PlaceBatchEnrichmentService(
      PlaceRepository repository,
      PlaceDetailsService placeDetailsService,
      ZioMapProvider zioMapProvider) {
    this.repository = repository;
    this.placeDetailsService = placeDetailsService;
    this.zioMapProvider = zioMapProvider;
  }

  public PlaceStatsDto getStats() {
    long totalCount = repository.count();
    long pendingCount = repository.countPendingEnrichment();
    long enrichedCount = Math.max(0, totalCount - pendingCount);

    return PlaceStatsDto.builder()
        .totalPlaces(totalCount)
        .enrichedPlaces(enrichedCount)
        .pendingPlaces(pendingCount)
        .zioMapKeyConfigured(zioMapProvider.isApiKeyConfigured())
        .zioMapKeyMasked(zioMapProvider.getMaskedApiKey())
        .isJobRunning("RUNNING".equalsIgnoreCase(status))
        .build();
  }

  public BatchEnrichmentProgressDto getProgress() {
    int totalVal = total.get();
    int processedVal = processed.get();
    double percentage = totalVal > 0 ? Math.min(100.0, (processedVal * 100.0) / totalVal) : 0.0;

    long elapsedSeconds = 0;
    if (startedAt != null) {
      Instant end = finishedAt != null ? finishedAt : Instant.now();
      elapsedSeconds = Math.max(0, Duration.between(startedAt, end).getSeconds());
    }

    long remainingSeconds = 0;
    if ("RUNNING".equalsIgnoreCase(status) && processedVal > 0 && totalVal > processedVal) {
      double avgPerItem = (double) elapsedSeconds / processedVal;
      remainingSeconds = (long) (avgPerItem * (totalVal - processedVal));
    }

    return BatchEnrichmentProgressDto.builder()
        .jobId(jobId)
        .status(status)
        .total(totalVal)
        .processed(processedVal)
        .success(success.get())
        .failed(failed.get())
        .percentage(Math.round(percentage * 10.0) / 10.0)
        .elapsedSeconds(elapsedSeconds)
        .estimatedRemainingSeconds(remainingSeconds)
        .currentPlaceName(currentPlaceName)
        .recentLogs(new ArrayList<>(recentLogs))
        .build();
  }

  public synchronized BatchEnrichmentProgressDto startBatchEnrichment(
      BatchEnrichmentRequest request) {
    if ("RUNNING".equalsIgnoreCase(status)) {
      return getProgress();
    }

    int limit = request != null && request.getLimit() != null ? request.getLimit() : 1000;
    int concurrency =
        request != null && request.getConcurrency() != null
            ? Math.max(1, Math.min(10, request.getConcurrency()))
            : 5;
    boolean forceAll = request != null && Boolean.TRUE.equals(request.getForceAll());

    List<Place> targets =
        forceAll
            ? repository.findAll(PageRequest.of(0, limit)).getContent()
            : repository.findPendingEnrichment(PageRequest.of(0, limit));

    if (targets.isEmpty()) {
      jobId = "batch-" + UUID.randomUUID().toString().substring(0, 8);
      status = "COMPLETED";
      total.set(0);
      processed.set(0);
      success.set(0);
      failed.set(0);
      addLog("No places need enrichment. Database is fully up to date.");
      return getProgress();
    }

    // Reset Job
    jobId = "batch-" + UUID.randomUUID().toString().substring(0, 8);
    status = "RUNNING";
    startedAt = Instant.now();
    finishedAt = null;
    currentPlaceName = "";
    total.set(targets.size());
    processed.set(0);
    success.set(0);
    failed.set(0);
    cancelled.set(false);
    recentLogs.clear();
    zioMapProvider.clearQuotaExceeded();

    addLog(
        String.format(
            "Batch enrichment started for %d places with %d workers (forceAll=%b)",
            targets.size(), concurrency, forceAll));

    activeExecutor = Executors.newFixedThreadPool(concurrency);
    CompletableFuture.runAsync(() -> runPipeline(targets, activeExecutor));

    return getProgress();
  }

  public synchronized boolean cancel() {
    if ("RUNNING".equalsIgnoreCase(status)) {
      cancelled.set(true);
      status = "CANCELLED";
      finishedAt = Instant.now();
      if (activeExecutor != null) {
        activeExecutor.shutdownNow();
      }
      addLog("Batch enrichment was cancelled by user.");
      return true;
    }
    return false;
  }

  private void runPipeline(List<Place> places, ExecutorService executor) {
    List<CompletableFuture<Void>> futures = new ArrayList<>();

    for (Place place : places) {
      if (cancelled.get() || zioMapProvider.isLastCallQuotaExceeded()) {
        if (zioMapProvider.isLastCallQuotaExceeded()) {
          handleQuotaExceeded();
        }
        break;
      }

      CompletableFuture<Void> future =
          CompletableFuture.runAsync(
              () -> {
                if (cancelled.get() || zioMapProvider.isLastCallQuotaExceeded()) {
                  if (zioMapProvider.isLastCallQuotaExceeded()) {
                    handleQuotaExceeded();
                  }
                  return;
                }
                currentPlaceName = place.getName();
                try {
                  // Throttle slightly between requests to protect ZioMap quota
                  Thread.sleep(100);

                  Double lat =
                      place.getLocation() != null ? place.getLocation().getY() : null;
                  Double lng =
                      place.getLocation() != null ? place.getLocation().getX() : null;

                  Optional<PlaceDto> enriched =
                      placeDetailsService.getDetails(
                          place.getId(), place.getName(), lat, lng, true);

                  if (zioMapProvider.isLastCallQuotaExceeded()) {
                    handleQuotaExceeded();
                    return;
                  }

                  if (enriched.isPresent()) {
                    PlaceDto dto = enriched.get();
                    int photoCount = dto.getPhotos() != null ? dto.getPhotos().size() : 0;
                    int reviewCount = dto.getReviews() != null ? dto.getReviews().size() : 0;
                    Double rating = dto.getRating();

                    boolean hasNewEnrichment = photoCount > 0 || reviewCount > 0 || rating != null;
                    if (hasNewEnrichment) {
                      success.incrementAndGet();
                      addLog(
                          String.format(
                              "[%d/%d] Enriched '%s' (rating: %s, %d reviews, %d photos) -> Qdrant synced",
                              processed.get() + 1,
                              total.get(),
                              place.getName(),
                              rating != null ? String.valueOf(rating) : "N/A",
                              reviewCount,
                              photoCount));
                    } else {
                      failed.incrementAndGet();
                      addLog(
                          String.format(
                              "[WARN] Không tìm thấy thông tin bổ sung cho '%s' trên ZioMap",
                              place.getName()));
                    }
                  } else {
                    failed.incrementAndGet();
                    addLog(
                        String.format(
                            "[WARN] Không tìm thấy thông tin bổ sung cho '%s' trên ZioMap",
                            place.getName()));
                  }
                } catch (InterruptedException ie) {
                  Thread.currentThread().interrupt();
                } catch (Exception ex) {
                  failed.incrementAndGet();
                  addLog(
                      String.format(
                          "[ERROR] '%s': %s",
                          place.getName(),
                          ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName()));
                  if (isQuotaOrAuthException(ex)) {
                    handleQuotaExceeded();
                  }
                } finally {
                  processed.incrementAndGet();
                }
              },
              executor);

      futures.add(future);
    }

    try {
      CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    } catch (Exception ignored) {
    } finally {
      executor.shutdown();
      try {
        if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
          executor.shutdownNow();
        }
      } catch (InterruptedException e) {
        executor.shutdownNow();
      }

      finishedAt = Instant.now();
      if (!cancelled.get()) {
        status = "COMPLETED";
        currentPlaceName = "";
        long dur = Math.max(1, Duration.between(startedAt, finishedAt).getSeconds());
        addLog(
            String.format(
                "BATCH FINISHED in %ds: %d enriched, %d failed out of %d total",
                dur, success.get(), failed.get(), total.get()));
      } else if (!"FAILED".equalsIgnoreCase(status)) {
        status = "CANCELLED";
      }
    }
  }

  private synchronized void handleQuotaExceeded() {
    if (!cancelled.get()) {
      cancelled.set(true);
      status = "FAILED";
      finishedAt = Instant.now();
      if (activeExecutor != null) {
        activeExecutor.shutdownNow();
      }
      String err = zioMapProvider.getLastQuotaErrorMessage();
      if (err == null || err.isBlank()) {
        err = "ZioMap API Key đã hết lượt gọi hoặc token không hợp lệ (Quota Exceeded / 401 / 402 / 429).";
      }
      addLog(String.format("[FATAL] %s", err));
      addLog(
          "[FATAL] TIẾN TRÌNH ĐÃ TỰ ĐỘNG DỪNG! Vui lòng vào trang Settings thay API Key ZioMap mới rồi bấm chạy tiếp.");
    }
  }

  private boolean isQuotaOrAuthException(Throwable throwable) {
    Throwable current = throwable;
    while (current != null) {
      if (current instanceof org.springframework.web.client.RestClientResponseException restEx) {
        int code = restEx.getStatusCode().value();
        if (code == 401 || code == 402 || code == 403 || code == 429) {
          return true;
        }
      }
      String msg = current.getMessage();
      if (msg != null) {
        String lower = msg.toLowerCase();
        if (lower.contains("401")
            || lower.contains("402")
            || lower.contains("403")
            || lower.contains("429")
            || lower.contains("quota")
            || lower.contains("unauthorized")
            || lower.contains("payment required")
            || lower.contains("too many requests")
            || lower.contains("rate limit")
            || lower.contains("credit")) {
          return true;
        }
      }
      current = current.getCause();
    }
    return false;
  }

  private void addLog(String message) {
    String logEntry = String.format("[%s] %s", TIME_FMT.format(Instant.now()), message);
    log.info("[BATCH-ENRICH] {}", message);
    recentLogs.addFirst(logEntry);
    while (recentLogs.size() > MAX_LOGS) {
      recentLogs.removeLast();
    }
  }
}
