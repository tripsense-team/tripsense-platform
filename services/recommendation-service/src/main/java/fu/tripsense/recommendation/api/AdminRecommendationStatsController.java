package fu.tripsense.recommendation.api;

import fu.tripsense.recommendation.api.dto.AdminRecommendationStatsResponse;
import fu.tripsense.recommendation.api.dto.AdminRecommendationStatsResponse.FunnelStats;
import fu.tripsense.recommendation.api.dto.AdminRecommendationStatsResponse.PersonalizationComparison;
import fu.tripsense.recommendation.api.dto.AdminRecommendationStatsResponse.PositionBucketStats;
import fu.tripsense.recommendation.application.AdminRecommendationStatsResult;
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
    return ResponseEntity.ok(toResponse(statsService.getStats(periodDays)));
  }

  private static AdminRecommendationStatsResponse toResponse(AdminRecommendationStatsResult r) {
    return new AdminRecommendationStatsResponse(
        r.periodDays(),
        r.totalImpressions(),
        r.periodImpressions(),
        r.totalRecommendedItems(),
        new FunnelStats(
            r.funnel().impressions(),
            r.funnel().clicks(),
            r.funnel().detailViews(),
            r.funnel().saves(),
            r.funnel().addToTrip(),
            r.funnel().ctrPercent(),
            r.funnel().conversionRatePercent()),
        r.positionBuckets().stream()
            .map(b -> new PositionBucketStats(b.bucket(), b.impressions(), b.clicks(), b.ctrPercent()))
            .toList(),
        new PersonalizationComparison(
            r.personalizationComparison().personalizedImpressions(),
            r.personalizationComparison().personalizedCtrPercent(),
            r.personalizationComparison().degradedImpressions(),
            r.personalizationComparison().degradedCtrPercent()));
  }
}

