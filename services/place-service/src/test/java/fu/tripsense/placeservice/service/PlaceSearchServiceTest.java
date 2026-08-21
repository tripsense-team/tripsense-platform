package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.providers.PlaceProvider;
import fu.tripsense.placeservice.providers.PlaceProviderException;
import fu.tripsense.placeservice.service.impl.PlaceRankingServiceImpl;
import fu.tripsense.placeservice.service.impl.PlaceSearchServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlaceSearchServiceTest {

    @Mock private PlaceRepository repository;
    @Mock private PlaceProvider provider;
    @Mock private PlaceCacheService cache;
    @Mock private PlacePersistenceService persistence;

    private PlaceSearchService service;

    @BeforeEach
    void setUp() {
        TripSensePlaceProperties properties = new TripSensePlaceProperties();
        properties.getSearch().setMinLocalResults(3);
        service = new PlaceSearchServiceImpl(
                repository, provider, cache, new PlaceRankingServiceImpl(), persistence, properties);
    }

    @Test
    void returnsCachedResultsWithoutCallingStorageOrProvider() {
        PlaceDto cachedPlace = PlaceDto.builder().id("cached-1").name("The Coffee House").build();
        when(cache.getSearchResults(eq("quán cafe"), anyDouble(), anyDouble(), anyInt(), anyInt()))
                .thenReturn(Optional.of(List.of(cachedPlace)));

        List<PlaceDto> result = service.searchPlaces("quán cafe", null, null, null, 10);

        assertEquals(List.of(cachedPlace), result);
        verify(repository, never()).searchByText(anyString(), any(Pageable.class));
        verify(provider, never()).textSearch(anyString(), anyDouble(), anyDouble(), any(), anyInt());
    }

    @Test
    void persistsProviderResultsWhenLocalResultsAreInsufficient() {
        when(cache.getSearchResults(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt()))
                .thenReturn(Optional.empty());
        when(repository.searchByText(eq("hải sản ngon"), any(Pageable.class)))
                .thenReturn(Collections.emptyList());
        when(provider.getProviderName()).thenReturn("ziomap");

        PlaceDto external = PlaceDto.builder()
                .provider("ziomap")
                .providerPlaceId("ext-1")
                .name("Nhà Hàng Hải Sản Ngon")
                .build();
        PlaceDto saved = PlaceDto.builder()
                .id("saved-1")
                .provider("ziomap")
                .providerPlaceId("ext-1")
                .name("Nhà Hàng Hải Sản Ngon")
                .build();
        when(provider.textSearch(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt()))
                .thenReturn(List.of(external));
        when(persistence.upsertProviderPlace(external, "ziomap")).thenReturn(saved);

        List<PlaceDto> result = service.searchPlaces("hải sản ngon", null, null, null, 10);

        assertEquals(1, result.size());
        assertEquals("saved-1", result.get(0).getId());
        verify(cache).putSearchResults(eq("hải sản ngon"), anyDouble(), anyDouble(), anyInt(), anyInt(), any());
    }

    @Test
    void servesStoredResultsWhenProviderIsUnavailable() {
        Place stored = Place.builder().id("local-1").name("Local Cafe").lastFetchedAt(null).build();
        PlaceDto storedDto = PlaceDto.builder().id("local-1").name("Local Cafe").build();
        when(cache.getSearchResults(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt()))
                .thenReturn(Optional.empty());
        when(repository.searchByText(anyString(), any(Pageable.class))).thenReturn(List.of(stored));
        when(persistence.toDto(stored)).thenReturn(storedDto);
        when(provider.textSearch(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt()))
                .thenThrow(new PlaceProviderException("down", new RuntimeException()));

        List<PlaceDto> result = service.searchPlaces("local cafe", null, null, null, 10);

        assertEquals(List.of(storedDto), result);
    }

    @Test
    void propagatesProviderFailureWhenNoStoredFallbackExists() {
        when(cache.getSearchResults(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt()))
                .thenReturn(Optional.empty());
        when(repository.searchByText(anyString(), any(Pageable.class))).thenReturn(Collections.emptyList());
        when(provider.textSearch(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt()))
                .thenThrow(new PlaceProviderException("down", new RuntimeException()));

        assertThrows(PlaceProviderException.class,
                () -> service.searchPlaces("missing", null, null, null, 10));
    }
}
