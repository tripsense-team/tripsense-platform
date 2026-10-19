package fu.tripsense.tripservice.hotel;

import static fu.tripsense.tripservice.hotel.HotelFinanceDtos.*;

import fu.tripsense.tripservice.security.CurrentUserProvider;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/hotels")
public class HotelFinanceController {

  private final HotelFinanceService finance;
  private final CurrentUserProvider users;

  public HotelFinanceController(HotelFinanceService finance, CurrentUserProvider users) {
    this.finance = finance;
    this.users = users;
  }

  // --- Partner Endpoints ---

  @GetMapping("/finance/summary")
  public Object getSummary(@RequestParam UUID businessId) {
    return finance.getPartnerSummary(users.get(), businessId);
  }

  @GetMapping("/finance/payout-account")
  public Object getPayoutAccount(@RequestParam UUID businessId) {
    return finance.getPayoutAccount(users.get(), businessId);
  }

  @PutMapping("/finance/payout-account")
  public Object updatePayoutAccount(@RequestParam UUID businessId, @Valid @RequestBody PayoutAccountInput input) {
    return finance.updatePayoutAccount(users.get(), businessId, input);
  }

  @PostMapping("/finance/withdrawals")
  public Object requestWithdrawal(@RequestParam UUID businessId, @Valid @RequestBody WithdrawalInput input) {
    return finance.requestWithdrawal(users.get(), businessId, input.amount());
  }

  @GetMapping("/finance/withdrawals")
  public Object getWithdrawals(@RequestParam UUID businessId) {
    return finance.getPartnerWithdrawals(users.get(), businessId);
  }

  @GetMapping("/finance/ledger")
  public Object getLedger(@RequestParam UUID businessId) {
    return finance.getPartnerLedger(users.get(), businessId);
  }

  // --- Customer Cancel with Refund Bank Account ---

  @PostMapping("/bookings/{id}/cancel-and-refund")
  public Object cancelAndRefund(@PathVariable UUID id, @Valid @RequestBody RefundInput input) {
    return finance.cancelAndRefund(users.get(), id, input);
  }

  // --- Admin Finance Management Endpoints ---

  @GetMapping("/admin/finance/overview")
  public Object getAdminOverview() {
    return finance.getAdminOverview(users.get());
  }

  @GetMapping("/admin/finance/withdrawals")
  public Object getAdminWithdrawals(@RequestParam(required = false) String status) {
    return finance.getAdminWithdrawals(users.get(), status);
  }

  @PostMapping("/admin/finance/withdrawals/{id}/complete")
  public Object completeAdminWithdrawal(@PathVariable UUID id, @RequestBody(required = false) PayoutCompletionInput input) {
    return finance.completeAdminWithdrawal(users.get(), id, input);
  }

  @PostMapping("/admin/finance/withdrawals/{id}/reject")
  public Object rejectAdminWithdrawal(@PathVariable UUID id, @Valid @RequestBody RejectInput input) {
    return finance.rejectAdminWithdrawal(users.get(), id, input.reason());
  }

  @GetMapping("/admin/finance/refunds")
  public Object getAdminRefunds(@RequestParam(required = false) String status) {
    return finance.getAdminRefunds(users.get(), status);
  }

  @PostMapping("/admin/finance/refunds/{id}/complete")
  public Object completeAdminRefund(@PathVariable UUID id, @RequestBody(required = false) PayoutCompletionInput input) {
    return finance.completeAdminRefund(users.get(), id, input);
  }

  @GetMapping("/admin/finance/ledger")
  public Object getAdminLedger() {
    return finance.getAdminLedger(users.get());
  }
}
