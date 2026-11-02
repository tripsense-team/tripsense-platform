package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.enums.BusinessKind;
import fu.tripsense.tripservice.partner.service.PartnerSubscriptionService;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class PartnerSubscriptionController {

  private final PartnerSubscriptionService subscriptionService;

  @GetMapping("/api/subscription-plans")
  public ResponseEntity<ApiResponse<List<PartnerSubscriptionPlanDto>>> getSubscriptionPlans(
      @RequestParam(required = false, defaultValue = "RESTAURANT") BusinessKind businessKind) {
    return ResponseEntity.ok(ApiResponse.success(subscriptionService.getPlans(businessKind)));
  }

  @GetMapping("/api/partners/businesses/{businessId}/subscription")
  public ResponseEntity<ApiResponse<PartnerSubscriptionDto>> getSubscription(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID businessId) {
    return ResponseEntity.ok(ApiResponse.success(subscriptionService.getSubscription(user, businessId)));
  }

  @PostMapping("/api/partners/businesses/{businessId}/subscription/checkout")
  public ResponseEntity<ApiResponse<SubscriptionCheckoutResponse>> createCheckout(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID businessId,
      @Valid @RequestBody SubscriptionCheckoutRequest request) {
    return ResponseEntity.ok(ApiResponse.success(subscriptionService.createCheckout(user, businessId, request)));
  }

  @GetMapping("/api/partners/businesses/{businessId}/subscription/orders/{orderCode}/status")
  public ResponseEntity<ApiResponse<Map<String, Object>>> getOrderStatus(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID businessId,
      @PathVariable Long orderCode) {
    return ResponseEntity.ok(ApiResponse.success(subscriptionService.getOrderStatus(user, businessId, orderCode)));
  }

  @PostMapping("/api/partners/businesses/{businessId}/subscription/orders/{orderCode}/verify-manual")
  public ResponseEntity<ApiResponse<PartnerSubscriptionDto>> verifyManualPayment(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID businessId,
      @PathVariable Long orderCode) {
    return ResponseEntity.ok(ApiResponse.success(subscriptionService.verifyManualPayment(user, businessId, orderCode)));
  }
}
