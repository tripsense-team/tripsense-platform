package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.providers.PlaceProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Pageable;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PlaceSearchServiceTest {

    @Mock
    private PlaceRepository placeRepository;

    @Mock
    private PlaceProvider placeProvider;

    @Mock
    private PlaceCacheService cacheService;

    @Mock
    private fu.tripsense.placeservice.providers.ziomap.ZioMapProvider zioMapProvider;

    private PlaceRankingService rankingService;
    private TripSensePlaceProperties properties;
    private PlaceSearchService searchService;

    @BeforeEach
    void setUp() {
        rankingService = new PlaceRankingService();
        properties = new TripSensePlaceProperties();
        properties.getSearch().setMinLocalResults(3);

        searchService = new PlaceSearchService(placeRepository, placeProvider, zioMapProvider, cacheService, rankingService, properties);
    }

    @Test
    void shouldReturnCachedResultsOnCacheHit() {
        String query = "quán cafe";
        PlaceDto cachedPlace = PlaceDto.builder().id("cached-1").name("The Coffee House").build();

        when(cacheService.getSearchResults(eq("quán cafe"), anyDouble(), anyDouble(), anyInt(), anyInt()))
                .thenReturn(Optional.of(List.of(cachedPlace)));

        List<PlaceDto> result = searchService.searchPlaces(query, null, null, null, 10);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("cached-1", result.get(0).getId());

        verify(placeRepository, never()).searchByText(anyString(), any(Pageable.class));
        verify(placeProvider, never()).textSearch(anyString(), anyDouble(), anyDouble(), any(), anyInt());
    }

    @Test
    void shouldQueryProviderWhenLocalResultsBelowThreshold() {
        String query = "hải sản ngon";

        when(cacheService.getSearchResults(eq("hải sản ngon"), anyDouble(), anyDouble(), anyInt(), anyInt()))
                .thenReturn(Optional.empty());
        when(placeRepository.searchByText(eq("hải sản ngon"), any(Pageable.class))).thenReturn(Collections.emptyList());

        PlaceDto externalPlace = PlaceDto.builder()
                .provider("ziomap")
                .providerPlaceId("ext-1")
                .name("Hải Sản Bé Mặn")
                .build();

        when(placeProvider.getProviderName()).thenReturn("ziomap");
        when(placeProvider.textSearch(anyString(), anyDouble(), anyDouble(), any(), anyInt()))
                .thenReturn(List.of(externalPlace));

        Place savedEntity = Place.builder()
                .id("saved-id-1")
                .provider("ziomap")
                .providerPlaceId("ext-1")
                .name("Hải Sản Bé Mặn")
                .build();

        when(placeRepository.findByProviderAndProviderPlaceId("ziomap", "ext-1")).thenReturn(Optional.empty());
        when(placeRepository.save(any(Place.class))).thenReturn(savedEntity);

        List<PlaceDto> result = searchService.searchPlaces(query, null, null, null, 10);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("saved-id-1", result.get(0).getId());
        assertEquals("Hải Sản Bé Mặn", result.get(0).getName());

        verify(cacheService).putSearchResults(eq("hải sản ngon"), anyDouble(), anyDouble(), anyInt(), anyInt(), any());
    }

    @Test
    void shouldRequeryProviderWhenPlaceDetailsIsStaleOlderThan30Days() {
        String placeId = "mongo-id-old";
        java.time.Instant thirtyOneDaysAgo = java.time.Instant.now().minus(java.time.Duration.ofDays(31));

        Place stalePlace = Place.builder()
                .id(placeId)
                .provider("ziomap")
                .providerPlaceId("mv-123")
                .name("Quán Cà Phê Mới")
                .location(new org.springframework.data.mongodb.core.geo.GeoJsonPoint(108.20, 16.05))
                .lastFetchedAt(thirtyOneDaysAgo)
                .build();

        PlaceDto freshZioMapPlace = PlaceDto.builder()
                .id(placeId)
                .name("Quán Cà Phê Mới Cập Nhật")
                .phone("0905123456")
                .openingHours("Thứ Hai: 07:00 - 22:00")
                .reviews(List.of(fu.tripsense.placeservice.dto.PlaceReviewDto.builder().authorName("Customer").rating(5).text("Rất ngon").build()))
                .build();

        when(zioMapProvider.fetchGooglePlaceEnrichment(eq("Quán Cà Phê Mới"), anyDouble(), anyDouble()))
                .thenReturn(Optional.of(freshZioMapPlace));

        Place updatedEntity = Place.builder()
                .id(placeId)
                .provider("ziomap")
                .providerPlaceId("mv-123")
                .name("Quán Cà Phê Mới Cập Nhật")
                .phone("0905123456")
                .location(new org.springframework.data.mongodb.core.geo.GeoJsonPoint(108.20, 16.05))
                .openingHours("Thứ Hai: 07:00 - 22:00")
                .lastFetchedAt(java.time.Instant.now())
                .reviews(List.of(fu.tripsense.placeservice.domain.model.PlaceReview.builder().authorName("Customer").build()))
                .build();

        when(placeRepository.findByProviderAndProviderPlaceId("ziomap", "mv-123")).thenReturn(Optional.of(stalePlace));
        when(placeRepository.findById(placeId)).thenReturn(Optional.of(stalePlace));
        when(placeRepository.save(any(Place.class))).thenReturn(updatedEntity);

        Optional<PlaceDto> details = searchService.getPlaceDetails(placeId);

        org.junit.jupiter.api.Assertions.assertTrue(details.isPresent());
        assertEquals("Quán Cà Phê Mới Cập Nhật", details.get().getName());
        assertEquals("0905123456", details.get().getPhone());
        verify(zioMapProvider).fetchGooglePlaceEnrichment(eq("Quán Cà Phê Mới"), anyDouble(), anyDouble());
        verify(cacheService).putPlaceDetails(eq(placeId), any());
    }

    @Test
    void shouldServeDirectlyFromMongoWhenPlaceDetailsIsFreshWithin30Days() {
        String placeId = "mongo-id-fresh";
        java.time.Instant fiveDaysAgo = java.time.Instant.now().minus(java.time.Duration.ofDays(5));

        Place freshPlace = Place.builder()
                .id(placeId)
                .provider("ziomap")
                .providerPlaceId("mv-456")
                .name("Hawa's Food")
                .phone("0799433579")
                .openingHours("Thứ Hai: 08:00 - 22:00")
                .lastFetchedAt(fiveDaysAgo)
                .reviews(List.of(fu.tripsense.placeservice.domain.model.PlaceReview.builder().authorName("Reviewer").build()))
                .build();

        when(cacheService.getPlaceDetails(placeId)).thenReturn(Optional.empty());
        when(placeRepository.findById(placeId)).thenReturn(Optional.of(freshPlace));

        Optional<PlaceDto> details = searchService.getPlaceDetails(placeId);

        org.junit.jupiter.api.Assertions.assertTrue(details.isPresent());
        assertEquals("Hawa's Food", details.get().getName());
        assertEquals("0799433579", details.get().getPhone());
        // Verify that external provider was NOT queried unnecessarily
        verify(zioMapProvider, never()).fetchGooglePlaceEnrichment(any(), any(), any());
    }
}
