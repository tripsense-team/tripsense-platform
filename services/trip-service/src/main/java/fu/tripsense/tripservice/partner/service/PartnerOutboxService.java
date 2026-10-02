package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.partner.entity.PartnerOutbox;
import fu.tripsense.tripservice.partner.repository.PartnerOutboxRepository;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PartnerOutboxService {

  private final PartnerOutboxRepository outboxRepository;

  @Transactional(propagation = Propagation.MANDATORY)
  public void publish(
      String aggregateType, UUID aggregateId, String eventType, Map<String, Object> payload) {
    PartnerOutbox event =
        PartnerOutbox.builder()
            .eventId(UUID.randomUUID())
            .aggregateType(aggregateType)
            .aggregateId(aggregateId)
            .eventType(eventType)
            .payload(payload != null ? payload : Map.of())
            .attempts(0)
            .nextAttempt(Instant.now())
            .deadLetter(false)
            .build();

    outboxRepository.save(event);
    log.debug("Published partner outbox event: {} for {} {}", eventType, aggregateType, aggregateId);
  }
}
