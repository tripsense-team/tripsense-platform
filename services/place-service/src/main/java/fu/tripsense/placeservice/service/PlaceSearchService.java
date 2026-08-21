package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.AutocompleteSuggestionDto;
import fu.tripsense.placeservice.dto.LocationDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.dto.PlaceReviewDto;
import fu.tripsense.placeservice.providers.PlaceProvider;
import fu.tripsense.placeservice.providers.ziomap.ZioMapProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.Metrics;
import org.springframework.data.geo.Point;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

@Slf4j
@Service
public class PlaceSearchService {

    private final PlaceRepository placeRepository;
    private final PlaceProvider placeProvider;
    private final ZioMapProvider zioMapProvider;
    private final PlaceCacheService cacheService;
    private final PlaceRankingService rankingService;
    private final TripSensePlaceProperties properties;

    public PlaceSearchService(PlaceRepository placeRepository,
                              PlaceProvider placeProvider,
                              ZioMapProvider zioMapProvider,
                              PlaceCacheService cacheService,
                              PlaceRankingService rankingService,
                              TripSensePlaceProperties properties) {
        this.placeRepository = placeRepository;
        this.placeProvider = placeProvider;
        this.zioMapProvider = zioMapProvider;
        this.cacheService = cacheService;
        this.rankingService = rankingService;
        this.properties = properties;
    }

    public List<PlaceDto> searchPlaces(String query, Double lat, Double lng, Integer radius, Integer limit) {
        if (!StringUtils.hasText(query)) {
            return Collections.emptyList();
        }

        String normalizedQuery = query.trim().toLowerCase();
        double effectiveLat = lat != null ? lat : properties.getDefaultLat();
        double effectiveLng = lng != null ? lng : properties.getDefaultLng();
        int effectiveRadius = radius != null ? radius : 15_000;
        int effectiveLimit = (limit != null && limit > 0) ? Math.min(limit, 50) : 20;

        // 1. Check Redis Cache
        Optional<List<PlaceDto>> cached = cacheService.getSearchResults(
                normalizedQuery, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit);
        if (cached.isPresent() && !cached.get().isEmpty()) {
            log.debug("Serving search results for query '{}' from Redis cache", query);
            return cached.get();
        }

        // 2. Check MongoDB Local Database with strict ranking/relevance
        List<Place> localPlaces = Collections.emptyList();
        try {
            localPlaces = placeRepository.searchByText(normalizedQuery, PageRequest.of(0, effectiveLimit));
        } catch (Exception ex) {
            log.warn("Local MongoDB text search query error: {}", ex.getMessage());
        }

        List<PlaceDto> localDtos = new ArrayList<>();
        for (Place p : localPlaces) {
            localDtos.add(mapEntityToDto(p));
        }
        List<PlaceDto> rankedLocal = rankingService.rank(localDtos, query, effectiveLat, effectiveLng);

        boolean anyLocalStale = localPlaces.stream().anyMatch(this::isPlaceStale);

        if (!anyLocalStale && rankedLocal.size() >= properties.getSearch().getMinLocalResults()) {
            log.debug("Serving search results for query '{}' from MongoDB ({} relevant fresh results found)", query, rankedLocal.size());
            cacheService.putSearchResults(normalizedQuery, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit, rankedLocal);
            return rankedLocal;
        }

        // 3. Fallback / Enrichment: Call External Place Provider
        String enrichedQuery = enrichQueryForProvider(query, effectiveLat, effectiveLng);
        log.info("Local results for '{}' below threshold (found {}). Calling provider '{}' with query '{}'.", query, rankedLocal.size(), placeProvider.getProviderName(), enrichedQuery);
        List<PlaceDto> externalPlaces = placeProvider.textSearch(enrichedQuery, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit);

        // 4. Idempotently Persist/Update places into MongoDB
        List<PlaceDto> persistedPlaces = new ArrayList<>();
        for (PlaceDto dto : externalPlaces) {
            PlaceDto savedDto = upsertPlace(dto);
            persistedPlaces.add(savedDto);
        }

        // Merge with existing relevant local results if needed (deduplicating by ID/providerPlaceId)
        List<PlaceDto> combined = mergeDtoResults(persistedPlaces, rankedLocal);

        // 5. Rank Results Deterministically & Filter Zero-Relevance Noise
        List<PlaceDto> ranked = rankingService.rank(combined, query, effectiveLat, effectiveLng);

        // 6. Cache in Redis
        cacheService.putSearchResults(normalizedQuery, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit, ranked);

        return ranked;
    }

    public List<AutocompleteSuggestionDto> autocomplete(String query, Double lat, Double lng, Integer radius, Integer limit) {
        if (!StringUtils.hasText(query)) {
            return Collections.emptyList();
        }

        String normalizedQuery = query.trim().toLowerCase();

        double effectiveLat = lat != null ? lat : properties.getDefaultLat();
        double effectiveLng = lng != null ? lng : properties.getDefaultLng();
        int effectiveRadius = radius != null ? radius : 15_000;
        int effectiveLimit = limit != null ? Math.min(limit, 10) : 5;

        Optional<List<AutocompleteSuggestionDto>> cached = cacheService.getAutocomplete(
                normalizedQuery, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit);
        if (cached.isPresent()) {
            return cached.get();
        }

        List<AutocompleteSuggestionDto> suggestions = new ArrayList<>();
        try {
            suggestions.addAll(placeProvider.autocomplete(query, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit));
        } catch (Exception ex) {
            log.warn("Place autocomplete provider '{}' exception: {}", placeProvider.getProviderName(), ex.getMessage());
        }

        if (suggestions.isEmpty()) {
            List<fu.tripsense.placeservice.domain.model.Place> local = placeRepository.findByNameRegex(
                    Pattern.quote(query), org.springframework.data.domain.PageRequest.of(0, 5));
            for (fu.tripsense.placeservice.domain.model.Place doc : local) {
                suggestions.add(AutocompleteSuggestionDto.builder()
                        .id(doc.getId())
                        .title(doc.getName())
                        .subtitle(doc.getAddress())
                        .category(doc.getCategories() != null && !doc.getCategories().isEmpty() ? doc.getCategories().get(0) : "Đà Nẵng")
                        .build());
            }
        }

        if (!suggestions.isEmpty()) {
            cacheService.putAutocomplete(normalizedQuery, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit, suggestions);
        }

        return suggestions;
    }

    public Optional<PlaceDto> getPlaceDetails(String id) {
        return getPlaceDetails(id, null, null, null);
    }

    public Optional<PlaceDto> getPlaceDetails(String id, String fallbackName, Double fallbackLat, Double fallbackLng) {
        if (!StringUtils.hasText(id)) {
            return Optional.empty();
        }

        // 1. Check Redis (only if it has full reviews and hours)
        Optional<PlaceDto> cached = cacheService.getPlaceDetails(id);
        if (cached.isPresent()) {
            PlaceDto c = cached.get();
            if (c.getReviews() != null && !c.getReviews().isEmpty() && StringUtils.hasText(c.getOpeningHours())) {
                return cached;
            }
        }

        // 2. Check MongoDB by internal ID
        Optional<Place> mongoPlace = placeRepository.findById(id);
        if (mongoPlace.isPresent()) {
            Place p = mongoPlace.get();
            boolean hasFullData = p.getReviews() != null && !p.getReviews().isEmpty()
                    && StringUtils.hasText(p.getOpeningHours())
                    && (StringUtils.hasText(p.getPhone()) || StringUtils.hasText(p.getWebsite()));
            boolean isStale = isPlaceStale(p);

            // If missing full data or stale (>30 days), enrich directly with ZioMap in 1 unified step
            if (!hasFullData || isStale) {
                Double lat = (p.getLocation() != null) ? p.getLocation().getY() : fallbackLat;
                Double lng = (p.getLocation() != null) ? p.getLocation().getX() : fallbackLng;
                String name = StringUtils.hasText(p.getName()) ? p.getName() : fallbackName;
                Optional<PlaceDto> enriched = fetchAndSaveGoogleReviews(p.getId(), name, lat, lng);
                if (enriched.isPresent()) {
                    return enriched;
                }
            }

            PlaceDto dto = mapEntityToDto(p);
            cacheService.putPlaceDetails(id, dto);
            return Optional.of(dto);
        }

        // 3. Check MongoDB by providerPlaceId
        Optional<Place> byProvider = placeRepository.findByProviderAndProviderPlaceId(ZioMapProvider.PROVIDER_NAME, id);
        if (byProvider.isPresent()) {
            Place p = byProvider.get();
            Double lat = (p.getLocation() != null) ? p.getLocation().getY() : fallbackLat;
            Double lng = (p.getLocation() != null) ? p.getLocation().getX() : fallbackLng;
            String name = StringUtils.hasText(p.getName()) ? p.getName() : fallbackName;
            Optional<PlaceDto> enriched = fetchAndSaveGoogleReviews(p.getId(), name, lat, lng);
            if (enriched.isPresent()) {
                return enriched;
            }
            PlaceDto dto = mapEntityToDto(p);
            cacheService.putPlaceDetails(id, dto);
            return Optional.of(dto);
        }

        // 4. Query External Provider and directly enrich with ZioMap
        Optional<PlaceDto> providerDetails = placeProvider.getPlaceDetails(id);
        if (providerDetails.isPresent()) {
            PlaceDto saved = upsertPlace(providerDetails.get());
            Double lat = (saved.getLocation() != null) ? saved.getLocation().getLat() : fallbackLat;
            Double lng = (saved.getLocation() != null) ? saved.getLocation().getLng() : fallbackLng;
            String name = StringUtils.hasText(saved.getName()) ? saved.getName() : fallbackName;
            Optional<PlaceDto> enriched = fetchAndSaveGoogleReviews(saved.getId(), name, lat, lng);
            return enriched.isPresent() ? enriched : Optional.of(saved);
        }

        // 5. If provider details returned empty, but we have fallbackName, query ZioMap directly
        if (StringUtils.hasText(fallbackName)) {
            return fetchAndSaveGoogleReviews(id, fallbackName, fallbackLat, fallbackLng);
        }

        return Optional.empty();
    }

    private Optional<PlaceDto> fetchAndSaveGoogleReviews(String id, String fallbackName, Double fallbackLat, Double fallbackLng) {
        if (!StringUtils.hasText(id)) {
            return Optional.empty();
        }

        // 1. Find place in MongoDB by id or providerPlaceId
        Optional<Place> placeOpt = placeRepository.findById(id);
        if (placeOpt.isEmpty()) {
            placeOpt = placeRepository.findByProviderAndProviderPlaceId(ZioMapProvider.PROVIDER_NAME, id);
        }

        Place place;
        if (placeOpt.isPresent()) {
            place = placeOpt.get();
        } else {
            String searchKey = StringUtils.hasText(fallbackName) ? fallbackName : id;
            double queryLat = fallbackLat != null ? fallbackLat : 16.0544;
            double queryLng = fallbackLng != null ? fallbackLng : 108.2022;
            Optional<PlaceDto> mapVinaPlace = placeProvider.textSearch(searchKey, queryLat, queryLng, 5000, 1).stream().findFirst();
            if (mapVinaPlace.isPresent()) {
                PlaceDto saved = upsertPlace(mapVinaPlace.get());
                place = placeRepository.findById(saved.getId()).orElse(null);
            } else if (StringUtils.hasText(fallbackName)) {
                Place stub = Place.builder()
                        .provider(ZioMapProvider.PROVIDER_NAME)
                        .providerPlaceId(id)
                        .name(fallbackName)
                        .location((fallbackLat != null && fallbackLng != null) ? new org.springframework.data.mongodb.core.geo.GeoJsonPoint(fallbackLng, fallbackLat) : null)
                        .build();
                place = placeRepository.save(stub);
            } else {
                return Optional.empty();
            }
        }

        if (place == null) {
            return Optional.empty();
        }

        // If reviews, hours and contact info already fully exist, return directly
        boolean hasReviews = place.getReviews() != null && !place.getReviews().isEmpty();
        boolean hasHours = StringUtils.hasText(place.getOpeningHours());
        boolean hasPhone = StringUtils.hasText(place.getPhone());
        boolean hasWebsite = StringUtils.hasText(place.getWebsite());

        if (hasReviews && hasHours && (hasPhone || hasWebsite)) {
            PlaceDto dto = mapEntityToDto(place);
            cacheService.putPlaceDetails(place.getId(), dto);
            return Optional.of(dto);
        }

        // 2. Fetch full Google place enrichment on-demand from ZioMap
        Double lat = (place.getLocation() != null) ? place.getLocation().getY() : fallbackLat;
        Double lng = (place.getLocation() != null) ? place.getLocation().getX() : fallbackLng;

        Optional<PlaceDto> enrichmentOpt = zioMapProvider.fetchGooglePlaceEnrichment(place.getName(), lat, lng);
        if (enrichmentOpt.isPresent()) {
            PlaceDto enrich = enrichmentOpt.get();

            // Enrich opening hours
            if (StringUtils.hasText(enrich.getOpeningHours())) {
                place.setOpeningHours(enrich.getOpeningHours());
            }

            // Enrich phone if missing or if ZioMap has it
            if (StringUtils.hasText(enrich.getPhone()) && !StringUtils.hasText(place.getPhone())) {
                place.setPhone(enrich.getPhone());
            }

            // Enrich website if missing
            if (StringUtils.hasText(enrich.getWebsite()) && !StringUtils.hasText(place.getWebsite())) {
                place.setWebsite(enrich.getWebsite());
            }

            // Enrich business status
            if (StringUtils.hasText(enrich.getBusinessStatus())) {
                place.setBusinessStatus(enrich.getBusinessStatus());
            }

            // Enrich rating / user rating count from Google if higher quality
            if (enrich.getRating() != null && enrich.getRating() > 0) {
                place.setRating(enrich.getRating());
            }
            if (enrich.getUserRatingCount() != null && enrich.getUserRatingCount() > 0) {
                place.setUserRatingCount(enrich.getUserRatingCount());
            }

            // Enrich reviews
            if (enrich.getReviews() != null && !enrich.getReviews().isEmpty()) {
                List<fu.tripsense.placeservice.domain.model.PlaceReview> entityReviews = new ArrayList<>();
                for (fu.tripsense.placeservice.dto.PlaceReviewDto r : enrich.getReviews()) {
                    entityReviews.add(fu.tripsense.placeservice.domain.model.PlaceReview.builder()
                            .authorName(r.getAuthorName())
                            .rating(r.getRating())
                            .text(r.getText())
                            .profilePhotoUrl(r.getProfilePhotoUrl())
                            .relativeTimeDescription(r.getRelativeTimeDescription())
                            .time(r.getTime())
                            .build());
                }
                place.setReviews(entityReviews);
            }

            place.setLastFetchedAt(java.time.Instant.now());
            Place updated = placeRepository.save(place);
            PlaceDto dto = mapEntityToDto(updated);
            cacheService.putPlaceDetails(updated.getId(), dto);
            return Optional.of(dto);
        }

        PlaceDto dto = mapEntityToDto(place);
        return Optional.of(dto);
    }

    public List<PlaceDto> getNearbyPlaces(double lat, double lng, Integer radiusMeters, String category, Integer limit) {
        int effectiveLimit = (limit != null && limit > 0) ? Math.min(limit, 50) : 20;
        double radiusKm = (radiusMeters != null && radiusMeters > 0) ? radiusMeters / 1000.0 : 5.0;

        Point locationPoint = new Point(lng, lat);
        Distance distance = new Distance(radiusKm, Metrics.KILOMETERS);

        List<Place> places = placeRepository.findByLocationNear(locationPoint, distance, PageRequest.of(0, effectiveLimit));

        List<PlaceDto> result = new ArrayList<>();
        for (Place p : places) {
            if (StringUtils.hasText(category)) {
                if (p.getCategories() != null && p.getCategories().stream().anyMatch(c -> c.equalsIgnoreCase(category))) {
                    result.add(mapEntityToDto(p));
                }
            } else {
                result.add(mapEntityToDto(p));
            }
        }

        return rankingService.rank(result, category, lat, lng);
    }

    private PlaceDto upsertPlace(PlaceDto dto) {
        if (dto == null || !StringUtils.hasText(dto.getProviderPlaceId())) {
            return dto;
        }

        List<String> photos = dto.getPhotos() != null ? new ArrayList<>(dto.getPhotos()) : new ArrayList<>();

        String provider = StringUtils.hasText(dto.getProvider()) ? dto.getProvider() : placeProvider.getProviderName();
        Optional<Place> existing = placeRepository.findByProviderAndProviderPlaceId(provider, dto.getProviderPlaceId());

        Place entity;
        if (existing.isPresent()) {
            entity = existing.get();
            if (StringUtils.hasText(dto.getName())) entity.setName(dto.getName());
            if (dto.getLocation() != null) {
                entity.setLocation(new GeoJsonPoint(dto.getLocation().getLng(), dto.getLocation().getLat()));
            }
            if (StringUtils.hasText(dto.getAddress())) entity.setAddress(dto.getAddress());
            if (StringUtils.hasText(dto.getOldAddress())) entity.setOldAddress(dto.getOldAddress());
            if (dto.getRating() != null) entity.setRating(dto.getRating());
            if (dto.getUserRatingCount() != null) entity.setUserRatingCount(dto.getUserRatingCount());
            if (!photos.isEmpty()) {
                entity.setPhotos(photos);
            }
            if (StringUtils.hasText(dto.getPhone())) entity.setPhone(dto.getPhone());
            if (StringUtils.hasText(dto.getWebsite())) entity.setWebsite(dto.getWebsite());
            if (dto.getSocials() != null && !dto.getSocials().isEmpty()) entity.setSocials(dto.getSocials());
            if (StringUtils.hasText(dto.getOpeningHours())) entity.setOpeningHours(dto.getOpeningHours());
            if (StringUtils.hasText(dto.getBusinessStatus())) entity.setBusinessStatus(dto.getBusinessStatus());
            if (dto.getReviews() != null && !dto.getReviews().isEmpty()) {
                List<fu.tripsense.placeservice.domain.model.PlaceReview> reviews = dto.getReviews().stream()
                        .map(r -> fu.tripsense.placeservice.domain.model.PlaceReview.builder()
                                .authorName(r.getAuthorName())
                                .profilePhotoUrl(r.getProfilePhotoUrl())
                                .rating(r.getRating())
                                .text(r.getText())
                                .relativeTimeDescription(r.getRelativeTimeDescription())
                                .time(r.getTime())
                                .build())
                        .toList();
                entity.setReviews(reviews);
            }
            entity.setLastFetchedAt(Instant.now());
        } else {
            GeoJsonPoint point = null;
            if (dto.getLocation() != null) {
                point = new GeoJsonPoint(dto.getLocation().getLng(), dto.getLocation().getLat());
            }

            List<fu.tripsense.placeservice.domain.model.PlaceReview> reviews = new ArrayList<>();
            if (dto.getReviews() != null) {
                reviews = dto.getReviews().stream()
                        .map(r -> fu.tripsense.placeservice.domain.model.PlaceReview.builder()
                                .authorName(r.getAuthorName())
                                .profilePhotoUrl(r.getProfilePhotoUrl())
                                .rating(r.getRating())
                                .text(r.getText())
                                .relativeTimeDescription(r.getRelativeTimeDescription())
                                .time(r.getTime())
                                .build())
                        .toList();
            }

            entity = Place.builder()
                    .provider(provider)
                    .providerPlaceId(dto.getProviderPlaceId())
                    .name(dto.getName())
                    .normalizedName(dto.getName() != null ? dto.getName().toLowerCase() : "")
                    .location(point)
                    .address(dto.getAddress())
                    .oldAddress(dto.getOldAddress())
                    .city(StringUtils.hasText(dto.getCity()) ? dto.getCity() : properties.getDefaultCity())
                    .district(dto.getDistrict())
                    .categories(dto.getCategories() != null ? dto.getCategories() : new ArrayList<>())
                    .rating(dto.getRating())
                    .userRatingCount(dto.getUserRatingCount())
                    .photos(dto.getPhotos() != null ? dto.getPhotos() : new ArrayList<>())
                    .phone(dto.getPhone())
                    .website(dto.getWebsite())
                    .socials(dto.getSocials() != null ? dto.getSocials() : new ArrayList<>())
                    .openingHours(dto.getOpeningHours())
                    .businessStatus(dto.getBusinessStatus())
                    .description(dto.getDescription())
                    .reviews(reviews)
                    .lastFetchedAt(Instant.now())
                    .build();
        }

        Place saved = placeRepository.save(entity);
        return mapEntityToDto(saved);
    }

    public boolean isPlaceStale(Place place) {
        if (place == null || place.getLastFetchedAt() == null) {
            return true;
        }
        long ttlSeconds = properties.getCache().getProviderTtlSeconds();
        if (ttlSeconds <= 0) {
            ttlSeconds = 30L * 24 * 3600; // 30 days (1 month) default
        }
        Instant expireAt = place.getLastFetchedAt().plusSeconds(ttlSeconds);
        return Instant.now().isAfter(expireAt);
    }

    private List<PlaceDto> mergeDtoResults(List<PlaceDto> primary, List<PlaceDto> secondary) {
        List<PlaceDto> merged = new ArrayList<>(primary);
        for (PlaceDto sec : secondary) {
            boolean alreadyPresent = merged.stream().anyMatch(p ->
                    (p.getId() != null && p.getId().equals(sec.getId())) ||
                    (p.getProviderPlaceId() != null && p.getProviderPlaceId().equals(sec.getProviderPlaceId())));
            if (!alreadyPresent) {
                merged.add(sec);
            }
        }
        return merged;
    }

    private PlaceDto mapEntityToDto(Place p) {
        if (p == null) return null;

        LocationDto loc = null;
        if (p.getLocation() != null) {
            loc = LocationDto.builder()
                    .lat(p.getLocation().getY())
                    .lng(p.getLocation().getX())
                    .build();
        }

        List<PlaceReviewDto> reviewDtos = new ArrayList<>();
        if (p.getReviews() != null) {
            reviewDtos = p.getReviews().stream()
                    .map(r -> PlaceReviewDto.builder()
                            .authorName(r.getAuthorName())
                            .profilePhotoUrl(r.getProfilePhotoUrl())
                            .rating(r.getRating())
                            .text(r.getText())
                            .relativeTimeDescription(r.getRelativeTimeDescription())
                            .time(r.getTime())
                            .build())
                    .toList();
        }

        return PlaceDto.builder()
                .id(p.getId())
                .provider(p.getProvider())
                .providerPlaceId(p.getProviderPlaceId())
                .name(p.getName())
                .location(loc)
                .address(p.getAddress())
                .oldAddress(p.getOldAddress())
                .city(p.getCity())
                .district(p.getDistrict())
                .categories(p.getCategories() != null ? p.getCategories() : new ArrayList<>())
                .rating(p.getRating())
                .userRatingCount(p.getUserRatingCount())
                .photos(p.getPhotos() != null ? p.getPhotos() : new ArrayList<>())
                .phone(p.getPhone())
                .website(p.getWebsite())
                .socials(p.getSocials() != null ? p.getSocials() : new ArrayList<>())
                .openingHours(p.getOpeningHours())
                .businessStatus(p.getBusinessStatus())
                .description(p.getDescription())
                .reviews(reviewDtos)
                .build();
    }

    public String enrichQueryForProvider(String query, Double lat, Double lng) {
        if (!StringUtils.hasText(query)) {
            return query;
        }

        String lower = query.toLowerCase().trim();

        // If the user query already includes city or known district names, keep untouched
        if (lower.contains("đà nẵng") || lower.contains("da nang") || lower.contains("hà nội") ||
                lower.contains("sài gòn") || lower.contains("hồ chí minh") || lower.contains("hội an") ||
                lower.contains("sơn trà") || lower.contains("hải châu") || lower.contains("ngũ hành sơn") ||
                lower.contains("thanh khê") || lower.contains("liên chiểu") || lower.contains("cẩm lệ")) {
            return query;
        }

        // Only enrich broad generic category queries (e.g. "nhà hàng", "quán cafe", "hải sản", "quán ăn")
        boolean isBroadCategory = lower.equals("nhà hàng") || lower.equals("quán cafe") ||
                lower.equals("quán ăn") || lower.equals("hải sản") || lower.equals("quán nhậu") ||
                lower.equals("quán ốc") || lower.equals("cafe") || lower.equals("coffee") ||
                lower.equals("ẩm thực") || lower.equals("điểm tham quan") || lower.equals("khách sạn");

        if (isBroadCategory) {
            String district = inferDistrict(lat, lng);
            if (StringUtils.hasText(district)) {
                return query + " " + district + " Đà Nẵng";
            }
            return query + " Đà Nẵng";
        }

        // For specific place names (e.g. "Hawa's Food", "Bếp Cuốn", "quán abcxyz"), keep clean so provider does not match false positives
        return query;
    }

    private String inferDistrict(Double lat, Double lng) {
        if (lat == null || lng == null) {
            return "";
        }
        // Sơn Trà: 16.07 - 16.13, 108.225 - 108.30
        if (lat >= 16.07 && lat <= 16.13 && lng >= 108.225 && lng <= 108.30) {
            return "Sơn Trà";
        }
        // Ngũ Hành Sơn: 15.96 - 16.06, 108.23 - 108.28
        if (lat >= 15.96 && lat <= 16.06 && lng >= 108.23 && lng <= 108.28) {
            return "Ngũ Hành Sơn";
        }
        // Hải Châu: 16.03 - 16.08, 108.20 - 108.23
        if (lat >= 16.03 && lat <= 16.08 && lng >= 108.20 && lng <= 108.23) {
            return "Hải Châu";
        }
        // Thanh Khê: 16.05 - 16.085, 108.16 - 108.20
        if (lat >= 16.05 && lat <= 16.085 && lng >= 108.16 && lng <= 108.20) {
            return "Thanh Khê";
        }
        // Liên Chiểu: 16.08 - 16.16, 108.11 - 108.18
        if (lat >= 16.08 && lat <= 16.16 && lng >= 108.11 && lng <= 108.18) {
            return "Liên Chiểu";
        }
        // Cẩm Lệ: 15.99 - 16.04, 108.17 - 108.22
        if (lat >= 15.99 && lat <= 16.04 && lng >= 108.17 && lng <= 108.22) {
            return "Cẩm Lệ";
        }

        return "";
    }
}
