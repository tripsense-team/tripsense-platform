package fu.tripsense.contextservice.adapter.in.web;

import fu.tripsense.contextservice.adapter.in.web.dto.AdminContextStatsResponse;
import fu.tripsense.contextservice.application.service.AdminContextStatsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/context/admin")
public class AdminContextStatsController {

  private final AdminContextStatsService statsService;

  public AdminContextStatsController(AdminContextStatsService statsService) {
    this.statsService = statsService;
  }

  @GetMapping("/stats")
  public ResponseEntity<AdminContextStatsResponse> getStats(
      @RequestParam(defaultValue = "30") int periodDays) {
    return ResponseEntity.ok(statsService.getStats(periodDays));
  }
}

