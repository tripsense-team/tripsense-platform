package fu.tripsense.tripservice.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.partner.entity.NotificationRealtimeOutbox;
import fu.tripsense.tripservice.partner.entity.PartnerNotification;
import fu.tripsense.tripservice.partner.repository.NotificationRealtimeOutboxRepository;
import fu.tripsense.tripservice.partner.repository.PartnerNotificationRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;

@ExtendWith(MockitoExtension.class)
class PartnerNotificationOutboxServiceTest {

  @Mock private PartnerNotificationRepository notificationRepository;
  @Mock private NotificationRealtimeOutboxRepository outboxRepository;
  @Mock private StringRedisTemplate redisTemplate;

  private final ObjectMapper objectMapper = new ObjectMapper();
  private PartnerNotificationOutboxService outboxService;

  @BeforeEach
  void setUp() {
    outboxService = new PartnerNotificationOutboxService(
        notificationRepository, outboxRepository, redisTemplate, objectMapper);
  }

  @Test
  @DisplayName("saveNotificationWithOutbox: atomically persists notification and outbox row")
  void testSaveNotificationWithOutbox() {
    UUID notifId = UUID.randomUUID();
    UUID recipientId = UUID.randomUUID();

    PartnerNotification notification = PartnerNotification.builder()
        .id(notifId)
        .eventId(UUID.randomUUID())
        .recipientId(recipientId)
        .eventType("RESTAURANT_RESERVATION_REQUESTED")
        .message("New reservation")
        .createdAt(Instant.now())
        .build();

    when(notificationRepository.save(any(PartnerNotification.class))).thenAnswer(inv -> inv.getArgument(0));
    when(outboxRepository.save(any(NotificationRealtimeOutbox.class))).thenAnswer(inv -> inv.getArgument(0));

    PartnerNotification result = outboxService.saveNotificationWithOutbox(notification);

    assertThat(result).isNotNull();
    verify(notificationRepository).save(notification);
    verify(outboxRepository).save(argThat(outbox ->
        outbox.getNotificationId().equals(notifId) &&
        outbox.getRecipientId().equals(recipientId) &&
        outbox.getEventType().equals("RESTAURANT_RESERVATION_REQUESTED")
    ));
  }

  @Test
  @DisplayName("publishEvent: converts payload and sends to Redis channel")
  void testPublishEvent() {
    UUID outboxId = UUID.randomUUID();
    UUID recipientId = UUID.randomUUID();

    NotificationRealtimeOutbox row = NotificationRealtimeOutbox.builder()
        .id(outboxId)
        .recipientId(recipientId)
        .eventType("RESTAURANT_RESERVATION_CONFIRMED")
        .build();

    when(outboxRepository.findById(outboxId)).thenReturn(Optional.of(row));

    outboxService.publishEvent(outboxId, recipientId, "RESTAURANT_RESERVATION_CONFIRMED");

    verify(redisTemplate).convertAndSend(
        eq(PartnerNotificationRealtime.CHANNEL),
        contains(recipientId.toString()));
    verify(outboxRepository).save(argThat(r -> r.getPublishedAt() != null));
  }

  @Test
  @DisplayName("sweepPendingOutbox: sweeps and publishes pending outbox rows")
  void testSweepPendingOutbox() {
    UUID outboxId = UUID.randomUUID();
    UUID recipientId = UUID.randomUUID();

    NotificationRealtimeOutbox pending = NotificationRealtimeOutbox.builder()
        .id(outboxId)
        .recipientId(recipientId)
        .eventType("RESTAURANT_RESERVATION_PLACED")
        .attempts(0)
        .build();

    when(outboxRepository.findPendingForPublish(any(Instant.class), any(Pageable.class)))
        .thenReturn(List.of(pending));

    outboxService.sweepPendingOutbox();

    verify(redisTemplate).convertAndSend(
        eq(PartnerNotificationRealtime.CHANNEL),
        contains(recipientId.toString()));
    verify(outboxRepository).save(argThat(r -> r.getPublishedAt() != null));
  }
}
