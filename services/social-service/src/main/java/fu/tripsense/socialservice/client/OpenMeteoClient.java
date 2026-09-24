package fu.tripsense.socialservice.client;

import fu.tripsense.socialservice.client.dto.OpenMeteoResponse;
import java.time.Duration;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@Slf4j
public class OpenMeteoClient {

  private final RestClient restClient;

  public OpenMeteoClient(
      RestClient.Builder restClientBuilder,
      @Value("${weather.open-meteo.base-url:https://api.open-meteo.com/v1/forecast}") String baseUrl,
      @Value("${weather.open-meteo.connect-timeout-ms:2000}") int connectTimeoutMs,
      @Value("${weather.open-meteo.read-timeout-ms:4000}") int readTimeoutMs) {
    SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
    requestFactory.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
    requestFactory.setReadTimeout(Duration.ofMillis(readTimeoutMs));

    this.restClient =
        restClientBuilder
            .requestFactory(requestFactory)
            .baseUrl(baseUrl)
            .build();
  }

  public Optional<OpenMeteoResponse> fetchForecast(double latitude, double longitude) {
    try {
      OpenMeteoResponse response =
          restClient
              .get()
              .uri(
                  uriBuilder ->
                      uriBuilder
                          .queryParam("latitude", latitude)
                          .queryParam("longitude", longitude)
                          .queryParam("current", "temperature_2m,relative_humidity_2m,weather_code")
                          .queryParam("daily", "temperature_2m_max,temperature_2m_min")
                          .queryParam("timezone", "Asia/Bangkok")
                          .queryParam("forecast_days", 1)
                          .build())
              .retrieve()
              .body(OpenMeteoResponse.class);

      return Optional.ofNullable(response);
    } catch (Exception ex) {
      log.warn(
          "Failed to fetch weather from Open-Meteo for coordinates ({}, {}): {}",
          latitude,
          longitude,
          ex.getMessage());
      return Optional.empty();
    }
  }
}
