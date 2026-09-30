package fu.tripsense.tripservice.hotel;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static fu.tripsense.tripservice.hotel.HotelDtos.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import fu.tripsense.tripservice.support.RealInfrastructureTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

@SpringBootTest(properties={"hotel.jobs.enabled=false","spring.cache.type=simple","HOTEL_DEMO_PAYMENTS_ENABLED=true"})
@AutoConfigureMockMvc
class HotelReservationIntegrationTest extends RealInfrastructureTest {
  @Autowired HotelService service;
  @Autowired HotelJobs jobs;
  @Autowired JdbcTemplate db;
  @MockitoBean HotelMailClient mail;
  @Autowired MockMvc http;
  AuthenticatedUser owner,customer,other,admin;
  UUID pid,rid;
  UUID businessId;
  LocalDate from,to;
  @BeforeEach void setup() {
    db.execute("TRUNCATE hotel_payos_receipt,hotel_payos_payment,hotel_demo_ledger,hotel_demo_command,hotel_demo_payment,hotel_email_delivery,hotel_notification,hotel_outbox,hotel_booking,hotel_inventory,hotel_room_type,hotel_property,hotel_request_lock CASCADE");
    owner=user("USER");customer=user("USER");other=user("USER");admin=user("ROLE_ADMIN");
    from=LocalDate.now().plusDays(5);to=from.plusDays(2);
    businessId=UUID.randomUUID();
    db.update("INSERT INTO partner_business(id,kind,owner_user_id,display_name,approval_validity,publication_state,accepting_new) VALUES (?,'HOTEL',?,'Hotel','VALID','PUBLISHED',true)",businessId,owner.id());
    UUID applicationId=UUID.randomUUID();
    db.update("INSERT INTO partner_application(id,business_id,revision,profile_snapshot,requested_capabilities,state) VALUES (?,?,1,'{\"destination\":\"Da Nang\",\"address\":\"Address\"}'::jsonb,'[\"HOTEL_INVENTORY\",\"HOTEL_BOOKING\"]'::jsonb,'APPROVED')",applicationId,businessId);
    db.update("UPDATE partner_business SET approved_revision_id=? WHERE id=?",applicationId,businessId);
    db.update("INSERT INTO partner_business_member(business_id,user_id,role,state) VALUES (?,?,'OWNER','ACTIVE')",businessId,owner.id());
    for(String cap:List.of("HOTEL_INVENTORY","HOTEL_BOOKING")) db.update("INSERT INTO partner_business_capability(business_id,capability,granted_by) VALUES (?,?,?)",businessId,cap,admin.id());
    pid=(UUID)service.saveProperty(owner,null,new PropertyInput("Hotel","Da Nang","Address","Asia/Ho_Chi_Minh","14:00","11:00",businessId)).get("id");
    rid=(UUID)service.createRoom(owner,pid,new RoomInput("Double",2)).get("id");
    service.setInventory(owner,pid,rid,new InventoryInput(from,to,1,new BigDecimal("500000.00"),false));
  }
  private static AuthenticatedUser user(String role) { var id=UUID.randomUUID();return new AuthenticatedUser(id,id+"@example.test",role); }
  private HoldInput input() { return new HoldInput(rid,from,to,1,2); }
  private UUID demoHold() { return (UUID)service.hold(customer,"request-123",input()).get("id"); }
  private UUID hold() { UUID id=demoHold(); db.update("UPDATE hotel_booking SET payment_method='PAY_AT_PROPERTY' WHERE id=?",id); return id; }
  private int inventory(String field) { return db.queryForObject("SELECT sum("+field+") FROM hotel_inventory",Integer.class); }

  @Test void demoCaptureRefundAndIdempotencyKeepMoneyAndInventoryConsistent() {
    UUID id=demoHold();
    assertEquals("DEMO_ONLINE",service.bookingDetail(customer,id).get("payment_method"));
    assertThrows(TripServiceException.class,()->service.transition(customer,id,true));
    var first=service.demoPayment(customer,id,"payment-key-123","SUCCESS");
    assertEquals("CAPTURED",first.get("outcome"));
    assertEquals("CONFIRMED",service.bookingDetail(customer,id).get("status"));
    assertEquals("CAPTURED",service.demoPayment(customer,id,"payment-key-123","SUCCESS").get("outcome"));
    assertThrows(TripServiceException.class,()->service.demoPayment(customer,id,"payment-key-123","FAILURE"));
    assertEquals(1,db.queryForObject("SELECT count(*) FROM hotel_demo_ledger WHERE booking_id=? AND event='CAPTURE'",Integer.class,id));
    assertEquals(0,new BigDecimal("100000").compareTo(db.queryForObject("SELECT commission_amount FROM hotel_demo_payment WHERE booking_id=?",BigDecimal.class,id)));
    service.transition(customer,id,false);
    assertEquals("REFUNDED",db.queryForObject("SELECT state FROM hotel_demo_payment WHERE booking_id=?",String.class,id));
    assertEquals(1,db.queryForObject("SELECT count(*) FROM hotel_demo_ledger WHERE booking_id=? AND event='REFUND'",Integer.class,id));
  }

  @Test void demoSettlementRequiresCheckoutAndPaysOnce() {
    UUID id=demoHold();service.demoPayment(customer,id,"payment-key-123","SUCCESS");
    assertThrows(TripServiceException.class,()->service.demoSettlement(admin,id,"settle-key-123"));
    service.checkIn(owner,id,null);service.checkOut(owner,id,null);
    assertEquals("PAID_OUT",service.demoSettlement(admin,id,"settle-key-123").get("outcome"));
    assertEquals("PAID_OUT",service.demoSettlement(admin,id,"settle-key-123").get("outcome"));
    assertEquals(1,db.queryForObject("SELECT count(*) FROM hotel_demo_ledger WHERE booking_id=? AND event='PAYOUT'",Integer.class,id));
  }

  @Test void demoFailureCanRetryAndExpiredSuccessIsImmediatelyRefunded() {
    UUID id=demoHold();
    assertEquals("FAILED",service.demoPayment(customer,id,"payment-fail-123","FAILURE").get("outcome"));
    assertEquals(0,db.queryForObject("SELECT count(*) FROM hotel_demo_payment WHERE booking_id=?",Integer.class,id));
    assertEquals("REFUNDED_EXPIRED",service.demoPayment(customer,id,"payment-late-123","EXPIRED").get("outcome"));
    assertEquals("EXPIRED",service.bookingDetail(customer,id).get("status"));
    assertEquals("REFUNDED",db.queryForObject("SELECT state FROM hotel_demo_payment WHERE booking_id=?",String.class,id));
    assertEquals(0,inventory("held"));
  }

  @Test void pausedBusinessCannotSellButExistingHoldCanBeCancelled() {
    UUID id=hold();
    db.update("UPDATE partner_business SET accepting_new=false WHERE id=?",businessId);
    assertTrue(service.search("Da Nang",from,to,2,1).isEmpty());
    assertThrows(TripServiceException.class,()->service.hold(other,"other-hold-123",input()));
    assertEquals("CANCELLED",service.transition(customer,id,false).get("status"));
  }

  @Test void approvedProfileChangeBlocksSalesUntilPropertyIsSynced() {
    db.update("UPDATE partner_application SET profile_snapshot=jsonb_set(profile_snapshot,'{address}','\"New Address\"'::jsonb) WHERE id=(SELECT approved_revision_id FROM partner_business WHERE id=?)",businessId);
    assertTrue(service.search("Da Nang",from,to,2,1).isEmpty());
    assertThrows(TripServiceException.class,()->service.hold(customer,"new-hold-123",input()));
    assertThrows(TripServiceException.class,()->service.saveProperty(owner,pid,new PropertyInput("Hotel","Da Nang","Address","Asia/Ho_Chi_Minh","14:00","11:00",businessId)));
    service.saveProperty(owner,pid,new PropertyInput("Hotel","Da Nang","New Address","Asia/Ho_Chi_Minh","14:00","11:00",businessId));
    assertEquals(1,service.search("Da Nang",from,to,2,1).size());
  }

  @Test void lastRoomConcurrentCustomersOnlyOneSucceeds() throws Exception {
    try(var pool=Executors.newFixedThreadPool(2)) {
      var ready=new CountDownLatch(2);var go=new CountDownLatch(1);
      List<Future<Boolean>> futures=new ArrayList<>();
      for(var u:List.of(customer,other)) futures.add(pool.submit(() -> {ready.countDown();go.await();try {service.hold(u,"request-123",input());return true;}catch(TripServiceException e){assertEquals("HOTEL_SOLD_OUT",e.code());return false;}}));
      assertTrue(ready.await(5,TimeUnit.SECONDS));go.countDown();
      int success=0;for(var future:futures) if(future.get(15,TimeUnit.SECONDS))success++;
      assertEquals(1,success);assertEquals(2,inventory("held"));
    }
  }
  @Test void duplicateConcurrentRequestReturnsSameBooking() throws Exception {
    try(var pool=Executors.newFixedThreadPool(2)) {
      var a=pool.submit(this::hold);var b=pool.submit(this::hold);
      assertEquals(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS));
      assertEquals(1,db.queryForObject("SELECT count(*) FROM hotel_booking",Integer.class));
    }
    assertThrows(TripServiceException.class,()->service.hold(customer,"request-123",new HoldInput(rid,from,to,1,1)));
  }
  @Test void missingNightRollsBackEntireHold() {
    db.update("DELETE FROM hotel_inventory WHERE stay_date=?",from.plusDays(1));
    assertThrows(TripServiceException.class,this::hold);assertEquals(0,inventory("held"));
    assertTrue(service.search("Da Nang",from,to,2,1).isEmpty());
  }
  @Test void checkoutNightIsNotConsumedAndTotalIsAllNights() {
    var booking=service.hold(customer,"request-123",input());
    assertEquals(0,new BigDecimal("1000000").compareTo((BigDecimal)booking.get("total")));
    assertEquals(2,inventory("held"));
    service.setInventory(owner,pid,rid,new InventoryInput(to,to.plusDays(1),1,new BigDecimal("500000"),false));
    assertEquals(1,service.search("Da Nang",to,to.plusDays(1),2,1).size());
  }
  @Test void confirmAndCancelAreIdempotent() {
    var id=hold();service.transition(customer,id,true);service.transition(customer,id,true);
    assertEquals(0,inventory("held"));assertEquals(2,inventory("booked"));
    service.transition(customer,id,false);service.transition(customer,id,false);
    assertEquals(0,inventory("booked"));
    assertEquals(1,db.queryForObject("SELECT count(*) FROM hotel_outbox WHERE event_type='BOOKING_CONFIRMED'",Integer.class));
  }
  @Test void expiredConfirmCommitsReleaseAndCannotResurrect() {
    var id=hold();db.update("UPDATE hotel_booking SET expires_at=clock_timestamp()-interval '1 second' WHERE id=?",id);
    var ex=assertThrows(TripServiceException.class,()->service.transition(customer,id,true));
    assertEquals("HOTEL_HOLD_EXPIRED",ex.code());assertEquals(0,inventory("held"));
    jobs.tick();assertEquals(0,inventory("held"));
    assertEquals("EXPIRED",db.queryForObject("SELECT status FROM hotel_booking WHERE id=?",String.class,id));
  }
  @Test void cannotReduceInventoryBelowCommitmentsOrManageForeignProperty() {
    hold();assertThrows(TripServiceException.class,()->service.setInventory(owner,pid,rid,new InventoryInput(from,to,0,BigDecimal.ONE,false)));
    assertThrows(TripServiceException.class,()->service.createRoom(other,pid,new RoomInput("Attack",2)));
    assertThrows(TripServiceException.class,()->service.status(owner,pid,"ACTIVE"));
    assertThrows(TripServiceException.class,()->service.transition(other,hold(),true));
    assertEquals(2,inventory("allocation"));
  }
  @Test void suspendedPropertyCannotConfirmButCancellationStillWorks() {
    var id=hold();db.update("UPDATE partner_business SET operation_state='SUSPENDED' WHERE id=?",businessId);
    assertThrows(TripServiceException.class,()->service.transition(customer,id,true));
    service.transition(customer,id,false);assertEquals(0,inventory("held"));
  }
  @Test void outboxReplayAndEmailRetriesDoNotCreateDuplicateJobs() throws Exception {
    service.transition(customer,hold(),true);jobs.dispatch();
    int count=db.queryForObject("SELECT count(*) FROM hotel_notification",Integer.class);
    db.update("UPDATE hotel_outbox SET processed_at=NULL");jobs.dispatch();
    assertEquals(count,db.queryForObject("SELECT count(*) FROM hotel_notification",Integer.class));
    doThrow(new IllegalStateException("not sent")).when(mail).send(any());jobs.deliver();
    assertEquals(count,db.queryForObject("SELECT count(*) FROM hotel_email_delivery WHERE state='PENDING'",Integer.class));
    reset(mail);db.update("UPDATE hotel_email_delivery SET next_attempt=clock_timestamp()");jobs.deliver();
    assertEquals(count,db.queryForObject("SELECT count(*) FROM hotel_email_delivery WHERE state='SENT'",Integer.class));
    jobs.deliver();verify(mail,times(count)).send(any());
    assertEquals("CONFIRMED",db.queryForObject("SELECT status FROM hotel_booking",String.class));
  }
  @Test void oldAmbiguousDeliveryIsDeadLetteredWithoutSending() throws Exception {
    service.transition(customer,hold(),true);jobs.dispatch();db.update("UPDATE hotel_email_delivery SET first_attempt=clock_timestamp()-interval '24 hours'");jobs.deliver();
    verifyNoInteractions(mail);
    assertFalse(service.deliveries(admin).isEmpty());
    assertThrows(TripServiceException.class,()->service.deliveries(customer));
  }
  @Test void httpAuthenticationOwnershipValidationAndResponseContract() throws Exception {
    http.perform(get("/api/hotels/bookings")).andExpect(status().isUnauthorized());
    var identity=new UsernamePasswordAuthenticationToken(customer,null,List.of());
    http.perform(get("/api/hotels/search").with(authentication(identity)).param("destination","Da Nang")
        .param("checkIn",from.toString()).param("checkOut",to.toString()).param("quantity","1").param("guests","2"))
        .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
        .andExpect(jsonPath("$.success").value(true)).andExpect(jsonPath("$.data[0].room_type_id").value(rid.toString()));
    http.perform(get("/api/hotels/properties/{id}/rooms",pid).with(authentication(identity)))
        .andExpect(status().isNotFound());
    http.perform(get("/api/hotels/admin/properties").with(authentication(identity))).andExpect(status().isForbidden());
    http.perform(post("/api/hotels/holds").with(authentication(identity)).contentType("application/json")
        .content("{\"quantity\":-1}"))
        .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("HOTEL_INVALID_INPUT"));
  }
  @Test void confirmationAndExpiryRaceCannotDoubleRelease() throws Exception {
    var id=hold();db.update("UPDATE hotel_booking SET expires_at=clock_timestamp()-interval '1 second' WHERE id=?",id);
    try(var pool=Executors.newFixedThreadPool(2)) {
      var expiry=pool.submit(()->service.expire());
      var confirm=pool.submit(()->assertThrows(TripServiceException.class,()->service.transition(customer,id,true)));
      expiry.get(15,TimeUnit.SECONDS);confirm.get(15,TimeUnit.SECONDS);
    }
    assertEquals(0,inventory("held"));assertEquals(0,inventory("booked"));
    assertEquals(1,db.queryForObject("SELECT count(*) FROM hotel_outbox WHERE event_type='BOOKING_EXPIRED'",Integer.class));
  }
  @Test void failedNotificationNeverRollsBackConfirmedBookingAndRetriesUseSameIds() throws Exception {
    service.transition(customer,hold(),true);jobs.dispatch();
    var attempted=new ArrayList<UUID>();
    doAnswer(call->{attempted.add((UUID)((Map<?,?>)call.getArgument(0)).get("id"));throw new IllegalStateException("ambiguous response");}).when(mail).send(any());
    jobs.deliver();var first=List.copyOf(attempted);attempted.clear();
    db.update("UPDATE hotel_email_delivery SET next_attempt=clock_timestamp()");jobs.deliver();
    assertEquals(new HashSet<>(first),new HashSet<>(attempted));
    db.update("UPDATE hotel_email_delivery SET attempts=6,next_attempt=clock_timestamp()");jobs.deliver();
    assertFalse(service.deliveries(admin).isEmpty());
    assertEquals("CONFIRMED",db.queryForObject("SELECT status FROM hotel_booking",String.class));
  }
  @Test void roomCapacityCannotInvalidateAnExistingReservation() {
    hold();assertThrows(TripServiceException.class,()->service.updateRoom(owner,pid,rid,new RoomInput("Small",1)));
    assertEquals(2,service.rooms(owner,pid).getFirst().get("capacity"));
  }

  @Test void checkInAndCheckOutLifecycle() {
    var id = hold();
    service.transition(customer, id, true);
    assertEquals("CONFIRMED", db.queryForObject("SELECT status FROM hotel_booking WHERE id=?", String.class, id));

    assertThrows(TripServiceException.class, () -> service.checkIn(other, id, 0L));

    var ex = assertThrows(TripServiceException.class, () -> service.checkIn(owner, id, 99L));
    assertEquals("HOTEL_VERSION_CONFLICT", ex.code());

    var checkedIn = service.checkIn(owner, id, 0L);
    assertEquals("CHECKED_IN", checkedIn.get("status"));
    assertNotNull(checkedIn.get("check_in_at"));
    assertEquals(1L, ((Number) checkedIn.get("version")).longValue());

    assertThrows(TripServiceException.class, () -> service.checkIn(owner, id, 1L));

    var checkedOut = service.checkOut(owner, id, 1L);
    assertEquals("CHECKED_OUT", checkedOut.get("status"));
    assertNotNull(checkedOut.get("check_out_at"));
    assertEquals(2L, ((Number) checkedOut.get("version")).longValue());

    assertThrows(TripServiceException.class, () -> service.checkOut(owner, id, 2L));
  }

  @Test void noShowEnforcement() {
    var id = hold();
    service.transition(customer, id, true);

    var ex = assertThrows(TripServiceException.class, () -> service.noShow(owner, id, 0L));
    assertEquals("HOTEL_NO_SHOW_EARLY", ex.code());

    db.update("UPDATE hotel_booking SET no_show_after = clock_timestamp() - interval '1 hour' WHERE id=?", id);

    var noShow = service.noShow(owner, id, 0L);
    assertEquals("NO_SHOW", noShow.get("status"));
    assertEquals(0, inventory("booked"));
  }

  @Test void propertyCancelWithReasonAndRelease() {
    var id = hold();
    service.transition(customer, id, true);
    assertEquals(2, inventory("booked"));

    var ex = assertThrows(TripServiceException.class, () -> service.propertyCancel(owner, id, 0L, "  "));
    assertEquals("HOTEL_REASON_REQUIRED", ex.code());

    var cancelled = service.propertyCancel(owner, id, 0L, "Overbooking maintenance issue");
    assertEquals("CANCELLED", cancelled.get("status"));
    assertEquals("PROPERTY", cancelled.get("cancelled_by"));
    assertEquals("Overbooking maintenance issue", cancelled.get("cancellation_reason"));
    assertEquals(0, inventory("booked"));
  }

  @Test void freeCancellationCutoffEnforcement() {
    var id = hold();
    service.transition(customer, id, true);

    db.update("UPDATE hotel_booking SET free_cancellation_until = clock_timestamp() - interval '1 minute' WHERE id=?", id);

    var ex = assertThrows(TripServiceException.class, () -> service.transition(customer, id, false));
    assertEquals("HOTEL_CANCELLATION_CLOSED", ex.code());
  }

  @Test void dutyOfServiceContinuesUnderSuspension() {
    var id = hold();
    service.transition(customer, id, true);

    db.update("UPDATE partner_business SET operation_state='SUSPENDED' WHERE id=?", businessId);

    var checkedIn = service.checkIn(owner, id, 0L);
    assertEquals("CHECKED_IN", checkedIn.get("status"));

    assertThrows(TripServiceException.class, () -> service.hold(other, "req-suspend", input()));
  }
}
