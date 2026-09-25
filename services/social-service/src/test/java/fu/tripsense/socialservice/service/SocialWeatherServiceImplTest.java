package fu.tripsense.socialservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.*;

import fu.tripsense.socialservice.client.OpenMeteoClient;
import fu.tripsense.socialservice.client.dto.OpenMeteoResponse;
import fu.tripsense.socialservice.dto.response.DestinationWeatherResponse;
import fu.tripsense.socialservice.service.impl.SocialWeatherServiceImpl;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SocialWeatherServiceImplTest {

  @Mock private OpenMeteoClient openMeteoClient;

  private SocialWeatherServiceImpl weatherService;

  @BeforeEach
  void setUp() {
    weatherService = new SocialWeatherServiceImpl(openMeteoClient);
  }

  @Test
  void getDestinationWeather_successLiveFetch_parsesAndCachesResponse() {
    OpenMeteoResponse.CurrentWeather current =
        new OpenMeteoResponse.CurrentWeather("2026-09-24T16:00", 28.4, 72, 0);
    OpenMeteoResponse.DailyWeather daily =
        new OpenMeteoResponse.DailyWeather(
            List.of("2026-09-24"), List.of(31.2), List.of(24.5));
    OpenMeteoResponse mockResponse =
        new OpenMeteoResponse(16.0544, 108.2022, current, daily);

    when(openMeteoClient.fetchForecast(anyDouble(), anyDouble()))
        .thenReturn(Optional.of(mockResponse));

    DestinationWeatherResponse res = weatherService.getDestinationWeather("danang");

    assertThat(res).isNotNull();
    assertThat(res.id()).isEqualTo("danang");
    assertThat(res.cityName()).isEqualTo("Đà Nẵng");
    assertThat(res.temperature()).isEqualTo(28);
    assertThat(res.humidity()).isEqualTo(72);
    assertThat(res.tempRange()).isEqualTo("25° – 31°");
    assertThat(res.conditionKey()).isEqualTo("weatherConditionSunny");
    assertThat(res.iconType()).isEqualTo("sunny");
    assertThat(res.travelTipKey()).isEqualTo("weatherTipDaNang");

    // Second call should hit in-memory cache and not invoke client again
    DestinationWeatherResponse cachedRes = weatherService.getDestinationWeather("danang");
    assertThat(cachedRes).isNotNull();
    assertThat(cachedRes.temperature()).isEqualTo(28);
    verify(openMeteoClient, times(1)).fetchForecast(anyDouble(), anyDouble());
  }

  @Test
  void getDestinationWeather_openMeteoReturnsEmpty_fallsBackToPreset() {
    when(openMeteoClient.fetchForecast(anyDouble(), anyDouble()))
        .thenReturn(Optional.empty());

    DestinationWeatherResponse res = weatherService.getDestinationWeather("dalat");

    assertThat(res).isNotNull();
    assertThat(res.id()).isEqualTo("dalat");
    assertThat(res.cityName()).isEqualTo("Đà Lạt");
    assertThat(res.temperature()).isEqualTo(19);
    assertThat(res.conditionKey()).isEqualTo("weatherConditionPartlyCloudy");
    assertThat(res.travelTipKey()).isEqualTo("weatherTipDalat");
  }

  @Test
  void getDestinationWeather_openMeteoThrowsException_fallsBackToPreset() {
    when(openMeteoClient.fetchForecast(anyDouble(), anyDouble()))
        .thenThrow(new RuntimeException("Connection timed out"));

    DestinationWeatherResponse res = weatherService.getDestinationWeather("phuquoc");

    assertThat(res).isNotNull();
    assertThat(res.id()).isEqualTo("phuquoc");
    assertThat(res.cityName()).isEqualTo("Phú Quốc");
    assertThat(res.temperature()).isEqualTo(29);
    assertThat(res.iconType()).isEqualTo("sunny");
    assertThat(res.travelTipKey()).isEqualTo("weatherTipPhuQuoc");
  }

  @Test
  void getDestinationWeather_unknownCityId_fallsBackToDalat() {
    when(openMeteoClient.fetchForecast(anyDouble(), anyDouble()))
        .thenReturn(Optional.empty());

    DestinationWeatherResponse res = weatherService.getDestinationWeather("nonexistent-city");

    assertThat(res).isNotNull();
    assertThat(res.id()).isEqualTo("dalat");
    assertThat(res.cityName()).isEqualTo("Đà Lạt");
  }

  @Test
  void getDestinationWeather_coldClimate_mapsIconToCool() {
    OpenMeteoResponse.CurrentWeather current =
        new OpenMeteoResponse.CurrentWeather("2026-09-24T16:00", 14.2, 85, 2);
    OpenMeteoResponse.DailyWeather daily =
        new OpenMeteoResponse.DailyWeather(
            List.of("2026-09-24"), List.of(17.0), List.of(11.0));
    OpenMeteoResponse mockResponse =
        new OpenMeteoResponse(22.3364, 103.8438, current, daily);

    when(openMeteoClient.fetchForecast(anyDouble(), anyDouble()))
        .thenReturn(Optional.of(mockResponse));

    DestinationWeatherResponse res = weatherService.getDestinationWeather("sapa");

    assertThat(res.temperature()).isEqualTo(14);
    assertThat(res.iconType()).isEqualTo("cool");
    assertThat(res.conditionKey()).isEqualTo("weatherConditionPartlyCloudy");
  }

  @Test
  void getDestinationWeather_rainyWmoCode_mapsIconToRainy() {
    OpenMeteoResponse.CurrentWeather current =
        new OpenMeteoResponse.CurrentWeather("2026-09-24T16:00", 25.0, 95, 63);
    OpenMeteoResponse.DailyWeather daily =
        new OpenMeteoResponse.DailyWeather(
            List.of("2026-09-24"), List.of(27.0), List.of(23.0));
    OpenMeteoResponse mockResponse =
        new OpenMeteoResponse(21.0285, 105.8542, current, daily);

    when(openMeteoClient.fetchForecast(anyDouble(), anyDouble()))
        .thenReturn(Optional.of(mockResponse));

    DestinationWeatherResponse res = weatherService.getDestinationWeather("hanoi");

    assertThat(res.conditionKey()).isEqualTo("weatherConditionRainy");
    assertThat(res.iconType()).isEqualTo("rainy");
  }
}
