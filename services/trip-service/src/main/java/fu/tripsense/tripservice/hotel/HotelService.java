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
  public static boolean isAdmin(AuthenticatedUser u) { return Set.of("ADMIN","ROLE_ADMIN").contains(Objects.toString(u.role(),"")); }
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
      if(count!=null && count>0) return true;
    }
    return u.id().equals(p.get("owner_id"));
  }
  private void owner(AuthenticatedUser u,Map<String,Object> p) {
    if(!isPropertyOwner(u,p)) throw error("HOTEL_NOT_FOUND",HttpStatus.NOT_FOUND);
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
    return db.queryForList("SELECT * FROM hotel_property WHERE owner_id=? ORDER BY created_at DESC LIMIT 100",u.id());
  }
  public Map<String,Object> details(UUID id,AuthenticatedUser u) {
    var p=one("SELECT * FROM hotel_property WHERE id=?",id);
    if(!"ACTIVE".equals(p.get("status")) && !isAdmin(u)) owner(u,p);
    p.remove("owner_email"); p.remove("owner_id"); return p;
  }
  public Map<String,Object> saveProperty(AuthenticatedUser u,UUID id,PropertyInput in) {
    validate(in);
    return tx.execute(s -> {
      UUID key=id==null?UUID.randomUUID():id;
      if(id==null) db.update("INSERT INTO hotel_property(id,owner_id,owner_email,name,destination,address,time_zone,check_in_time,check_out_time) VALUES (?,?,?,?,?,?,?,?,?)",
          key,u.id(),u.email(),in.name().strip(),in.destination().strip(),in.address().strip(),in.timeZone(),in.checkInTime(),in.checkOutTime());
      else {
        var p=property(id); owner(u,p);
        db.update("UPDATE hotel_property SET name=?,destination=?,address=?,time_zone=?,check_in_time=?,check_out_time=?,status='PENDING' WHERE id=?",
            in.name().strip(),in.destination().strip(),in.address().strip(),in.timeZone(),in.checkInTime(),in.checkOutTime(),id);
      }
      return one("SELECT * FROM hotel_property WHERE id=?",key);
    });
  }
  public Map<String,Object> status(AuthenticatedUser u,UUID id,String status) {
    admin(u);
    return tx.execute(s -> {
      var p=property(id);
      if(!status.equals(p.get("status"))) {
        db.update("UPDATE hotel_property SET status=? WHERE id=?",status,id);
        event(id,"PROPERTY_STATUS_CHANGED",p,null);
      }
      return one("SELECT * FROM hotel_property WHERE id=?",id);
    });
  }
  public List<Map<String,Object>> rooms(AuthenticatedUser u,UUID id) {
    return tx.execute(s -> { owner(u,property(id)); return db.queryForList("SELECT * FROM hotel_room_type WHERE property_id=? ORDER BY name",id); });
  }
  public Map<String,Object> createRoom(AuthenticatedUser u,UUID id,RoomInput in) {
    return tx.execute(s -> { owner(u,property(id)); UUID rid=UUID.randomUUID();
      db.update("INSERT INTO hotel_room_type(id,property_id,name,capacity) VALUES (?,?,?,?)",rid,id,in.name().strip(),in.capacity());
      return one("SELECT * FROM hotel_room_type WHERE id=?",rid);
    });
  }
  public Map<String,Object> updateRoom(AuthenticatedUser u,UUID pid,UUID rid,RoomInput in) {
    return tx.execute(s -> {
      var p=property(pid); owner(u,p); room(pid,rid); expireProperty(p);
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
      var p=property(pid); owner(u,p); room(pid,rid); expireProperty(p);
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
    range(from,to,30);
    if(destination==null || destination.isBlank() || destination.length()>120 || quantity<1 || quantity>10 || guests<1 || guests>200)
      throw error("HOTEL_INVALID_SEARCH",HttpStatus.BAD_REQUEST);
    return db.queryForList("""
        SELECT p.id AS property_id,p.name,p.destination,p.address,p.time_zone,r.id AS room_type_id,r.name AS room_name,
        r.capacity,min(i.allocation-i.held-i.booked) AS available_rooms,sum(i.nightly_price)*? AS total,'VND' AS currency,
        clock_timestamp() AS checked_at
        FROM hotel_property p JOIN hotel_room_type r ON r.property_id=p.id
        JOIN hotel_inventory i ON i.room_type_id=r.id AND i.stay_date>=? AND i.stay_date<?
        WHERE p.status='ACTIVE' AND lower(p.destination)=lower(?) AND r.capacity*?>=?
        AND ? >= (clock_timestamp() AT TIME ZONE p.time_zone)::date
        GROUP BY p.id,r.id HAVING count(*)=? AND bool_and(NOT i.stop_sell) AND min(i.allocation-i.held-i.booked)>=?
        ORDER BY total,p.id,r.id LIMIT 50
        """,quantity,from,to,destination.strip(),quantity,guests,from,ChronoUnit.DAYS.between(from,to),quantity);
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
      if(bizId!=null) {
        var bRows=db.queryForList("SELECT operation_state, requires_reverification FROM partner_business WHERE id=?",bizId);
        if(!bRows.isEmpty()) {
          var bz=bRows.getFirst();
          if("SUSPENDED".equals(bz.get("operation_state"))) {
            throw new TripServiceException("BUSINESS_SUSPENDED","Partner business is suspended",HttpStatus.FORBIDDEN);
          }
          if(Boolean.TRUE.equals(bz.get("requires_reverification"))) {
            throw new TripServiceException("REVERIFICATION_REQUIRED","Cannot accept new bookings while reverification is required",HttpStatus.CONFLICT);
          }
          Integer capCount=db.queryForObject(
              "SELECT count(*) FROM partner_business_capability WHERE business_id=? AND capability='HOTEL_BOOKING' AND revoked_at IS NULL",
              Integer.class,bizId);
          if(capCount==null || capCount==0) {
            throw new TripServiceException("CAPABILITY_REQUIRED","Business does not have HOTEL_BOOKING capability",HttpStatus.FORBIDDEN);
          }
        }
      }
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
          INSERT INTO hotel_booking(id,property_id,business_id,room_type_id,customer_id,customer_email,request_key,check_in,check_out,quantity,guests,total,property_name,room_name,time_zone,status,expires_at,free_cancellation_until,no_show_after)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'HELD',clock_timestamp()+interval '10 minutes',?,?)
          """,bid,pid,bizId,in.roomTypeId(),u.id(),u.email(),key,in.checkIn(),in.checkOut(),in.quantity(),in.guests(),total.multiply(BigDecimal.valueOf(in.quantity())),p.get("name"),r.get("name"),p.get("time_zone"),java.sql.Timestamp.from(freeCancelUntil),java.sql.Timestamp.from(noShowAfter));
      metrics.counter("hotel.holds.created").increment(); return booking(bid);
    });
  }
  private Map<String,Object> booking(UUID id) { return one("SELECT * FROM hotel_booking WHERE id=?",id); }
  public Map<String,Object> transition(AuthenticatedUser u,UUID id,boolean confirm) {
    var result=tx.execute(s -> {
      var initial=booking(id); var p=property((UUID)initial.get("property_id"));
      var b=one("SELECT * FROM hotel_booking WHERE id=? FOR UPDATE",id);
      boolean isOwner=isPropertyOwner(u,p);
      if(!u.id().equals(b.get("customer_id")) && (confirm || !isOwner)) throw error("HOTEL_NOT_FOUND",HttpStatus.NOT_FOUND);
      expireProperty(p); b=booking(id); String state=(String)b.get("status");
      if(confirm && "CONFIRMED".equals(state) || !confirm && Set.of("CANCELLED","EXPIRED").contains(state)) return b;
      if("EXPIRED".equals(state)) return b; // commit expiry release before reporting conflict
      check(confirm?"HELD".equals(state):Set.of("HELD","CONFIRMED").contains(state),"HOTEL_INVALID_STATE");
      if(confirm) {
        check("ACTIVE".equals(p.get("status")),"HOTEL_NOT_ACTIVE");
        UUID bizId=(UUID)p.get("business_id");
        if(bizId!=null) {
          var bRows=db.queryForList("SELECT operation_state FROM partner_business WHERE id=?",bizId);
          if(!bRows.isEmpty() && "SUSPENDED".equals(bRows.getFirst().get("operation_state"))) {
            throw new TripServiceException("BUSINESS_SUSPENDED","Partner business is suspended",HttpStatus.FORBIDDEN);
          }
          Integer capCount=db.queryForObject(
              "SELECT count(*) FROM partner_business_capability WHERE business_id=? AND capability='HOTEL_BOOKING' AND revoked_at IS NULL",
              Integer.class,bizId);
          if(capCount==null || capCount==0) {
            throw new TripServiceException("CAPABILITY_REQUIRED","Business does not have HOTEL_BOOKING capability",HttpStatus.FORBIDDEN);
          }
        }
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
      adjust(b,confirm?"CONFIRMED":"CANCELLED");
      if(!confirm) {
        db.update("UPDATE hotel_booking SET cancelled_by=? WHERE id=?",u.id().equals(b.get("customer_id"))?"CUSTOMER":"PROPERTY",id);
      }
      event(id,confirm?"BOOKING_CONFIRMED":"BOOKING_CANCELLED",p,b);
      if(confirm && days((UUID)b.get("room_type_id"),date(b.get("check_in")),date(b.get("check_out"))).stream().anyMatch(d -> number(d.get("allocation"))-number(d.get("held"))-number(d.get("booked"))<=1)) event(id,"INVENTORY_LOW",p,null);
      return booking(id);
    });
    if(confirm && "EXPIRED".equals(result.get("status"))) throw error("HOTEL_HOLD_EXPIRED",HttpStatus.CONFLICT);
    return result;
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
      event(id, "BOOKING_CANCELLED", p, b);
      return booking(id);
    });
  }
}
