package fu.tripsense.socialservice.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import fu.tripsense.socialservice.exception.SocialException;

@Component
@Slf4j
public class ChatRealtime implements MessageListener {
  private static final String CHANNEL = "tripsense:chat:events";
  private final Map<UUID, Set<SseEmitter>> sessions = new ConcurrentHashMap<>();
  private final StringRedisTemplate redis;
  private final ObjectMapper json;

  public ChatRealtime(StringRedisTemplate redis, ObjectMapper json) {
    this.redis=redis; this.json=json;
  }

  public SseEmitter connect(UUID user) {
    Set<SseEmitter> group=sessions.computeIfAbsent(user,id->ConcurrentHashMap.newKeySet());
    // Auto-evict stale emitters if user has open sessions (e.g. rapid page reloads)
    while (group.size() >= 10) {
      SseEmitter oldest = group.iterator().next();
      group.remove(oldest);
      try { oldest.complete(); } catch (Exception ignored) {}
    }
    SseEmitter emitter=new SseEmitter(Duration.ofMinutes(5).toMillis());
    group.add(emitter);
    Runnable cleanup=()->{ group.remove(emitter); if (group.isEmpty()) sessions.remove(user,group); };
    emitter.onCompletion(cleanup);
    emitter.onTimeout(cleanup);
    emitter.onError(error->cleanup.run());
    try { emitter.send(SseEmitter.event().name("chat.connected").data("{}")); }
    catch (IOException e) { cleanup.run(); emitter.completeWithError(e); }
    presence(user);
    return emitter;
  }

  public boolean online(UUID user) {
    try { return Boolean.TRUE.equals(redis.hasKey("chat:presence:"+user)); }
    catch (Exception e) { return false; }
  }
  private void presence(UUID user) {
    try { redis.opsForValue().set("chat:presence:"+user,"1",Duration.ofSeconds(50)); }
    catch (Exception e) { log.warn("Chat presence temporarily unavailable"); }
  }

  public void afterCommit(UUID recipient, UUID conversationId, String eventType, long version) {
    Runnable action=()->{
      try {
        String payload=json.writeValueAsString(Map.of("userId",recipient.toString(),
            "conversationId",conversationId.toString(),"eventType",eventType,"version",Long.toString(version)));
        redis.convertAndSend(CHANNEL,payload);
      } catch (Exception e) {
        log.warn("Chat invalidation unavailable; REST reconciliation remains authoritative");
      }
    };
    if (TransactionSynchronizationManager.isSynchronizationActive()) {
      TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
        @Override public void afterCommit() { action.run(); }
      });
    } else action.run();
  }

  @Override
  public void onMessage(Message message, byte[] pattern) {
    try {
      var node=json.readTree(message.getBody());
      UUID user=UUID.fromString(node.path("userId").asText());
      Set<SseEmitter> group=sessions.get(user);
      if (group==null) return;
      String data=json.writeValueAsString(Map.of("conversationId",node.path("conversationId").asText(),
          "eventType",node.path("eventType").asText(),"version",node.path("version").asText()));
      group.forEach(emitter -> {
        try { emitter.send(SseEmitter.event().name("chat.changed").data(data)); }
        catch (IOException e) { emitter.complete(); group.remove(emitter); }
      });
    } catch (Exception e) { log.warn("Dropped malformed chat invalidation"); }
  }

  @Scheduled(fixedDelay=25000)
  public void heartbeat() {
    sessions.forEach((user,group)->{
      presence(user);
      group.forEach(emitter->{
        try { emitter.send(SseEmitter.event().name("chat.heartbeat").data("{}")); }
        catch (IOException e) { emitter.complete(); group.remove(emitter); }
      });
    });
  }

  @Configuration
  @EnableScheduling
  static class Config {
    @Bean
    RedisMessageListenerContainer chatRedisListener(RedisConnectionFactory connection, ChatRealtime realtime) {
      RedisMessageListenerContainer container=new RedisMessageListenerContainer();
      container.setConnectionFactory(connection);
      container.addMessageListener(realtime,new ChannelTopic(CHANNEL));
      return container;
    }
  }
}
