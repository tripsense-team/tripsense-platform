package fu.tripsense.placeservice.places;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PlaceSearchServiceTest {

    @Test
    void rejectsShortSearchQueriesBeforeProviderCalls() {
        PlaceSearchService service = new PlaceSearchService(null, null);

        assertThatThrownBy(() -> service.search("c", null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least 2 characters");
    }

    @Test
    void rejectsInvalidCoordinatesBeforeProviderCalls() {
        PlaceSearchService service = new PlaceSearchService(null, null);

        assertThatThrownBy(() -> service.search("coffee", 99.0, 108.2022))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Latitude");
    }
}
