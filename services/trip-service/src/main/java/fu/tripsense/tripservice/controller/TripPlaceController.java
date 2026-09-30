package fu.tripsense.tripservice.controller;

import fu.tripsense.tripservice.dto.request.TripPlaceMembershipBatchRequest;
import fu.tripsense.tripservice.dto.response.*;
import fu.tripsense.tripservice.security.CurrentUserProvider;
import fu.tripsense.tripservice.service.TripPlaceService;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/trips")
@RequiredArgsConstructor
public class TripPlaceController {
  private final TripPlaceService service;
  private final CurrentUserProvider currentUser;

  @PostMapping("/place-memberships:batch")
  public ApiResponse<TripPlaceMembershipBatchResponse> memberships(
      @Valid @RequestBody TripPlaceMembershipBatchRequest request) {
    return ApiResponse.success(service.memberships(currentUser.userId(), request.placeRefs()));
  }

  @PutMapping("/{tripId}/places/{placeRef}")
  public ApiResponse<TripPlaceResponse> add(
      @PathVariable UUID tripId, @PathVariable String placeRef) {
    return ApiResponse.success("Place added to trip", service.add(currentUser.userId(), tripId, placeRef));
  }

  @DeleteMapping("/{tripId}/places/{placeRef}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void remove(@PathVariable UUID tripId, @PathVariable String placeRef) {
    service.remove(currentUser.userId(), tripId, placeRef);
  }

  @GetMapping("/{tripId}/places")
  public ApiResponse<TripPlacePageResponse> list(
      @PathVariable UUID tripId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "50") int size) {
    return ApiResponse.success(service.list(currentUser.userId(), tripId, page, size));
  }
}
