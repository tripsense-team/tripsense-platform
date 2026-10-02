package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.PartnerNotificationDto;
import fu.tripsense.tripservice.partner.service.PartnerNotificationService;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/partners/notifications")
@RequiredArgsConstructor
public class PartnerNotificationController {

  private final PartnerNotificationService notificationService;

  @GetMapping
  public ResponseEntity<ApiResponse<List<PartnerNotificationDto>>> getMyNotifications(
      @AuthenticationPrincipal AuthenticatedUser user,
      @RequestParam(required = false, defaultValue = "false") boolean unreadOnly) {
    return ResponseEntity.ok(
        ApiResponse.success(notificationService.getMyNotifications(user, unreadOnly)));
  }

  @PostMapping("/{id}/read")
  public ResponseEntity<ApiResponse<PartnerNotificationDto>> markAsRead(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
    return ResponseEntity.ok(ApiResponse.success(notificationService.markAsRead(user, id)));
  }
}
