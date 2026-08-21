package fu.tripsense.placeservice.providers.ziomap;

import fu.tripsense.placeservice.config.ZioMapProperties;
import fu.tripsense.placeservice.dto.AutocompleteSuggestionDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ZioMapProviderTest {

    private ZioMapProvider provider;

    @BeforeEach
    void setUp() {
        ZioMapProperties props = new ZioMapProperties();
        props.setBaseUrl("https://ziomap-api.socibi.com");
        props.setApiKey("test-key");
        provider = new ZioMapProvider(props);
    }

    @Test
    void shouldReturnEmptyListWhenSearchQueryIsBlank() {
        List<PlaceDto> results = provider.textSearch("", null, null, null, 10);
        assertNotNull(results);
        assertTrue(results.isEmpty());
    }

    @Test
    void shouldReturnEmptyListWhenAutocompleteQueryIsBlank() {
        List<AutocompleteSuggestionDto> results = provider.autocomplete("   ", null, null, null, 5);
        assertNotNull(results);
        assertTrue(results.isEmpty());
    }

    @Test
    void shouldReturnCorrectProviderName() {
        assertEquals("ziomap", provider.getProviderName());
    }
}
