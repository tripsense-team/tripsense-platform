package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.service.RestaurantReservationService;
import fu.tripsense.tripservice.security.CurrentUserProvider;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class RestaurantReservationController {

  private final RestaurantReservationService reservationService;
  private final CurrentUserProvider currentUserProvider;

  @PostMapping("/api/restaurants/{businessId}/reservation-requests")
  public ResponseEntity<ApiResponse<RestaurantReservationDto>> createRequest(
      @PathVariable UUID businessId,
      @RequestHeader(value = "Idempotency-Key", required = false) String requestKey,
      @Valid @RequestBody CreateRestaurantReservationRequest request) {
    RestaurantReservationDto dto =
        reservationService.createRequest(currentUserProvider.get(), businessId, requestKey, request);
    return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
  }

  @GetMapping("/api/me/restaurant-reservation-requests")
  public ResponseEntity<ApiResponse<Page<RestaurantReservationDto>>> getMyReservations(
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    Page<RestaurantReservationDto> dtos =
        reservationService.getCustomerReservations(currentUserProvider.get(), page, size);
    return ResponseEntity.ok(ApiResponse.success(dtos));
  }

  @GetMapping("/api/restaurant-reservation-requests/{id}")
  public ResponseEntity<ApiResponse<RestaurantReservationDto>> getReservation(
      @PathVariable UUID id) {
    RestaurantReservationDto dto = reservationService.getReservation(currentUserProvider.get(), id);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }

  @PostMapping("/api/restaurant-reservation-requests/{id}/cancel")
  public ResponseEntity<ApiResponse<RestaurantReservationDto>> cancelByCustomer(
      @PathVariable UUID id,
      @Valid @RequestBody CancelRestaurantReservationRequest request) {
    RestaurantReservationDto dto =
        reservationService.cancelByCustomer(currentUserProvider.get(), id, request);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }

  @GetMapping("/api/partners/businesses/{businessId}/reservation-requests")
  public ResponseEntity<ApiResponse<Page<RestaurantReservationDto>>> getBusinessReservations(
      @PathVariable UUID businessId,
      @RequestParam(required = false) String state,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    Page<RestaurantReservationDto> dtos =
        reservationService.getBusinessReservations(currentUserProvider.get(), businessId, state, page, size);
    return ResponseEntity.ok(ApiResponse.success(dtos));
  }

  @PostMapping("/api/partners/businesses/{businessId}/reservation-requests/{id}/decision")
  public ResponseEntity<ApiResponse<RestaurantReservationDto>> decideByPartner(
      @PathVariable UUID businessId,
      @PathVariable UUID id,
      @Valid @RequestBody RestaurantReservationDecisionRequest request) {
    RestaurantReservationDto dto =
        reservationService.decideByPartner(currentUserProvider.get(), businessId, id, request);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }
}
