package fu.tripsense.tripservice.service;

import fu.tripsense.tripservice.entity.CollaborationChangeEvent;
import fu.tripsense.tripservice.entity.Trip;
import fu.tripsense.tripservice.enums.CollaborationChangeType;
import fu.tripsense.tripservice.exception.NotFoundException;
import fu.tripsense.tripservice.repository.CollaborationChangeEventRepository;
import fu.tripsense.tripservice.repository.TripRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CollaborationChangeService {
  private final CollaborationChangeEventRepository eventRepository;
  private final TripRepository tripRepository;
  private final CollaborationRealtime realtime;

  @Value("${trip-collaboration.event-retention:24h}")
  private Duration retention;

  @Transactional(propagation = Propagation.MANDATORY)
  public CollaborationChangeEvent record(
      Trip trip, UUID actorUserId, CollaborationChangeType type, Map<String, Object> payload) {
    Trip lockedTrip =
        tripRepository
            .findActiveByIdForUpdate(trip.getId())
            .orElseThrow(() -> new NotFoundException("TRIP_NOT_FOUND", "Trip not found"));
    long revision = Optional.ofNullable(lockedTrip.getAggregateRevision()).orElse(0L) + 1;
    lockedTrip.setAggregateRevision(revision);
    tripRepository.save(lockedTrip);
    Instant now = Instant.now();
    CollaborationChangeEvent event =
        eventRepository.save(
            CollaborationChangeEvent.builder()
                .eventId(UUID.randomUUID())
                .tripId(lockedTrip.getId())
                .revision(revision)
                .eventType(type)
                .actorUserId(actorUserId)
                .schemaVersion((short) 1)
                .payload(Map.copyOf(payload))
                .occurredAt(now)
                .expiresAt(now.plus(retention))
                .build());
    realtime.afterCommit(event.getEventId());
    return event;
  }

  @Scheduled(fixedDelayString = "${trip-collaboration.cleanup-delay-ms:3600000}")
  @Transactional
  public void deleteExpiredEvents() {
    var expired =
        eventRepository.findByExpiresAtBeforeOrderByExpiresAtAsc(
            Instant.now(), org.springframework.data.domain.PageRequest.of(0, 1000));
    if (!expired.isEmpty()) eventRepository.deleteAllInBatch(expired);
  }
}
