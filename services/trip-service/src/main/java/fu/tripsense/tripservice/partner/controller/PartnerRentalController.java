package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.service.RentalService;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import fu.tripsense.tripservice.security.CurrentUserProvider;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/partners")
public class PartnerRentalController {

  private final RentalService rentalService;
  private final CurrentUserProvider currentUserProvider;

  @GetMapping("/businesses/{businessId}/rental-items")
  public ResponseEntity<ApiResponse<List<RentalItemDto>>> getRentalItems(
      @PathVariable UUID businessId) {
    currentUserProvider.get(); // Require auth
    return ResponseEntity.ok(ApiResponse.success(rentalService.getRentalItemsByBusiness(businessId)));
  }

  @PostMapping("/businesses/{businessId}/rental-items")
  public ResponseEntity<ApiResponse<RentalItemDto>> createRentalItem(
      @PathVariable UUID businessId, @Valid @RequestBody CreateRentalItemRequest req) {
    AuthenticatedUser user = currentUserProvider.get();
    return ResponseEntity.ok(ApiResponse.success(rentalService.createRentalItem(user, businessId, req)));
  }

  @PutMapping("/businesses/{businessId}/rental-items/{itemId}")
  public ResponseEntity<ApiResponse<RentalItemDto>> updateRentalItem(
      @PathVariable UUID businessId,
      @PathVariable UUID itemId,
      @Valid @RequestBody UpdateRentalItemRequest req) {
    AuthenticatedUser user = currentUserProvider.get();
    return ResponseEntity.ok(ApiResponse.success(rentalService.updateRentalItem(user, businessId, itemId, req)));
  }

  @DeleteMapping("/businesses/{businessId}/rental-items/{itemId}")
  public ResponseEntity<ApiResponse<Void>> deleteRentalItem(
      @PathVariable UUID businessId, @PathVariable UUID itemId) {
    AuthenticatedUser user = currentUserProvider.get();
    rentalService.deleteRentalItem(user, businessId, itemId);
    return ResponseEntity.ok(ApiResponse.success(null));
  }

  @GetMapping("/businesses/{businessId}/rental-bookings")
  public ResponseEntity<ApiResponse<Page<RentalBookingOrderDto>>> getRentalBookings(
      @PathVariable UUID businessId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    AuthenticatedUser user = currentUserProvider.get();
    return ResponseEntity.ok(
        ApiResponse.success(rentalService.getBookingsByBusiness(user, businessId, PageRequest.of(page, size))));
  }

  @PostMapping("/businesses/{businessId}/rental-bookings/{bookingId}/confirm")
  public ResponseEntity<ApiResponse<RentalBookingOrderDto>> confirmBooking(
      @PathVariable UUID businessId, @PathVariable UUID bookingId) {
    AuthenticatedUser user = currentUserProvider.get();
    return ResponseEntity.ok(ApiResponse.success(rentalService.confirmBooking(user, businessId, bookingId)));
  }

  @PostMapping("/businesses/{businessId}/rental-bookings/{bookingId}/handover")
  public ResponseEntity<ApiResponse<RentalBookingOrderDto>> handoverBooking(
      @PathVariable UUID businessId, @PathVariable UUID bookingId) {
    AuthenticatedUser user = currentUserProvider.get();
    return ResponseEntity.ok(ApiResponse.success(rentalService.handoverBooking(user, businessId, bookingId)));
  }

  @PostMapping("/businesses/{businessId}/rental-bookings/{bookingId}/return")
  public ResponseEntity<ApiResponse<RentalBookingOrderDto>> returnBooking(
      @PathVariable UUID businessId,
      @PathVariable UUID bookingId,
      @RequestBody(required = false) Map<String, Object> body) {
    AuthenticatedUser user = currentUserProvider.get();
    BigDecimal overdueFee = BigDecimal.ZERO;
    String partnerNote = null;
    if (body != null) {
      if (body.get("overdueFee") != null) {
        overdueFee = new BigDecimal(body.get("overdueFee").toString());
      }
      if (body.get("partnerNote") != null) {
        partnerNote = body.get("partnerNote").toString();
      }
    }
    return ResponseEntity.ok(
        ApiResponse.success(rentalService.returnBooking(user, businessId, bookingId, overdueFee, partnerNote)));
  }

  @PostMapping("/businesses/{businessId}/rental-bookings/{bookingId}/reject")
  public ResponseEntity<ApiResponse<RentalBookingOrderDto>> rejectBooking(
      @PathVariable UUID businessId,
      @PathVariable UUID bookingId,
      @RequestBody(required = false) Map<String, String> body) {
    AuthenticatedUser user = currentUserProvider.get();
    String reason = body != null ? body.get("reason") : null;
    return ResponseEntity.ok(ApiResponse.success(rentalService.rejectBooking(user, businessId, bookingId, reason)));
  }
}
