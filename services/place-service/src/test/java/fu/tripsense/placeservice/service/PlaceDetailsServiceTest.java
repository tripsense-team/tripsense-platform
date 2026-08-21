package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceReview;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.dto.PlaceReviewDto;
import fu.tripsense.placeservice.providers.PlaceEnrichmentProvider;
import fu.tripsense.placeservice.providers.PlaceProvider;
import fu.tripsense.placeservice.providers.PlaceProviderException;
import fu.tripsense.placeservice.service.impl.PlaceDetailsServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlaceDetailsServiceTest {

    @Mock private PlaceRepository repository;
    @Mock private PlaceProvider provider;
    @Mock private PlaceEnrichmentProvider enrichmentProvider;
    @Mock private PlaceCacheService cache;
    @Mock private PlacePersistenceService persistence;

    private PlaceDetailsService service;

    @BeforeEach
    void setUp() {
        service = new PlaceDetailsServiceImpl(repository, provider, enrichmentProvider, cache, persistence);
    }

    @Test
    void servesFreshCompleteStoredDetailsWithoutProviderCall() {
        Place entity = completeEntity(Instant.now().minus(5, ChronoUnit.DAYS));
        PlaceDto dto = completeDto();
        when(cache.getPlaceDetails("place-1")).thenReturn(Optional.empty());
        when(repository.findById("place-1")).thenReturn(Optional.of(entity));
        when(persistence.toDto(entity)).thenReturn(dto);

        PlaceDto result = service.getDetails("place-1", null, null, null).orElseThrow();

        assertEquals(dto, result);
        verify(enrichmentProvider, never()).enrichPlace(any(), any(), any());
    }

    @Test
    void refreshesStaleStoredDetailsThroughAbstraction() {
        Place entity = completeEntity(Instant.now().minus(31, ChronoUnit.DAYS));
        PlaceDto current = completeDto();
        PlaceDto enrichment = PlaceDto.builder().name("Updated Cafe").phone("0905").build();
        PlaceDto updated = PlaceDto.builder().id("place-1").name("Updated Cafe").phone("0905").build();
        when(cache.getPlaceDetails("place-1")).thenReturn(Optional.empty());
        when(repository.findById("place-1")).thenReturn(Optional.of(entity));
        when(persistence.toDto(entity)).thenReturn(current);
        when(enrichmentProvider.enrichPlace(eq("Cafe"), any(), any())).thenReturn(Optional.of(enrichment));
        when(persistence.enrichExistingPlace(entity, enrichment)).thenReturn(updated);

        PlaceDto result = service.getDetails("place-1", null, null, null).orElseThrow();

        assertEquals(updated, result);
    }

    @Test
    void servesStoredDetailsWhenEnrichmentProviderFails() {
        Place entity = completeEntity(Instant.now().minus(31, ChronoUnit.DAYS));
        PlaceDto current = completeDto();
        when(cache.getPlaceDetails("place-1")).thenReturn(Optional.empty());
        when(repository.findById("place-1")).thenReturn(Optional.of(entity));
        when(persistence.toDto(entity)).thenReturn(current);
        when(enrichmentProvider.enrichPlace(eq("Cafe"), any(), any()))
                .thenThrow(new PlaceProviderException("down", new RuntimeException()));

        PlaceDto result = service.getDetails("place-1", null, null, null).orElseThrow();

        assertEquals(current, result);
    }

    private Place completeEntity(Instant fetchedAt) {
        return Place.builder()
                .id("place-1")
                .provider("ziomap")
                .providerPlaceId("provider-1")
                .name("Cafe")
                .phone("0905")
                .openingHours("08:00-22:00")
                .reviews(List.of(PlaceReview.builder().authorName("Guest").build()))
                .lastFetchedAt(fetchedAt)
                .build();
    }

    private PlaceDto completeDto() {
        return PlaceDto.builder()
                .id("place-1")
                .name("Cafe")
                .phone("0905")
                .openingHours("08:00-22:00")
                .reviews(List.of(PlaceReviewDto.builder().authorName("Guest").build()))
                .build();
    }
}
