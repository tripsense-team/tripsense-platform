package fu.tripsense.userservice.controller;

import fu.tripsense.userservice.dto.response.AdminUserStatsDto;
import fu.tripsense.userservice.dto.response.ApiResponse;
import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.service.AdminUserStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users/admin")
@RequiredArgsConstructor
public class AdminUserStatsController {

  private final AdminUserStatsService adminUserStatsService;

  @GetMapping("/stats")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<ApiResponse<AdminUserStatsDto>> getStats(
      @AuthenticationPrincipal User currentUser,
      @RequestParam(name = "periodDays", defaultValue = "30") Integer periodDays) {
    return ResponseEntity.ok(
        ApiResponse.success(adminUserStatsService.getStats(currentUser, periodDays)));
  }
}

