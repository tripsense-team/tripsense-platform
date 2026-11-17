package fu.tripsense.placeservice.service.impl;

import fu.tripsense.placeservice.client.RecommendationIndexerClient;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.dto.PlacePhotoDto;
import fu.tripsense.placeservice.providers.PlaceEnrichmentProvider;
import fu.tripsense.placeservice.providers.PlaceProvider;
import fu.tripsense.placeservice.providers.PlaceProviderException;
import fu.tripsense.placeservice.service.PlaceCacheService;
import fu.tripsense.placeservice.service.PlaceDetailsService;
import fu.tripsense.placeservice.service.PlacePersistenceService;
import fu.tripsense.placeservice.service.PlaceCloudinaryStorageService;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Slf4j
@Service
public class PlaceDetailsServiceImpl implements PlaceDetailsService {
  private static final Duration PHOTO_URL_TTL = Duration.ofMinutes(5);

  private static final Duration REFRESH_AFTER = Duration.ofDays(14);
  private static final int DEFAULT_LAZY_PHOTO_LIMIT = 3;
  private static final int PHOTO_LOCK_STRIPES = 128;

  private final PlaceRepository repository;
  private final PlaceProvider provider;
  private final PlaceEnrichmentProvider enrichmentProvider;
  private final PlaceCacheService cache;
  private final PlacePersistenceService persistence;
  private final RecommendationIndexerClient recommendationIndexerClient;
  private final PlaceCloudinaryStorageService cloudinaryStorageService;
  private final int lazyPhotoLimit;
  private final Object[] photoHealLocks = createLockStripes();
  private final ExecutorService snapshotPhotoExecutor =
      Executors.newFixedThreadPool(
          4,
          runnable -> {
            Thread thread = new Thread(runnable, "snapshot-photo-");
            thread.setDaemon(true);
            return thread;
          });

  @PreDestroy
  public void shutdownSnapshotExecutor() {
    snapshotPhotoExecutor.shutdown();
    try {
      if (!snapshotPhotoExecutor.awaitTermination(2, TimeUnit.SECONDS)) {
        snapshotPhotoExecutor.shutdownNow();
      }
    } catch (InterruptedException ex) {
      snapshotPhotoExecutor.shutdownNow();
      Thread.currentThread().interrupt();
    }
  }

  public PlaceDetailsServiceImpl(
      PlaceRepository repository,
      PlaceProvider provider,
      PlaceEnrichmentProvider enrichmentProvider,
      PlaceCacheService cache,
      PlacePersistenceService persistence) {
    this(repository, provider, enrichmentProvider, cache, persistence, null, null);
  }

  public PlaceDetailsServiceImpl(
      PlaceRepository repository,
      PlaceProvider provider,
      PlaceEnrichmentProvider enrichmentProvider,
      PlaceCacheService cache,
      PlacePersistenceService persistence,
      RecommendationIndexerClient recommendationIndexerClient) {
    this(repository, provider, enrichmentProvider, cache, persistence, recommendationIndexerClient, null);
  }

  public PlaceDetailsServiceImpl(
      PlaceRepository repository,
      PlaceProvider provider,
      PlaceEnrichmentProvider enrichmentProvider,
      PlaceCacheService cache,
      PlacePersistenceService persistence,
      RecommendationIndexerClient recommendationIndexerClient,
      PlaceCloudinaryStorageService cloudinaryStorageService) {
    this(
        repository,
        provider,
        enrichmentProvider,
        cache,
        persistence,
        recommendationIndexerClient,
        cloudinaryStorageService,
        DEFAULT_LAZY_PHOTO_LIMIT);
  }

  @Autowired
  public PlaceDetailsServiceImpl(
      PlaceRepository repository,
      PlaceProvider provider,
      PlaceEnrichmentProvider enrichmentProvider,
      PlaceCacheService cache,
      PlacePersistenceService persistence,
      @Autowired(required = false) RecommendationIndexerClient recommendationIndexerClient,
      @Autowired(required = false) PlaceCloudinaryStorageService cloudinaryStorageService,
      @Value("${tripsense.places.lazy-photo-limit:3}") int lazyPhotoLimit) {
    this.repository = repository;
    this.provider = provider;
    this.enrichmentProvider = enrichmentProvider;
    this.cache = cache;
    this.persistence = persistence;
    this.recommendationIndexerClient = recommendationIndexerClient;
    this.cloudinaryStorageService = cloudinaryStorageService;
    this.lazyPhotoLimit = Math.max(1, Math.min(lazyPhotoLimit, 5));
  }

  private static Object[] createLockStripes() {
    Object[] stripes = new Object[PHOTO_LOCK_STRIPES];
    for (int i = 0; i < stripes.length; i++) {
      stripes[i] = new Object();
    }
    return stripes;
  }

  @Override
  public Optional<PlaceDto> getDetails(
      String id, String fallbackName, Double fallbackLat, Double fallbackLng) {
    return getDetails(id, fallbackName, fallbackLat, fallbackLng, false);
  }

  @Override
  public Optional<PlaceDto> getDetails(
      String id,
      String fallbackName,
      Double fallbackLat,
      Double fallbackLng,
      boolean includePhoto) {
    Optional<PlaceDto> result = getDetailsWithoutPhoto(id, fallbackName, fallbackLat, fallbackLng);
    Optional<PlaceDto> finalResult;
    if (!includePhoto) {
      finalResult = result;
    } else {
      finalResult =
          result.map(
              base -> {
                PlaceDto place = new PlaceDto();
                BeanUtils.copyProperties(base, place);

                // Photos are fresh if:
                // 1) They are permanent Cloudinary URLs (never expire), OR
                // 2) They are approved provider URLs within valid PHOTO_URL_TTL
                boolean hasPermanentPhotos =
                    base.getPhotos() != null
                        && !base.getPhotos().isEmpty()
                        && base.getPhotos().stream()
                            .anyMatch(PlaceCloudinaryStorageService::isPermanentCloudinaryUrl);

                if (hasPermanentPhotos && base.getPhotos() != null && !base.getPhotos().isEmpty()) {
                  List<PlacePhotoDto> existingGallery =
                      base.getPhotos().stream()
                          .filter(PlaceCloudinaryStorageService::isPermanentCloudinaryUrl)
                          .map(
                              url ->
                                  new PlacePhotoDto(
                                      url,
                                      "cloudinary",
                                      List.of(),
                                      base.getFetchedAt() != null
                                          ? base.getFetchedAt()
                                          : Instant.now(),
                                      true))
                          .toList();
                  if (!existingGallery.isEmpty()) {
                    place.setPhotos(existingGallery.stream().map(PlacePhotoDto::url).toList());
                    place.setPhotoGallery(existingGallery);
                    place.setPrimaryPhoto(existingGallery.get(0));
                    return place;
                  }
                }

                // Provider media URLs are short-lived. Reuse only evidence that is still inside
                // the bounded photo TTL; never mint a new fetchedAt timestamp for a stored URL.
                List<PlacePhotoDto> existingGallery = freshPhotoGallery(base, Instant.now());
                if (!existingGallery.isEmpty()) {
                  place.setPhotoGallery(existingGallery);
                  place.setPrimaryPhoto(existingGallery.get(0));
                  return place;
                }

                // Do not return expired persisted URLs while a refresh is attempted. If the
                // provider is unavailable, the truthful result is an empty gallery rather than a
                // browser-visible broken image.
                place.setPhotos(new ArrayList<>());
                place.setPrimaryPhoto(null);
                place.setPhotoGallery(null);
                if (StringUtils.hasText(place.getProvider())
                    && place.getProvider().equalsIgnoreCase(provider.getProviderName())
                    && StringUtils.hasText(place.getProviderPlaceId())) {
                  healPhotosWithSingleFlight(place, base.getFetchedAt());
                }
                return place;
              });
    }

    finalResult.ifPresent(this::triggerRecommendationIndexing);
    return finalResult;
  }

  private void healPhotosWithSingleFlight(PlaceDto place, Instant fallbackFetchedAt) {
    String lockKey =
        StringUtils.hasText(place.getProviderPlaceId()) ? place.getProviderPlaceId() : place.getId();
    Object lock =
        photoHealLocks[Math.floorMod(lockKey != null ? lockKey.hashCode() : 0, PHOTO_LOCK_STRIPES)];

    synchronized (lock) {
      // Re-check persisted Cloudinary URLs so concurrent callers reuse a just-completed upload.
      List<String> storedCloudinaryUrls = loadStoredCloudinaryUrls(place);
      if (!storedCloudinaryUrls.isEmpty()) {
        applyCloudinaryGallery(place, storedCloudinaryUrls, fallbackFetchedAt);
        cacheDetails(place.getId(), place);
        if (StringUtils.hasText(place.getProviderPlaceId())) {
          cacheDetails(place.getProviderPlaceId(), place);
        }
        return;
      }

      var rawGallery = provider.getPhotoGallery(place.getProviderPlaceId(), lazyPhotoLimit);
      if (rawGallery.isEmpty()) {
        return;
      }

      List<PlacePhotoDto> permanentGallery = new ArrayList<>();
      List<String> permanentUrls = new ArrayList<>();

      for (int i = 0; i < rawGallery.size(); i++) {
        PlacePhotoDto rawPhoto = rawGallery.get(i);
        String rawUrl = rawPhoto.url();
        if (!StringUtils.hasText(rawUrl)) {
          continue;
        }
        if (cloudinaryStorageService != null) {
          Optional<String> permanentOpt =
              cloudinaryStorageService.uploadRemotePhoto(rawUrl, place.getProviderPlaceId(), i);
          if (permanentOpt.isPresent()) {
            String finalUrl = permanentOpt.get();
            permanentUrls.add(finalUrl);
            permanentGallery.add(
                new PlacePhotoDto(
                    finalUrl,
                    "cloudinary",
                    rawPhoto.attribution(),
                    rawPhoto.fetchedAt(),
                    rawPhoto.displayApproved()));
          }
        } else {
          permanentUrls.add(rawUrl);
          permanentGallery.add(
              new PlacePhotoDto(
                  rawUrl,
                  rawPhoto.source(),
                  rawPhoto.attribution(),
                  rawPhoto.fetchedAt(),
                  rawPhoto.displayApproved()));
        }
      }

      if (!permanentGallery.isEmpty()) {
        place.setPhotoGallery(permanentGallery);
        place.setPrimaryPhoto(permanentGallery.get(0));
        place.setPhotos(new ArrayList<>(permanentUrls));
        persistPhotoUrls(place, permanentUrls);
      }
    }
  }

  private List<String> loadStoredCloudinaryUrls(PlaceDto place) {
    Optional<Place> stored = findStoredPlace(place);
    if (stored.isEmpty() || stored.get().getPhotos() == null) {
      return List.of();
    }
    return stored.get().getPhotos().stream()
        .filter(PlaceCloudinaryStorageService::isPermanentCloudinaryUrl)
        .toList();
  }

  private Optional<Place> findStoredPlace(PlaceDto place) {
    if (place == null) {
      return Optional.empty();
    }
    Optional<Place> stored = Optional.empty();
    if (StringUtils.hasText(place.getId())) {
      stored = repository.findById(place.getId());
    }
    if (stored.isEmpty()
        && StringUtils.hasText(place.getProvider())
        && StringUtils.hasText(place.getProviderPlaceId())) {
      stored =
          repository.findByProviderAndProviderPlaceId(
              place.getProvider(), place.getProviderPlaceId());
    }
    return stored;
  }

  private void applyCloudinaryGallery(
      PlaceDto place, List<String> cloudinaryUrls, Instant fetchedAt) {
    Instant effectiveFetchedAt = fetchedAt != null ? fetchedAt : Instant.now();
    List<PlacePhotoDto> gallery =
        cloudinaryUrls.stream()
            .map(url -> new PlacePhotoDto(url, "cloudinary", List.of(), effectiveFetchedAt, true))
            .toList();
    place.setPhotos(new ArrayList<>(cloudinaryUrls));
    place.setPhotoGallery(gallery);
    place.setPrimaryPhoto(gallery.get(0));
  }

  private List<PlacePhotoDto> freshPhotoGallery(PlaceDto place, Instant now) {
    List<PlacePhotoDto> gallery =
        place.getPhotoGallery() != null && !place.getPhotoGallery().isEmpty()
            ? place.getPhotoGallery()
            : place.getPrimaryPhoto() != null ? List.of(place.getPrimaryPhoto()) : List.of();
    return gallery.stream()
        .filter(photo -> photo != null && StringUtils.hasText(photo.url()))
        .filter(photo -> photo.displayApproved() && photo.fetchedAt() != null)
        .filter(
            photo ->
                !photo.fetchedAt().isAfter(now)
                    && photo.fetchedAt().isAfter(now.minus(PHOTO_URL_TTL)))
        .limit(5)
        .toList();
  }

  private void triggerRecommendationIndexing(PlaceDto place) {
    if (recommendationIndexerClient != null && place != null) {
      recommendationIndexerClient.triggerIndexingAsync(List.of(place));
    }
  }

  private void persistPhotoUrls(PlaceDto place, List<String> photoUrls) {
    try {
      Optional<Place> stored = findStoredPlace(place);
      if (stored.isPresent()) {
        Place entity = stored.get();
        entity.setPhotos(new ArrayList<>(photoUrls));
        entity.setLastFetchedAt(Instant.now());
        repository.save(entity);
      }
      cacheDetails(place.getId(), place);
      if (StringUtils.hasText(place.getProviderPlaceId())) {
        cacheDetails(place.getProviderPlaceId(), place);
      }
    } catch (Exception ex) {
      log.warn("Failed to persist photo URLs for place '{}': {}", place.getId(), ex.getMessage());
    }
  }

  private Optional<PlaceDto> getDetailsWithoutPhoto(
      String id, String fallbackName, Double fallbackLat, Double fallbackLng) {
    if (!StringUtils.hasText(id)) {
      return Optional.empty();
    }

    Optional<PlaceDto> cached = cache.getPlaceDetails(id);
    if (cached.filter(this::hasCompleteDetails).isPresent()) {
      return cached;
    }

    try {
      Optional<Place> stored =
          repository
              .findById(id)
              .or(
                  () ->
                      repository.findByProviderAndProviderPlaceId(provider.getProviderName(), id));
      if (stored.isPresent()) {
        if (stored.get().getLifecycleStatus()
            == fu.tripsense.placeservice.domain.model.PlaceLifecycleStatus.ARCHIVED) {
          return Optional.empty();
        }
        return Optional.of(refreshIfNeeded(stored.get(), fallbackLat, fallbackLng));
      }
    } catch (Exception ex) {
      log.warn("Failed to query place details from MongoDB for id '{}': {}", id, ex.getMessage());
    }

    Optional<PlaceDto> providerDetails = Optional.empty();
    if (!id.startsWith("poi_")) {
      try {
        providerDetails = provider.getPlaceDetails(id);
      } catch (Exception ex) {
        log.debug("Direct place details lookup failed for id '{}': {}", id, ex.getMessage());
      }
    }

    if (providerDetails.isEmpty() && StringUtils.hasText(fallbackName)) {
      try {
        Optional<PlaceDto> found =
            provider.textSearch(fallbackName, fallbackLat, fallbackLng, 5000, 1).stream()
                .findFirst();
        if (found.isPresent()) {
          String zioId = found.get().getProviderPlaceId();
          if (StringUtils.hasText(zioId) && !zioId.startsWith("poi_")) {
            try {
              Optional<PlaceDto> deep = provider.getPlaceDetails(zioId);
              providerDetails = deep.isPresent() ? deep : found;
            } catch (Exception ex) {
              providerDetails = found;
            }
          } else {
            providerDetails = found;
          }
        }
      } catch (Exception ex) {
        log.warn(
            "Failed to find fallback place details for '{}': {}", fallbackName, ex.getMessage());
      }
    }
    if (providerDetails.isEmpty()) {
      return Optional.empty();
    }

    PlaceDto saved =
        persistence.upsertProviderPlace(providerDetails.get(), provider.getProviderName());
    Place entity = null;
    if (saved != null && StringUtils.hasText(saved.getId())) {
      try {
        entity = repository.findById(saved.getId()).orElse(null);
      } catch (Exception ex) {
        log.warn("Failed to query saved place from MongoDB: {}", ex.getMessage());
      }
    }
    PlaceDto result = entity == null ? saved : refreshIfNeeded(entity, fallbackLat, fallbackLng);
    cacheDetails(id, result);
    return Optional.ofNullable(result);
  }

  @Override
  public List<PlaceDto> getSnapshots(List<String> ids) {
    return getSnapshots(ids, false);
  }

  @Override
  public List<PlaceDto> getSnapshots(List<String> ids, boolean includePhoto) {
    if (ids == null || ids.isEmpty()) {
      return List.of();
    }
    List<String> sanitized =
        ids.stream().filter(StringUtils::hasText).distinct().limit(100).toList();
    if (sanitized.isEmpty()) {
      return List.of();
    }
    List<Place> stored = new ArrayList<>(repository.findAllById(sanitized));
    Set<String> foundIds = stored.stream().map(Place::getId).collect(Collectors.toSet());
    List<String> missing = sanitized.stream().filter(id -> !foundIds.contains(id)).toList();
    if (!missing.isEmpty()) {
      stored.addAll(repository.findByProviderPlaceIdIn(missing));
    }
    List<PlaceDto> baseSnapshots =
        stored.stream()
            .filter(
                place ->
                    place.getLifecycleStatus()
                        != fu.tripsense.placeservice.domain.model.PlaceLifecycleStatus.ARCHIVED)
            .map(persistence::toDto)
            .toList();
    if (!includePhoto || baseSnapshots.isEmpty()) {
      return baseSnapshots;
    }

    int maxHydrate = 12;
    List<CompletableFuture<PlaceDto>> futures = new ArrayList<>(baseSnapshots.size());
    int hydratedRequests = 0;
    for (PlaceDto snapshot : baseSnapshots) {
      if (hasUsablePhoto(snapshot) || hydratedRequests >= maxHydrate) {
        futures.add(CompletableFuture.completedFuture(snapshot));
        continue;
      }
      hydratedRequests++;
      futures.add(
          CompletableFuture.supplyAsync(
                  () -> {
                    Double lat =
                        snapshot.getLocation() != null ? snapshot.getLocation().getLat() : null;
                    Double lng =
                        snapshot.getLocation() != null ? snapshot.getLocation().getLng() : null;
                    return getDetails(snapshot.getId(), snapshot.getName(), lat, lng, true)
                        .orElse(snapshot);
                  },
                  snapshotPhotoExecutor)
              .orTimeout(4, TimeUnit.SECONDS)
              .exceptionally(ex -> snapshot));
    }

    return futures.stream().map(CompletableFuture::join).toList();
  }

  private boolean hasUsablePhoto(PlaceDto place) {
    if (place == null) {
      return false;
    }
    if (place.getMedia() != null
        && "READY".equals(place.getMedia().state())
        && place.getMedia().primary() != null
        && StringUtils.hasText(place.getMedia().primary().url())) {
      return true;
    }
    if (place.getPrimaryPhoto() != null && StringUtils.hasText(place.getPrimaryPhoto().url())) {
      return true;
    }
    if (place.getPhotos() != null
        && place.getPhotos().stream()
            .anyMatch(PlaceCloudinaryStorageService::isPermanentCloudinaryUrl)) {
      return true;
    }
    return !freshPhotoGallery(place, Instant.now()).isEmpty();
  }

  private PlaceDto refreshIfNeeded(Place place, Double fallbackLat, Double fallbackLng) {
    PlaceDto current = persistence.toDto(place);
    if (!isStale(place) && hasDeepDetails(place)) {
      cacheDetails(place.getId(), current);
      return current;
    }

    Double lat =
        place.getLocation() == null ? fallbackLat : Double.valueOf(place.getLocation().getY());
    Double lng =
        place.getLocation() == null ? fallbackLng : Double.valueOf(place.getLocation().getX());
    try {
      if (StringUtils.hasText(place.getProviderPlaceId())
          && !place.getProviderPlaceId().startsWith("poi_")) {
        try {
          Optional<PlaceDto> deep = provider.getPlaceDetails(place.getProviderPlaceId());
          if (deep.isPresent()) {
            PlaceDto refreshed = persistence.enrichExistingPlace(place, deep.get());
            cacheDetails(place.getId(), refreshed);
            return refreshed;
          }
        } catch (Exception ex) {
          log.warn(
              "Provider place details lookup failed for place '{}' ({}): {}",
              place.getId(),
              place.getProviderPlaceId(),
              ex.getMessage());
        }
      }
      Optional<PlaceDto> enrichment = enrichmentProvider.enrichPlace(place.getName(), lat, lng);
      if (enrichment.isPresent()) {
        PlaceDto refreshed = persistence.enrichExistingPlace(place, enrichment.get());
        cacheDetails(place.getId(), refreshed);
        return refreshed;
      }
    } catch (PlaceProviderException exception) {
      log.warn(
          "Provider enrichment unavailable for place '{}'; serving stored details", place.getId());
    }

    cacheDetails(place.getId(), current);
    return current;
  }

  private boolean hasDeepDetails(Place place) {
    if (place.getReviews() != null && !place.getReviews().isEmpty()) {
      return true;
    }
    if (place.getSourceData() != null
        && Boolean.TRUE.equals(place.getSourceData().get("deepDetailsFetched"))) {
      return true;
    }
    return false;
  }

  private boolean hasCompleteDetails(PlaceDto place) {
    return place.getReviews() != null
        && !place.getReviews().isEmpty()
        && StringUtils.hasText(place.getOpeningHours())
        && (StringUtils.hasText(place.getPhone()) || StringUtils.hasText(place.getWebsite()));
  }

  private boolean isStale(Place place) {
    return place.getLastFetchedAt() == null
        || Instant.now().isAfter(place.getLastFetchedAt().plus(REFRESH_AFTER));
  }

  private void cacheDetails(String requestedId, PlaceDto place) {
    cache.putPlaceDetails(requestedId, place);
    if (StringUtils.hasText(place.getId()) && !place.getId().equals(requestedId)) {
      cache.putPlaceDetails(place.getId(), place);
    }
  }
}
