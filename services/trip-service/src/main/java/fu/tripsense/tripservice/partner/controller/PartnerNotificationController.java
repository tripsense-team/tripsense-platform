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
  private final fu.tripsense.tripservice.partner.service.PartnerNotificationRealtime realtime;

  @GetMapping(value = "/events", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
  public org.springframework.web.servlet.mvc.method.annotation.SseEmitter subscribeEvents(
      @AuthenticationPrincipal AuthenticatedUser user,
      jakarta.servlet.http.HttpServletResponse response) {
    if (user == null) {
      throw new fu.tripsense.tripservice.exception.TripServiceException(
          "UNAUTHORIZED", "Authentication required", org.springframework.http.HttpStatus.UNAUTHORIZED);
    }
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Accel-Buffering", "no");
    return realtime.connect(user.id());
  }

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

  @PostMapping("/read-all")
  public ResponseEntity<ApiResponse<Void>> markAllAsRead(
      @AuthenticationPrincipal AuthenticatedUser user) {
    notificationService.markAllAsRead(user);
    return ResponseEntity.ok(ApiResponse.success(null));
  }
}
