package fu.tripsense.tripservice.hotel;

import static fu.tripsense.tripservice.hotel.HotelDtos.*;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import io.micrometer.core.instrument.MeterRegistry;
import java.math.BigDecimal;
import java.sql.Date;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;

/** All mutations lock the property first, serializing inventory and reservation transitions. */
@Service
public class HotelService {
  @org.springframework.beans.factory.annotation.Value("${HOTEL_DEMO_PAYMENTS_ENABLED:false}")
  private boolean demoPaymentsEnabled;
  @org.springframework.beans.factory.annotation.Value("${payos.enabled:false}")
  private boolean payosEnabled;
  private final JdbcTemplate db;
  private final TransactionTemplate tx;
  private final MeterRegistry metrics;
  public HotelService(JdbcTemplate db, PlatformTransactionManager transactions, MeterRegistry metrics) {
    this.db=db; this.tx=new TransactionTemplate(transactions); this.tx.setTimeout(15); this.metrics=metrics;
  }
  static TripServiceException error(String code, HttpStatus status) {
    return new TripServiceException(code, switch(code) {
      case "HOTEL_NOT_FOUND" -> "Hotel resource not found";
      case "HOTEL_SOLD_OUT" -> "Rooms are no longer available for these dates";
      case "HOTEL_HOLD_EXPIRED" -> "The reservation hold has expired";
      case "HOTEL_IDEMPOTENCY_CONFLICT" -> "Request key was already used for different booking details";
      case "HOTEL_VERSION_CONFLICT" -> "Booking version conflict";
      case "HOTEL_NO_SHOW_EARLY" -> "Cannot mark as no-show before the scheduled no-show cutoff";
      case "HOTEL_REASON_REQUIRED" -> "Cancellation reason is required";
      case "HOTEL_CANCELLATION_CLOSED" -> "Free cancellation window has passed";
      default -> "The hotel request could not be completed";
    }, status);
  }
  private static void check(boolean ok, String code) { if(!ok) throw error(code,HttpStatus.CONFLICT); }
  public static boolean isAdmin(AuthenticatedUser u) { return u != null && u.isAdmin(); }
  public static void admin(AuthenticatedUser u) { if(!isAdmin(u)) throw error("HOTEL_FORBIDDEN",HttpStatus.FORBIDDEN); }
  private Map<String,Object> one(String sql,Object... args) {
    var rows=db.queryForList(sql,args);
    if(rows.isEmpty()) throw error("HOTEL_NOT_FOUND",HttpStatus.NOT_FOUND);
    return rows.getFirst();
  }
  private Map<String,Object> property(UUID id) { return one("SELECT * FROM hotel_property WHERE id=? FOR UPDATE",id); }
  public boolean isPropertyOwner(AuthenticatedUser u,Map<String,Object> p) {
    if(u==null) return false;
    UUID bizId=(UUID)p.get("business_id");
    if(bizId!=null) {
      Integer count=db.queryForObject(
          "SELECT count(*) FROM partner_business_member WHERE business_id=? AND user_id=? AND state='ACTIVE' AND role IN ('OWNER','MANAGER')",
          Integer.class,bizId,u.id());
      return count!=null && count>0;
    }
    return u.id().equals(p.get("owner_id"));
  }
  private void owner(AuthenticatedUser u,Map<String,Object> p) {
    if(!isPropertyOwner(u,p)) throw error("HOTEL_NOT_FOUND",HttpStatus.NOT_FOUND);
  }
  private Map<String,Object> eligibleBusiness(UUID id, String capability, boolean intake) {
    check(id!=null,"HOTEL_PARTNER_REQUIRED");
    var b=one("SELECT * FROM partner_business WHERE id=? FOR UPDATE",id);
    check("HOTEL".equals(b.get("kind")) && "VALID".equals(b.get("approval_validity"))
        && "ACTIVE".equals(b.get("operation_state")) && !Boolean.TRUE.equals(b.get("requires_reverification")),"HOTEL_PARTNER_NOT_READY");
    check(!intake || ("PUBLISHED".equals(b.get("publication_state")) && Boolean.TRUE.equals(b.get("accepting_new"))),"HOTEL_INTAKE_PAUSED");
    check(db.queryForObject("SELECT count(*) FROM partner_business_capability WHERE business_id=? AND capability=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>clock_timestamp())",Integer.class,id,capability)>0,"HOTEL_CAPABILITY_REQUIRED");
    return b;
  }
  private void currentIdentity(Map<String,Object> property,Map<String,Object> business) {
    var approved=one("SELECT profile_snapshot->>'destination' AS destination,profile_snapshot->>'address' AS address FROM partner_application WHERE id=? AND business_id=? AND state='APPROVED'",business.get("approved_revision_id"),business.get("id"));
    check(Objects.equals(property.get("name"),business.get("display_name")) && Objects.equals(property.get("destination"),approved.get("destination")) && Objects.equals(property.get("address"),approved.get("address")),"HOTEL_PROFILE_OUTDATED");
  }
  private Instant now() { return db.queryForObject("SELECT clock_timestamp()",java.sql.Timestamp.class).toInstant(); }
  private static LocalDate date(Object value) { return ((Date)value).toLocalDate(); }
  private static int number(Object value) { return ((Number)value).intValue(); }
  private static void range(LocalDate from,LocalDate to,int max) {
    if(from==null || to==null || !to.isAfter(from) || ChronoUnit.DAYS.between(from,to)>max)
      throw error("HOTEL_INVALID_DATES",HttpStatus.BAD_REQUEST);
  }
  private static void validate(PropertyInput in) {
    try { ZoneId.of(in.timeZone()); LocalTime.parse(in.checkInTime()); LocalTime.parse(in.checkOutTime()); }
    catch(DateTimeException e) { throw error("HOTEL_INVALID_POLICY",HttpStatus.BAD_REQUEST); }
  }
  public List<Map<String,Object>> properties(AuthenticatedUser u,boolean all) {
    if(all) { admin(u); return db.queryForList("SELECT * FROM hotel_property ORDER BY created_at DESC LIMIT 100"); }
    return db.queryForList("SELECT p.* FROM hotel_property p WHERE (p.business_id IS NULL AND p.owner_id=?) OR EXISTS (SELECT 1 FROM partner_business_member m WHERE m.business_id=p.business_id AND m.user_id=? AND m.state='ACTIVE' AND m.role IN ('OWNER','MANAGER')) ORDER BY p.created_at DESC LIMIT 100",u.id(),u.id());
  }
  public Map<String,Object> details(UUID id,AuthenticatedUser u) {
    var p=one("SELECT * FROM hotel_property WHERE id=?",id);
    if(!"ACTIVE".equals(p.get("status")) && !isAdmin(u)) owner(u,p);
    p.remove("owner_email"); p.remove("owner_id"); return p;
  }
  public Map<String,Object> saveProperty(AuthenticatedUser u,UUID id,PropertyInput in) {
    validate(in);
    return tx.execute(s -> {
      var b=eligibleBusiness(in.businessId(),"HOTEL_INVENTORY",false);
      check(u.id().equals(b.get("owner_user_id")),"HOTEL_OWNER_REQUIRED");
      check(b.get("approved_revision_id")!=null,"HOTEL_PARTNER_NOT_READY");
      var approved=one("SELECT profile_snapshot->>'destination' AS destination,profile_snapshot->>'address' AS address FROM partner_application WHERE id=? AND business_id=? AND state='APPROVED'",b.get("approved_revision_id"),in.businessId());
      check(Objects.equals(in.destination().strip(),approved.get("destination")) && Objects.equals(in.address().strip(),approved.get("address")),"HOTEL_PROFILE_MISMATCH");
      if(id!=null) {
        var existing=property(id);
        check(in.businessId().equals(existing.get("business_id")),"HOTEL_PROFILE_MISMATCH");
        db.update("UPDATE hotel_property SET name=?,destination=?,address=?,time_zone=?,check_in_time=?,check_out_time=?,status='ACTIVE' WHERE id=?",
            b.get("display_name"),approved.get("destination"),approved.get("address"),in.timeZone(),in.checkInTime(),in.checkOutTime(),id);
        return one("SELECT * FROM hotel_property WHERE id=?",id);
      }
      check(db.queryForObject("SELECT count(*) FROM hotel_property WHERE business_id=?",Integer.class,in.businessId())==0,"HOTEL_PROPERTY_EXISTS");
      UUID key=UUID.randomUUID();
      db.update("INSERT INTO hotel_property(id,business_id,owner_id,owner_email,name,destination,address,time_zone,check_in_time,check_out_time,status) VALUES (?,?,?,?,?,?,?,?,?,?,'ACTIVE')",
          key,in.businessId(),b.get("owner_user_id"),u.email(),b.get("display_name"),approved.get("destination"),approved.get("address"),in.timeZone(),in.checkInTime(),in.checkOutTime());
      return one("SELECT * FROM hotel_property WHERE id=?",key);
    });
  }
  public Map<String,Object> status(AuthenticatedUser u,UUID id,String status) {
    admin(u);
    throw error("HOTEL_USE_PARTNER_REVIEW",HttpStatus.CONFLICT);
  }
  public List<Map<String,Object>> rooms(AuthenticatedUser u,UUID id) {
    return tx.execute(s -> { owner(u,property(id)); return db.queryForList("SELECT * FROM hotel_room_type WHERE property_id=? ORDER BY name",id); });
  }
  public Map<String,Object> createRoom(AuthenticatedUser u,UUID id,RoomInput in) {
    return tx.execute(s -> {
      var p=property(id); owner(u,p);
      UUID bizId=(UUID)p.get("business_id");
      if(bizId!=null) eligibleBusiness(bizId,"HOTEL_INVENTORY",false);
      UUID rid=UUID.randomUUID();
      db.update("INSERT INTO hotel_room_type(id,property_id,name,capacity) VALUES (?,?,?,?)",rid,id,in.name().strip(),in.capacity());
      BigDecimal price = (in.nightlyPrice() != null && in.nightlyPrice().compareTo(BigDecimal.ZERO) > 0)
          ? in.nightlyPrice() : new BigDecimal("500000.00");
      int alloc = (in.allocation() != null && in.allocation() > 0) ? in.allocation() : 5;
      LocalDate today = LocalDate.now();
      for(int day = 0; day < 90; day++) {
        LocalDate d = today.plusDays(day);
        db.update("""
            INSERT INTO hotel_inventory(room_type_id,stay_date,allocation,nightly_price,stop_sell)
            VALUES (?,?,?,?,false) ON CONFLICT(room_type_id,stay_date) DO NOTHING
            """, rid, d, alloc, price);
      }
      return one("SELECT * FROM hotel_room_type WHERE id=?",rid);
    });
  }
  public Map<String,Object> updateRoom(AuthenticatedUser u,UUID pid,UUID rid,RoomInput in) {
    return tx.execute(s -> {
      var p=property(pid); owner(u,p); eligibleBusiness((UUID)p.get("business_id"),"HOTEL_INVENTORY",false); room(pid,rid); expireProperty(p);
      check(db.queryForObject("SELECT count(*) FROM hotel_booking WHERE room_type_id=? AND status IN ('HELD','CONFIRMED') AND check_out>=CURRENT_DATE AND guests>quantity*?",Integer.class,rid,in.capacity())==0,"HOTEL_CAPACITY_EXCEEDED");
      db.update("UPDATE hotel_room_type SET name=?,capacity=? WHERE id=?",in.name().strip(),in.capacity(),rid);
      return one("SELECT * FROM hotel_room_type WHERE id=?",rid);
    });
  }
  private Map<String,Object> room(UUID property,UUID room) { return one("SELECT * FROM hotel_room_type WHERE id=? AND property_id=? FOR UPDATE",room,property); }
  public List<Map<String,Object>> inventory(AuthenticatedUser u,UUID pid,UUID rid,LocalDate from,LocalDate to) {
    range(from,to,366);
    return tx.execute(s -> { owner(u,property(pid)); room(pid,rid); return days(rid,from,to); });
  }
  private List<Map<String,Object>> days(UUID rid,LocalDate from,LocalDate to) {
    return db.queryForList("SELECT * FROM hotel_inventory WHERE room_type_id=? AND stay_date>=? AND stay_date<? ORDER BY stay_date",rid,from,to);
  }
  public void setInventory(AuthenticatedUser u,UUID pid,UUID rid,InventoryInput in) {
    range(in.from(),in.to(),366);
    tx.executeWithoutResult(s -> {
      var p=property(pid); owner(u,p); eligibleBusiness((UUID)p.get("business_id"),"HOTEL_INVENTORY",false); room(pid,rid); expireProperty(p);
      for(LocalDate d=in.from();d.isBefore(in.to());d=d.plusDays(1)) {
        int updated=db.update("""
            INSERT INTO hotel_inventory(room_type_id,stay_date,allocation,nightly_price,stop_sell) VALUES (?,?,?,?,?)
            ON CONFLICT(room_type_id,stay_date) DO UPDATE SET allocation=excluded.allocation,
            nightly_price=excluded.nightly_price,stop_sell=excluded.stop_sell
            WHERE hotel_inventory.held+hotel_inventory.booked<=excluded.allocation
            """,rid,d,in.allocation(),in.nightlyPrice(),in.stopSell());
        check(updated==1,"HOTEL_INVENTORY_CONFLICT");
      }
    });
  }
  public List<Map<String,Object>> search(String destination,LocalDate from,LocalDate to,int guests,int quantity) {
    expire();
    range(from,to,30);
    String dest = (destination == null || destination.isBlank()) ? "all" : destination.strip();
    if(quantity<1 || quantity>10 || guests<1 || guests>200)
      throw error("HOTEL_INVALID_SEARCH",HttpStatus.BAD_REQUEST);
    return db.queryForList("""
        SELECT p.id AS property_id,p.name,p.destination,p.address,p.time_zone,r.id AS room_type_id,r.name AS room_name,
        r.capacity,min(i.allocation-i.held-i.booked) AS available_rooms,sum(i.nightly_price)*? AS total,'VND' AS currency,
        clock_timestamp() AS checked_at, 'FREE_BEFORE_CHECK_IN' AS cancellation_policy,
        ((?::date + p.check_in_time::time) AT TIME ZONE p.time_zone) AS free_cancellation_until
        FROM hotel_property p JOIN hotel_room_type r ON r.property_id=p.id
        LEFT JOIN partner_business b ON b.id=p.business_id
        LEFT JOIN partner_application a ON a.id=b.approved_revision_id AND a.state='APPROVED'
        JOIN hotel_inventory i ON i.room_type_id=r.id AND i.stay_date>=? AND i.stay_date<?
        WHERE p.status='ACTIVE'
        AND (? = 'all' OR lower(trim(p.destination)) = lower(trim(?))
            OR lower(p.destination) LIKE lower('%' || trim(?) || '%')
            OR lower(?) LIKE lower('%' || trim(p.destination) || '%'))
        AND r.capacity*?>=?
        AND (b.id IS NULL OR (b.approval_validity='VALID' AND b.operation_state='ACTIVE' AND NOT b.requires_reverification))
        AND ? >= (clock_timestamp() AT TIME ZONE p.time_zone)::date
        GROUP BY p.id,r.id HAVING count(*)=? AND bool_and(NOT i.stop_sell) AND min(i.allocation-i.held-i.booked)>=?
        ORDER BY total,p.id,r.id LIMIT 50
        """,quantity,from,from,to,dest,dest,dest,dest,quantity,guests,from,ChronoUnit.DAYS.between(from,to),quantity);
  }
  public Map<String,Object> hold(AuthenticatedUser u,String key,HoldInput in) {
    range(in.checkIn(),in.checkOut(),30);
    if(key==null || !key.matches("[A-Za-z0-9_-]{8,100}")) throw error("HOTEL_INVALID_REQUEST_KEY",HttpStatus.BAD_REQUEST);
    return tx.execute(s -> {
      db.update("INSERT INTO hotel_request_lock(customer_id) VALUES (?) ON CONFLICT DO NOTHING",u.id());
      one("SELECT * FROM hotel_request_lock WHERE customer_id=? FOR UPDATE",u.id());
      var existing=db.queryForList("SELECT * FROM hotel_booking WHERE customer_id=? AND request_key=?",u.id(),key);
      if(!existing.isEmpty()) {
        var b=existing.getFirst();
        check(in.roomTypeId().equals(b.get("room_type_id")) && in.checkIn().equals(date(b.get("check_in"))) && in.checkOut().equals(date(b.get("check_out"))) && in.quantity()==number(b.get("quantity")) && in.guests()==number(b.get("guests")),"HOTEL_IDEMPOTENCY_CONFLICT");
        var p=property((UUID)b.get("property_id")); expireProperty(p);
        return booking((UUID)b.get("id"));
      }
      UUID pid=(UUID)one("SELECT property_id FROM hotel_room_type WHERE id=?",in.roomTypeId()).get("property_id");
      var p=property(pid); var r=room(pid,in.roomTypeId()); expireProperty(p);
      UUID bizId=(UUID)p.get("business_id");
      currentIdentity(p,eligibleBusiness(bizId,"HOTEL_BOOKING",true));
      check(db.queryForObject("SELECT count(*) FROM hotel_booking WHERE customer_id=? AND status='HELD'",Integer.class,u.id())<3,"HOTEL_HOLD_LIMIT");
      check("ACTIVE".equals(p.get("status")),"HOTEL_NOT_ACTIVE");
      LocalDate today=now().atZone(ZoneId.of((String)p.get("time_zone"))).toLocalDate();
      check(!in.checkIn().isBefore(today) && !in.checkIn().isAfter(today.plusDays(365)),"HOTEL_INVALID_DATES");
      check(in.quantity()>=1 && in.quantity()<=10 && in.guests()>=1 && in.guests()<=number(r.get("capacity"))*in.quantity(),"HOTEL_CAPACITY_EXCEEDED");
      var inventory=days(in.roomTypeId(),in.checkIn(),in.checkOut());
      check(inventory.size()==ChronoUnit.DAYS.between(in.checkIn(),in.checkOut()),"HOTEL_SOLD_OUT");
      BigDecimal total=BigDecimal.ZERO;
      for(var d:inventory) {
        if(Boolean.TRUE.equals(d.get("stop_sell")) || number(d.get("allocation"))-number(d.get("held"))-number(d.get("booked"))<in.quantity()) {
          metrics.counter("hotel.inventory.conflicts").increment(); throw error("HOTEL_SOLD_OUT",HttpStatus.CONFLICT);
        }
        total=total.add((BigDecimal)d.get("nightly_price"));
      }
      db.update("UPDATE hotel_inventory SET held=held+? WHERE room_type_id=? AND stay_date>=? AND stay_date<?",in.quantity(),in.roomTypeId(),in.checkIn(),in.checkOut());
      UUID bid=UUID.randomUUID();
      ZoneId zone=ZoneId.of((String)p.get("time_zone"));
      LocalTime checkInTime=LocalTime.parse((String)p.get("check_in_time"));
      Instant freeCancelUntil=in.checkIn().atTime(checkInTime).atZone(zone).toInstant();
      Instant noShowAfter=in.checkIn().plusDays(1).atTime(6,0).atZone(zone).toInstant();
      db.update("""
          INSERT INTO hotel_booking(id,property_id,business_id,room_type_id,customer_id,customer_email,request_key,check_in,check_out,quantity,guests,total,property_name,room_name,time_zone,status,payment_method,expires_at,free_cancellation_until,no_show_after)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'HELD',?,clock_timestamp()+interval '10 minutes',?,?)
          """,bid,pid,bizId,in.roomTypeId(),u.id(),u.email(),key,in.checkIn(),in.checkOut(),in.quantity(),in.guests(),total.multiply(BigDecimal.valueOf(in.quantity())),p.get("name"),r.get("name"),p.get("time_zone"),payosEnabled?"PAYOS":demoPaymentsEnabled?"DEMO_ONLINE":"PAY_AT_PROPERTY",java.sql.Timestamp.from(freeCancelUntil),java.sql.Timestamp.from(noShowAfter));
      metrics.counter("hotel.holds.created").increment(); return booking(bid);
    });
  }
  private Map<String,Object> booking(UUID id) { return one("SELECT * FROM hotel_booking WHERE id=?",id); }
  public Map<String,Object> transition(AuthenticatedUser u,UUID id,boolean confirm) {
    var result=tx.execute(s -> transitionLocked(u,id,confirm,false));
    if(confirm && "EXPIRED".equals(result.get("status"))) throw error("HOTEL_HOLD_EXPIRED",HttpStatus.CONFLICT);
    return result;
  }
  private Map<String,Object> transitionLocked(AuthenticatedUser u,UUID id,boolean confirm,boolean demoCapture) {
      var initial=booking(id); var p=property((UUID)initial.get("property_id"));
      var b=one("SELECT * FROM hotel_booking WHERE id=? FOR UPDATE",id);
      boolean isOwner=isPropertyOwner(u,p);
      if(!u.id().equals(b.get("customer_id")) && (confirm || !isOwner)) throw error("HOTEL_NOT_FOUND",HttpStatus.NOT_FOUND);
      expireProperty(p); b=booking(id); String state=(String)b.get("status");
      if(confirm && "CONFIRMED".equals(state) || !confirm && Set.of("CANCELLED","EXPIRED").contains(state)) return b;
      if("EXPIRED".equals(state)) return b; // commit expiry release before reporting conflict
      check(confirm?"HELD".equals(state):Set.of("HELD","CONFIRMED").contains(state),"HOTEL_INVALID_STATE");
      if(confirm) {
        if("DEMO_ONLINE".equals(b.get("payment_method")) && !demoCapture)
          check(db.queryForObject("SELECT count(*) FROM hotel_demo_payment WHERE booking_id=? AND state='CAPTURED'",Integer.class,id)==1,"HOTEL_PAYMENT_REQUIRED");
        if("PAYOS".equals(b.get("payment_method")) && !demoCapture)
          check(db.queryForObject("SELECT count(*) FROM hotel_payos_payment WHERE booking_id=? AND state='PAID'",Integer.class,id)==1,"HOTEL_PAYMENT_REQUIRED");
        check("ACTIVE".equals(p.get("status")),"HOTEL_NOT_ACTIVE");
        UUID bizId=(UUID)p.get("business_id");
        currentIdentity(p,eligibleBusiness(bizId,"HOTEL_BOOKING",false));
        check(!date(b.get("check_in")).isBefore(now().atZone(ZoneId.of((String)b.get("time_zone"))).toLocalDate()),"HOTEL_INVALID_DATES");
        var inv=days((UUID)b.get("room_type_id"),date(b.get("check_in")),date(b.get("check_out")));
        check(inv.size()==ChronoUnit.DAYS.between(date(b.get("check_in")),date(b.get("check_out"))) && inv.stream().allMatch(d -> number(d.get("held"))>=number(initial.get("quantity")) && number(d.get("held"))+number(d.get("booked"))<=number(d.get("allocation"))),"HOTEL_INVENTORY_CONFLICT");
      } else if("CONFIRMED".equals(state) && u.id().equals(b.get("customer_id"))) {
        Object fcu=b.get("free_cancellation_until");
        if(fcu instanceof java.sql.Timestamp ts) {
          check(now().isBefore(ts.toInstant()),"HOTEL_CANCELLATION_CLOSED");
        } else {
          check(now().atZone(ZoneId.of((String)b.get("time_zone"))).toLocalDate().isBefore(date(b.get("check_in"))),"HOTEL_CANCELLATION_CLOSED");
        }
      }
      if (!confirm && !u.id().equals(b.get("customer_id"))) throw error("HOTEL_REASON_REQUIRED",HttpStatus.BAD_REQUEST);
      adjust(b,confirm?"CONFIRMED":"CANCELLED");
      if(!confirm && !"PAYOS".equals(b.get("payment_method"))) refundDemo(id);
      if(!confirm && "PAYOS".equals(b.get("payment_method")))
        db.update("UPDATE hotel_payos_payment SET resolution='REFUND_REQUIRED' WHERE booking_id=? AND state='PAID' AND resolution='NONE'",id);
      if(!confirm) {
        db.update("UPDATE hotel_booking SET cancelled_by=? WHERE id=?",u.id().equals(b.get("customer_id"))?"CUSTOMER":"PROPERTY",id);
      }
      event(id,confirm?"BOOKING_CONFIRMED":"BOOKING_CANCELLED",p,b);
      if(confirm && days((UUID)b.get("room_type_id"),date(b.get("check_in")),date(b.get("check_out"))).stream().anyMatch(d -> number(d.get("allocation"))-number(d.get("held"))-number(d.get("booked"))<=1)) event(id,"INVENTORY_LOW",p,null);
      return booking(id);
  }
  private void adjust(Map<String,Object> b,String next) {
    int q=number(b.get("quantity")); boolean held="HELD".equals(b.get("status"));
    db.update("UPDATE hotel_inventory SET held=held+?,booked=booked+? WHERE room_type_id=? AND stay_date>=? AND stay_date<?",
        held?-q:0,"CONFIRMED".equals(next)?q:held?0:-q,b.get("room_type_id"),b.get("check_in"),b.get("check_out"));
    db.update("UPDATE hotel_booking SET status=? WHERE id=?",next,b.get("id"));
  }
  private void expireProperty(Map<String,Object> p) {
    for(var b:db.queryForList("SELECT * FROM hotel_booking WHERE property_id=? AND status='HELD' AND expires_at<=clock_timestamp() ORDER BY id FOR UPDATE",p.get("id"))) {
      adjust(b,"EXPIRED"); event((UUID)b.get("id"),"BOOKING_EXPIRED",p,b); metrics.counter("hotel.holds.expired").increment();
    }
  }
  public void expire() {
    for(UUID pid:db.queryForList("SELECT DISTINCT property_id FROM hotel_booking WHERE status='HELD' AND expires_at<=clock_timestamp() LIMIT 50",UUID.class))
      tx.executeWithoutResult(s -> expireProperty(property(pid)));
  }
  private void event(UUID aggregate,String type,Map<String,Object> p,Map<String,Object> b) {
    // JSON constructed by PostgreSQL avoids serializing arbitrary domain objects or credentials.
    db.update("""
        INSERT INTO hotel_outbox(id,aggregate_id,event_type,payload) VALUES (?,?,?,
          jsonb_build_object('ownerId',?::text,'ownerEmail',?::text,'customerId',?::text,'customerEmail',?::text))
        """,UUID.randomUUID(),aggregate,type,p.get("owner_id"),p.get("owner_email"),b==null?null:b.get("customer_id"),b==null?null:b.get("customer_email"));
  }
  public List<Map<String,Object>> bookings(AuthenticatedUser u,UUID pid) {
    if(pid==null) return db.queryForList("SELECT * FROM hotel_booking WHERE customer_id=? ORDER BY created_at DESC LIMIT 100",u.id());
    return tx.execute(s -> { owner(u,property(pid)); return db.queryForList("SELECT * FROM hotel_booking WHERE property_id=? ORDER BY created_at DESC LIMIT 100",pid); });
  }
  public List<Map<String,Object>> notifications(AuthenticatedUser u) { return db.queryForList("SELECT * FROM hotel_notification WHERE recipient_id=? ORDER BY created_at DESC LIMIT 100",u.id()); }
  public void read(AuthenticatedUser u,UUID id) {
    if(db.update("UPDATE hotel_notification SET read_at=coalesce(read_at,clock_timestamp()) WHERE id=? AND recipient_id=?",id,u.id())==0) throw error("HOTEL_NOT_FOUND",HttpStatus.NOT_FOUND);
  }
  public List<Map<String,Object>> deliveries(AuthenticatedUser u) {
    admin(u); return db.queryForList("""
        SELECT id,'EMAIL' AS channel,state,attempts,last_error,first_attempt FROM hotel_email_delivery WHERE state='DEAD'
        UNION ALL SELECT id,'OUTBOX' AS channel,'DEAD' AS state,attempts,last_error,created_at AS first_attempt FROM hotel_outbox WHERE dead_letter
        ORDER BY first_attempt DESC LIMIT 100
        """);
  }
  public Map<String,Object> checkIn(AuthenticatedUser u, UUID id, Long expectedVersion) {
    return tx.execute(s -> {
      var initial = booking(id); var p = property((UUID) initial.get("property_id"));
      owner(u, p);
      var b = one("SELECT * FROM hotel_booking WHERE id=? FOR UPDATE", id);
      if (expectedVersion != null && !expectedVersion.equals(((Number) b.get("version")).longValue())) {
        throw error("HOTEL_VERSION_CONFLICT", HttpStatus.CONFLICT);
      }
      String state = (String) b.get("status");
      check("CONFIRMED".equals(state), "HOTEL_INVALID_STATE");
      db.update("UPDATE hotel_booking SET status='CHECKED_IN', check_in_at=clock_timestamp(), version=version+1 WHERE id=?", id);
      event(id, "BOOKING_CHECKED_IN", p, b);
      return booking(id);
    });
  }

  public Map<String,Object> checkOut(AuthenticatedUser u, UUID id, Long expectedVersion) {
    return tx.execute(s -> {
      var initial = booking(id); var p = property((UUID) initial.get("property_id"));
      owner(u, p);
      var b = one("SELECT * FROM hotel_booking WHERE id=? FOR UPDATE", id);
      if (expectedVersion != null && !expectedVersion.equals(((Number) b.get("version")).longValue())) {
        throw error("HOTEL_VERSION_CONFLICT", HttpStatus.CONFLICT);
      }
      String state = (String) b.get("status");
      check("CHECKED_IN".equals(state), "HOTEL_INVALID_STATE");
      db.update("UPDATE hotel_booking SET status='CHECKED_OUT', check_out_at=clock_timestamp(), version=version+1 WHERE id=?", id);
      event(id, "BOOKING_CHECKED_OUT", p, b);
      return booking(id);
    });
  }

  public Map<String,Object> noShow(AuthenticatedUser u, UUID id, Long expectedVersion) {
    return tx.execute(s -> {
      var initial = booking(id); var p = property((UUID) initial.get("property_id"));
      owner(u, p);
      var b = one("SELECT * FROM hotel_booking WHERE id=? FOR UPDATE", id);
      if (expectedVersion != null && !expectedVersion.equals(((Number) b.get("version")).longValue())) {
        throw error("HOTEL_VERSION_CONFLICT", HttpStatus.CONFLICT);
      }
      String state = (String) b.get("status");
      check("CONFIRMED".equals(state), "HOTEL_INVALID_STATE");

      Object nsa = b.get("no_show_after");
      if (nsa instanceof java.sql.Timestamp ts && ts.toInstant().isAfter(now())) {
        throw error("HOTEL_NO_SHOW_EARLY", HttpStatus.CONFLICT);
      }

      LocalDate today = now().atZone(ZoneId.of((String) p.get("time_zone"))).toLocalDate();
      LocalDate checkIn = date(b.get("check_in"));
      LocalDate checkOut = date(b.get("check_out"));
      LocalDate releaseFrom = today.isAfter(checkIn) ? today : checkIn;
      if (releaseFrom.isBefore(checkOut)) {
        int q = number(b.get("quantity"));
        db.update("UPDATE hotel_inventory SET booked=booked-? WHERE room_type_id=? AND stay_date>=? AND stay_date<?",
            q, b.get("room_type_id"), releaseFrom, checkOut);
      }

      db.update("UPDATE hotel_booking SET status='NO_SHOW', version=version+1 WHERE id=?", id);
      event(id, "BOOKING_NO_SHOW", p, b);
      return booking(id);
    });
  }

  public Map<String,Object> propertyCancel(AuthenticatedUser u, UUID id, Long expectedVersion, String reason) {
    if (reason == null || reason.isBlank()) {
      throw error("HOTEL_REASON_REQUIRED", HttpStatus.BAD_REQUEST);
    }
    return tx.execute(s -> {
      var initial = booking(id); var p = property((UUID) initial.get("property_id"));
      owner(u, p);
      var b = one("SELECT * FROM hotel_booking WHERE id=? FOR UPDATE", id);
      if (expectedVersion != null && !expectedVersion.equals(((Number) b.get("version")).longValue())) {
        throw error("HOTEL_VERSION_CONFLICT", HttpStatus.CONFLICT);
      }
      String state = (String) b.get("status");
      check("CONFIRMED".equals(state) || "HELD".equals(state), "HOTEL_INVALID_STATE");

      LocalDate today = now().atZone(ZoneId.of((String) p.get("time_zone"))).toLocalDate();
      LocalDate checkIn = date(b.get("check_in"));
      LocalDate checkOut = date(b.get("check_out"));
      LocalDate releaseFrom = today.isAfter(checkIn) ? today : checkIn;
      if (releaseFrom.isBefore(checkOut)) {
        int q = number(b.get("quantity"));
        boolean held = "HELD".equals(state);
        db.update("UPDATE hotel_inventory SET held=held+?, booked=booked+? WHERE room_type_id=? AND stay_date>=? AND stay_date<?",
            held ? -q : 0, held ? 0 : -q, b.get("room_type_id"), releaseFrom, checkOut);
      }

      db.update("UPDATE hotel_booking SET status='CANCELLED', cancelled_by='PROPERTY', cancellation_reason=?, version=version+1 WHERE id=?",
          reason, id);
      if ("PAYOS".equals(b.get("payment_method")))
        db.update("UPDATE hotel_payos_payment SET resolution='REFUND_REQUIRED' WHERE booking_id=? AND state='PAID' AND resolution='NONE'",id);
      else refundDemo(id);
      event(id, "BOOKING_CANCELLED", p, b);
      return booking(id);
    });
  }

  public Map<String,Object> bookingDetail(AuthenticatedUser u, UUID id) {
    var b=booking(id);
    if(!u.id().equals(b.get("customer_id"))) owner(u,one("SELECT * FROM hotel_property WHERE id=?",b.get("property_id")));
    return b;
  }

  public Map<String,Object> commerceConfig() {
    return Map.of("simulationEnabled",demoPaymentsEnabled,"commissionBps",1000,"currency","VND",
        "onlineProvider",payosEnabled?"PAYOS":"");
  }

  private void demoEnabled() {
    if(!demoPaymentsEnabled) throw error("HOTEL_DEMO_DISABLED",HttpStatus.SERVICE_UNAVAILABLE);
  }

  private Map<String,Object> previousCommand(AuthenticatedUser u, UUID id, String key, String operation, String payload) {
    if(key==null || !key.matches("[A-Za-z0-9_-]{8,100}")) throw error("HOTEL_INVALID_REQUEST_KEY",HttpStatus.BAD_REQUEST);
    // Actor lock also prevents the same key racing across different properties.
    db.update("INSERT INTO hotel_request_lock(customer_id) VALUES (?) ON CONFLICT DO NOTHING",u.id());
    one("SELECT * FROM hotel_request_lock WHERE customer_id=? FOR UPDATE",u.id());
    var rows=db.queryForList("SELECT * FROM hotel_demo_command WHERE actor_id=? AND operation=? AND request_key=?",u.id(),operation,key);
    if(rows.isEmpty()) return null;
    var command=rows.getFirst();
    check(id.equals(command.get("booking_id")) && payload.equals(command.get("payload")),"HOTEL_IDEMPOTENCY_CONFLICT");
    return one("SELECT result->>'outcome' AS outcome FROM hotel_demo_command WHERE id=?",command.get("id"));
  }

  private void receipt(AuthenticatedUser u,UUID id,String key,String operation,String payload,String outcome) {
    db.update("INSERT INTO hotel_demo_command(id,actor_id,booking_id,operation,request_key,payload,result) VALUES (?,?,?,?,?,?,jsonb_build_object('outcome',?::text))",
        UUID.randomUUID(),u.id(),id,operation,key,payload,outcome);
  }

  private Map<String,Object> paymentResult(UUID id,String outcome) {
    var payments=db.queryForList("SELECT * FROM hotel_demo_payment WHERE booking_id=?",id);
    return Map.of("simulation",true,"outcome",outcome,"booking",booking(id),"payments",payments);
  }

  public Map<String,Object> demoPayment(AuthenticatedUser u,UUID id,String key,String outcome) {
    demoEnabled();
    if(!Set.of("SUCCESS","FAILURE","EXPIRED").contains(outcome)) throw error("HOTEL_INVALID_OUTCOME",HttpStatus.BAD_REQUEST);
    return tx.execute(s -> {
      var initial=booking(id);
      if(!u.id().equals(initial.get("customer_id"))) throw error("HOTEL_NOT_FOUND",HttpStatus.NOT_FOUND);
      var previous=previousCommand(u,id,key,"PAYMENT",outcome);
      if(previous!=null) return paymentResult(id,(String)previous.get("outcome"));
      var p=property((UUID)initial.get("property_id"));
      var b=one("SELECT * FROM hotel_booking WHERE id=? FOR UPDATE",id);
      check("DEMO_ONLINE".equals(b.get("payment_method")),"HOTEL_INVALID_PAYMENT_METHOD");
      if(db.queryForObject("SELECT count(*) FROM hotel_demo_payment WHERE booking_id=?",Integer.class,id)>0) {
        receipt(u,id,key,"PAYMENT",outcome,"ALREADY_PROCESSED");
        return paymentResult(id,"ALREADY_PROCESSED");
      }
      check(Set.of("HELD","EXPIRED").contains(b.get("status")),"HOTEL_INVALID_STATE");
      if("EXPIRED".equals(outcome) && "HELD".equals(b.get("status")))
        db.update("UPDATE hotel_booking SET expires_at=clock_timestamp() WHERE id=?",id);
      expireProperty(p);
      b=booking(id);
      if("FAILURE".equals(outcome)) {
        receipt(u,id,key,"PAYMENT",outcome,"FAILED");
        return paymentResult(id,"FAILED");
      }
      var confirmedOrExpired="EXPIRED".equals(b.get("status")) ? b : transitionLocked(u,id,true,true);
      boolean expired="EXPIRED".equals(confirmedOrExpired.get("status"));
      java.math.BigDecimal amount=(java.math.BigDecimal)b.get("total");
      var commission=amount.multiply(new java.math.BigDecimal("0.10")).setScale(0,java.math.RoundingMode.HALF_UP);
      var net=amount.subtract(commission);
      db.update("INSERT INTO hotel_demo_payment(booking_id,state,amount,currency,commission_bps,commission_amount,partner_amount) VALUES (?,'CAPTURED',?,'VND',1000,?,?)",id,amount,commission,net);
      db.update("UPDATE hotel_booking SET payment_method='DEMO_ONLINE' WHERE id=?",id);
      ledger(id,"CAPTURE");
      if(expired) refundDemo(id);
      String result=expired?"REFUNDED_EXPIRED":"CAPTURED";
      receipt(u,id,key,"PAYMENT",outcome,result);
      return paymentResult(id,result);
    });
  }

  private void ledger(UUID id,String event) {
    db.update("INSERT INTO hotel_demo_ledger(id,booking_id,event,gross,commission,partner_amount) SELECT ?,booking_id,?,amount,commission_amount,partner_amount FROM hotel_demo_payment WHERE booking_id=? ON CONFLICT(booking_id,event) DO NOTHING",UUID.randomUUID(),event,id);
  }

  private void refundDemo(UUID id) {
    check(db.queryForObject("SELECT count(*) FROM hotel_demo_ledger WHERE booking_id=? AND event='PAYOUT'",Integer.class,id)==0,"HOTEL_ALREADY_SETTLED");
    if(db.update("UPDATE hotel_demo_payment SET state='REFUNDED',refunded_at=clock_timestamp() WHERE booking_id=? AND state='CAPTURED'",id)>0) ledger(id,"REFUND");
  }

  public Map<String,Object> demoSettlement(AuthenticatedUser u,UUID id,String key) {
    demoEnabled(); admin(u);
    return tx.execute(s -> {
      var previous=previousCommand(u,id,key,"SETTLEMENT","PAYOUT");
      var initial=booking(id); var p=property((UUID)initial.get("property_id"));
      var b=one("SELECT * FROM hotel_booking WHERE id=? FOR UPDATE",id);
      if(previous!=null || db.queryForObject("SELECT count(*) FROM hotel_demo_ledger WHERE booking_id=? AND event='PAYOUT'",Integer.class,id)>0)
        return paymentResult(id,"PAID_OUT");
      check("CHECKED_OUT".equals(b.get("status")),"HOTEL_NOT_COMPLETED");
      check(db.queryForObject("SELECT count(*) FROM hotel_demo_payment WHERE booking_id=? AND state='CAPTURED'",Integer.class,id)==1,"HOTEL_NOT_PAID");
      check(db.queryForObject("SELECT count(*) FROM partner_support_case WHERE resource_type='HOTEL_BOOKING' AND resource_id=? AND state IN ('OPEN','IN_PROGRESS')",Integer.class,id)==0,"HOTEL_OPEN_DISPUTE");
      ledger(id,"PAYOUT");
      receipt(u,id,key,"SETTLEMENT","PAYOUT","PAID_OUT");
      event(id,"BOOKING_DEMO_SETTLED",p,b);
      return paymentResult(id,"PAID_OUT");
    });
  }

  public List<Map<String,Object>> commerce(AuthenticatedUser u) {
    return db.queryForList("""
        SELECT b.id AS booking_id,b.business_id,b.property_name,b.room_name,b.status AS booking_status,
        p.amount,p.currency,p.commission_bps,p.commission_amount,p.partner_amount,p.state AS payment_state,
        p.captured_at,p.refunded_at,
        CASE WHEN p.state='REFUNDED' THEN 'REFUNDED'
             WHEN EXISTS(SELECT 1 FROM hotel_demo_ledger l WHERE l.booking_id=b.id AND l.event='PAYOUT') THEN 'PAID_OUT'
             WHEN EXISTS(SELECT 1 FROM partner_support_case c WHERE c.resource_type='HOTEL_BOOKING' AND c.resource_id=b.id AND c.state IN ('OPEN','IN_PROGRESS')) THEN 'DISPUTED'
             WHEN b.status='CHECKED_OUT' THEN 'ELIGIBLE' ELSE 'PENDING' END AS settlement_state
        FROM hotel_demo_payment p JOIN hotel_booking b ON b.id=p.booking_id
        WHERE ? OR b.customer_id=? OR EXISTS(SELECT 1 FROM partner_business_member m WHERE m.business_id=b.business_id AND m.user_id=? AND m.state='ACTIVE' AND m.role IN ('OWNER','MANAGER'))
        ORDER BY p.captured_at DESC LIMIT 200
        """,isAdmin(u),u.id(),u.id());
  }

  /** Confirm a PAYOS booking after verified payment. Called from PayOsPaymentService inside transaction. */
  public void confirmPayosBooking(UUID bookingId) {
    var b=one("SELECT * FROM hotel_booking WHERE id=? FOR UPDATE",bookingId);
    var p=property((UUID)b.get("property_id"));
    check("HELD".equals(b.get("status")),"HOTEL_INVALID_STATE");
    check("PAYOS".equals(b.get("payment_method")),"HOTEL_INVALID_PAYMENT_METHOD");
    check("ACTIVE".equals(p.get("status")),"HOTEL_NOT_ACTIVE");
    UUID bizId=(UUID)p.get("business_id");
    currentIdentity(p,eligibleBusiness(bizId,"HOTEL_BOOKING",false));
    check(!date(b.get("check_in")).isBefore(now().atZone(ZoneId.of((String)b.get("time_zone"))).toLocalDate()),"HOTEL_INVALID_DATES");
    var inv=days((UUID)b.get("room_type_id"),date(b.get("check_in")),date(b.get("check_out")));
    int qty=number(b.get("quantity"));
    check(inv.size()==ChronoUnit.DAYS.between(date(b.get("check_in")),date(b.get("check_out")))
        && inv.stream().allMatch(d->number(d.get("held"))>=qty && number(d.get("held"))+number(d.get("booked"))<=number(d.get("allocation"))),"HOTEL_INVENTORY_CONFLICT");
    adjust(b,"CONFIRMED");
    event(bookingId,"BOOKING_CONFIRMED",p,b);
    if(inv.stream().anyMatch(d->number(d.get("allocation"))-number(d.get("held"))-number(d.get("booked"))<=1)) event(bookingId,"INVENTORY_LOW",p,null);
  }

  /** Direct booking read without auth check — for internal payment service use only. */
  Map<String,Object> bookingDirect(UUID id) { return one("SELECT * FROM hotel_booking WHERE id=?",id); }
}
