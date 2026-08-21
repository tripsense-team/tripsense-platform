package fu.tripsense.placeservice.controller;

import fu.tripsense.placeservice.dto.AutocompleteSuggestionDto;
import fu.tripsense.placeservice.dto.LocationDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.service.PlaceDetailsService;
import fu.tripsense.placeservice.service.PlaceSearchService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PlaceControllerTest {

    private MockMvc mockMvc;

    @Mock
    private PlaceSearchService placeSearchService;

    @Mock
    private PlaceDetailsService placeDetailsService;

    @BeforeEach
    void setUp() {
        PlaceController controller = new PlaceController(placeSearchService, placeDetailsService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldReturnBadRequestWhenQueryIsBlank() throws Exception {
        mockMvc.perform(get("/api/places/search").param("q", ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("INVALID_QUERY"));
    }

    @Test
    void shouldReturnPlacesOnValidSearch() throws Exception {
        PlaceDto place = PlaceDto.builder()
                .id("p1")
                .name("Madame Lan")
                .location(LocationDto.builder().lat(16.0678).lng(108.2208).build())
                .rating(4.6)
                .build();

        when(placeSearchService.searchPlaces(eq("madame"), any(), any(), any(), eq(20)))
                .thenReturn(List.of(place));

        mockMvc.perform(get("/api/places/search").param("q", "madame"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").value("p1"))
                .andExpect(jsonPath("$.data[0].name").value("Madame Lan"));
    }

    @Test
    void shouldReturnAutocompleteSuggestions() throws Exception {
        AutocompleteSuggestionDto suggestion = AutocompleteSuggestionDto.builder()
                .id("s1")
                .title("Madame Lan Restaurant")
                .subtitle("Da Nang")
                .category("restaurant")
                .build();

        when(placeSearchService.autocomplete(eq("madame"), any(), any(), any(), eq(5)))
                .thenReturn(List.of(suggestion));

        mockMvc.perform(get("/api/places/autocomplete").param("q", "madame"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].title").value("Madame Lan Restaurant"));
    }

    @Test
    void shouldReturn404WhenPlaceNotFound() throws Exception {
        when(placeDetailsService.getDetails("unknown-id", null, null, null)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/places/unknown-id"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("PLACE_NOT_FOUND"));
    }
}
