package fu.tripsense.socialservice.service;

import fu.tripsense.socialservice.dto.response.DestinationWeatherResponse;

public interface SocialWeatherService {
  DestinationWeatherResponse getDestinationWeather(String cityId);
}
