package fu.tripsense.placeservice.service.impl;

import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.AutocompleteSuggestionDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.providers.PlaceProvider;
import fu.tripsense.placeservice.providers.PlaceProviderException;
import fu.tripsense.placeservice.service.PlaceCacheService;
import fu.tripsense.placeservice.service.PlacePersistenceService;
import fu.tripsense.placeservice.service.PlaceRankingService;
import fu.tripsense.placeservice.service.PlaceSearchService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.Metrics;
import org.springframework.data.geo.Point;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

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

    public PlaceSearchServiceImpl(PlaceRepository repository,
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
    public List<PlaceDto> searchPlaces(String query, Double lat, Double lng, Integer radius, Integer limit) {
        if (!StringUtils.hasText(query)) return Collections.emptyList();

        String normalizedQuery = query.trim().toLowerCase(Locale.ROOT);
        double effectiveLat = lat != null ? lat : properties.getDefaultLat();
        double effectiveLng = lng != null ? lng : properties.getDefaultLng();
        int effectiveRadius = radius != null ? radius : 15_000;
        int effectiveLimit = limit != null ? Math.min(limit, 50) : 20;

        Optional<List<PlaceDto>> cached = cache.getSearchResults(
                normalizedQuery, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit);
        if (cached.isPresent() && !cached.get().isEmpty()) {
            List<PlaceDto> rankedCached = ranking.rank(cached.get(), query, effectiveLat, effectiveLng);
            if (!rankedCached.isEmpty()) {
                return rankedCached;
            }
        }

        List<Place> localEntities = findLocalPlaces(normalizedQuery, effectiveLimit);
        List<PlaceDto> rankedLocal = ranking.rank(
                localEntities.stream().map(persistence::toDto).toList(),
                query,
                effectiveLat,
                effectiveLng);

        boolean isSpecificQuery = !isBroadCategory(normalizedQuery)
                && !normalizedQuery.equals("đà nẵng")
                && !normalizedQuery.equals("da nang")
                && !normalizedQuery.equals("tất cả")
                && !normalizedQuery.equals("địa điểm nổi tiếng ở đà nẵng");

        // For specific queries, check if the top local result actually contains the query in its name
        boolean hasStrongLocalMatch = !rankedLocal.isEmpty() && rankedLocal.stream().anyMatch(p -> {
            if (p.getName() == null) return false;
            String nameLower = p.getName().toLowerCase(Locale.ROOT);
            return nameLower.contains(normalizedQuery) || normalizedQuery.contains(nameLower);
        });

        boolean localIsFreshAndSufficient = localEntities.stream().noneMatch(this::isPlaceStale)
                && (isSpecificQuery ? hasStrongLocalMatch : rankedLocal.size() >= properties.getSearch().getMinLocalResults());

        if (localIsFreshAndSufficient) {
            cache.putSearchResults(normalizedQuery, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit, rankedLocal);
            return rankedLocal;
        }

        List<PlaceDto> providerResults;
        try {
            String providerQuery = enrichQueryForProvider(query, effectiveLat, effectiveLng);
            providerResults = provider.textSearch(providerQuery, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit);
        } catch (PlaceProviderException exception) {
            if (!rankedLocal.isEmpty()) {
                log.warn("Provider unavailable for query '{}'; serving {} stored results", query, rankedLocal.size());
                cache.putSearchResults(normalizedQuery, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit, rankedLocal);
                return rankedLocal;
            }
            throw exception;
        }

        List<PlaceDto> persisted = providerResults.stream()
                .map(result -> persistence.upsertProviderPlace(result, provider.getProviderName()))
                .toList();
        List<PlaceDto> rankedResults = ranking.rank(
                mergeResults(persisted, rankedLocal),
                query,
                effectiveLat,
                effectiveLng);
        cache.putSearchResults(normalizedQuery, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit, rankedResults);
        return rankedResults;
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

        Optional<List<AutocompleteSuggestionDto>> cached = cache.getAutocomplete(
                normalizedQuery, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit);
        if (cached.isPresent()) return cached.get();

        List<AutocompleteSuggestionDto> suggestions;
        try {
            suggestions = provider.autocomplete(query, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit);
        } catch (PlaceProviderException exception) {
            log.warn("Autocomplete provider unavailable for query '{}'; using local data", query);
            suggestions = new ArrayList<>();
        }

        if (suggestions.isEmpty()) {
            suggestions = repository.findByNameRegex(Pattern.quote(query), PageRequest.of(0, effectiveLimit))
                    .stream()
                    .map(this::toSuggestion)
                    .toList();
        }
        if (!suggestions.isEmpty()) {
            cache.putAutocomplete(normalizedQuery, effectiveLat, effectiveLng, effectiveRadius, effectiveLimit, suggestions);
        }
        return suggestions;
    }

    @Override
    public List<PlaceDto> getNearbyPlaces(Double lat, Double lng, Integer radius, String category, Integer limit) {
        int effectiveLimit = limit != null ? Math.min(limit, 50) : 20;
        Distance distance = new Distance(radius != null ? radius / 1000.0 : 5.0, Metrics.KILOMETERS);
        List<PlaceDto> places = repository.findByLocationNear(
                        new Point(lng, lat), distance, PageRequest.of(0, effectiveLimit))
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

    private List<Place> findLocalPlaces(String normalizedQuery, int limit) {
        try {
            return repository.searchByText(normalizedQuery, PageRequest.of(0, limit));
        } catch (Exception exception) {
            log.warn("Local MongoDB text search failed: {}", exception.getMessage());
            return Collections.emptyList();
        }
    }

    private AutocompleteSuggestionDto toSuggestion(Place place) {
        String category = place.getCategories() == null || place.getCategories().isEmpty()
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
        return List.of("đà nẵng", "da nang", "hà nội", "sài gòn", "hồ chí minh", "hội an",
                        "sơn trà", "hải châu", "ngũ hành sơn", "thanh khê", "liên chiểu", "cẩm lệ")
                .stream()
                .anyMatch(query::contains);
    }

    private boolean isBroadCategory(String query) {
        return List.of("nhà hàng", "quán cafe", "quán ăn", "hải sản", "quán nhậu", "quán ốc",
                "cafe", "coffee", "ẩm thực", "điểm tham quan", "khách sạn").contains(query);
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
}
