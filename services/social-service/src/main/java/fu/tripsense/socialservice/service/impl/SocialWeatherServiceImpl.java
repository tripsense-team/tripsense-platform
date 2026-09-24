package fu.tripsense.socialservice.service.impl;

import fu.tripsense.socialservice.client.OpenMeteoClient;
import fu.tripsense.socialservice.client.dto.OpenMeteoResponse;
import fu.tripsense.socialservice.dto.response.DestinationWeatherResponse;
import fu.tripsense.socialservice.model.DestinationCity;
import fu.tripsense.socialservice.service.SocialWeatherService;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class SocialWeatherServiceImpl implements SocialWeatherService {

  private static final Duration CACHE_TTL = Duration.ofMinutes(30);

  private final OpenMeteoClient openMeteoClient;
  private final Map<String, CachedWeather> weatherCache = new ConcurrentHashMap<>();

  record CachedWeather(DestinationWeatherResponse response, Instant cachedAt) {
    boolean isExpired(Duration ttl) {
      return Instant.now().isAfter(cachedAt.plus(ttl));
    }
  }

  record ConditionInfo(String condition, String conditionKey, String iconType) {}

  @Override
  public DestinationWeatherResponse getDestinationWeather(String cityId) {
    DestinationCity city = DestinationCity.fromId(cityId);

    CachedWeather cached = weatherCache.get(city.getId());
    if (cached != null && !cached.isExpired(CACHE_TTL)) {
      log.debug("Cache hit for destination weather: {}", city.getId());
      return cached.response();
    }

    try {
      Optional<OpenMeteoResponse> forecastOpt =
          openMeteoClient.fetchForecast(city.getLatitude(), city.getLongitude());

      if (forecastOpt.isPresent() && forecastOpt.get().current() != null) {
        DestinationWeatherResponse response = buildResponse(city, forecastOpt.get());
        weatherCache.put(city.getId(), new CachedWeather(response, Instant.now()));
        return response;
      }
    } catch (Exception ex) {
      log.warn(
          "Error retrieving live weather for {}: {}. Falling back to default preset.",
          city.getId(),
          ex.getMessage());
    }

    if (cached != null) {
      log.info("Serving stale cached weather for {}", city.getId());
      return cached.response();
    }

    return city.toFallbackResponse();
  }

  private DestinationWeatherResponse buildResponse(
      DestinationCity city, OpenMeteoResponse openMeteo) {
    var current = openMeteo.current();
    double tempVal = current.temperature() != null ? current.temperature() : city.getDefaultTemp();
    int temp = (int) Math.round(tempVal);
    int humidity =
        current.relativeHumidity() != null
            ? current.relativeHumidity()
            : city.getDefaultHumidity();

    ConditionInfo conditionInfo = mapWmoCode(current.weatherCode(), tempVal);

    String tempRange = city.getDefaultRange();
    if (openMeteo.daily() != null
        && openMeteo.daily().tempMin() != null
        && !openMeteo.daily().tempMin().isEmpty()
        && openMeteo.daily().tempMax() != null
        && !openMeteo.daily().tempMax().isEmpty()) {
      int min = (int) Math.round(openMeteo.daily().tempMin().get(0));
      int max = (int) Math.round(openMeteo.daily().tempMax().get(0));
      tempRange = min + "° – " + max + "°";
    }

    return new DestinationWeatherResponse(
        city.getId(),
        city.getCityName(),
        city.getCityKey(),
        temp,
        conditionInfo.condition(),
        conditionInfo.conditionKey(),
        tempRange,
        humidity,
        "Vừa cập nhật",
        conditionInfo.iconType(),
        city.getTravelTip(),
        city.getTravelTipKey());
  }

  ConditionInfo mapWmoCode(Integer code, double temp) {
    boolean isCold = temp <= 18.0;

    if (code == null) {
      return new ConditionInfo(
          isCold ? "Dịu mát" : "Nắng ráo",
          isCold ? "weatherConditionCool" : "weatherConditionSunny",
          isCold ? "cool" : "sunny");
    }

    return switch (code) {
      case 0 -> new ConditionInfo(
          "Trời quang", "weatherConditionSunny", isCold ? "cool" : "sunny");
      case 1, 2 -> new ConditionInfo(
          "Mây rải rác", "weatherConditionPartlyCloudy", isCold ? "cool" : "partlyCloudy");
      case 3 -> new ConditionInfo(
          "Nhiều mây", "weatherConditionCloudy", isCold ? "cool" : "cloudy");
      case 45, 48 -> new ConditionInfo("Có sương mù", "weatherConditionCool", "cool");
      case 51, 53, 55 -> new ConditionInfo(
          "Mưa phùn nhẹ", "weatherConditionRainy", "rainy");
      case 56, 57 -> new ConditionInfo(
          "Mưa phùn lạnh", "weatherConditionRainy", "rainy");
      case 61, 63, 65 -> new ConditionInfo(
          "Có mưa", "weatherConditionRainy", "rainy");
      case 66, 67 -> new ConditionInfo(
          "Mưa lạnh", "weatherConditionRainy", "rainy");
      case 71, 73, 75, 77, 85, 86 -> new ConditionInfo(
          "Rất lạnh", "weatherConditionCool", "cool");
      case 80, 81, 82 -> new ConditionInfo(
          "Mưa rào", "weatherConditionRainy", "rainy");
      case 95, 96, 99 -> new ConditionInfo(
          "Có giông sét", "weatherConditionRainy", "rainy");
      default -> new ConditionInfo(
          isCold ? "Dịu mát" : "Nắng ráo",
          isCold ? "weatherConditionCool" : "weatherConditionSunny",
          isCold ? "cool" : "sunny");
    };
  }
}
