package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.client.RecommendationIndexerClient;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceLifecycleStatus;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.BatchEnrichmentProgressDto;
import fu.tripsense.placeservice.dto.BatchEnrichmentRequest;
import fu.tripsense.placeservice.dto.DiscoveryCategory;
import fu.tripsense.placeservice.dto.LocationDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.dto.PlaceStatsDto;
import fu.tripsense.placeservice.providers.ziomap.ZioMapProvider;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Slf4j
@Service
public class PlaceBatchEnrichmentService {

  private static final int MAX_LOGS = 40;
  private static final int BATCH_CHUNK_SIZE = 50;
  private static final int DEFAULT_BATCH_LIMIT = 2000;
  private static final DateTimeFormatter TIME_FMT =
      DateTimeFormatter.ofPattern("HH:mm:ss").withZone(ZoneId.systemDefault());

  private final PlaceRepository repository;
  private final PlaceDetailsService placeDetailsService;
  private final ZioMapProvider zioMapProvider;
  private final PlaceCloudinaryStorageService cloudinaryStorageService;
  private final RecommendationIndexerClient recommendationIndexerClient;
  private final PlacePersistenceService placePersistenceService;

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
    this(repository, placeDetailsService, zioMapProvider, null, null, null);
  }

  public PlaceBatchEnrichmentService(
      PlaceRepository repository,
      PlaceDetailsService placeDetailsService,
      ZioMapProvider zioMapProvider,
      PlaceCloudinaryStorageService cloudinaryStorageService) {
    this(repository, placeDetailsService, zioMapProvider, cloudinaryStorageService, null, null);
  }

  @Autowired
  public PlaceBatchEnrichmentService(
      PlaceRepository repository,
      PlaceDetailsService placeDetailsService,
      ZioMapProvider zioMapProvider,
      @Autowired(required = false) PlaceCloudinaryStorageService cloudinaryStorageService,
      @Autowired(required = false) RecommendationIndexerClient recommendationIndexerClient,
      @Autowired(required = false) PlacePersistenceService placePersistenceService) {
    this.repository = repository;
    this.placeDetailsService = placeDetailsService;
    this.zioMapProvider = zioMapProvider;
    this.cloudinaryStorageService = cloudinaryStorageService;
    this.recommendationIndexerClient = recommendationIndexerClient;
    this.placePersistenceService = placePersistenceService;
  }

  /**
   * Scans already-uploaded Cloudinary assets under {@code tripsense/places/<providerPlaceId>/} and
   * relinks them back into matching MongoDB {@link Place} documents without making external
   * ZioMap API calls.
   */
  public Map<String, Object> relinkExistingCloudinaryPhotos(boolean dryRun) {
    Map<String, Object> summary = new LinkedHashMap<>();
    if (cloudinaryStorageService == null || !cloudinaryStorageService.isConfigured()) {
      summary.put("configured", false);
      summary.put("dryRun", dryRun);
      summary.put("cloudinaryFoldersFound", 0);
      summary.put("placesScanned", 0);
      summary.put("placesRelinked", 0);
      summary.put("alreadyLinked", 0);
      summary.put("unmatchedCloudinaryFolders", 0);
      return summary;
    }

    Map<String, List<String>> cloudPhotosByFolder =
        cloudinaryStorageService.listExistingPlacePhotos();
    Set<String> matchedFolders = new LinkedHashSet<>();
    int placesScanned = 0;
    int placesRelinked = 0;
    int alreadyLinked = 0;

    int page = 0;
    while (true) {
      Page<Place> slice = repository.findAll(PageRequest.of(page, 500));
      for (Place place : slice.getContent()) {
        placesScanned++;
        if (place.getProviderPlaceId() == null || place.getProviderPlaceId().isBlank()) {
          continue;
        }
        String folderKey = cloudinaryStorageService.safeIdentifier(place.getProviderPlaceId());
        List<String> cloudUrls = cloudPhotosByFolder.get(folderKey);
        if (cloudUrls == null || cloudUrls.isEmpty()) {
          continue;
        }
        matchedFolders.add(folderKey);

        List<String> currentPhotos = place.getPhotos() != null ? place.getPhotos() : List.of();
        List<String> existingPermanent =
            currentPhotos.stream()
                .filter(PlaceCloudinaryStorageService::isPermanentCloudinaryUrl)
                .toList();
        boolean hasStaleNonCloudinary =
            existingPermanent.size() != currentPhotos.size();

        Set<String> mergedSet = new LinkedHashSet<>(existingPermanent);
        mergedSet.addAll(cloudUrls);
        List<String> merged = new ArrayList<>(mergedSet);

        if (!hasStaleNonCloudinary && existingPermanent.equals(merged)) {
          alreadyLinked++;
          continue;
        }

        if (!dryRun) {
          place.setPhotos(merged);
          place.setLastFetchedAt(Instant.now());
          repository.save(place);
        }
        placesRelinked++;
      }
      if (!slice.hasNext()) {
        break;
      }
      page++;
    }

    int unmatched = Math.max(0, cloudPhotosByFolder.size() - matchedFolders.size());
    addLog(
        String.format(
            "Cloudinary relink (dryRun=%b): folders=%d, scanned=%d, relinked=%d, alreadyLinked=%d, unmatched=%d",
            dryRun,
            cloudPhotosByFolder.size(),
            placesScanned,
            placesRelinked,
            alreadyLinked,
            unmatched));

    summary.put("configured", true);
    summary.put("dryRun", dryRun);
    summary.put("cloudinaryFoldersFound", cloudPhotosByFolder.size());
    summary.put("placesScanned", placesScanned);
    summary.put("placesRelinked", placesRelinked);
    summary.put("alreadyLinked", alreadyLinked);
    summary.put("unmatchedCloudinaryFolders", unmatched);
    return summary;
  }

  public Map<String, Object> normalizeMetadataAndSyncQdrant(
      boolean dryRun, boolean syncQdrant) {
    return normalizeMetadataAndSyncQdrant(dryRun, syncQdrant, false);
  }

  /**
   * Deterministically normalizes stored {@code city}, {@code district}, and missing {@code
   * primaryType} fields using local address/category rules (zero external ZioMap/AI calls,
   * preserving {@code manualOverrideFields} and skipping {@code ARCHIVED} places) and optionally
   * pushes all active places to Qdrant in chunks. When {@code async} is true, Qdrant sync runs
   * in the background and reports live progress via {@link #getProgress()}.
   */
  public Map<String, Object> normalizeMetadataAndSyncQdrant(
      boolean dryRun, boolean syncQdrant, boolean async) {
    int placesScanned = 0;
    int placesUpdated = 0;
    int cityNormalized = 0;
    int districtFilled = 0;
    int primaryTypeDerived = 0;
    int skippedArchived = 0;
    int skippedManualOverrides = 0;
    List<PlaceDto> qdrantCandidates = new ArrayList<>();

    int page = 0;
    while (true) {
      Page<Place> slice = repository.findAll(PageRequest.of(page, 500));
      for (Place place : slice.getContent()) {
        placesScanned++;
        if (place.getLifecycleStatus() == PlaceLifecycleStatus.ARCHIVED) {
          skippedArchived++;
          continue;
        }

        Set<String> overrides =
            place.getManualOverrideFields() != null ? place.getManualOverrideFields() : Set.of();
        boolean changed = false;

        String normalizedCity =
            VietnameseAdministrativeAreaNormalizer.city(place.getCity(), place.getAddress());
        if (StringUtils.hasText(normalizedCity) && !normalizedCity.equals(place.getCity())) {
          if (overrides.contains("city")) {
            skippedManualOverrides++;
          } else {
            if (!dryRun) {
              place.setCity(normalizedCity);
            }
            cityNormalized++;
            changed = true;
          }
        }

        String normalizedDistrict =
            VietnameseAdministrativeAreaNormalizer.district(
                place.getDistrict(), place.getAddress());
        if (StringUtils.hasText(normalizedDistrict)
            && !normalizedDistrict.equals(place.getDistrict())) {
          if (overrides.contains("district")) {
            skippedManualOverrides++;
          } else {
            if (!dryRun) {
              place.setDistrict(normalizedDistrict);
            }
            districtFilled++;
            changed = true;
          }
        }

        if (!StringUtils.hasText(place.getPrimaryType())) {
          String derivedPrimaryType =
              DiscoveryCategory.derivePrimaryTypeFromCategories(
                  place.getCategories(), place.getName());
          if (StringUtils.hasText(derivedPrimaryType)) {
            if (overrides.contains("primaryType")) {
              skippedManualOverrides++;
            } else {
              if (!dryRun) {
                place.setPrimaryType(derivedPrimaryType);
              }
              primaryTypeDerived++;
              changed = true;
            }
          }
        }

        Place persistedPlace = place;
        if (changed) {
          placesUpdated++;
          if (!dryRun) {
            place.setLastFetchedAt(Instant.now());
            persistedPlace = repository.save(place);
          }
        }

        if (syncQdrant && !dryRun) {
          qdrantCandidates.add(toIndexingDto(persistedPlace));
        }
      }
      if (!slice.hasNext()) {
        break;
      }
      page++;
    }

    int batchesSucceeded = 0;
    int batchesFailed = 0;
    boolean qdrantSynced = false;
    String qdrantStatus;

    if (dryRun) {
      qdrantStatus = "SKIPPED_DRY_RUN";
    } else if (!syncQdrant) {
      qdrantStatus = "DISABLED";
    } else if (recommendationIndexerClient == null) {
      qdrantStatus = "CLIENT_UNAVAILABLE";
    } else if (qdrantCandidates.isEmpty()) {
      qdrantStatus = "NO_CANDIDATES";
    } else if (async) {
      boolean started = startBackgroundQdrantSync(qdrantCandidates);
      qdrantStatus = started ? "SYNC_STARTED" : "JOB_ALREADY_RUNNING";
    } else {
      RecommendationIndexerClient.IndexBatchOutcome outcome =
          recommendationIndexerClient.triggerIndexingBatchSync(qdrantCandidates);
      batchesSucceeded = outcome.batchesSucceeded();
      batchesFailed = outcome.batchesFailed();
      qdrantSynced = outcome.isFullySynced() && outcome.batchesSucceeded() > 0;
      qdrantStatus = qdrantSynced ? "SYNCED" : "PARTIAL_OR_UNREACHABLE";
    }

    addLog(
        String.format(
            "Metadata normalize (dryRun=%b, syncQdrant=%b): scanned=%d, updated=%d, city=%d, district=%d, primaryType=%d, qdrant=%s",
            dryRun,
            syncQdrant,
            placesScanned,
            placesUpdated,
            cityNormalized,
            districtFilled,
            primaryTypeDerived,
            qdrantStatus));

    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("dryRun", dryRun);
    summary.put("syncQdrant", syncQdrant);
    summary.put("placesScanned", placesScanned);
    summary.put("placesUpdated", placesUpdated);
    summary.put("cityNormalized", cityNormalized);
    summary.put("districtFilled", districtFilled);
    summary.put("primaryTypeDerived", primaryTypeDerived);
    summary.put("skippedArchived", skippedArchived);
    summary.put("skippedManualOverrides", skippedManualOverrides);
    summary.put("qdrantCandidates", qdrantCandidates.size());
    summary.put("qdrantBatchesSucceeded", batchesSucceeded);
    summary.put("qdrantBatchesFailed", batchesFailed);
    summary.put("qdrantSynced", qdrantSynced);
    summary.put("qdrantStatus", qdrantStatus);
    return summary;
  }

  private synchronized boolean startBackgroundQdrantSync(List<PlaceDto> candidates) {
    if ("RUNNING".equalsIgnoreCase(status)) {
      return false;
    }
    jobId = "qdrant-" + UUID.randomUUID().toString().substring(0, 8);
    status = "RUNNING";
    startedAt = Instant.now();
    finishedAt = null;
    currentPlaceName = "Qdrant Cloud";
    total.set(candidates.size());
    processed.set(0);
    success.set(0);
    failed.set(0);
    cancelled.set(false);
    recentLogs.clear();
    addLog(String.format("Started background Qdrant sync for %d places (batches of 25)", candidates.size()));
    CompletableFuture.runAsync(() -> runQdrantSyncPipeline(candidates));
    return true;
  }

  private void runQdrantSyncPipeline(List<PlaceDto> candidates) {
    final int chunkSize = 25;
    try {
      for (int i = 0; i < candidates.size(); i += chunkSize) {
        if (cancelled.get()) {
          break;
        }
        int end = Math.min(i + chunkSize, candidates.size());
        List<PlaceDto> batch = candidates.subList(i, end);
        currentPlaceName =
            batch.isEmpty() ? "Qdrant Cloud" : String.format("Qdrant [%d-%d/%d]", i + 1, end, candidates.size());
        RecommendationIndexerClient.IndexBatchOutcome outcome =
            recommendationIndexerClient.triggerIndexingBatchSync(batch);
        processed.addAndGet(batch.size());
        if (outcome.isFullySynced() && outcome.batchesSucceeded() > 0) {
          success.addAndGet(batch.size());
          addLog(
              String.format(
                  "Qdrant batch [%d-%d/%d] synced", end - batch.size() + 1, end, candidates.size()));
        } else {
          failed.addAndGet(batch.size());
          addLog(
              String.format(
                  "[WARN] Qdrant batch [%d-%d/%d] failed (%s)",
                  end - batch.size() + 1,
                  end,
                  candidates.size(),
                  outcome.errorReason() != null ? outcome.errorReason() : "unreachable"));
        }
        if (end < candidates.size() && !cancelled.get()) {
          Thread.sleep(200);
        }
      }
    } catch (InterruptedException ie) {
      Thread.currentThread().interrupt();
    } finally {
      finishedAt = Instant.now();
      currentPlaceName = "";
      if (cancelled.get()) {
        status = "CANCELLED";
      } else {
        status = "COMPLETED";
        long dur = Math.max(1, Duration.between(startedAt, finishedAt).getSeconds());
        addLog(
            String.format(
                "QDRANT SYNC FINISHED in %ds: %d synced, %d failed out of %d total",
                dur, success.get(), failed.get(), total.get()));
      }
    }
  }

  private PlaceDto toIndexingDto(Place place) {
    // Map directly from the already-loaded Place entity instead of calling
    // placePersistenceService.toDto(place), which queries PlaceMediaAssetRepository per place
    // (1,500+ N+1 MongoDB round trips before the HTTP response can return).
    LocationDto locationDto = null;
    if (place.getLocation() != null) {
      locationDto =
          LocationDto.builder()
              .lat(place.getLocation().getY())
              .lng(place.getLocation().getX())
              .build();
    }
    List<String> permanentPhotos =
        place.getPhotos() == null
            ? List.of()
            : place.getPhotos().stream()
                .filter(PlaceCloudinaryStorageService::isPermanentCloudinaryUrl)
                .toList();
    return PlaceDto.builder()
        .id(place.getId())
        .provider(place.getProvider())
        .providerPlaceId(place.getProviderPlaceId())
        .name(place.getName())
        .location(locationDto)
        .address(place.getAddress())
        .city(place.getCity())
        .district(place.getDistrict())
        .categories(place.getCategories())
        .primaryType(place.getPrimaryType())
        .rating(place.getRating())
        .userRatingCount(place.getUserRatingCount())
        .photos(permanentPhotos)
        .openingHours(place.getOpeningHours())
        .businessStatus(place.getBusinessStatus())
        .description(place.getDescription())
        .build();
  }

  public PlaceStatsDto getStats() {
    long totalCount = repository.count();
    long pendingCount = repository.countPendingEnrichment();
    long enrichedCount = Math.max(0, totalCount - pendingCount);
    long stalePhotosCount = repository.countPlacesNeedingCloudinaryPhotos();

    return PlaceStatsDto.builder()
        .totalPlaces(totalCount)
        .enrichedPlaces(enrichedCount)
        .pendingPlaces(pendingCount)
        .stalePhotoPlaces(stalePhotosCount)
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

    int limit =
        request != null && request.getLimit() != null ? request.getLimit() : DEFAULT_BATCH_LIMIT;
    int concurrency =
        request != null && request.getConcurrency() != null
            ? Math.max(1, Math.min(10, request.getConcurrency()))
            : 5;
    boolean forceAll = request != null && Boolean.TRUE.equals(request.getForceAll());
    boolean stalePhotosOnly =
        request != null && Boolean.TRUE.equals(request.getStalePhotosOnly());
    boolean syncEmbedding =
        request == null || !Boolean.FALSE.equals(request.getSyncEmbedding());

    List<Place> rawTargets;
    if (stalePhotosOnly) {
      rawTargets = repository.findPlacesNeedingCloudinaryPhotos(PageRequest.of(0, limit));
    } else if (forceAll) {
      rawTargets = repository.findAll(PageRequest.of(0, limit)).getContent();
    } else {
      rawTargets = repository.findPendingEnrichment(PageRequest.of(0, limit));
    }
    List<Place> targets =
        rawTargets.stream()
            .filter(Objects::nonNull)
            .filter(p -> p.getLifecycleStatus() != PlaceLifecycleStatus.ARCHIVED)
            .toList();

    if (targets.isEmpty()) {
      jobId = "batch-" + UUID.randomUUID().toString().substring(0, 8);
      status = "COMPLETED";
      total.set(0);
      processed.set(0);
      success.set(0);
      failed.set(0);
      addLog("No places need enrichment or photo migration. Database is fully up to date.");
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
            "Batch enrichment started for %d places with %d workers (forceAll=%b, stalePhotosOnly=%b, syncEmbedding=%b)",
            targets.size(), concurrency, forceAll, stalePhotosOnly, syncEmbedding));

    activeExecutor = Executors.newFixedThreadPool(concurrency);
    CompletableFuture.runAsync(() -> runPipeline(targets, activeExecutor, syncEmbedding));

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

  private void runPipeline(
      List<Place> places, ExecutorService executor, boolean syncEmbedding) {
    List<PlaceDto> enrichedForBatchSync = Collections.synchronizedList(new ArrayList<>());
    try {
      for (int i = 0; i < places.size(); i += BATCH_CHUNK_SIZE) {
        if (cancelled.get() || zioMapProvider.isLastCallQuotaExceeded()) {
          if (zioMapProvider.isLastCallQuotaExceeded()) {
            handleQuotaExceeded();
          }
          break;
        }

        int end = Math.min(i + BATCH_CHUNK_SIZE, places.size());
        List<Place> chunk = places.subList(i, end);
        List<CompletableFuture<Void>> chunkFutures = new ArrayList<>();

        for (Place place : chunk) {
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

                      Double lat = place.getLocation() != null ? place.getLocation().getY() : null;
                      Double lng = place.getLocation() != null ? place.getLocation().getX() : null;

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

                        boolean hasNewEnrichment =
                            photoCount > 0 || reviewCount > 0 || rating != null;
                        if (hasNewEnrichment) {
                          success.incrementAndGet();
                          if (syncEmbedding) {
                            enrichedForBatchSync.add(dto);
                          }
                          addLog(
                              String.format(
                                  "[%d/%d] Enriched '%s' (rating: %s, %d reviews, %d photos)%s",
                                  processed.get() + 1,
                                  total.get(),
                                  place.getName(),
                                  rating != null ? String.valueOf(rating) : "N/A",
                                  reviewCount,
                                  photoCount,
                                  syncEmbedding ? " -> Qdrant queued" : ""));
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
                      log.error(
                          "Batch enrichment failed for place '{}' (id={}): {}",
                          place.getName(),
                          place.getId(),
                          ex.getMessage(),
                          ex);
                      String sanitizedReason = sanitizeErrorMessage(ex);
                      addLog(String.format("[ERROR] '%s': %s", place.getName(), sanitizedReason));
                      if (isQuotaOrAuthException(ex)) {
                        handleQuotaExceeded();
                      }
                    } finally {
                      processed.incrementAndGet();
                    }
                  },
                  executor);

          chunkFutures.add(future);
        }

        try {
          CompletableFuture.allOf(chunkFutures.toArray(new CompletableFuture[0])).join();
        } catch (Exception ignored) {
        }
      }
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
        if (syncEmbedding
            && recommendationIndexerClient != null
            && !enrichedForBatchSync.isEmpty()) {
          List<PlaceDto> snapshot;
          synchronized (enrichedForBatchSync) {
            snapshot = new ArrayList<>(enrichedForBatchSync);
          }
          RecommendationIndexerClient.IndexBatchOutcome outcome =
              recommendationIndexerClient.triggerIndexingBatchSync(snapshot);
          addLog(
              String.format(
                  "Qdrant batch sync finished: %d places in %d succeeded batches (%d failed)",
                  outcome.submitted(), outcome.batchesSucceeded(), outcome.batchesFailed()));
        } else if (!syncEmbedding) {
          addLog("Post-batch Qdrant sync skipped (syncEmbedding=false).");
        }
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
        err =
            "ZioMap API Key đã hết lượt gọi hoặc token không hợp lệ (Quota Exceeded / 401 / 402 / 429).";
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

  private String sanitizeErrorMessage(Throwable ex) {
    if (isQuotaOrAuthException(ex)) {
      return "Dịch vụ bản đồ từ chối xác thực hoặc đã vượt hạn mức truy vấn (Quota/Auth error)";
    }
    Throwable current = ex;
    while (current != null) {
      if (current instanceof java.net.SocketTimeoutException
          || current instanceof java.net.ConnectException
          || current instanceof org.springframework.web.client.ResourceAccessException) {
        return "Lỗi kết nối hoặc quá thời gian phản hồi từ dịch vụ bản đồ (Network timeout)";
      }
      current = current.getCause();
    }
    return "Lỗi xử lý dữ liệu địa điểm (Enrichment processing error)";
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
