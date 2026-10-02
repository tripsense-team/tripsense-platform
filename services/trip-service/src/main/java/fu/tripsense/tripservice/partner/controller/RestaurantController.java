package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.service.RestaurantService;
import fu.tripsense.tripservice.security.CurrentUserProvider;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class RestaurantController {

  private final RestaurantService restaurantService;
  private final CurrentUserProvider currentUserProvider;

  @GetMapping("/api/partners/businesses/{id}/restaurant-menu")
  public ResponseEntity<ApiResponse<List<RestaurantMenuItemDto>>> getMenu(
      @PathVariable UUID id) {
    List<RestaurantMenuItemDto> menu = restaurantService.getMenu(currentUserProvider.get(), id);
    return ResponseEntity.ok(ApiResponse.success(menu));
  }

  @PutMapping("/api/partners/businesses/{id}/restaurant-menu")
  public ResponseEntity<ApiResponse<List<RestaurantMenuItemDto>>> updateMenu(
      @PathVariable UUID id, @Valid @RequestBody RestaurantMenuBatchRequest request) {
    List<RestaurantMenuItemDto> updated =
        restaurantService.updateMenu(currentUserProvider.get(), id, request);
    return ResponseEntity.ok(ApiResponse.success(updated));
  }

  @PutMapping("/api/partners/businesses/{id}/contact-sharing")
  public ResponseEntity<ApiResponse<Void>> updateContactSharing(
      @PathVariable UUID id, @Valid @RequestBody PublicContactConsentRequest request) {
    restaurantService.updateContactSharing(currentUserProvider.get(), id, request);
    return ResponseEntity.ok(ApiResponse.success(null));
  }

  @GetMapping("/api/public/restaurants/{id}")
  public ResponseEntity<ApiResponse<PublicRestaurantListingDto>> getPublicRestaurant(
      @PathVariable UUID id) {
    PublicRestaurantListingDto dto = restaurantService.getPublicRestaurant(id);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }

  @GetMapping("/api/partner-listings/{id}")
  public ResponseEntity<ApiResponse<PublicRestaurantListingDto>> getPartnerListing(
      @PathVariable UUID id) {
    PublicRestaurantListingDto dto = restaurantService.getPublicRestaurant(id);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }
}
