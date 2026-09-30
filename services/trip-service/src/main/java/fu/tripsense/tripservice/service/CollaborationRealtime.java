package fu.tripsense.tripservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.dto.response.CollaborationChangeEventResponse;
import fu.tripsense.tripservice.entity.CollaborationChangeEvent;
import fu.tripsense.tripservice.exception.EventCursorExpiredException;
import fu.tripsense.tripservice.exception.NotFoundException;
import fu.tripsense.tripservice.repository.CollaborationChangeEventRepository;
import fu.tripsense.tripservice.repository.TripMemberRepository;
import fu.tripsense.tripservice.repository.TripRepository;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
@Slf4j
public class CollaborationRealtime implements MessageListener {
  static final String CHANNEL = "tripsense:trip-collaboration:events";
  private static final int MAX_REPLAY = 500;
  private static final int MAX_USER_TRIP_SESSIONS = 3;

  private final Map<UUID, Set<Session>> sessions = new ConcurrentHashMap<>();
  private final CollaborationChangeEventRepository eventRepository;
  private final TripRepository tripRepository;
  private final TripMemberRepository tripMemberRepository;
  private final StringRedisTemplate redis;
  private final ObjectMapper objectMapper;

  public CollaborationRealtime(
      CollaborationChangeEventRepository eventRepository,
      TripRepository tripRepository,
      TripMemberRepository tripMemberRepository,
      StringRedisTemplate redis,
      ObjectMapper objectMapper) {
    this.eventRepository = eventRepository;
    this.tripRepository = tripRepository;
    this.tripMemberRepository = tripMemberRepository;
    this.redis = redis;
    this.objectMapper = objectMapper;
  }

  public SseEmitter connect(UUID tripId, UUID userId, long afterRevision) {
    if (!hasReadAccess(tripId, userId)) {
      throw new NotFoundException("TRIP_NOT_FOUND", "Trip not found");
    }
    long currentRevision =
        tripRepository
            .findById(tripId)
            .map(trip -> trip.getAggregateRevision() == null ? 0L : trip.getAggregateRevision())
            .orElseThrow(() -> new NotFoundException("TRIP_NOT_FOUND", "Trip not found"));
    if (afterRevision < 0 || afterRevision > currentRevision) {
      throw new EventCursorExpiredException();
    }
    var earliestEvent = eventRepository.findFirstByTripIdOrderByRevisionAsc(tripId);
    if (currentRevision > afterRevision
        && (earliestEvent.isEmpty()
            || earliestEvent.orElseThrow().getRevision() > afterRevision + 1)) {
      throw new EventCursorExpiredException();
    }

    SseEmitter emitter = new SseEmitter(Duration.ofMinutes(30).toMillis());
    Session session = new Session(userId, emitter, afterRevision);
    replay(tripId, session);

    Set<Session> group = sessions.computeIfAbsent(tripId, ignored -> ConcurrentHashMap.newKeySet());
    long sameUserCount = group.stream().filter(item -> item.userId().equals(userId)).count();
    if (sameUserCount >= MAX_USER_TRIP_SESSIONS) {
      group.stream()
          .filter(item -> item.userId().equals(userId))
          .findFirst()
          .ifPresent(this::complete);
    }
    group.add(session);
    replay(tripId, session);

    Runnable cleanup = () -> remove(tripId, session);
    emitter.onCompletion(cleanup);
    emitter.onTimeout(cleanup);
    emitter.onError(ignored -> cleanup.run());
    try {
      emitter.send(
          SseEmitter.event()
              .name("trip.connected")
              .data(Map.of("tripId", tripId, "revision", session.lastRevision().get())));
    } catch (IOException exception) {
      complete(session);
    }
    return emitter;
  }

  public void afterCommit(UUID eventId) {
    Runnable publish =
        () -> {
          try {
            redis.convertAndSend(CHANNEL, eventId.toString());
          } catch (Exception exception) {
            eventRepository.findById(eventId).ifPresent(this::broadcast);
            log.warn("Collaboration fan-out unavailable; durable replay remains available");
          }
        };
    if (TransactionSynchronizationManager.isSynchronizationActive()) {
      TransactionSynchronizationManager.registerSynchronization(
          new TransactionSynchronization() {
            @Override
            public void afterCommit() {
              publish.run();
            }
          });
    } else {
      publish.run();
    }
  }

  @Override
  public void onMessage(Message message, byte[] pattern) {
    try {
      UUID eventId =
          UUID.fromString(new String(message.getBody(), java.nio.charset.StandardCharsets.UTF_8));
      eventRepository.findById(eventId).ifPresent(this::broadcast);
    } catch (Exception exception) {
      log.warn("Dropped malformed collaboration event notification");
    }
  }

  private void replay(UUID tripId, Session session) {
    List<CollaborationChangeEvent> events =
        eventRepository.findByTripIdAndRevisionGreaterThanOrderByRevisionAsc(
            tripId, session.lastRevision().get(), PageRequest.of(0, MAX_REPLAY + 1));
    if (events.size() > MAX_REPLAY) {
      throw new EventCursorExpiredException();
    }
    events.forEach(event -> send(session, event));
  }

  private void broadcast(CollaborationChangeEvent event) {
    Set<Session> group = sessions.get(event.getTripId());
    if (group == null) return;
    group.forEach(session -> send(session, event));
  }

  private void send(Session session, CollaborationChangeEvent event) {
    synchronized (session) {
      if (event.getRevision() <= session.lastRevision().get()) return;
      try {
        CollaborationChangeEventResponse response = toResponse(event);
        session
            .emitter()
            .send(
                SseEmitter.event()
                    .id(Long.toString(event.getRevision()))
                    .name("trip-change")
                    .data(objectMapper.writeValueAsString(response)));
        session.lastRevision().set(event.getRevision());
        Object removedUserId = event.getPayload().get("userId");
        if ((event.getEventType().name().equals("MEMBER_REMOVED")
                || event.getEventType().name().equals("MEMBER_LEFT"))
            && session.userId().toString().equals(String.valueOf(removedUserId))) {
          complete(session);
        }
      } catch (IOException exception) {
        complete(session);
      }
    }
  }

  private CollaborationChangeEventResponse toResponse(CollaborationChangeEvent event) {
    return new CollaborationChangeEventResponse(
        event.getEventId(),
        event.getSchemaVersion(),
        event.getTripId(),
        event.getRevision(),
        event.getEventType(),
        event.getActorUserId(),
        event.getOccurredAt(),
        event.getPayload());
  }

  @Scheduled(fixedDelay = 20000)
  public void heartbeat() {
    sessions.forEach(
        (tripId, group) ->
            group.forEach(
                session -> {
                  if (!hasReadAccess(tripId, session.userId())) {
                    complete(session);
                    return;
                  }
                  try {
                    session.emitter().send(SseEmitter.event().comment("heartbeat"));
                  } catch (IOException exception) {
                    complete(session);
                  }
                }));
  }

  private boolean hasReadAccess(UUID tripId, UUID userId) {
    return tripRepository
        .findById(tripId)
        .filter(trip -> trip.getArchivedAt() == null)
        .map(
            trip ->
                trip.getOwnerUserId().equals(userId)
                    || tripMemberRepository.existsByTripIdAndUserId(tripId, userId))
        .orElse(false);
  }

  private void complete(Session session) {
    sessions.forEach((tripId, ignored) -> remove(tripId, session));
    try {
      session.emitter().complete();
    } catch (Exception ignored) {
    }
  }

  private void remove(UUID tripId, Session session) {
    Set<Session> group = sessions.get(tripId);
    if (group == null) return;
    group.remove(session);
    if (group.isEmpty()) sessions.remove(tripId, group);
  }

  private record Session(UUID userId, SseEmitter emitter, AtomicLong lastRevision) {
    private Session(UUID userId, SseEmitter emitter, long lastRevision) {
      this(userId, emitter, new AtomicLong(lastRevision));
    }
  }

  @Configuration
  @EnableScheduling
  static class Config {
    @Bean
    RedisMessageListenerContainer collaborationRedisListener(
        RedisConnectionFactory connectionFactory, CollaborationRealtime realtime) {
      RedisMessageListenerContainer container = new RedisMessageListenerContainer();
      container.setConnectionFactory(connectionFactory);
      container.addMessageListener(realtime, new ChannelTopic(CHANNEL));
      return container;
    }
  }
}
