package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.AdminFinanceDtos.SubscriptionOrderPageDto;
import fu.tripsense.tripservice.partner.service.AdminSubscriptionOrderService;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/finance")
@RequiredArgsConstructor
public class AdminFinanceController {

  private final AdminSubscriptionOrderService subscriptionOrderService;

  @GetMapping("/subscription-orders")
  public ResponseEntity<ApiResponse<SubscriptionOrderPageDto>> listSubscriptionOrders(
      @AuthenticationPrincipal AuthenticatedUser admin,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String businessKind,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return ResponseEntity.ok(
        ApiResponse.success(
            subscriptionOrderService.listSubscriptionOrders(
                admin, status, businessKind, page, size)));
  }
}

