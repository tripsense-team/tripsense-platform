package fu.tripsense.recommendation.api;

import fu.tripsense.recommendation.api.dto.AdminRecommendationStatsResponse;
import fu.tripsense.recommendation.application.AdminRecommendationStatsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recommendations/admin")
public class AdminRecommendationStatsController {

  private final AdminRecommendationStatsService statsService;

  public AdminRecommendationStatsController(AdminRecommendationStatsService statsService) {
    this.statsService = statsService;
  }

  @GetMapping("/stats")
  public ResponseEntity<AdminRecommendationStatsResponse> getStats(
      @RequestParam(defaultValue = "30") int periodDays) {
    return ResponseEntity.ok(statsService.getStats(periodDays));
  }
}

