package fu.tripsense.placeservice.service.impl;

import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.AutocompleteSuggestionDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.dto.PlacePhotoDto;
import fu.tripsense.placeservice.dto.PlaceRecommendationRequest;
import fu.tripsense.placeservice.dto.PlaceRecommendationResult;
import fu.tripsense.placeservice.dto.RetrievalEvidenceDto;
import fu.tripsense.placeservice.providers.PlaceProvider;
import fu.tripsense.placeservice.providers.PlaceProviderException;
import fu.tripsense.placeservice.service.PlaceCacheService;
import fu.tripsense.placeservice.service.PlacePersistenceService;
import fu.tripsense.placeservice.service.PlaceRankingService;
import fu.tripsense.placeservice.service.PlaceSearchService;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.Metrics;
import org.springframework.data.geo.Point;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Slf4j
@Service
public class PlaceSearchServiceImpl implements PlaceSearchService {

  private static final Duration REFRESH_AFTER = Duration.ofDays(30);

  private final PlaceRepository repository;
  private final PlaceProvider provider;
  private final PlaceCacheService cache;
  private final PlaceRankingService ranking;
  private final PlacePersistenceService persistence;
  private final TripSensePlaceProperties properties;

  public PlaceSearchServiceImpl(
      PlaceRepository repository,
      PlaceProvider provider,
      PlaceCacheService cache,
      PlaceRankingService ranking,
      PlacePersistenceService persistence,
      TripSensePlaceProperties properties) {
    this.repository = repository;
    this.provider = provider;
    this.cache = cache;
    this.ranking = ranking;
    this.persistence = persistence;
    this.properties = properties;
  }

  @Override
  public List<PlaceDto> searchPlaces(
      String query, Double lat, Double lng, Integer radius, Integer limit) {
    if (!StringUtils.hasText(query)) return Collections.emptyList();

    String normalizedQuery = query.trim().toLowerCase(Locale.ROOT);
    double effectiveLat = lat != null ? lat : properties.getDefaultLat();
    double effectiveLng = lng != null ? lng : properties.getDefaultLng();
    int effectiveRadius = radius != null ? radius : 15_000;
    int effectiveLimit = limit != null ? Math.min(limit, 50) : 20;

    Optional<List<PlaceDto>> cached =
        cache.getSearchResults(
            normalizedQuery, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit);
    if (cached.isPresent() && !cached.get().isEmpty()) {
      List<PlaceDto> rankedCached = ranking.rank(cached.get(), query, effectiveLat, effectiveLng);
      if (!rankedCached.isEmpty()) {
        return enrichPhotosForPlaces(rankedCached);
      }
    }

    int candidateFetchLimit = Math.max(effectiveLimit * 3, 50);
    List<Place> localEntities = findLocalPlaces(normalizedQuery, candidateFetchLimit);
    List<PlaceDto> rankedLocal =
        ranking.rank(
            localEntities.stream().map(persistence::toDto).toList(),
            query,
            effectiveLat,
            effectiveLng);
    if (rankedLocal.size() > effectiveLimit) {
      rankedLocal = new ArrayList<>(rankedLocal.subList(0, effectiveLimit));
    }

    boolean isSpecificQuery =
        !isBroadCategory(normalizedQuery)
            && !normalizedQuery.equals("đà nẵng")
            && !normalizedQuery.equals("da nang")
            && !normalizedQuery.equals("tất cả")
            && !normalizedQuery.equals("địa điểm nổi tiếng ở đà nẵng");

    // For specific queries, check if the top local result actually contains the query in its name
    boolean hasStrongLocalMatch =
        !rankedLocal.isEmpty()
            && rankedLocal.stream()
                .anyMatch(
                    p -> {
                      if (p.getName() == null) return false;
                      String nameLower = p.getName().toLowerCase(Locale.ROOT);
                      return nameLower.contains(normalizedQuery)
                          || normalizedQuery.contains(nameLower);
                    });

    boolean localIsFreshAndSufficient =
        localEntities.stream().noneMatch(this::isPlaceStale)
            && (isSpecificQuery
                ? hasStrongLocalMatch
                : rankedLocal.size() >= properties.getSearch().getMinLocalResults());

    if (localIsFreshAndSufficient) {
      cache.putSearchResults(
          normalizedQuery,
          effectiveLat,
          effectiveLng,
          effectiveRadius,
          effectiveLimit,
          rankedLocal);
      return enrichPhotosForPlaces(rankedLocal);
    }

    List<PlaceDto> providerResults;
    try {
      String providerQuery = enrichQueryForProvider(query, effectiveLat, effectiveLng);
      providerResults =
          provider.textSearch(
              providerQuery, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit);
    } catch (PlaceProviderException exception) {
      if (!rankedLocal.isEmpty()) {
        log.warn(
            "Provider unavailable for query '{}'; serving {} stored results",
            query,
            rankedLocal.size());
        cache.putSearchResults(
            normalizedQuery,
            effectiveLat,
            effectiveLng,
            effectiveRadius,
            effectiveLimit,
            rankedLocal);
        return enrichPhotosForPlaces(rankedLocal);
      }
      throw exception;
    }

    List<PlaceDto> persisted =
        providerResults.stream()
            .map(result -> persistence.upsertProviderPlace(result, provider.getProviderName()))
            .toList();
    List<PlaceDto> rankedResults =
        ranking.rank(mergeResults(persisted, rankedLocal), query, effectiveLat, effectiveLng);
    cache.putSearchResults(
        normalizedQuery,
        effectiveLat,
        effectiveLng,
        effectiveRadius,
        effectiveLimit,
        rankedResults);
    return enrichPhotosForPlaces(rankedResults);
  }

  @Override
  public PlaceRecommendationResult recommend(PlaceRecommendationRequest request) {
    String query = request.query().trim();
    String normalizedQuery = query.toLowerCase(Locale.ROOT);
    // A missing anchor cannot be replaced with the service's legacy Da Nang default.
    // Text-only local matches may be shown as evidence, but cannot establish geographic fit.
    if (request.lat() == null || request.lng() == null) {
      List<PlaceDto> local =
          findLocalPlaces(normalizedQuery, request.effectiveTargetCount()).stream()
              .map(persistence::toDto)
              .toList();
      local.forEach(
          place ->
              decorate(
                  place,
                  "LOCAL",
                  place.getFetchedAt(),
                  request.effectiveMaximumAgeSeconds()));
      RetrievalEvidenceDto assessed =
          assess(local, request, Set.of("LOCAL"), "NOT_CALLED", false, Instant.now());
      List<String> reasons = new ArrayList<>(assessed.reasonCodes());
      reasons.add("LOCATION_ANCHOR_UNRESOLVED");
      RetrievalEvidenceDto evidence =
          new RetrievalEvidenceDto(
              "INSUFFICIENT",
              assessed.queryResolved(),
              assessed.candidateCount(),
              assessed.eligibleCount(),
              assessed.requiredFieldCoverage(),
              0.0,
              assessed.freshness(),
              assessed.sourceSet(),
              assessed.retrievedAt(),
              "NOT_CALLED",
              false,
              reasons.stream().distinct().toList(),
              assessed.rankingVersion());
      return new PlaceRecommendationResult(enrichPhotosForPlaces(local), evidence);
    }
    double lat = request.lat() != null ? request.lat() : properties.getDefaultLat();
    double lng = request.lng() != null ? request.lng() : properties.getDefaultLng();
    int radius = request.radiusMeters() != null ? request.radiusMeters() : 15_000;
    int target = request.effectiveTargetCount();
    Instant retrievedAt = Instant.now();

    Optional<List<PlaceDto>> cached =
        cache.getSearchResults(normalizedQuery, lat, lng, radius, target);
    if (cached.isPresent() && !cached.get().isEmpty()) {
      List<PlaceDto> values = ranking.rank(cached.get(), query, lat, lng);
      values.forEach(
          place ->
              decorate(
                  place,
                  "CACHE",
                  place.getFetchedAt(),
                  request.effectiveMaximumAgeSeconds()));
      RetrievalEvidenceDto evidence =
          assess(values, request, Set.of("CACHE"), "NOT_CALLED", false, retrievedAt);
      if ("SUFFICIENT".equals(evidence.status())) {
        return new PlaceRecommendationResult(
            enrichPhotosForPlaces(values.stream().limit(target).toList()), evidence);
      }
    }

    List<PlaceDto> local =
        ranking.rank(
            findLocalPlaces(normalizedQuery, Math.max(target * 2, target)).stream()
                .map(persistence::toDto)
                .toList(),
            query,
            lat,
            lng);
    local.forEach(
        place ->
            decorate(
                place,
                "LOCAL",
                place.getFetchedAt(),
                request.effectiveMaximumAgeSeconds()));
    RetrievalEvidenceDto localEvidence =
        assess(local, request, Set.of("LOCAL"), "NOT_CALLED", false, retrievedAt);
    if ("SUFFICIENT".equals(localEvidence.status())) {
      cache.putSearchResults(normalizedQuery, lat, lng, radius, target, local);
      return new PlaceRecommendationResult(
          enrichPhotosForPlaces(local.stream().limit(target).toList()), localEvidence);
    }
    if (!request.externalRefreshAllowed()) {
      return new PlaceRecommendationResult(
          enrichPhotosForPlaces(local.stream().limit(target).toList()), localEvidence);
    }

    try {
      List<PlaceDto> external =
          provider.textSearch(
              enrichQueryForProvider(query, lat, lng),
              lat,
              lng,
              radius,
              Math.min(50, Math.max(target * 2, target)));
      List<PlaceDto> persisted =
          external.stream()
              .map(item -> persistence.upsertProviderPlace(item, provider.getProviderName()))
              .peek(
                  item ->
                      decorate(
                          item,
                          "PROVIDER",
                          retrievedAt,
                          request.effectiveMaximumAgeSeconds()))
              .toList();
      List<PlaceDto> merged = ranking.rank(mergeResults(persisted, local), query, lat, lng);
      RetrievalEvidenceDto evidence =
          assess(
              merged,
              request,
              new LinkedHashSet<>(List.of("LOCAL", "PROVIDER:" + provider.getProviderName())),
              "AVAILABLE",
              true,
              retrievedAt);
      cache.putSearchResults(normalizedQuery, lat, lng, radius, target, merged);
      return new PlaceRecommendationResult(
          enrichPhotosForPlaces(merged.stream().limit(target).toList()), evidence);
    } catch (PlaceProviderException exception) {
      RetrievalEvidenceDto evidence =
          assess(local, request, Set.of("LOCAL"), "UNAVAILABLE", true, retrievedAt);
      List<String> reasons = new ArrayList<>(evidence.reasonCodes());
      reasons.add("PROVIDER_UNAVAILABLE");
      evidence =
          new RetrievalEvidenceDto(
              "INSUFFICIENT",
              evidence.queryResolved(),
              evidence.candidateCount(),
              evidence.eligibleCount(),
              evidence.requiredFieldCoverage(),
              evidence.geographicCoverage(),
              evidence.freshness(),
              evidence.sourceSet(),
              evidence.retrievedAt(),
              "UNAVAILABLE",
              true,
              reasons.stream().distinct().toList(),
              evidence.rankingVersion());
      return new PlaceRecommendationResult(
          enrichPhotosForPlaces(local.stream().limit(target).toList()), evidence);
    }
  }

  private RetrievalEvidenceDto assess(
      List<PlaceDto> candidates,
      PlaceRecommendationRequest request,
      Set<String> sources,
      String providerStatus,
      boolean refreshed,
      Instant retrievedAt) {
    List<String> required =
        request.requiredFields().stream()
            .map(String::trim)
            .filter(StringUtils::hasText)
            .distinct()
            .toList();
    Map<String, Double> coverage = new HashMap<>();
    List<String> reasons = new ArrayList<>();
    for (String field : required) {
      long present = candidates.stream().filter(place -> hasField(place, field)).count();
      double value = candidates.isEmpty() ? 0.0 : (double) present / candidates.size();
      coverage.put(field, value);
      if (value < 1.0) reasons.add("MANDATORY_FIELD_MISSING:" + field);
    }
    if (candidates.size() < request.effectiveTargetCount()) reasons.add("TOO_FEW_CANDIDATES");
    double geographic =
        candidates.isEmpty()
            ? 0.0
            : (double) candidates.stream().filter(item -> item.getLocation() != null).count()
                / candidates.size();
    if (request.lat() != null && geographic < 1.0) reasons.add("WEAK_GEOGRAPHIC_COVERAGE");
    if (candidates.stream().anyMatch(item -> "STALE".equals(item.getFreshness()))
        && !required.isEmpty()) {
      reasons.add("STALE_REQUIRED_EVIDENCE");
    }
    int eligible =
        (int)
            candidates.stream()
                .filter(place -> required.stream().allMatch(field -> hasField(place, field)))
                .count();
    String status =
        reasons.isEmpty()
            ? "SUFFICIENT"
            : request.externalRefreshAllowed() && !refreshed ? "REFRESHABLE" : "INSUFFICIENT";
    String freshness =
        candidates.isEmpty()
            ? "UNKNOWN"
            : candidates.stream().allMatch(item -> "FRESH".equals(item.getFreshness()))
                ? "FRESH"
                : candidates.stream().anyMatch(item -> "STALE".equals(item.getFreshness()))
                    ? "STALE"
                    : "UNKNOWN";
    return new RetrievalEvidenceDto(
        status,
        !candidates.isEmpty(),
        candidates.size(),
        eligible,
        coverage,
        geographic,
        freshness,
        sources,
        retrievedAt,
        providerStatus,
        refreshed,
        reasons.stream().distinct().toList(),
        "place-rank-v2");
  }

  private boolean hasField(PlaceDto place, String field) {
    return switch (field) {
      case "id", "canonicalId" -> StringUtils.hasText(place.getId());
      case "location", "coordinates" -> place.getLocation() != null;
      case "openingHours" -> StringUtils.hasText(place.getOpeningHours());
      // The current source stores an unparsed string; it cannot prove time-specific opening claims.
      case "normalizedOpeningHours" -> false;
      case "businessStatus" -> StringUtils.hasText(place.getBusinessStatus());
      case "category", "categories" -> place.getCategories() != null
          && !place.getCategories().isEmpty();
      case "rating" -> place.getRating() != null;
      case "price", "priceAmount" -> false;
      default -> false;
    };
  }

  private void decorate(
      PlaceDto place, String source, Instant fetchedAt, long maximumAgeSeconds) {
    place.setSource(source);
    if (place.getFetchedAt() == null) place.setFetchedAt(fetchedAt);
    Instant observed = place.getFetchedAt();
    place.setFreshness(
        observed == null
            ? "UNKNOWN"
            : Instant.now().isAfter(observed.plusSeconds(maximumAgeSeconds)) ? "STALE" : "FRESH");
  }

  @Override
  public List<AutocompleteSuggestionDto> autocomplete(
      String query, Double lat, Double lng, Integer radius, Integer limit) {
    if (!StringUtils.hasText(query)) return Collections.emptyList();

    String normalizedQuery = query.trim().toLowerCase(Locale.ROOT);
    double effectiveLat = lat != null ? lat : properties.getDefaultLat();
    double effectiveLng = lng != null ? lng : properties.getDefaultLng();
    int effectiveRadius = radius != null ? radius : 15_000;
    int effectiveLimit = limit != null ? Math.min(limit, 10) : 5;

    Optional<List<AutocompleteSuggestionDto>> cached =
        cache.getAutocomplete(
            normalizedQuery, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit);
    if (cached.isPresent()) return cached.get();

    List<AutocompleteSuggestionDto> suggestions;
    try {
      suggestions =
          provider.autocomplete(query, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit);
    } catch (PlaceProviderException exception) {
      log.warn("Autocomplete provider unavailable for query '{}'; using local data", query);
      suggestions = new ArrayList<>();
    }

    if (suggestions.isEmpty()) {
      suggestions =
          repository
              .findByNameRegex(Pattern.quote(query), PageRequest.of(0, effectiveLimit))
              .stream()
              .map(this::toSuggestion)
              .toList();
    }
    if (!suggestions.isEmpty()) {
      cache.putAutocomplete(
          normalizedQuery,
          effectiveLat,
          effectiveLng,
          effectiveRadius,
          effectiveLimit,
          suggestions);
    }
    return suggestions;
  }

  @Override
  public List<PlaceDto> getNearbyPlaces(
      Double lat, Double lng, Integer radius, String category, Integer limit) {
    int effectiveLimit = limit != null ? Math.min(limit, 50) : 20;
    Distance distance = new Distance(radius != null ? radius / 1000.0 : 5.0, Metrics.KILOMETERS);
    List<PlaceDto> places =
        repository
            .findByLocationNear(new Point(lng, lat), distance, PageRequest.of(0, effectiveLimit))
            .stream()
            .map(persistence::toDto)
            .filter(place -> matchesCategory(place, category))
            .toList();
    return ranking.rank(places, category, lat, lng);
  }

  private boolean isPlaceStale(Place place) {
    return place == null
        || place.getLastFetchedAt() == null
        || Instant.now().isAfter(place.getLastFetchedAt().plus(REFRESH_AFTER));
  }

  private String enrichQueryForProvider(String query, Double lat, Double lng) {
    if (!StringUtils.hasText(query)) return query;
    String lower = query.toLowerCase(Locale.ROOT).trim();
    if (containsKnownLocation(lower)) return query;

    if (isBroadCategory(lower)) {
      String district = inferDistrict(lat, lng);
      return query + (StringUtils.hasText(district) ? " " + district : "") + " Đà Nẵng";
    }
    return query;
  }

  private volatile long lastLocalSearchFailureTime = 0;

  private List<Place> findLocalPlaces(String normalizedQuery, int limit) {
    if (System.currentTimeMillis() - lastLocalSearchFailureTime < 30_000) {
      return Collections.emptyList();
    }
    try {
      return repository.searchByText(normalizedQuery, PageRequest.of(0, limit));
    } catch (Exception exception) {
      lastLocalSearchFailureTime = System.currentTimeMillis();
      log.warn("Local MongoDB text search failed: {}", exception.getMessage());
      return Collections.emptyList();
    }
  }

  private AutocompleteSuggestionDto toSuggestion(Place place) {
    String category =
        place.getCategories() == null || place.getCategories().isEmpty()
            ? "place"
            : place.getCategories().get(0);
    return AutocompleteSuggestionDto.builder()
        .id(place.getId())
        .title(place.getName())
        .subtitle(place.getAddress())
        .category(category)
        .build();
  }

  private List<PlaceDto> mergeResults(List<PlaceDto> primary, List<PlaceDto> secondary) {
    Map<String, PlaceDto> merged = new LinkedHashMap<>();
    primary.forEach(place -> merged.put(identity(place), place));
    secondary.forEach(place -> merged.putIfAbsent(identity(place), place));
    return new ArrayList<>(merged.values());
  }

  private String identity(PlaceDto place) {
    if (StringUtils.hasText(place.getProviderPlaceId())) {
      return place.getProvider() + ":" + place.getProviderPlaceId();
    }
    return StringUtils.hasText(place.getId()) ? place.getId() : place.getName();
  }

  private boolean matchesCategory(PlaceDto place, String category) {
    if (!StringUtils.hasText(category)) return true;
    if (place.getCategories() == null) return false;
    String expected = category.toLowerCase(Locale.ROOT);
    return place.getCategories().stream()
        .filter(StringUtils::hasText)
        .map(value -> value.toLowerCase(Locale.ROOT))
        .anyMatch(value -> value.contains(expected));
  }

  private boolean containsKnownLocation(String query) {
    return List.of(
            "đà nẵng",
            "da nang",
            "hà nội",
            "sài gòn",
            "hồ chí minh",
            "hội an",
            "sơn trà",
            "hải châu",
            "ngũ hành sơn",
            "thanh khê",
            "liên chiểu",
            "cẩm lệ")
        .stream()
        .anyMatch(query::contains);
  }

  private boolean isBroadCategory(String query) {
    return List.of(
            "nhà hàng",
            "quán cafe",
            "quán ăn",
            "hải sản",
            "quán nhậu",
            "quán ốc",
            "cafe",
            "coffee",
            "ẩm thực",
            "điểm tham quan",
            "khách sạn")
        .contains(query);
  }

  private String inferDistrict(Double lat, Double lng) {
    if (lat == null || lng == null) return "";
    if (lat >= 16.07 && lat <= 16.13 && lng >= 108.225 && lng <= 108.30) return "Sơn Trà";
    if (lat >= 15.96 && lat <= 16.06 && lng >= 108.23 && lng <= 108.28) return "Ngũ Hành Sơn";
    if (lat >= 16.03 && lat <= 16.08 && lng >= 108.20 && lng <= 108.23) return "Hải Châu";
    if (lat >= 16.05 && lat <= 16.085 && lng >= 108.16 && lng <= 108.20) return "Thanh Khê";
    if (lat >= 16.08 && lat <= 16.16 && lng >= 108.11 && lng <= 108.18) return "Liên Chiểu";
    if (lat >= 15.99 && lat <= 16.04 && lng >= 108.17 && lng <= 108.22) return "Cẩm Lệ";
    return "";
  }

  private List<PlaceDto> enrichPhotosForPlaces(List<PlaceDto> places) {
    if (places == null || places.isEmpty()) {
      return List.of();
    }
    List<PlaceDto> needExternalEnrichment = new ArrayList<>();
    for (PlaceDto place : places) {
      if (place.getPrimaryPhoto() != null && StringUtils.hasText(place.getPrimaryPhoto().url())) {
        continue;
      }
      if (place.getPhotos() != null && !place.getPhotos().isEmpty()) {
        PlacePhotoDto photo =
            new PlacePhotoDto(
                place.getPhotos().get(0),
                StringUtils.hasText(place.getProvider())
                    ? place.getProvider()
                    : provider.getProviderName(),
                List.of(),
                place.getFetchedAt() != null ? place.getFetchedAt() : Instant.now(),
                true);
        place.setPrimaryPhoto(photo);
        if (place.getPhotoGallery() == null || place.getPhotoGallery().isEmpty()) {
          place.setPhotoGallery(
              place.getPhotos().stream()
                  .map(
                      url ->
                          new PlacePhotoDto(
                              url,
                              StringUtils.hasText(place.getProvider())
                                  ? place.getProvider()
                                  : provider.getProviderName(),
                              List.of(),
                              place.getFetchedAt() != null ? place.getFetchedAt() : Instant.now(),
                              true))
                  .toList());
        }
        continue;
      }
      if (StringUtils.hasText(place.getProviderPlaceId())
          && (place.getProvider() == null
              || place.getProvider().equalsIgnoreCase(provider.getProviderName()))) {
        needExternalEnrichment.add(place);
      }
    }

    if (!needExternalEnrichment.isEmpty()) {
      List<CompletableFuture<Void>> futures =
          needExternalEnrichment.stream()
              .map(place -> CompletableFuture.runAsync(() -> enrichSinglePlacePhoto(place)))
              .toList();
      CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    }

    return places;
  }

  private void enrichSinglePlacePhoto(PlaceDto place) {
    try {
      List<PlacePhotoDto> gallery = provider.getPhotoGallery(place.getProviderPlaceId(), 3);
      if (!gallery.isEmpty()) {
        place.setPhotoGallery(gallery);
        place.setPrimaryPhoto(gallery.get(0));
        List<String> urls =
            gallery.stream().map(PlacePhotoDto::url).filter(StringUtils::hasText).toList();
        if (!urls.isEmpty()) {
          place.setPhotos(new ArrayList<>(urls));
          persistPhotoUrls(place, urls);
        }
      }
    } catch (Exception ex) {
      log.warn(
          "Failed to enrich photo gallery for place '{}': {}",
          place.getName(),
          ex.getMessage());
    }
  }

  private void persistPhotoUrls(PlaceDto place, List<String> photoUrls) {
    try {
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
      if (stored.isPresent()) {
        Place entity = stored.get();
        entity.setPhotos(new ArrayList<>(photoUrls));
        repository.save(entity);
      }
    } catch (Exception ex) {
      log.warn("Failed to persist photo URLs for place '{}': {}", place.getId(), ex.getMessage());
    }
  }
}
