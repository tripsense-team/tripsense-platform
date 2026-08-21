package fu.tripsense.placeservice.service.impl;

import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.providers.PlaceEnrichmentProvider;
import fu.tripsense.placeservice.providers.PlaceProvider;
import fu.tripsense.placeservice.providers.PlaceProviderException;
import fu.tripsense.placeservice.service.PlaceCacheService;
import fu.tripsense.placeservice.service.PlaceDetailsService;
import fu.tripsense.placeservice.service.PlacePersistenceService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@Slf4j
@Service
public class PlaceDetailsServiceImpl implements PlaceDetailsService {

    private static final Duration REFRESH_AFTER = Duration.ofDays(30);

    private final PlaceRepository repository;
    private final PlaceProvider provider;
    private final PlaceEnrichmentProvider enrichmentProvider;
    private final PlaceCacheService cache;
    private final PlacePersistenceService persistence;

    public PlaceDetailsServiceImpl(PlaceRepository repository,
                                   PlaceProvider provider,
                                   PlaceEnrichmentProvider enrichmentProvider,
                                   PlaceCacheService cache,
                                   PlacePersistenceService persistence) {
        this.repository = repository;
        this.provider = provider;
        this.enrichmentProvider = enrichmentProvider;
        this.cache = cache;
        this.persistence = persistence;
    }

    @Override
    public Optional<PlaceDto> getDetails(String id, String fallbackName, Double fallbackLat, Double fallbackLng) {
        if (!StringUtils.hasText(id)) return Optional.empty();

        Optional<PlaceDto> cached = cache.getPlaceDetails(id);
        if (cached.filter(this::hasCompleteDetails).isPresent()) return cached;

        Optional<Place> stored = repository.findById(id)
                .or(() -> repository.findByProviderAndProviderPlaceId(provider.getProviderName(), id));
        if (stored.isPresent()) {
            return Optional.of(refreshIfNeeded(stored.get(), fallbackLat, fallbackLng));
        }

        Optional<PlaceDto> providerDetails = provider.getPlaceDetails(id);
        if (providerDetails.isEmpty() && StringUtils.hasText(fallbackName)) {
            providerDetails = provider.textSearch(fallbackName, fallbackLat, fallbackLng, 5000, 1)
                    .stream()
                    .findFirst();
        }
        if (providerDetails.isEmpty()) return Optional.empty();

        PlaceDto saved = persistence.upsertProviderPlace(providerDetails.get(), provider.getProviderName());
        Place entity = repository.findById(saved.getId()).orElse(null);
        PlaceDto result = entity == null ? saved : refreshIfNeeded(entity, fallbackLat, fallbackLng);
        cacheDetails(id, result);
        return Optional.of(result);
    }

    private PlaceDto refreshIfNeeded(Place place, Double fallbackLat, Double fallbackLng) {
        PlaceDto current = persistence.toDto(place);
        if (hasCompleteDetails(current) && !isStale(place)) {
            cacheDetails(place.getId(), current);
            return current;
        }

        Double lat = place.getLocation() == null ? fallbackLat : Double.valueOf(place.getLocation().getY());
        Double lng = place.getLocation() == null ? fallbackLng : Double.valueOf(place.getLocation().getX());
        try {
            Optional<PlaceDto> enrichment = enrichmentProvider.enrichPlace(place.getName(), lat, lng);
            if (enrichment.isPresent()) {
                PlaceDto refreshed = persistence.enrichExistingPlace(place, enrichment.get());
                cacheDetails(place.getId(), refreshed);
                return refreshed;
            }
        } catch (PlaceProviderException exception) {
            log.warn("Provider enrichment unavailable for place '{}'; serving stored details", place.getId());
        }

        cacheDetails(place.getId(), current);
        return current;
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
