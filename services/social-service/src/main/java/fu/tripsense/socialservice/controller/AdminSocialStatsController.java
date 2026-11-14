package fu.tripsense.socialservice.controller;

import fu.tripsense.socialservice.dto.response.AdminSocialStatsResponse;
import fu.tripsense.socialservice.dto.response.ApiResponse;
import fu.tripsense.socialservice.security.CurrentUserProvider;
import fu.tripsense.socialservice.service.AdminSocialStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/social/admin")
@RequiredArgsConstructor
public class AdminSocialStatsController {

  private final AdminSocialStatsService statsService;
  private final CurrentUserProvider currentUser;

  @GetMapping("/stats")
  public ApiResponse<AdminSocialStatsResponse> getStats(
      @RequestParam(name = "periodDays", defaultValue = "30") Integer periodDays) {
    return ApiResponse.success(
        statsService.getStats(currentUser.requiredUser(), periodDays));
  }
}

