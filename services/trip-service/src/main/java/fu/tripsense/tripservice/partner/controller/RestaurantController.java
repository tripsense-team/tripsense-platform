package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.service.RestaurantService;
import fu.tripsense.tripservice.partner.service.PartnerAnalyticsService;
import fu.tripsense.tripservice.partner.service.RestaurantAvailabilityService;
import fu.tripsense.tripservice.security.CurrentUserProvider;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class RestaurantController {

  private final RestaurantService restaurantService;
  private final PartnerAnalyticsService analyticsService;
  private final RestaurantAvailabilityService availabilityService;
  private final CurrentUserProvider currentUserProvider;

  @GetMapping("/api/partners/businesses/{id}/restaurant-availability")
  public ResponseEntity<ApiResponse<RestaurantAvailabilityDto>> getRestaurantAvailabilitySettings(
      @PathVariable UUID id) {
    return ResponseEntity.ok(ApiResponse.success(availabilityService.getSettings(currentUserProvider.get(), id)));
  }

  @PutMapping("/api/partners/businesses/{id}/restaurant-availability")
  public ResponseEntity<ApiResponse<RestaurantAvailabilityDto>> updateRestaurantAvailabilitySettings(
      @PathVariable UUID id, @Valid @RequestBody UpdateRestaurantAvailabilityRequest request) {
    return ResponseEntity.ok(ApiResponse.success(
        availabilityService.updateSettings(currentUserProvider.get(), id, request)));
  }

  @GetMapping("/api/restaurants/{id}/availability")
  public ResponseEntity<ApiResponse<RestaurantAvailabilityResponse>> getRestaurantAvailability(
      @PathVariable UUID id, @RequestParam LocalDate date, @RequestParam int partySize) {
    return ResponseEntity.ok(ApiResponse.success(availabilityService.getAvailableSlots(id, date, partySize)));
  }

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

  @PostMapping(
      value = "/api/partners/businesses/{id}/restaurant-menu/images",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<ApiResponse<RestaurantMenuImageUploadDto>> uploadMenuImage(
      @PathVariable UUID id, @RequestPart("file") MultipartFile file) {
    RestaurantMenuImageUploadDto uploaded =
        restaurantService.uploadMenuImage(currentUserProvider.get(), id, file);
    return ResponseEntity.ok(ApiResponse.success(uploaded));
  }

  @DeleteMapping("/api/partners/businesses/{id}/restaurant-menu/images")
  public ResponseEntity<ApiResponse<Void>> deleteUnreferencedMenuImage(
      @PathVariable UUID id, @RequestParam String imagePublicId) {
    restaurantService.deleteUnreferencedMenuImage(currentUserProvider.get(), id, imagePublicId);
    return ResponseEntity.ok(ApiResponse.success(null));
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

  @PostMapping("/api/restaurants/{id}/views")
  public ResponseEntity<Void> recordRestaurantView(
      @PathVariable UUID id, @Valid @RequestBody RestaurantViewRequest request) {
    analyticsService.recordRestaurantView(currentUserProvider.getIfAuthenticated(), id, request.sessionKey());
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/api/partners/businesses/{id}/analytics")
  public ResponseEntity<ApiResponse<PartnerAnalyticsSummaryDto>> getAnalytics(
      @PathVariable UUID id, @RequestParam(defaultValue = "30") int periodDays) {
    var summary = analyticsService.getSummary(currentUserProvider.get(), id, periodDays);
    return ResponseEntity.ok(ApiResponse.success(summary));
  }

  @GetMapping("/api/partners/analytics")
  public ResponseEntity<ApiResponse<fu.tripsense.tripservice.partner.dto.PartnerAnalyticsDashboardDto>> getPartnerAnalyticsDashboard(
      @RequestParam(required = false) UUID businessId,
      @RequestParam(defaultValue = "30") int periodDays) {
    var dashboard = analyticsService.getDashboard(currentUserProvider.get(), businessId, periodDays);
    return ResponseEntity.ok(ApiResponse.success(dashboard));
  }

  @GetMapping("/api/public/restaurants")
  public ResponseEntity<ApiResponse<List<PublicRestaurantListingDto>>> searchPublicRestaurants(
      @RequestParam(required = false) String query) {
    List<PublicRestaurantListingDto> dtos = restaurantService.searchPublicRestaurants(query);
    return ResponseEntity.ok(ApiResponse.success(dtos));
  }

  @GetMapping("/api/partner-listings/{id}")
  public ResponseEntity<ApiResponse<PublicRestaurantListingDto>> getPartnerListing(
      @PathVariable UUID id) {
    PublicRestaurantListingDto dto = restaurantService.getPublicRestaurant(id);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }
}
