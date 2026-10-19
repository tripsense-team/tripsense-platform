package fu.tripsense.tripservice.partner.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.partner.entity.NotificationRealtimeOutbox;
import fu.tripsense.tripservice.partner.entity.PartnerNotification;
import fu.tripsense.tripservice.partner.repository.NotificationRealtimeOutboxRepository;
import fu.tripsense.tripservice.partner.repository.PartnerNotificationRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@RequiredArgsConstructor
@Slf4j
public class PartnerNotificationOutboxService {

  private final PartnerNotificationRepository notificationRepository;
  private final NotificationRealtimeOutboxRepository outboxRepository;
  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;

  @Transactional
  public PartnerNotification saveNotificationWithOutbox(PartnerNotification notification) {
    PartnerNotification savedNotification = notificationRepository.save(notification);

    NotificationRealtimeOutbox outbox = NotificationRealtimeOutbox.builder()
        .id(UUID.randomUUID())
        .notificationId(savedNotification.getId())
        .recipientId(savedNotification.getRecipientId())
        .eventType(savedNotification.getEventType())
        .createdAt(savedNotification.getCreatedAt())
        .nextAttemptAt(Instant.now())
        .attempts(0)
        .build();

    NotificationRealtimeOutbox savedOutbox = outboxRepository.save(outbox);

    if (TransactionSynchronizationManager.isSynchronizationActive()) {
      TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
        @Override
        public void afterCommit() {
          publishEvent(savedOutbox.getId(), savedOutbox.getRecipientId(), savedOutbox.getEventType());
        }
      });
    } else {
      publishEvent(savedOutbox.getId(), savedOutbox.getRecipientId(), savedOutbox.getEventType());
    }

    return savedNotification;
  }

  public void publishEvent(UUID outboxId, UUID recipientId, String eventType) {
    try {
      String json = objectMapper.writeValueAsString(Map.of(
          "recipientId", recipientId.toString(),
          "eventType", eventType
      ));
      redisTemplate.convertAndSend(PartnerNotificationRealtime.CHANNEL, json);
      markPublished(outboxId);
    } catch (Exception e) {
      log.warn("Direct Redis fan-out failed for outbox {}: {}. Will retry in background.", outboxId, e.getMessage());
    }
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void markPublished(UUID outboxId) {
    outboxRepository.findById(outboxId).ifPresent(row -> {
      row.setPublishedAt(Instant.now());
      outboxRepository.save(row);
    });
  }

  @Scheduled(fixedDelay = 5000)
  public void sweepPendingOutbox() {
    Instant now = Instant.now();
    List<NotificationRealtimeOutbox> pending = outboxRepository.findPendingForPublish(now, PageRequest.of(0, 50));
    if (pending.isEmpty()) return;

    for (NotificationRealtimeOutbox row : pending) {
      try {
        String json = objectMapper.writeValueAsString(Map.of(
            "recipientId", row.getRecipientId().toString(),
            "eventType", row.getEventType()
        ));
        redisTemplate.convertAndSend(PartnerNotificationRealtime.CHANNEL, json);
        row.setPublishedAt(Instant.now());
      } catch (Exception e) {
        int nextAttempts = row.getAttempts() + 1;
        row.setAttempts(nextAttempts);
        row.setLastErrorCode(e.getClass().getSimpleName());
        long backoffSeconds = (long) Math.min(300, Math.pow(2, nextAttempts));
        row.setNextAttemptAt(now.plusSeconds(backoffSeconds));
        log.warn("Failed background publish for outbox {}: {}", row.getId(), e.getMessage());
      }
      outboxRepository.save(row);
    }
  }
}
