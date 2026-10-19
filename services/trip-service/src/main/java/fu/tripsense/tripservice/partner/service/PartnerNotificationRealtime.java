package fu.tripsense.tripservice.partner.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
@Slf4j
public class PartnerNotificationRealtime implements MessageListener {

  public static final String CHANNEL = "tripsense:partner-notifications:events";
  private static final int MAX_SESSIONS_PER_USER = 5;
  private static final long SSE_TIMEOUT_MS = Duration.ofMinutes(5).toMillis();

  private final Map<UUID, Set<SseEmitter>> sessions = new ConcurrentHashMap<>();
  private final ObjectMapper objectMapper;

  public PartnerNotificationRealtime(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public SseEmitter connect(UUID recipientId) {
    SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
    Set<SseEmitter> userSessions = sessions.computeIfAbsent(recipientId, k -> ConcurrentHashMap.newKeySet());

    if (userSessions.size() >= MAX_SESSIONS_PER_USER) {
      userSessions.stream().findFirst().ifPresent(old -> {
        try {
          old.complete();
        } catch (Exception ignored) {}
        userSessions.remove(old);
      });
    }

    userSessions.add(emitter);

    Runnable cleanup = () -> {
      userSessions.remove(emitter);
      if (userSessions.isEmpty()) {
        sessions.remove(recipientId, userSessions);
      }
    };

    emitter.onCompletion(cleanup);
    emitter.onTimeout(cleanup);
    emitter.onError(ignored -> cleanup.run());

    try {
      emitter.send(SseEmitter.event().comment("connected"));
    } catch (IOException e) {
      cleanup.run();
    }

    return emitter;
  }

  @Override
  public void onMessage(Message message, byte[] pattern) {
    try {
      String json = new String(message.getBody(), java.nio.charset.StandardCharsets.UTF_8);
      Map<?, ?> map = objectMapper.readValue(json, Map.class);
      Object recipientObj = map.get("recipientId");
      if (recipientObj == null) return;

      UUID recipientId = UUID.fromString(recipientObj.toString());
      Set<SseEmitter> userSessions = sessions.get(recipientId);
      if (userSessions == null || userSessions.isEmpty()) return;

      // Minimal safe payload: zero sensitive personal info
      Map<String, String> payload = Map.of(
          "category", "PARTNER",
          "reason", "RESTAURANT_RESERVATION_UPDATED"
      );

      for (SseEmitter emitter : userSessions) {
        try {
          emitter.send(
              SseEmitter.event()
                  .name("notification.changed")
                  .data(payload)
          );
        } catch (Exception e) {
          userSessions.remove(emitter);
          try {
            emitter.complete();
          } catch (Exception ignored) {}
        }
      }
    } catch (Exception e) {
      log.warn("Dropped malformed partner notification event: {}", e.getMessage());
    }
  }

  @Scheduled(fixedDelay = 25000)
  public void heartbeat() {
    sessions.forEach((userId, set) -> {
      Iterator<SseEmitter> it = set.iterator();
      while (it.hasNext()) {
        SseEmitter emitter = it.next();
        try {
          emitter.send(SseEmitter.event().comment("heartbeat"));
        } catch (Exception e) {
          it.remove();
          try {
            emitter.complete();
          } catch (Exception ignored) {}
        }
      }
    });
  }

  @Configuration
  @EnableScheduling
  static class RealtimeConfig {
    @Bean
    RedisMessageListenerContainer partnerNotificationRedisListener(
        RedisConnectionFactory connectionFactory, PartnerNotificationRealtime realtime) {
      RedisMessageListenerContainer container = new RedisMessageListenerContainer();
      container.setConnectionFactory(connectionFactory);
      container.addMessageListener(realtime, new ChannelTopic(CHANNEL));
      return container;
    }
  }
}
