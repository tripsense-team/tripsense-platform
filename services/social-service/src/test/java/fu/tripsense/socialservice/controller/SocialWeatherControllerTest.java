package fu.tripsense.socialservice.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fu.tripsense.socialservice.dto.response.DestinationWeatherResponse;
import fu.tripsense.socialservice.service.SocialWeatherService;
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
class SocialWeatherControllerTest {

  private MockMvc mockMvc;

  @Mock private SocialWeatherService weatherService;

  @InjectMocks private SocialWeatherController controller;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
  }

  @Test
  void getDestinationWeather_withDefaultCity_returnsDalat() throws Exception {
    DestinationWeatherResponse dalat =
        new DestinationWeatherResponse(
            "dalat",
            "Đà Lạt",
            "destinationDalat",
            19,
            "Mây nhẹ",
            "weatherConditionPartlyCloudy",
            "14° – 22°",
            75,
            "Vừa cập nhật",
            "partlyCloudy",
            "Thời tiết se lạnh lý tưởng để săn mây và đi cà phê",
            "weatherTipDalat");

    when(weatherService.getDestinationWeather(eq("dalat"))).thenReturn(dalat);

    mockMvc
        .perform(get("/api/social/weather").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.id").value("dalat"))
        .andExpect(jsonPath("$.data.cityName").value("Đà Lạt"))
        .andExpect(jsonPath("$.data.cityKey").value("destinationDalat"))
        .andExpect(jsonPath("$.data.temperature").value(19))
        .andExpect(jsonPath("$.data.condition").value("Mây nhẹ"))
        .andExpect(jsonPath("$.data.conditionKey").value("weatherConditionPartlyCloudy"))
        .andExpect(jsonPath("$.data.tempRange").value("14° – 22°"))
        .andExpect(jsonPath("$.data.humidity").value(75))
        .andExpect(jsonPath("$.data.iconType").value("partlyCloudy"))
        .andExpect(jsonPath("$.data.travelTipKey").value("weatherTipDalat"))
        .andExpect(jsonPath("$.data.updatedAt").value("Vừa cập nhật"));

    verify(weatherService).getDestinationWeather(eq("dalat"));
  }

  @Test
  void getDestinationWeather_withExplicitCity_callsServiceAndReturns() throws Exception {
    DestinationWeatherResponse phuquoc =
        new DestinationWeatherResponse(
            "phuquoc",
            "Phú Quốc",
            "destinationPhuQuoc",
            29,
            "Nắng ráo",
            "weatherConditionSunny",
            "26° – 31°",
            68,
            "Vừa cập nhật",
            "sunny",
            "Biển êm sóng nhẹ, rất thích hợp lặn ngắm san hô",
            "weatherTipPhuQuoc");

    when(weatherService.getDestinationWeather(eq("phuquoc"))).thenReturn(phuquoc);

    mockMvc
        .perform(
            get("/api/social/weather")
                .param("cityId", "phuquoc")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.id").value("phuquoc"))
        .andExpect(jsonPath("$.data.cityName").value("Phú Quốc"))
        .andExpect(jsonPath("$.data.temperature").value(29))
        .andExpect(jsonPath("$.data.iconType").value("sunny"));

    verify(weatherService).getDestinationWeather(eq("phuquoc"));
  }
}
