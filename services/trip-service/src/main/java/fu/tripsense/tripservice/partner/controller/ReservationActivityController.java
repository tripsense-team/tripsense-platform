package fu.tripsense.tripservice.partner.controller;

import static fu.tripsense.tripservice.partner.dto.BookingActivitySummaryDtos.*;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.service.BookingActivitySummaryService;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import fu.tripsense.tripservice.security.CurrentUserProvider;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Endpoints providing lightweight booking activity counts and mark-seen actions. */
@RestController
@RequiredArgsConstructor
public class ReservationActivityController {

  private final BookingActivitySummaryService summaryService;
  private final CurrentUserProvider currentUserProvider;

  @GetMapping("/api/me/reservations/activity-summary")
  public ResponseEntity<ApiResponse<UserReservationActivitySummaryDto>> getUserActivitySummary() {
    AuthenticatedUser user = currentUserProvider.get();
    return ResponseEntity.ok(ApiResponse.success(summaryService.getUserSummary(user)));
  }

  @PostMapping("/api/me/reservations/activity-summary/mark-seen")
  public ResponseEntity<ApiResponse<UserReservationActivitySummaryDto>> markUserVerticalSeen(
      @Valid @RequestBody MarkReservationSeenRequest request) {
    AuthenticatedUser user = currentUserProvider.get();
    return ResponseEntity.ok(
        ApiResponse.success(summaryService.markUserVerticalSeen(user, request.vertical())));
  }

  @GetMapping("/api/partners/bookings/activity-summary")
  public ResponseEntity<ApiResponse<PartnerBookingsSummaryDto>> getPartnerActivitySummary() {
    AuthenticatedUser user = currentUserProvider.get();
    return ResponseEntity.ok(ApiResponse.success(summaryService.getPartnerSummary(user)));
  }
}

