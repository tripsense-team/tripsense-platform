package fu.tripsense.socialservice.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record OpenMeteoResponse(
    Double latitude,
    Double longitude,
    CurrentWeather current,
    DailyWeather daily
) {
  @JsonIgnoreProperties(ignoreUnknown = true)
  public record CurrentWeather(
      String time,
      @JsonProperty("temperature_2m") Double temperature,
      @JsonProperty("relative_humidity_2m") Integer relativeHumidity,
      @JsonProperty("weather_code") Integer weatherCode
  ) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record DailyWeather(
      List<String> time,
      @JsonProperty("temperature_2m_max") List<Double> tempMax,
      @JsonProperty("temperature_2m_min") List<Double> tempMin
  ) {}
}
