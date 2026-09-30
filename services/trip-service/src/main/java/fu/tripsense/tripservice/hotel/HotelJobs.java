package fu.tripsense.tripservice.hotel;

import io.micrometer.core.instrument.MeterRegistry;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class HotelJobs {
  private static final Logger log=LoggerFactory.getLogger(HotelJobs.class);
  private final JdbcTemplate db;
  private final TransactionTemplate tx;
  private final HotelService hotels;
  private final HotelMailClient mail;
  private final MeterRegistry metrics;
  private final PayOsPaymentService payOsPayments;
  public HotelJobs(JdbcTemplate db,TransactionTemplate tx,HotelService hotels,HotelMailClient mail,MeterRegistry metrics,PayOsPaymentService payOsPayments) {
    this.db=db; this.tx=tx; this.hotels=hotels; this.mail=mail; this.metrics=metrics; this.payOsPayments=payOsPayments;
  }
  @Configuration
  @EnableScheduling
  @ConditionalOnProperty(name="hotel.jobs.enabled",havingValue="true",matchIfMissing=true)
  static class Scheduling {}

  @Scheduled(fixedDelayString="${hotel.jobs.interval-ms:15000}")
  public void tick() {
    try { hotels.expire(); dispatch(); deliver(); payOsPayments.reconcile(); }
    catch(Exception e) { metrics.counter("hotel.worker.failures").increment(); log.warn("hotel_worker_failed type={}",e.getClass().getSimpleName()); }
  }
  public void dispatch() {
    for(UUID candidate:db.queryForList("SELECT id FROM hotel_outbox WHERE processed_at IS NULL AND NOT dead_letter AND next_attempt<=clock_timestamp() ORDER BY created_at LIMIT 50",UUID.class)) {
      try { tx.executeWithoutResult(s -> {
      var events=db.queryForList("""
          SELECT id,aggregate_id,event_type,payload->>'ownerId' AS owner_id,payload->>'ownerEmail' AS owner_email,
          payload->>'customerId' AS customer_id,payload->>'customerEmail' AS customer_email
          FROM hotel_outbox WHERE id=? AND processed_at IS NULL AND NOT dead_letter AND next_attempt<=clock_timestamp() FOR UPDATE SKIP LOCKED
          """,candidate);
      for(var e:events) {
        String type=(String)e.get("event_type");
        String message=switch(type) {
          case "BOOKING_CONFIRMED" -> {
              String method = db.queryForObject("SELECT payment_method FROM hotel_booking WHERE id=?",String.class,e.get("aggregate_id"));
              yield "PAYOS".equals(method) ? "Reservation confirmed. Online payment received."
                  : "DEMO_ONLINE".equals(method) ? "Reservation confirmed. Demo payment recorded; no real funds moved."
                  : "Reservation confirmed. Payment is due at the property.";
          }
          case "BOOKING_CANCELLED" -> "Reservation cancelled. The allocated rooms have been released.";
          case "BOOKING_EXPIRED" -> "Reservation hold expired. Search again to check available rooms.";
          case "BOOKING_CHECKED_IN" -> "Guest check-in recorded for this reservation.";
          case "BOOKING_CHECKED_OUT" -> "Guest check-out recorded for this reservation.";
          case "BOOKING_NO_SHOW" -> "No-show recorded for this reservation.";
          case "BOOKING_DEMO_SETTLED" -> "Demo partner settlement recorded; no real funds moved.";
          case "INVENTORY_LOW" -> "Allocated inventory is low for one or more nights. Review your calendar.";
          default -> "Property verification status changed. Review your property dashboard.";
        };
        message += " Reference: "+e.get("aggregate_id");
        for(String recipient:List.of("owner","customer")) {
          if(e.get(recipient+"_id")==null) continue;
          UUID nid=UUID.randomUUID();
          int inserted=db.update("""
              INSERT INTO hotel_notification(id,event_id,recipient_id,event_type,aggregate_id,message)
              VALUES (?,?,?,?,?,?) ON CONFLICT(event_id,recipient_id) DO NOTHING
              """,nid,e.get("id"),UUID.fromString((String)e.get(recipient+"_id")),type,e.get("aggregate_id"),message);
          if(inserted==1) db.update("INSERT INTO hotel_email_delivery(id,recipient_email,subject,message) VALUES (?,?,?,?)",nid,e.get(recipient+"_email"),"TripSense reservation update",message);
        }
        db.update("UPDATE hotel_outbox SET processed_at=clock_timestamp() WHERE id=?",e.get("id"));
      }
      }); } catch(Exception e) {
        db.update("""
            UPDATE hotel_outbox SET attempts=attempts+1,dead_letter=(attempts+1>=6),
            next_attempt=clock_timestamp()+least(3600,power(2,attempts+1)*30)*interval '1 second',last_error='DISPATCH_FAILED'
            WHERE id=? AND processed_at IS NULL
            """,candidate);
        metrics.counter("hotel.outbox.failures").increment();
        log.warn("hotel_event_failed eventId={} type={}",candidate,e.getClass().getSimpleName());
      }
    }
  }
  public void deliver() {
    for(int i=0;i<20;i++) {
      var job=tx.execute(s -> {
        db.update("""
            UPDATE hotel_email_delivery SET state='DEAD',last_error='RECONCILIATION_REQUIRED'
            WHERE state IN ('PENDING','SENDING') AND (attempts>=6 OR first_attempt<clock_timestamp()-interval '23 hours')
            AND (lease_until IS NULL OR lease_until<clock_timestamp())
            """);
        var jobs=db.queryForList("""
            SELECT * FROM hotel_email_delivery WHERE (state='PENDING' AND next_attempt<=clock_timestamp())
            OR (state='SENDING' AND lease_until<clock_timestamp()) ORDER BY next_attempt LIMIT 1 FOR UPDATE SKIP LOCKED
            """);
        if(jobs.isEmpty()) return null;
        var j=jobs.getFirst(); UUID lease=UUID.randomUUID();
        db.update("""
            UPDATE hotel_email_delivery SET state='SENDING',attempts=attempts+1,lease_token=?,
            first_attempt=coalesce(first_attempt,clock_timestamp()),lease_until=clock_timestamp()+interval '2 minutes' WHERE id=?
            """,lease,j.get("id"));
        j.put("lease_token",lease); return j;
      });
      if(job==null) break;
      try {
        mail.send(job);
        db.update("UPDATE hotel_email_delivery SET state='SENT',sent_at=clock_timestamp(),lease_until=NULL WHERE id=? AND lease_token=?",job.get("id"),job.get("lease_token"));
        metrics.counter("hotel.email.sent").increment();
      } catch(Exception e) {
        if(e instanceof InterruptedException) Thread.currentThread().interrupt();
        db.update("""
            UPDATE hotel_email_delivery SET state=CASE WHEN attempts>=6 THEN 'DEAD' ELSE 'PENDING' END,
            next_attempt=clock_timestamp()+least(3600,power(2,attempts)*30)*interval '1 second',
            lease_until=NULL,last_error='DELIVERY_FAILED' WHERE id=? AND lease_token=?
            """,job.get("id"),job.get("lease_token"));
        metrics.counter("hotel.email.failures").increment();
        log.warn("hotel_email_failed deliveryId={} attempt={}",job.get("id"),((Number)job.get("attempts")).intValue()+1);
      }
    }
  }
}
