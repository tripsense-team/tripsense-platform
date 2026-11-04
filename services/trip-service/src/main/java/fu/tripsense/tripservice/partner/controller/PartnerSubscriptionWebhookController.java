package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.partner.service.PartnerSubscriptionService;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.annotation.*;
import vn.payos.PayOS;
import vn.payos.model.webhooks.Webhook;

@RestController
@RequestMapping("/api/partners/subscriptions/payos")
public class PartnerSubscriptionWebhookController {

  private static final Logger log = LoggerFactory.getLogger(PartnerSubscriptionWebhookController.class);

  @Nullable private final PayOS payOS;
  private final PartnerSubscriptionService subscriptionService;
  private final Environment environment;

  public PartnerSubscriptionWebhookController(
      @Autowired(required = false) @Nullable PayOS payOS,
      PartnerSubscriptionService subscriptionService,
      Environment environment) {
    this.payOS = payOS;
    this.subscriptionService = subscriptionService;
    this.environment = environment;
  }

  @PostMapping("/webhook")
  public ResponseEntity<String> webhook(@RequestBody Webhook webhook) {
    if (payOS == null) {
      // In local dev/test environment without PayOS credentials, allow simulated test payload if provided
      boolean isDevOrTest = environment.acceptsProfiles(Profiles.of("dev", "local", "test"));
      if (isDevOrTest && webhook.getData() != null) {
        long orderCode = webhook.getData().getOrderCode();
        long amount = webhook.getData().getAmount();
        String reference = webhook.getData().getReference() != null ? webhook.getData().getReference() : "dev-" + orderCode;
        subscriptionService.handlePaidWebhook(orderCode, amount, "VND", reference, Instant.now());
        return ResponseEntity.ok("OK (Dev simulated)");
      }
      return ResponseEntity.status(503).body("PayOS not configured");
    }

    try {
      var data = payOS.webhooks().verify(webhook);
      long orderCode = data.getOrderCode();
      long amount = data.getAmount();
      String reference = data.getReference() != null ? data.getReference() : "wh-sub-" + orderCode;

      if (orderCode == 0) {
        log.info("payos_subscription_test_webhook received, acknowledging");
        return ResponseEntity.ok("OK");
      }

      subscriptionService.handlePaidWebhook(orderCode, amount, "VND", reference, Instant.now());
      return ResponseEntity.ok("OK");
    } catch (Exception e) {
      log.warn("payos_subscription_webhook_invalid error={}", e.getMessage());
      return ResponseEntity.badRequest().body("Invalid webhook signature");
    }
  }
}
