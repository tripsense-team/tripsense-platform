package fu.tripsense.tripservice.hotel;

import fu.tripsense.tripservice.security.AuthenticatedUser;
import io.micrometer.core.instrument.MeterRegistry;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import vn.payos.PayOS;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkRequest;

@Service
public class PayOsPaymentService {
  private static final Logger log = LoggerFactory.getLogger(PayOsPaymentService.class);
  private final JdbcTemplate db;
  private final TransactionTemplate tx;
  private final HotelService hotels;
  private final MeterRegistry metrics;
  @Nullable private final PayOS payOS;
  @Value("${payos.enabled:false}") private boolean enabled;
  @Value("${payos.return-base-url:http://localhost:3000}") private String returnBaseUrl;

  public PayOsPaymentService(JdbcTemplate db, TransactionTemplate tx, HotelService hotels,
      MeterRegistry metrics, @org.springframework.beans.factory.annotation.Autowired(required = false) @Nullable PayOS payOS) {
    this.db = db; this.tx = tx; this.hotels = hotels; this.metrics = metrics; this.payOS = payOS;
  }

  private void requireEnabled() {
    if (!enabled || payOS == null) throw hotels.error("PAYOS_DISABLED", HttpStatus.SERVICE_UNAVAILABLE);
  }

  /** Create or retrieve existing payment link for a booking. */
  public Map<String, Object> createOrGetPayment(AuthenticatedUser u, UUID bookingId) {
    requireEnabled();
    return tx.execute(s -> {
      var b = hotels.bookingDetail(u, bookingId);
      if (!u.id().equals(b.get("customer_id"))) throw hotels.error("HOTEL_NOT_FOUND", HttpStatus.NOT_FOUND);
      if (!"PAYOS".equals(b.get("payment_method"))) throw hotels.error("HOTEL_INVALID_PAYMENT_METHOD", HttpStatus.CONFLICT);
      if (!"HELD".equals(b.get("status"))) throw hotels.error("HOTEL_INVALID_STATE", HttpStatus.CONFLICT);

      // Check existing payment row
      var existing = db.queryForList("SELECT * FROM hotel_payos_payment WHERE booking_id=?", bookingId);
      if (!existing.isEmpty()) {
        var p = existing.getFirst();
        String state = (String) p.get("state");
        if ("PAID".equals(state)) return paymentResult(bookingId);
        if ("PENDING".equals(state) || "CREATING".equals(state)) return paymentResult(bookingId);
        if (Set.of("CANCELLED", "EXPIRED", "FAILED").contains(state))
          throw hotels.error("HOTEL_PAYMENT_EXPIRED", HttpStatus.CONFLICT);
      }

      // Create new payment row
      BigDecimal total = (BigDecimal) b.get("total");
      long amountVnd = total.setScale(0, java.math.RoundingMode.HALF_UP).longValue();
      if (amountVnd <= 0) throw hotels.error("HOTEL_INVALID_AMOUNT", HttpStatus.BAD_REQUEST);

      // Hold expiry drives payment expiry
      Object expiresAtObj = b.get("expires_at");
      Instant holdExpiry = expiresAtObj instanceof java.sql.Timestamp ts ? ts.toInstant() : Instant.now().plusSeconds(600);
      int expiredAtUnix = (int) holdExpiry.getEpochSecond();

      db.update("""
          INSERT INTO hotel_payos_payment(booking_id,amount,currency,state,expires_at)
          VALUES (?,?,'VND','CREATING',?) ON CONFLICT(booking_id) DO NOTHING
          """, bookingId, amountVnd, java.sql.Timestamp.from(holdExpiry));

      var row = db.queryForList("SELECT * FROM hotel_payos_payment WHERE booking_id=? FOR UPDATE", bookingId).getFirst();
      if (!"CREATING".equals(row.get("state"))) return paymentResult(bookingId);

      long orderCode = ((Number) row.get("order_code")).longValue();
      String returnUrl = returnBaseUrl + "/hotels/payment-result/" + bookingId;
      String cancelUrl = returnUrl + "?cancelled=true";
      String description = "TripSense #" + orderCode;
      if (description.length() > 25) description = "TS#" + orderCode;

      return row; // Will call provider outside transaction
    });
  }

  /** Called after transaction to make the actual provider HTTP call, then persist result. */
  public Map<String, Object> executeProviderCreate(UUID bookingId) {
    requireEnabled();
    var row = db.queryForList("SELECT * FROM hotel_payos_payment WHERE booking_id=? AND state='CREATING'", bookingId);
    if (row.isEmpty()) return paymentResult(bookingId); // Already processed

    var p = row.getFirst();
    long orderCode = ((Number) p.get("order_code")).longValue();
    long amount = ((Number) p.get("amount")).longValue();
    Instant expiresAt = ((java.sql.Timestamp) p.get("expires_at")).toInstant();
    long expiredAtUnix = expiresAt.getEpochSecond();


    String returnUrl = returnBaseUrl + "/hotels/payment-result/" + bookingId;
    String cancelUrl = returnUrl + "?cancelled=true";
    String description = "TripSense #" + orderCode;
    if (description.length() > 25) description = "TS#" + orderCode;

    try {
      var req = CreatePaymentLinkRequest.builder()
          .orderCode(orderCode)
          .amount(amount)
          .description(description)
          .cancelUrl(cancelUrl)
          .returnUrl(returnUrl)
          .expiredAt(expiredAtUnix)
          .build();

      var link = payOS.paymentRequests().create(req);
      String checkoutUrl = link.getCheckoutUrl();
      String linkId = link.getPaymentLinkId();

      db.update("""
          UPDATE hotel_payos_payment SET state='PENDING',checkout_url=?,payment_link_id=?,last_checked_at=now()
          WHERE booking_id=? AND state='CREATING'
          """, checkoutUrl, linkId, bookingId);
      metrics.counter("hotel.payos.links.created").increment();
    } catch (Exception e) {
      log.warn("payos_create_failed booking={} error={}", bookingId, e.getMessage());
      db.update("""
          UPDATE hotel_payos_payment SET state='FAILED',last_error_code=?,attempts=attempts+1,
          next_attempt=clock_timestamp()+interval '30 seconds'
          WHERE booking_id=? AND state='CREATING'
          """, e.getClass().getSimpleName(), bookingId);
      metrics.counter("hotel.payos.links.failures").increment();
      throw hotels.error("PAYOS_CREATE_FAILED", HttpStatus.SERVICE_UNAVAILABLE);
    }
    return paymentResult(bookingId);
  }

  /** Full create-or-get + provider call in one user-facing method. */
  public Map<String, Object> initiatePayment(AuthenticatedUser u, UUID bookingId) {
    createOrGetPayment(u, bookingId);
    return executeProviderCreate(bookingId);
  }

  /** Read local payment status. */
  public Map<String, Object> getPaymentStatus(AuthenticatedUser u, UUID bookingId) {
    hotels.bookingDetail(u, bookingId); // Auth check
    return paymentResult(bookingId);
  }

  /** Process a verified webhook. Idempotent. */
  public void handlePaidWebhook(long orderCode, long receivedAmount, String currency,
      String providerReference, Instant receivedAt) {
    tx.executeWithoutResult(s -> {
      var rows = db.queryForList("SELECT * FROM hotel_payos_payment WHERE order_code=? FOR UPDATE", orderCode);
      if (rows.isEmpty()) { log.warn("payos_webhook_unknown_order orderCode={}", orderCode); return; }
      var p = rows.getFirst();
      UUID bookingId = (UUID) p.get("booking_id");
      long expectedAmount = ((Number) p.get("amount")).longValue();
      String state = (String) p.get("state");

      // Already paid — deduplicate
      if ("PAID".equals(state)) return;

      // Record receipt (idempotent via unique provider_reference)
      int inserted = db.update("""
          INSERT INTO hotel_payos_receipt(id,booking_id,provider_reference,received_amount,currency,received_at)
          VALUES (?,?,?,?,?,?) ON CONFLICT(provider_reference) DO NOTHING
          """, UUID.randomUUID(), bookingId, providerReference, receivedAmount, currency,
          java.sql.Timestamp.from(receivedAt));
      if (inserted == 0) return; // Replay

      // Amount/currency mismatch → review required
      if (receivedAmount != expectedAmount || !"VND".equals(currency)) {
        db.update("UPDATE hotel_payos_payment SET state='PAID',paid_at=now(),resolution='REVIEW_REQUIRED' WHERE booking_id=?", bookingId);
        metrics.counter("hotel.payos.payments.mismatched").increment();
        log.warn("payos_amount_mismatch booking={} expected={} received={}", bookingId, expectedAmount, receivedAmount);
        return;
      }

      // Mark paid
      db.update("UPDATE hotel_payos_payment SET state='PAID',paid_at=now(),last_checked_at=now() WHERE booking_id=?", bookingId);
      metrics.counter("hotel.payos.payments.captured").increment();

      // Try to confirm booking
      var b = db.queryForList("SELECT * FROM hotel_booking WHERE id=? FOR UPDATE", bookingId);
      if (b.isEmpty()) return;
      var booking = b.getFirst();
      String bookingStatus = (String) booking.get("status");

      if ("HELD".equals(bookingStatus)) {
        try {
          hotels.confirmPayosBooking(bookingId);
        } catch (Exception e) {
          // Cannot fulfil but money received
          db.update("UPDATE hotel_payos_payment SET resolution='REFUND_REQUIRED' WHERE booking_id=?", bookingId);
          metrics.counter("hotel.payos.payments.refund_required").increment();
          log.warn("payos_confirm_failed booking={} error={}", bookingId, e.getMessage());
        }
      } else {
        // Booking already expired/cancelled but money arrived
        db.update("UPDATE hotel_payos_payment SET resolution='REFUND_REQUIRED' WHERE booking_id=?", bookingId);
        metrics.counter("hotel.payos.payments.late_arrival").increment();
        log.warn("payos_late_payment booking={} bookingStatus={}", bookingId, bookingStatus);
      }
    });
  }

  /** Reconciliation: check pending payments against provider. Called from HotelJobs. */
  public void reconcile() {
    if (!enabled || payOS == null) return;
    var candidates = db.queryForList("""
        SELECT booking_id,order_code,payment_link_id FROM hotel_payos_payment
        WHERE state IN ('CREATING','PENDING') AND next_attempt<=clock_timestamp() AND (lease_until IS NULL OR lease_until<clock_timestamp())
        ORDER BY next_attempt LIMIT 10
        """);
    for (var c : candidates) {
      UUID bookingId = (UUID) c.get("booking_id");
      try {
        UUID lease = UUID.randomUUID();
        int claimed = db.update("""
            UPDATE hotel_payos_payment SET lease_token=?,lease_until=clock_timestamp()+interval '1 minute'
            WHERE booking_id=? AND (lease_until IS NULL OR lease_until<clock_timestamp())
            """, lease, bookingId);
        if (claimed == 0) continue;

        String linkId = (String) c.get("payment_link_id");
        long orderCode = ((Number) c.get("order_code")).longValue();
        String lookupId = linkId != null ? linkId : String.valueOf(orderCode);

        var info = payOS.paymentRequests().get(lookupId);
        String providerStatus = info.getStatus() != null ? info.getStatus().name() : "";

        db.update("UPDATE hotel_payos_payment SET last_checked_at=now(),lease_until=NULL,lease_token=NULL WHERE booking_id=?", bookingId);

        if ("PAID".equals(providerStatus)) {
          // Trigger paid handling
          var transactions = info.getTransactions();
          if (transactions != null && !transactions.isEmpty()) {
            var t = transactions.getFirst();
            handlePaidWebhook(orderCode, (long) info.getAmount(), "VND",
                t.getReference() != null ? t.getReference() : "reconcile-" + orderCode,
                Instant.now());
          }
        } else if ("CANCELLED".equals(providerStatus) || "EXPIRED".equals(providerStatus)) {
          db.update("UPDATE hotel_payos_payment SET state=? WHERE booking_id=? AND state IN ('CREATING','PENDING')",
              providerStatus, bookingId);
        }
      } catch (Exception e) {
        db.update("""
            UPDATE hotel_payos_payment SET attempts=attempts+1,lease_until=NULL,lease_token=NULL,
            next_attempt=clock_timestamp()+least(3600,power(2,attempts+1)*30)*interval '1 second',
            last_error_code=? WHERE booking_id=?
            """, e.getClass().getSimpleName(), bookingId);
        log.warn("payos_reconcile_failed booking={} error={}", bookingId, e.getMessage());
      }
    }
  }

  /** Mark payment as needing refund when booking is cancelled. */
  public void markRefundRequired(UUID bookingId) {
    db.update("""
        UPDATE hotel_payos_payment SET resolution='REFUND_REQUIRED'
        WHERE booking_id=? AND state='PAID' AND resolution='NONE'
        """, bookingId);
  }

  Map<String, Object> paymentResult(UUID bookingId) {
    var payments = db.queryForList("SELECT * FROM hotel_payos_payment WHERE booking_id=?", bookingId);
    var booking = hotels.bookingDirect(bookingId);
    if (payments.isEmpty()) return Map.of("booking", booking);
    var p = payments.getFirst();
    return Map.of("booking", booking, "payment", Map.of(
        "provider", "PAYOS",
        "state", p.get("state"),
        "amount", p.get("amount"),
        "currency", p.get("currency"),
        "checkoutUrl", p.get("checkout_url") != null ? p.get("checkout_url") : "",
        "expiresAt", p.get("expires_at"),
        "resolution", p.get("resolution"),
        "lastCheckedAt", p.get("last_checked_at") != null ? p.get("last_checked_at") : ""
    ));
  }
}
