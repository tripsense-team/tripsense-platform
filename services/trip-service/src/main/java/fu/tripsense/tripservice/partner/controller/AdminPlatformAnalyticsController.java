package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.AdminPlatformAnalyticsDto;
import fu.tripsense.tripservice.partner.service.AdminPlatformAnalyticsService;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/analytics")
@RequiredArgsConstructor
public class AdminPlatformAnalyticsController {

  private final AdminPlatformAnalyticsService analyticsService;

  @GetMapping("/overview")
  public ResponseEntity<ApiResponse<AdminPlatformAnalyticsDto>> getOverview(
      @AuthenticationPrincipal AuthenticatedUser admin,
      @RequestParam(name = "periodDays", defaultValue = "30") Integer periodDays) {
    return ResponseEntity.ok(
        ApiResponse.success(analyticsService.getOverview(admin, periodDays)));
  }
}

