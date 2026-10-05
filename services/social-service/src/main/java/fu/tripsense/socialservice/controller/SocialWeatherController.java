package fu.tripsense.socialservice.controller;

import fu.tripsense.socialservice.dto.response.ApiResponse;
import fu.tripsense.socialservice.dto.response.DestinationWeatherResponse;
import fu.tripsense.socialservice.service.SocialWeatherService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/social")
@RequiredArgsConstructor
public class SocialWeatherController {

  private final SocialWeatherService weatherService;

  @GetMapping("/weather")
  public ApiResponse<DestinationWeatherResponse> getDestinationWeather(
      @RequestParam(defaultValue = "dalat") String cityId) {
    DestinationWeatherResponse response = weatherService.getDestinationWeather(cityId);
    return ApiResponse.success(response);
  }
}
