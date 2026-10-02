package fu.tripsense.tripservice.hotel;

import static org.junit.jupiter.api.Assertions.*;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import fu.tripsense.tripservice.support.RealInfrastructureTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(properties = {
    "hotel.jobs.enabled=false",
    "spring.cache.type=simple",
    "payos.enabled=false"
})
class PayOsPaymentIntegrationTest extends RealInfrastructureTest {
  @Autowired HotelService service;
  @Autowired PayOsPaymentService payOsPayments;
  @Autowired JdbcTemplate db;
  @MockitoBean HotelMailClient mail;

  AuthenticatedUser owner, customer, admin;
  UUID pid, rid, businessId;
  LocalDate from, to;

  @BeforeEach
  void setup() {
    db.execute("TRUNCATE hotel_payos_receipt,hotel_payos_payment,hotel_demo_ledger,hotel_demo_command,hotel_demo_payment,hotel_email_delivery,hotel_notification,hotel_outbox,hotel_booking,hotel_inventory,hotel_room_type,hotel_property,hotel_request_lock CASCADE");
    owner = user("USER"); customer = user("USER"); admin = user("ROLE_ADMIN");
    from = LocalDate.now().plusDays(5); to = from.plusDays(2);
    businessId = UUID.randomUUID();
    db.update("INSERT INTO partner_business(id,kind,owner_user_id,display_name,approval_validity,publication_state,accepting_new) VALUES (?,'HOTEL',?,'Hotel','VALID','PUBLISHED',true)", businessId, owner.id());
    UUID applicationId = UUID.randomUUID();
    db.update("INSERT INTO partner_application(id,business_id,revision,profile_snapshot,requested_capabilities,state) VALUES (?,?,1,'{\"destination\":\"Da Nang\",\"address\":\"Address\"}'::jsonb,'[\"HOTEL_INVENTORY\",\"HOTEL_BOOKING\"]'::jsonb,'APPROVED')", applicationId, businessId);
    db.update("UPDATE partner_business SET approved_revision_id=? WHERE id=?", applicationId, businessId);
    db.update("INSERT INTO partner_business_member(business_id,user_id,role,state) VALUES (?,?,'OWNER','ACTIVE')", businessId, owner.id());
    for (String cap : List.of("HOTEL_INVENTORY", "HOTEL_BOOKING"))
      db.update("INSERT INTO partner_business_capability(business_id,capability,granted_by) VALUES (?,?,?)", businessId, cap, admin.id());
    pid = (UUID) service.saveProperty(owner, null, new HotelDtos.PropertyInput("Hotel", "Da Nang", "Address", "Asia/Ho_Chi_Minh", "14:00", "11:00", businessId)).get("id");
    rid = (UUID) service.createRoom(owner, pid, new HotelDtos.RoomInput("Double", 2)).get("id");
    service.setInventory(owner, pid, rid, new HotelDtos.InventoryInput(from, to, 1, new BigDecimal("500000.00"), false));
  }

  private static AuthenticatedUser user(String role) {
    var id = UUID.randomUUID();
    return new AuthenticatedUser(id, id + "@example.test", role);
  }

  private UUID payosHold() {
    UUID id = (UUID) service.hold(customer, "payos-hold-1", new HotelDtos.HoldInput(rid, from, to, 1, 2)).get("id");
    db.update("UPDATE hotel_booking SET payment_method='PAYOS' WHERE id=?", id);
    return id;
  }

  @Test
  void unpaidPayosBookingCannotBeConfirmedDirectly() {
    UUID id = payosHold();
    assertEquals("PAYOS", service.bookingDetail(customer, id).get("payment_method"));
    var ex = assertThrows(TripServiceException.class, () -> service.transition(customer, id, true));
    assertEquals("HOTEL_PAYMENT_REQUIRED", ex.code());
  }

  @Test
  void verifiedWebhookConfirmsBookingAndDeduplicatesReplays() {
    UUID id = payosHold();
    long amount = 1000000L;
    long orderCode = 123456L;

    // Simulate payment row creation
    db.update("""
        INSERT INTO hotel_payos_payment(booking_id,order_code,amount,currency,state,expires_at)
        VALUES (?,?,?,'VND','PENDING',now()+interval '10 minutes')
        """, id, orderCode, amount);

    // First webhook delivery
    payOsPayments.handlePaidWebhook(orderCode, amount, "VND", "ref-001", Instant.now());
    assertEquals("CONFIRMED", service.bookingDetail(customer, id).get("status"));
    assertEquals("PAID", db.queryForObject("SELECT state FROM hotel_payos_payment WHERE booking_id=?", String.class, id));
    assertEquals(1, db.queryForObject("SELECT count(*) FROM hotel_payos_receipt WHERE booking_id=?", Integer.class, id));

    // Replay with same provider reference should be safely ignored
    payOsPayments.handlePaidWebhook(orderCode, amount, "VND", "ref-001", Instant.now());
    assertEquals("CONFIRMED", service.bookingDetail(customer, id).get("status"));
    assertEquals(1, db.queryForObject("SELECT count(*) FROM hotel_payos_receipt WHERE booking_id=?", Integer.class, id));
  }

  @Test
  void webhookAmountMismatchMarksReviewRequiredWithoutConfirming() {
    UUID id = payosHold();
    long expectedAmount = 1000000L;
    long paidWrongAmount = 500000L;
    long orderCode = 999999L;

    db.update("""
        INSERT INTO hotel_payos_payment(booking_id,order_code,amount,currency,state,expires_at)
        VALUES (?,?,?,'VND','PENDING',now()+interval '10 minutes')
        """, id, orderCode, expectedAmount);

    payOsPayments.handlePaidWebhook(orderCode, paidWrongAmount, "VND", "ref-bad-amount", Instant.now());
    assertEquals("HELD", service.bookingDetail(customer, id).get("status")); // Booking NOT confirmed
    assertEquals("REVIEW_REQUIRED", db.queryForObject("SELECT resolution FROM hotel_payos_payment WHERE booking_id=?", String.class, id));
  }

  @Test
  void cancelledPaidBookingMarksRefundRequired() {
    UUID id = payosHold();
    long amount = 1000000L;
    long orderCode = 777777L;

    db.update("""
        INSERT INTO hotel_payos_payment(booking_id,order_code,amount,currency,state,expires_at)
        VALUES (?,?,?,'VND','PENDING',now()+interval '10 minutes')
        """, id, orderCode, amount);

    payOsPayments.handlePaidWebhook(orderCode, amount, "VND", "ref-cancel-test", Instant.now());
    assertEquals("CONFIRMED", service.bookingDetail(customer, id).get("status"));

    // Customer cancels
    service.transition(customer, id, false);
    assertEquals("CANCELLED", service.bookingDetail(customer, id).get("status"));
    assertEquals("REFUND_REQUIRED", db.queryForObject("SELECT resolution FROM hotel_payos_payment WHERE booking_id=?", String.class, id));
  }
}
