package fu.tripsense.socialservice.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import fu.tripsense.socialservice.dto.response.TrendingDestinationResponse;
import fu.tripsense.socialservice.service.SocialDestinationService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class SocialDestinationControllerTest {

  private MockMvc mockMvc;

  @Mock private SocialDestinationService destinationService;

  @InjectMocks private SocialDestinationController controller;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
  }

  @Test
  void getTrendingDestinations_withDefaultLimit_returnsSuccess() throws Exception {
    TrendingDestinationResponse item =
        new TrendingDestinationResponse(
            "trend-dalat",
            "Đà Lạt",
            "destinationDalat",
            "https://img.com/dalat.jpg",
            "1.4k chia sẻ",
            1420,
            "Mùa hoa dã quỳ",
            "trendSubtitleDalat",
            "da-lat");

    when(destinationService.getTrendingDestinations(eq(4))).thenReturn(List.of(item));

    mockMvc
        .perform(get("/api/social/destinations/trending").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data[0].id").value("trend-dalat"))
        .andExpect(jsonPath("$.data[0].name").value("Đà Lạt"))
        .andExpect(jsonPath("$.data[0].cityNameKey").value("destinationDalat"))
        .andExpect(jsonPath("$.data[0].imageUrl").value("https://img.com/dalat.jpg"))
        .andExpect(jsonPath("$.data[0].shareCountText").value("1.4k chia sẻ"))
        .andExpect(jsonPath("$.data[0].shareCount").value(1420))
        .andExpect(jsonPath("$.data[0].subtitle").value("Mùa hoa dã quỳ"))
        .andExpect(jsonPath("$.data[0].subtitleKey").value("trendSubtitleDalat"))
        .andExpect(jsonPath("$.data[0].slug").value("da-lat"));

    verify(destinationService).getTrendingDestinations(eq(4));
  }

  @Test
  void getTrendingDestinations_withAliasAndCustomLimit_returnsSuccess() throws Exception {
    when(destinationService.getTrendingDestinations(eq(6))).thenReturn(List.of());

    mockMvc
        .perform(
            get("/api/social/trending-destinations")
                .param("limit", "6")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data").isArray());

    verify(destinationService).getTrendingDestinations(eq(6));
  }
}
