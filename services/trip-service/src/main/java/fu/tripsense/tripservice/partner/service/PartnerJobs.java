package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.client.SocialServiceClient;
import fu.tripsense.tripservice.hotel.HotelMailClient;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@Slf4j
public class PartnerJobs {

  private final JdbcTemplate db;
  private final TransactionTemplate tx;
  private final HotelMailClient mail;
  private final MeterRegistry metrics;
  private final SocialServiceClient socialServiceClient;

  public PartnerJobs(
      JdbcTemplate db,
      TransactionTemplate tx,
      HotelMailClient mail,
      MeterRegistry metrics) {
    this(db, tx, mail, metrics, null);
  }

  @Autowired
  public PartnerJobs(
      JdbcTemplate db,
      TransactionTemplate tx,
      HotelMailClient mail,
      MeterRegistry metrics,
      @Autowired(required = false) SocialServiceClient socialServiceClient) {
    this.db = db;
    this.tx = tx;
    this.mail = mail;
    this.metrics = metrics;
    this.socialServiceClient = socialServiceClient;
  }

  @Configuration
  @EnableScheduling
  @ConditionalOnProperty(name = "partner.jobs.enabled", havingValue = "true", matchIfMissing = true)
  static class Scheduling {}

  @Scheduled(fixedDelayString = "${partner.jobs.interval-ms:15000}")
  public void tick() {
    try {
      dispatch();
      deliver();
      expireInquiries();
    } catch (Exception e) {
      metrics.counter("partner.worker.failures").increment();
      log.warn("partner_worker_failed type={}", e.getClass().getSimpleName());
    }
  }

  public void expireInquiries() {
    try {
      db.update(
          """
          UPDATE guide_inquiry
          SET state = 'EXPIRED',
              close_reason = 'INQUIRY_EXPIRED',
              updated_at = clock_timestamp()
          WHERE expires_at < clock_timestamp()
            AND state IN ('SUBMITTED', 'IN_DISCUSSION', 'PROPOSAL_SENT')
          """);
    } catch (Exception ex) {
      log.warn("expire_inquiries_failed: {}", ex.getMessage());
    }
  }

  public void dispatch() {
    List<UUID> candidateIds =
        db.queryForList(
            """
            SELECT id FROM partner_outbox
            WHERE processed_at IS NULL AND NOT dead_letter AND next_attempt <= clock_timestamp()
            ORDER BY created_at LIMIT 50
            """,
            UUID.class);

    for (UUID candidateId : candidateIds) {
      try {
        tx.executeWithoutResult(
            status -> {
              var events =
                  db.queryForList(
                      """
                      SELECT id, event_id, aggregate_type, aggregate_id, event_type,
                             payload->>'businessId' AS business_id,
                             payload->>'ownerId' AS owner_id,
                             payload->>'recipientEmail' AS recipient_email,
                             payload->>'reason' AS reason,
                             payload->>'role' AS role,
                             payload->>'promotionId' AS promotion_id,
                             payload->>'distributionVersion' AS distribution_version,
                             payload->>'approvedRevisionId' AS approved_revision_id,
                             payload->>'enabled' AS enabled
                      FROM partner_outbox
                      WHERE id = ? AND processed_at IS NULL AND NOT dead_letter AND next_attempt <= clock_timestamp()
                      FOR UPDATE SKIP LOCKED
                      """,
                      candidateId);

              for (var e : events) {
                String eventType = (String) e.get("event_type");
                UUID eventId = (UUID) e.get("event_id");
                String businessIdStr = (String) e.get("business_id");
                UUID businessId = businessIdStr != null ? UUID.fromString(businessIdStr) : null;
                String ownerIdStr = (String) e.get("owner_id");
                String reason = (String) e.get("reason");

                String message =
                    switch (eventType) {
                      case "PartnerApplicationSubmitted" ->
                          "Your business application has been submitted for review.";
                      case "PartnerApplicationApproved" ->
                          "Congratulations! Your business application has been approved.";
                      case "PartnerChangesRequested" ->
                          "Changes requested for your business application: " + (reason != null ? reason : "");
                      case "PartnerApplicationRejected" ->
                          "Your business application was rejected: " + (reason != null ? reason : "");
                      case "PartnerMaterialChangeDeclared" ->
                          "Material change declared. Business is hidden pending reverification.";
                      case "PartnerBusinessSuspended" ->
                          "Your business has been suspended by administration. Reason: " + (reason != null ? reason : "");
                      case "PartnerBusinessReinstated" ->
                          "Your business suspension has been lifted. You may review your dashboard.";
                      case "PartnerCapabilitiesRevoked" ->
                          "One or more capabilities were revoked for your business.";
                      case "PartnerMemberInvited" ->
                          "You have been invited to join business as " + e.get("role");
                      case "PartnerMembershipRevoked" ->
                          "Your membership for business has been revoked.";
                      case "GuideCommunityDistributionChanged" ->
                          "Guide community distribution updated.";
                      default -> "Partner business status update.";
                    };

                // Notify owner if available
                if (ownerIdStr != null) {
                  UUID recipientId = UUID.fromString(ownerIdStr);
                  UUID nid = UUID.randomUUID();
                  db.update(
                      """
                      INSERT INTO partner_notification(id, event_id, recipient_id, event_type, business_id, message)
                      VALUES (?, ?, ?, ?, ?, ?)
                      ON CONFLICT (event_id, recipient_id) DO NOTHING
                      """,
                      nid,
                      eventId,
                      recipientId,
                      eventType,
                      businessId,
                      message);
                }

                if ("PartnerBusinessSuspended".equals(eventType) && businessId != null) {
                  db.update(
                      """
                      UPDATE guide_inquiry
                      SET state = 'CLOSED',
                          close_reason = 'SUSPENDED_DURING_INQUIRY',
                          updated_at = clock_timestamp()
                      WHERE guide_business_id = ?
                        AND state IN ('SUBMITTED', 'IN_DISCUSSION', 'PROPOSAL_SENT')
                      """,
                      businessId);
                }

                if ("GuideCommunityDistributionChanged".equals(eventType) && socialServiceClient != null) {
                  String promoIdStr = (String) e.get("promotion_id");
                  String distVerStr = (String) e.get("distribution_version");
                  String appRevIdStr = (String) e.get("approved_revision_id");
                  String enabledStr = (String) e.get("enabled");
                  if (promoIdStr != null && distVerStr != null) {
                    try {
                      UUID promotionId = UUID.fromString(promoIdStr);
                      Long distVer = Long.parseLong(distVerStr);
                      UUID approvedRevId =
                          (appRevIdStr != null && !appRevIdStr.isBlank())
                              ? UUID.fromString(appRevIdStr)
                              : UUID.randomUUID();
                      UUID ownerId = ownerIdStr != null ? UUID.fromString(ownerIdStr) : UUID.randomUUID();
                      boolean enabled = Boolean.parseBoolean(enabledStr);

                      var ack =
                          socialServiceClient.syncGuidePromotion(
                              promotionId, eventId, distVer, businessId, ownerId, approvedRevId, enabled);
                      if (ack != null && ack.postId() != null) {
                        db.update(
                            "UPDATE partner_guide_promotion SET community_post_id = ? WHERE id = ?",
                            ack.postId(),
                            promotionId);
                      }
                    } catch (Exception ex) {
                      log.warn("Failed to process GuideCommunityDistributionChanged: {}", ex.getMessage());
                    }
                  }
                }

                // If invitation email is provided
                String recipientEmail = (String) e.get("recipient_email");
                if (recipientEmail != null && !recipientEmail.isBlank()) {
                  UUID nid = UUID.randomUUID();
                  UUID dummyRecipient = UUID.randomUUID();
                  int inserted =
                      db.update(
                          """
                          INSERT INTO partner_notification(id, event_id, recipient_id, event_type, business_id, message)
                          VALUES (?, ?, ?, ?, ?, ?)
                          ON CONFLICT (event_id, recipient_id) DO NOTHING
                          """,
                          nid,
                          eventId,
                          dummyRecipient,
                          eventType,
                          businessId,
                          message);
                  if (inserted == 1) {
                    db.update(
                        """
                        INSERT INTO partner_email_delivery(id, recipient_email, subject, message)
                        VALUES (?, ?, ?, ?)
                        """,
                        nid,
                        recipientEmail,
                        "TripSense Partner Invitation",
                        message);
                  }
                }

                db.update(
                    "UPDATE partner_outbox SET processed_at = clock_timestamp() WHERE id = ?",
                    e.get("id"));
              }
            });
      } catch (Exception e) {
        db.update(
            """
            UPDATE partner_outbox
            SET attempts = attempts + 1,
                dead_letter = (attempts + 1 >= 6),
                next_attempt = clock_timestamp() + least(3600, power(2, attempts + 1) * 30) * interval '1 second',
                last_error = 'DISPATCH_FAILED'
            WHERE id = ? AND processed_at IS NULL
            """,
            candidateId);
        metrics.counter("partner.outbox.failures").increment();
        log.warn("partner_event_failed eventId={} type={}", candidateId, e.getClass().getSimpleName());
      }
    }
  }

  public void deliver() {
    for (int i = 0; i < 20; i++) {
      var job =
          tx.execute(
              status -> {
                db.update(
                    """
                    UPDATE partner_email_delivery
                    SET state = 'DEAD', last_error = 'RECONCILIATION_REQUIRED'
                    WHERE state IN ('PENDING', 'SENDING')
                      AND (attempts >= 6 OR first_attempt < clock_timestamp() - interval '23 hours')
                      AND (lease_until IS NULL OR lease_until < clock_timestamp())
                    """);

                var jobs =
                    db.queryForList(
                        """
                        SELECT * FROM partner_email_delivery
                        WHERE (state = 'PENDING' AND next_attempt <= clock_timestamp())
                           OR (state = 'SENDING' AND lease_until < clock_timestamp())
                        ORDER BY next_attempt LIMIT 1 FOR UPDATE SKIP LOCKED
                        """);

                if (jobs.isEmpty()) return null;
                var j = jobs.getFirst();
                UUID lease = UUID.randomUUID();
                db.update(
                    """
                    UPDATE partner_email_delivery
                    SET state = 'SENDING', attempts = attempts + 1, lease_token = ?,
                        first_attempt = coalesce(first_attempt, clock_timestamp()),
                        lease_until = clock_timestamp() + interval '2 minutes'
                    WHERE id = ?
                    """,
                    lease,
                    j.get("id"));
                j.put("lease_token", lease);
                return j;
              });

      if (job == null) break;

      try {
        mail.send(job);
        db.update(
            "UPDATE partner_email_delivery SET state = 'SENT', sent_at = clock_timestamp(), lease_until = NULL WHERE id = ? AND lease_token = ?",
            job.get("id"),
            job.get("lease_token"));
        metrics.counter("partner.email.sent").increment();
      } catch (Exception e) {
        if (e instanceof InterruptedException) Thread.currentThread().interrupt();
        db.update(
            """
            UPDATE partner_email_delivery
            SET state = CASE WHEN attempts >= 6 THEN 'DEAD' ELSE 'PENDING' END,
                next_attempt = clock_timestamp() + least(3600, power(2, attempts) * 30) * interval '1 second',
                lease_until = NULL, last_error = 'DELIVERY_FAILED'
            WHERE id = ? AND lease_token = ?
            """,
            job.get("id"),
            job.get("lease_token"));
        metrics.counter("partner.email.failures").increment();
        log.warn(
            "partner_email_failed deliveryId={} attempt={}",
            job.get("id"),
            ((Number) job.get("attempts")).intValue() + 1);
      }
    }
  }
}
