package fu.tripsense.socialservice.controller;

import fu.tripsense.socialservice.dto.response.ApiResponse;
import fu.tripsense.socialservice.dto.response.TrendingDestinationResponse;
import fu.tripsense.socialservice.service.SocialDestinationService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/social")
@RequiredArgsConstructor
public class SocialDestinationController {

  private final SocialDestinationService destinationService;

  @GetMapping({"/destinations/trending", "/trending-destinations"})
  public ApiResponse<List<TrendingDestinationResponse>> getTrendingDestinations(
      @RequestParam(defaultValue = "4") int limit) {
    List<TrendingDestinationResponse> response =
        destinationService.getTrendingDestinations(limit);
    return ApiResponse.success(response);
  }
}
