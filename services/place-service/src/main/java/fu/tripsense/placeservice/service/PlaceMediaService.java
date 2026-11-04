package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceMediaAsset;
import fu.tripsense.placeservice.domain.model.PlaceMediaBackfillJob;
import fu.tripsense.placeservice.domain.model.PlaceMediaState;
import fu.tripsense.placeservice.domain.repository.PlaceMediaAssetRepository;
import fu.tripsense.placeservice.domain.repository.PlaceMediaBackfillJobRepository;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.PlaceMediaAdminDtos;
import fu.tripsense.placeservice.dto.PlacePhotoDto;
import fu.tripsense.placeservice.exception.PlaceActionException;
import fu.tripsense.placeservice.providers.PlaceProvider;
import fu.tripsense.placeservice.security.CurrentUserProvider;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Service
public class PlaceMediaService {
  private static final List<PlaceMediaState> ALL_STATES = List.of(PlaceMediaState.values());

  private final PlaceRepository places;
  private final PlaceMediaAssetRepository assets;
  private final PlaceMediaBackfillJobRepository jobs;
  private final PlaceMediaStorage storage;
  private final PlaceProvider provider;
  private final CurrentUserProvider currentUser;
  private final MongoTemplate mongo;
  private final ThreadPoolExecutor jobExecutor;
  private final ThreadPoolExecutor workerExecutor;
  private final boolean providerPersistenceApproved;
  private final String providerLicenseEvidenceUrl;

  public PlaceMediaService(
      PlaceRepository places,
      PlaceMediaAssetRepository assets,
      PlaceMediaBackfillJobRepository jobs,
      PlaceMediaStorage storage,
      PlaceProvider provider,
      CurrentUserProvider currentUser,
      MongoTemplate mongo,
      @Qualifier("placeMediaJobExecutor") ThreadPoolExecutor jobExecutor,
      @Qualifier("placeMediaWorkerExecutor") ThreadPoolExecutor workerExecutor,
      @Value("${ziomap.photo-persistence-approved:false}")
          boolean providerPersistenceApproved,
      @Value("${ziomap.photo-persistence-license-evidence-url:}")
          String providerLicenseEvidenceUrl) {
    this.places = places;
    this.assets = assets;
    this.jobs = jobs;
    this.storage = storage;
    this.provider = provider;
    this.currentUser = currentUser;
    this.mongo = mongo;
    this.jobExecutor = jobExecutor;
    this.workerExecutor = workerExecutor;
    this.providerPersistenceApproved = providerPersistenceApproved;
    this.providerLicenseEvidenceUrl = providerLicenseEvidenceUrl.trim();
  }

  public PlaceMediaAdminDtos.AssetAdminResponse upload(
      String placeId,
      MultipartFile file,
      PlaceMediaAsset.SourceType sourceType,
      PlaceMediaAsset.LicenseType licenseType,
      String licenseEvidenceUrl,
      String attributionLabel,
      String attributionUrl,
      boolean makePrimary) {
    Place place = requirePlace(placeId);
    validateRights(sourceType, licenseType, licenseEvidenceUrl);
    String assetId = "pm_" + UUID.randomUUID();
    PlaceMediaStorage.StoredMedia stored = storage.upload(placeId, assetId, file);
    PlaceMediaAsset asset =
        PlaceMediaAsset.builder()
            .id(assetId)
            .placeId(placeId)
            .storageProvider(PlaceMediaAsset.StorageProvider.CLOUDINARY)
            .storagePublicId(stored.publicId())
            .sourceType(sourceType)
            .licenseType(licenseType)
            .licenseEvidenceUrl(normalizeHttpsUrl(licenseEvidenceUrl, false))
            .attribution(attribution(attributionLabel, attributionUrl))
            .checksumSha256(stored.checksumSha256())
            .mimeType(stored.mimeType())
            .byteSize(stored.byteSize())
            .width(stored.width())
            .height(stored.height())
            .moderationStatus(
                makePrimary
                    ? PlaceMediaAsset.ModerationStatus.APPROVED
                    : PlaceMediaAsset.ModerationStatus.PENDING)
            .healthStatus(PlaceMediaAsset.HealthStatus.HEALTHY)
            .verifiedAt(makePrimary ? Instant.now() : null)
            .createdBy(currentUser.userId().toString())
            .build();
    try {
      rejectDuplicate(stored.checksumSha256());
      asset = assets.save(asset);
      if (makePrimary) setPrimaryInternal(place, asset);
      else updatePlaceState(placeId, PlaceMediaState.REVIEW_REQUIRED, "REVIEW_PENDING");
      return response(asset);
    } catch (org.springframework.dao.DuplicateKeyException exception) {
      bestEffortDelete(placeId, stored.publicId());
      throw new PlaceActionException(
          HttpStatus.CONFLICT, "DUPLICATE_MEDIA", "This image is already stored");
    } catch (RuntimeException exception) {
      bestEffortDelete(placeId, stored.publicId());
      throw exception;
    }
  }

  public PlaceMediaAdminDtos.AssetAdminResponse approve(
      String placeId, String assetId, boolean makePrimary) {
    Place place = requirePlace(placeId);
    PlaceMediaAsset asset = requireAsset(placeId, assetId);
    validateRights(asset.getSourceType(), asset.getLicenseType(), asset.getLicenseEvidenceUrl());
    asset.setModerationStatus(PlaceMediaAsset.ModerationStatus.APPROVED);
    asset.setHealthStatus(PlaceMediaAsset.HealthStatus.HEALTHY);
    asset.setVerifiedAt(Instant.now());
    asset = assets.save(asset);
    if (makePrimary || !StringUtils.hasText(place.getPrimaryMediaAssetId())) {
      setPrimaryInternal(place, asset);
    } else {
      updatePlaceState(placeId, PlaceMediaState.READY, null);
    }
    return response(asset);
  }

  public PlaceMediaAdminDtos.AssetAdminResponse reject(
      String placeId, String assetId, String reasonCode) {
    requirePlace(placeId);
    PlaceMediaAsset asset = requireAsset(placeId, assetId);
    if (!reasonCode.matches("[A-Z0-9_]{2,64}")) {
      throw new IllegalArgumentException("Invalid media rejection reason");
    }
    asset.setModerationStatus(PlaceMediaAsset.ModerationStatus.REJECTED);
    asset = assets.save(asset);
    updatePlaceState(placeId, PlaceMediaState.REVIEW_REQUIRED, reasonCode);
    return response(asset);
  }

  public PlaceMediaAdminDtos.AssetAdminResponse setPrimary(String placeId, String assetId) {
    Place place = requirePlace(placeId);
    PlaceMediaAsset asset = requireAsset(placeId, assetId);
    if (asset.getModerationStatus() != PlaceMediaAsset.ModerationStatus.APPROVED
        || asset.getHealthStatus() != PlaceMediaAsset.HealthStatus.HEALTHY) {
      throw new PlaceActionException(
          HttpStatus.CONFLICT, "MEDIA_NOT_READY", "Only an approved healthy image can be primary");
    }
    setPrimaryInternal(place, asset);
    return response(asset);
  }

  public void delete(String placeId, String assetId) {
    Place place = requirePlace(placeId);
    PlaceMediaAsset asset = requireAsset(placeId, assetId);
    if (assetId.equals(place.getPrimaryMediaAssetId())) {
      throw new PlaceActionException(
          HttpStatus.CONFLICT, "PRIMARY_MEDIA_IN_USE", "Select another primary image first");
    }
    asset.setDeletedAt(Instant.now());
    assets.save(asset);
    bestEffortDelete(placeId, asset.getStoragePublicId());
  }

  public PlaceMediaAdminDtos.CoverageResponse coverage(
      PlaceMediaState state, String destinationId, int cursor, int limit) {
    if (cursor < 0 || limit < 1 || limit > 100) {
      throw new IllegalArgumentException("Invalid coverage cursor or limit");
    }
    Map<PlaceMediaState, Long> counts = new EnumMap<>(PlaceMediaState.class);
    for (PlaceMediaState value : PlaceMediaState.values()) {
      counts.put(value, places.countByMediaState(value));
    }
    List<Criteria> filters =
        new ArrayList<>(
            List.of(Criteria.where("mediaState").in(state == null ? ALL_STATES : List.of(state))));
    if (StringUtils.hasText(destinationId)) {
      Pattern target =
          Pattern.compile("^" + Pattern.quote(destinationId.trim()) + "$", Pattern.CASE_INSENSITIVE);
      filters.add(
          new Criteria()
              .orOperator(Criteria.where("city").regex(target), Criteria.where("district").regex(target)));
    }
    Query coverageQuery =
        Query.query(new Criteria().andOperator(filters.toArray(Criteria[]::new)))
            .skip((long) cursor * limit)
            .limit(limit + 1);
    List<Place> page = mongo.find(coverageQuery, Place.class);
    boolean hasMore = page.size() > limit;
    if (hasMore) page = page.subList(0, limit);
    List<PlaceMediaAdminDtos.CoverageItem> items =
        page.stream()
            .map(
                place ->
                    new PlaceMediaAdminDtos.CoverageItem(
                        place.getId(),
                        place.getName(),
                        place.getMediaState() == null ? PlaceMediaState.PENDING : place.getMediaState(),
                        place.getMediaStateReason()))
            .toList();
    return new PlaceMediaAdminDtos.CoverageResponse(
        counts, items, hasMore ? Integer.toString(cursor + 1) : null);
  }

  public PlaceMediaAdminDtos.BackfillJobResponse startBackfill(
      PlaceMediaAdminDtos.BackfillRequest request) {
    var existing = jobs.findByIdempotencyKey(request.idempotencyKey());
    if (existing.isPresent()) return response(existing.get());
    String creator = currentUser.userId().toString();
    List<Place> targets =
        findTargets(request.states(), request.destinationId(), request.effectiveLimit());
    PlaceMediaBackfillJob job =
        PlaceMediaBackfillJob.builder()
            .id("pmj_" + UUID.randomUUID())
            .idempotencyKey(request.idempotencyKey())
            .destinationId(request.destinationId())
            .states(request.states())
            .requestedLimit(request.effectiveLimit())
            .maxConcurrency(request.effectiveConcurrency())
            .dryRun(request.isDryRun())
            .status(
                request.isDryRun()
                    ? PlaceMediaBackfillJob.Status.COMPLETED
                    : PlaceMediaBackfillJob.Status.QUEUED)
            .total(targets.size())
            .processed(request.isDryRun() ? targets.size() : 0)
            .succeeded(0)
            .failed(0)
            .lastReasonCode(
                providerImportEnabled() ? null : "PROVIDER_PERSISTENCE_RIGHTS_NOT_APPROVED")
            .createdBy(creator)
            .build();
    try {
      job = jobs.save(job);
    } catch (org.springframework.dao.DuplicateKeyException exception) {
      return response(
          jobs.findByIdempotencyKey(request.idempotencyKey())
              .orElseThrow(() -> exception));
    }
    if (!request.isDryRun()) {
      PlaceMediaBackfillJob queued = job;
      try {
        jobExecutor.execute(() -> runBackfill(queued.getId(), targets, creator));
      } catch (RejectedExecutionException exception) {
        queued.setStatus(PlaceMediaBackfillJob.Status.FAILED);
        queued.setLastReasonCode("MEDIA_JOB_QUEUE_FULL");
        jobs.save(queued);
      }
    }
    return response(job);
  }

  public PlaceMediaAdminDtos.BackfillJobResponse getBackfill(String jobId) {
    return response(
        jobs.findById(jobId)
            .orElseThrow(
                () ->
                    new PlaceActionException(
                        HttpStatus.NOT_FOUND, "MEDIA_JOB_NOT_FOUND", "Media job was not found")));
  }

  private void runBackfill(String jobId, List<Place> targets, String creator) {
    PlaceMediaBackfillJob job = jobs.findById(jobId).orElse(null);
    if (job == null) return;
    job.setStatus(PlaceMediaBackfillJob.Status.RUNNING);
    jobs.save(job);
    int concurrency = Math.max(1, Math.min(3, job.getMaxConcurrency()));
    for (int offset = 0; offset < targets.size(); offset += concurrency) {
      int end = Math.min(targets.size(), offset + concurrency);
      List<Future<BackfillResult>> batch = new ArrayList<>();
      for (Place place : targets.subList(offset, end)) {
        try {
          batch.add(workerExecutor.submit(() -> importForBackfill(place, creator)));
        } catch (RejectedExecutionException exception) {
          batch.add(java.util.concurrent.CompletableFuture.completedFuture(
              new BackfillResult(false, "MEDIA_WORKER_QUEUE_FULL")));
        }
      }
      for (Future<BackfillResult> future : batch) {
        BackfillResult result;
        try {
          result = future.get();
        } catch (InterruptedException exception) {
          Thread.currentThread().interrupt();
          job.setStatus(PlaceMediaBackfillJob.Status.FAILED);
          job.setLastReasonCode("MEDIA_JOB_INTERRUPTED");
          jobs.save(job);
          return;
        } catch (ExecutionException exception) {
          result = new BackfillResult(false, "MEDIA_IMPORT_FAILED");
        }
        if (result.success()) {
          job.setSucceeded(job.getSucceeded() + 1);
          job.setLastReasonCode(null);
        } else {
          job.setFailed(job.getFailed() + 1);
          job.setLastReasonCode(result.reasonCode());
        }
        job.setProcessed(job.getProcessed() + 1);
      }
      jobs.save(job);
    }
    job.setStatus(PlaceMediaBackfillJob.Status.COMPLETED);
    jobs.save(job);
  }

  private BackfillResult importForBackfill(Place place, String creator) {
    try {
      importProviderPhoto(place, creator);
      return new BackfillResult(true, null);
    } catch (Exception exception) {
      String reason = reasonCode(exception);
      updatePlaceState(place.getId(), stateForFailure(exception), reason);
      return new BackfillResult(false, reason);
    }
  }

  private void importProviderPhoto(Place place, String creator) {
    if (!providerImportEnabled()) {
      throw new RightsNotApprovedException();
    }
    if (!provider.getProviderName().equalsIgnoreCase(place.getProvider())
        || !StringUtils.hasText(place.getProviderPlaceId())) {
      throw new IllegalStateException("NO_PROVIDER_REFERENCE");
    }
    List<PlacePhotoDto> gallery = provider.getPhotoGallery(place.getProviderPlaceId(), 1);
    PlacePhotoDto photo =
        gallery.stream()
            .filter(value -> value != null && value.displayApproved() && StringUtils.hasText(value.url()))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("NO_APPROVED_PROVIDER_PHOTO"));
    String assetId = "pm_" + UUID.randomUUID();
    PlaceMediaStorage.StoredMedia stored =
        storage.importProviderUrl(place.getId(), assetId, photo.url());
    PlaceMediaAsset asset =
        PlaceMediaAsset.builder()
            .id(assetId)
            .placeId(place.getId())
            .storageProvider(PlaceMediaAsset.StorageProvider.CLOUDINARY)
            .storagePublicId(stored.publicId())
            .sourceType(PlaceMediaAsset.SourceType.LICENSED_PROVIDER_IMPORT)
            .sourceProvider(provider.getProviderName())
            .sourceReferenceHash(sha256(photo.url()))
            .licenseType(PlaceMediaAsset.LicenseType.PROVIDER_PERSISTENCE_ALLOWED)
            .licenseEvidenceUrl(providerLicenseEvidenceUrl)
            .attribution(
                photo.attribution() == null
                    ? List.of()
                    : photo.attribution().stream()
                        .map(value -> new PlaceMediaAsset.Attribution(value.displayName(), value.uri()))
                        .toList())
            .checksumSha256(stored.checksumSha256())
            .mimeType(stored.mimeType())
            .byteSize(stored.byteSize())
            .width(stored.width())
            .height(stored.height())
            .moderationStatus(PlaceMediaAsset.ModerationStatus.APPROVED)
            .healthStatus(PlaceMediaAsset.HealthStatus.HEALTHY)
            .verifiedAt(Instant.now())
            .createdBy(creator)
            .build();
    try {
      rejectDuplicate(stored.checksumSha256());
      asset = assets.save(asset);
      setPrimaryInternal(place, asset);
    } catch (org.springframework.dao.DuplicateKeyException exception) {
      bestEffortDelete(place.getId(), stored.publicId());
      throw new PlaceActionException(
          HttpStatus.CONFLICT, "DUPLICATE_MEDIA", "This image is already stored");
    } catch (RuntimeException exception) {
      bestEffortDelete(place.getId(), stored.publicId());
      throw exception;
    }
  }

  private void setPrimaryInternal(Place place, PlaceMediaAsset asset) {
    long expectedVersion = place.getMediaVersion() == null ? 0 : place.getMediaVersion();
    Query query =
        Query.query(
            Criteria.where("_id")
                .is(place.getId())
                .and("mediaVersion")
                .in(expectedVersion, null));
    Update update =
        new Update()
            .set("primaryMediaAssetId", asset.getId())
            .set("mediaState", PlaceMediaState.READY)
            .set("mediaStateReason", null)
            .set("mediaLastVerifiedAt", Instant.now())
            .inc("mediaVersion", 1);
    Place updated =
        mongo.findAndModify(query, update, FindAndModifyOptions.options().returnNew(true), Place.class);
    if (updated == null) {
      throw new PlaceActionException(
          HttpStatus.CONFLICT,
          "MEDIA_CONCURRENT_UPDATE",
          "Place media changed concurrently; reload and retry");
    }
  }

  private void updatePlaceState(String placeId, PlaceMediaState state, String reason) {
    mongo.updateFirst(
        Query.query(Criteria.where("_id").is(placeId)),
        new Update()
            .set("mediaState", state)
            .set("mediaStateReason", reason)
            .set("mediaLastVerifiedAt", Instant.now()),
        Place.class);
  }

  private List<Place> findTargets(
      List<PlaceMediaState> states, String destinationId, int limit) {
    List<Criteria> filters =
        new ArrayList<>(List.of(Criteria.where("mediaState").in(states)));
    if (StringUtils.hasText(destinationId)) {
      Pattern target =
          Pattern.compile("^" + Pattern.quote(destinationId.trim()) + "$", Pattern.CASE_INSENSITIVE);
      filters.add(
          new Criteria()
              .orOperator(Criteria.where("city").regex(target), Criteria.where("district").regex(target)));
    }
    return mongo.find(
        Query.query(new Criteria().andOperator(filters.toArray(Criteria[]::new))).limit(limit),
        Place.class);
  }

  private Place requirePlace(String placeId) {
    return places.findById(placeId)
        .orElseThrow(
            () ->
                new PlaceActionException(
                    HttpStatus.NOT_FOUND, "PLACE_NOT_FOUND", "Place was not found"));
  }

  private PlaceMediaAsset requireAsset(String placeId, String assetId) {
    return assets.findByIdAndPlaceIdAndDeletedAtIsNull(assetId, placeId)
        .orElseThrow(
            () ->
                new PlaceActionException(
                    HttpStatus.NOT_FOUND, "MEDIA_NOT_FOUND", "Place image was not found"));
  }

  private void rejectDuplicate(String checksum) {
    if (assets.findByChecksumSha256AndDeletedAtIsNull(checksum).isPresent()) {
      throw new PlaceActionException(
          HttpStatus.CONFLICT, "DUPLICATE_MEDIA", "This image is already stored");
    }
  }

  private void validateRights(
      PlaceMediaAsset.SourceType sourceType,
      PlaceMediaAsset.LicenseType licenseType,
      String evidenceUrl) {
    if (sourceType == null || licenseType == null) {
      throw new IllegalArgumentException("Media source and license are required");
    }
    if (sourceType == PlaceMediaAsset.SourceType.LICENSED_PROVIDER_IMPORT
        && (licenseType != PlaceMediaAsset.LicenseType.PROVIDER_PERSISTENCE_ALLOWED
            || !providerImportEnabled())) {
      throw new PlaceActionException(
          HttpStatus.CONFLICT,
          "MEDIA_RIGHTS_NOT_APPROVED",
          "Provider image persistence rights are not approved");
    }
    if (licenseType != PlaceMediaAsset.LicenseType.OWNED) normalizeHttpsUrl(evidenceUrl, true);
  }

  private boolean providerImportEnabled() {
    if (!providerPersistenceApproved || !storage.configured()) return false;
    try {
      return StringUtils.hasText(normalizeHttpsUrl(providerLicenseEvidenceUrl, false));
    } catch (IllegalArgumentException invalidConfiguration) {
      return false;
    }
  }

  private String normalizeHttpsUrl(String value, boolean required) {
    if (!StringUtils.hasText(value)) {
      if (required) throw new IllegalArgumentException("License evidence URL is required");
      return null;
    }
    try {
      URI uri = URI.create(value.trim());
      if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) {
        throw new IllegalArgumentException("License evidence must be a safe HTTPS URL");
      }
      return uri.toString();
    } catch (IllegalArgumentException exception) {
      throw new IllegalArgumentException("License evidence must be a safe HTTPS URL", exception);
    }
  }

  private List<PlaceMediaAsset.Attribution> attribution(String label, String url) {
    if (!StringUtils.hasText(label) && !StringUtils.hasText(url)) return List.of();
    return List.of(
        new PlaceMediaAsset.Attribution(
            StringUtils.hasText(label) ? label.trim() : "Source",
            normalizeHttpsUrl(url, true)));
  }

  private PlaceMediaAdminDtos.AssetAdminResponse response(PlaceMediaAsset asset) {
    return new PlaceMediaAdminDtos.AssetAdminResponse(
        asset.getId(),
        asset.getPlaceId(),
        asset.getModerationStatus(),
        asset.getHealthStatus(),
        storage.deliveryUrl(asset.getStoragePublicId()));
  }

  private PlaceMediaAdminDtos.BackfillJobResponse response(PlaceMediaBackfillJob job) {
    return new PlaceMediaAdminDtos.BackfillJobResponse(
        job.getId(),
        job.getStatus(),
        job.isDryRun(),
        safe(job.getTotal()),
        safe(job.getProcessed()),
        safe(job.getSucceeded()),
        safe(job.getFailed()),
        job.getLastReasonCode());
  }

  private int safe(Integer value) {
    return value == null ? 0 : value;
  }

  private String sha256(String value) {
    try {
      return java.util.HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256")
                  .digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception exception) {
      throw new IllegalStateException("Unable to fingerprint provider reference", exception);
    }
  }

  private String reasonCode(Exception exception) {
    if (exception instanceof RightsNotApprovedException) return "PROVIDER_PERSISTENCE_RIGHTS_NOT_APPROVED";
    String message = exception.getMessage();
    if (message != null && message.matches("[A-Z0-9_]{2,64}")) return message;
    return "MEDIA_IMPORT_FAILED";
  }

  private PlaceMediaState stateForFailure(Exception exception) {
    if (exception instanceof RightsNotApprovedException) return PlaceMediaState.RIGHTS_BLOCKED;
    if ("NO_APPROVED_PROVIDER_PHOTO".equals(exception.getMessage())) return PlaceMediaState.UNAVAILABLE;
    return PlaceMediaState.DEGRADED;
  }

  private void bestEffortDelete(String placeId, String publicId) {
    try {
      storage.delete(placeId, publicId);
    } catch (RuntimeException exception) {
      log.warn("Place media cleanup failed placeId={} type={}", placeId, exception.getClass().getSimpleName());
    }
  }

  private static final class RightsNotApprovedException extends RuntimeException {}

  private record BackfillResult(boolean success, String reasonCode) {}
}
