package fu.tripsense.tripservice.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import fu.tripsense.tripservice.hotel.HotelMailClient;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.*;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

@ExtendWith(MockitoExtension.class)
class PartnerJobsTest {

  @Mock private JdbcTemplate db;
  @Mock private TransactionTemplate tx;
  @Mock private HotelMailClient mail;

  private SimpleMeterRegistry metrics;
  private PartnerJobs partnerJobs;

  @BeforeEach
  void setUp() {
    metrics = new SimpleMeterRegistry();
    partnerJobs = new PartnerJobs(db, tx, mail, metrics);
  }

  @Test
  @DisplayName("dispatch: processes pending outbox events and inserts notifications")
  void dispatch_success() {
    UUID candidateId = UUID.randomUUID();
    when(db.queryForList(anyString(), eq(UUID.class))).thenReturn(List.of(candidateId));

    // tx.executeWithoutResult executes the callback directly
    doAnswer(
            inv -> {
              Consumer<TransactionStatus> action = inv.getArgument(0);
              action.accept(mock(TransactionStatus.class));
              return null;
            })
        .when(tx)
        .executeWithoutResult(any());

    Map<String, Object> eventRow = new HashMap<>();
    eventRow.put("id", candidateId);
    eventRow.put("event_id", UUID.randomUUID());
    eventRow.put("aggregate_type", "PartnerBusiness");
    eventRow.put("aggregate_id", UUID.randomUUID().toString());
    eventRow.put("event_type", "PartnerApplicationApproved");
    eventRow.put("business_id", UUID.randomUUID().toString());
    eventRow.put("owner_id", UUID.randomUUID().toString());
    eventRow.put("recipient_email", "partner@example.com");
    eventRow.put("reason", null);
    eventRow.put("role", null);

    when(db.queryForList(anyString(), eq(candidateId))).thenReturn(List.of(eventRow));

    partnerJobs.dispatch();

    verify(db, atLeastOnce())
        .update(contains("INSERT INTO partner_notification"), any(), any(), any(), any(), any(), any());
    verify(db, atLeastOnce())
        .update(contains("UPDATE partner_outbox SET processed_at"), eq(candidateId));
  }

  @Test
  @DisplayName("dispatch: handles exception and records attempt with backoff")
  void dispatch_failureRecordsAttempt() {
    UUID candidateId = UUID.randomUUID();
    when(db.queryForList(anyString(), eq(UUID.class))).thenReturn(List.of(candidateId));

    doThrow(new RuntimeException("DB Connection down"))
        .when(tx)
        .executeWithoutResult(any());

    partnerJobs.dispatch();

    verify(db).update(contains("UPDATE partner_outbox"), eq(candidateId));
    assertThat(metrics.counter("partner.outbox.failures").count()).isEqualTo(1.0);
  }

  @Test
  @DisplayName("deliver: sends pending emails and marks them sent")
  void deliver_success() throws Exception {
    Map<String, Object> job = new HashMap<>();
    UUID jobId = UUID.randomUUID();
    job.put("id", jobId);
    job.put("recipient_email", "invited@example.com");
    job.put("subject", "TripSense Partner Invitation");
    job.put("message", "Welcome");
    job.put("lease_token", UUID.randomUUID());

    when(tx.execute(any()))
        .thenReturn(job) // first iteration returns a job
        .thenReturn(null); // second iteration returns empty

    partnerJobs.deliver();

    verify(mail).send(job);
    verify(db).update(contains("UPDATE partner_email_delivery SET state = 'SENT'"), eq(jobId), any());
    assertThat(metrics.counter("partner.email.sent").count()).isEqualTo(1.0);
  }
}
