package fu.tripsense.tripservice.partner.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.DefaultMessage;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class PartnerNotificationRealtimeTest {

  private final ObjectMapper objectMapper = new ObjectMapper();
  private PartnerNotificationRealtime realtime;

  @BeforeEach
  void setUp() {
    realtime = new PartnerNotificationRealtime(objectMapper);
  }

  @Test
  @DisplayName("connect: opens SseEmitter for recipient")
  void testConnect() {
    UUID recipientId = UUID.randomUUID();
    SseEmitter emitter = realtime.connect(recipientId);

    assertThat(emitter).isNotNull();
    assertThat(emitter.getTimeout()).isEqualTo(300_000L);
  }

  @Test
  @DisplayName("onMessage: handles Redis message and fans out to connected sessions")
  void testOnMessageFansOut() {
    UUID recipientId = UUID.randomUUID();
    SseEmitter emitter = realtime.connect(recipientId);
    assertThat(emitter).isNotNull();

    String json = "{\"recipientId\":\"" + recipientId + "\",\"eventType\":\"RESTAURANT_RESERVATION_REQUESTED\"}";
    DefaultMessage message = new DefaultMessage(
        PartnerNotificationRealtime.CHANNEL.getBytes(StandardCharsets.UTF_8),
        json.getBytes(StandardCharsets.UTF_8)
    );

    // Delivering message does not throw
    realtime.onMessage(message, null);
  }

  @Test
  @DisplayName("heartbeat: runs without error")
  void testHeartbeat() {
    UUID recipientId = UUID.randomUUID();
    realtime.connect(recipientId);

    realtime.heartbeat();
  }
}
