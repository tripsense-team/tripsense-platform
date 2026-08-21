package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.dto.LocationDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.service.impl.PlaceRankingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class PlaceRankingServiceTest {

    private PlaceRankingServiceImpl rankingService;

    @BeforeEach
    void setUp() {
        rankingService = new PlaceRankingServiceImpl();
    }

    @Test
    void shouldRankExactTitleMatchHigher() {
        PlaceDto exactMatch = PlaceDto.builder()
                .id("1")
                .name("Madame Lan")
                .rating(4.5)
                .userRatingCount(100)
                .build();

        PlaceDto partialMatch = PlaceDto.builder()
                .id("2")
                .name("Madame Lan Riverside Restaurant and Bar")
                .rating(4.5)
                .userRatingCount(100)
                .build();

        PlaceDto unrelated = PlaceDto.builder()
                .id("3")
                .name("Highlands Coffee")
                .rating(4.8)
                .userRatingCount(500)
                .build();

        List<PlaceDto> ranked = rankingService.rank(List.of(unrelated, partialMatch, exactMatch), "madame lan", null, null);

        assertFalse(ranked.isEmpty());
        assertEquals("1", ranked.get(0).getId(), "Exact match should be ranked first");
    }

    @Test
    void shouldFavorProximityWhenCoordinatesProvided() {
        // Reference point: Da Nang Dragon Bridge (16.0611, 108.2238)
        double targetLat = 16.0611;
        double targetLng = 108.2238;

        PlaceDto closePlace = PlaceDto.builder()
                .id("close")
                .name("Dragon Bridge Cafe")
                .location(LocationDto.builder().lat(16.0615).lng(108.2240).build())
                .rating(4.5)
                .userRatingCount(200)
                .build();

        PlaceDto farPlace = PlaceDto.builder()
                .id("far")
                .name("Dragon Bridge Cafe Branch 2")
                .location(LocationDto.builder().lat(16.1500).lng(108.3500).build())
                .rating(4.5)
                .userRatingCount(200)
                .build();

        List<PlaceDto> ranked = rankingService.rank(List.of(farPlace, closePlace), "dragon bridge", targetLat, targetLng);

        assertEquals("close", ranked.get(0).getId());
    }
}
