package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.enums.RentalCategory;
import fu.tripsense.tripservice.partner.service.RentalService;
import fu.tripsense.tripservice.security.CurrentUserProvider;
import jakarta.validation.Valid;
import java.time.Instant;
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
@RequestMapping("/api")
public class RentalBookingController {

  private final RentalService rentalService;
  private final CurrentUserProvider currentUserProvider;

  @GetMapping("/rental-items")
  public ResponseEntity<ApiResponse<List<RentalItemDto>>> getRentalItems(
      @RequestParam(required = false) UUID businessId,
      @RequestParam(required = false) RentalCategory category,
      @RequestParam(required = false) String query) {
    if (businessId != null) {
      return ResponseEntity.ok(ApiResponse.success(rentalService.getActiveRentalItemsByBusiness(businessId)));
    }
    return ResponseEntity.ok(ApiResponse.success(rentalService.searchRentalItemsList(category, query)));
  }

  @GetMapping("/rental-items/{id}")
  public ResponseEntity<ApiResponse<RentalItemDto>> getRentalItem(@PathVariable UUID id) {
    return ResponseEntity.ok(ApiResponse.success(rentalService.getRentalItem(id)));
  }

  @GetMapping("/rental-items/{id}/availability")
  public ResponseEntity<ApiResponse<Map<String, Object>>> checkAvailability(
      @PathVariable UUID id,
      @RequestParam Instant pickupAt,
      @RequestParam Instant returnAt,
      @RequestParam(defaultValue = "1") int quantity) {
    return ResponseEntity.ok(
        ApiResponse.success(rentalService.checkAvailability(id, pickupAt, returnAt, quantity)));
  }

  @GetMapping("/rental-items/businesses/{businessId}")
  public ResponseEntity<ApiResponse<List<RentalItemDto>>> getActiveRentalItemsByBusiness(
      @PathVariable UUID businessId) {
    return ResponseEntity.ok(ApiResponse.success(rentalService.getActiveRentalItemsByBusiness(businessId)));
  }

  @GetMapping("/rental-items/search")
  public ResponseEntity<ApiResponse<Page<RentalItemDto>>> searchRentalItems(
      @RequestParam(required = false) RentalCategory category,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return ResponseEntity.ok(
        ApiResponse.success(rentalService.searchRentalItems(category, PageRequest.of(page, size))));
  }

  @PostMapping("/rental-bookings")
  public ResponseEntity<ApiResponse<RentalBookingOrderDto>> createBooking(
      @Valid @RequestBody CreateRentalBookingRequest req) {
    UUID customerId = currentUserProvider.userId();
    return ResponseEntity.ok(ApiResponse.success(rentalService.createBooking(customerId, req)));
  }

  @GetMapping({"/rental-bookings/my", "/rental-bookings/me"})
  public ResponseEntity<ApiResponse<List<RentalBookingOrderDto>>> getMyBookings() {
    UUID customerId = currentUserProvider.userId();
    return ResponseEntity.ok(ApiResponse.success(rentalService.getBookingsByCustomer(customerId)));
  }

  @PostMapping("/rental-bookings/{id}/cancel")
  public ResponseEntity<ApiResponse<RentalBookingOrderDto>> cancelBooking(
      @PathVariable UUID id, @RequestBody(required = false) Map<String, String> body) {
    UUID customerId = currentUserProvider.userId();
    String reason = body != null ? body.get("reason") : "Customer cancelled";
    return ResponseEntity.ok(ApiResponse.success(rentalService.cancelBooking(customerId, id, reason)));
  }
}
