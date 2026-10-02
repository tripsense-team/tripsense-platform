package fu.tripsense.tripservice.hotel;

import java.time.Instant;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.annotation.*;
import vn.payos.PayOS;
import vn.payos.model.webhooks.Webhook;


/**
 * Receives payOS webhook callbacks. Separate controller to avoid HotelResponseAdvice wrapping.
 * No JWT required — signature verification via payOS SDK.
 */
@RestController
@RequestMapping("/api/hotels/payments/payos")
public class PayOsWebhookController {
  private static final Logger log = LoggerFactory.getLogger(PayOsWebhookController.class);
  @Nullable private final PayOS payOS;
  private final PayOsPaymentService payments;

  public PayOsWebhookController(
      @Autowired(required = false) @Nullable PayOS payOS,
      PayOsPaymentService payments) {
    this.payOS = payOS;
    this.payments = payments;
  }

  @PostMapping("/webhook")
  public ResponseEntity<String> webhook(@RequestBody Webhook webhook) {
    if (payOS == null) return ResponseEntity.status(503).body("payOS disabled");
    try {
      var data = payOS.webhooks().verify(webhook);
      long orderCode = data.getOrderCode();
      long amount = data.getAmount();
      String reference = data.getReference() != null ? data.getReference() : "wh-" + orderCode;

      // ponytail: payOS sends a test webhook with orderCode=0 on confirm-webhook registration. Ignore it.
      if (orderCode == 0) {
        log.info("payos_test_webhook received, acknowledging");
        return ResponseEntity.ok("OK");
      }

      payments.handlePaidWebhook(orderCode, amount, "VND", reference, Instant.now());
      return ResponseEntity.ok("OK");
    } catch (Exception e) {
      log.warn("payos_webhook_invalid error={}", e.getMessage());
      return ResponseEntity.badRequest().body("Invalid webhook");
    }
  }
}
