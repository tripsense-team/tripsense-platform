package fu.tripsense.socialservice.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import java.io.File;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ChatPushNotificationServiceTest {

  @Mock private JdbcTemplate db;

  @Test
  void init_WithValidCredentials_InitializesSuccessfully() {
    ChatPushNotificationService service = new ChatPushNotificationService(db);
    File f = new File("../../firebase-tripsense.json");
    if (f.exists()) {
      ReflectionTestUtils.setField(service, "credentialsPath", "firebase-tripsense.json");
      service.init();
      boolean initialized = (boolean) ReflectionTestUtils.getField(service, "initialized");
      assertThat(initialized).isTrue();
    }
  }

  @Test
  void sendNewMessageNotification_WithNoTokens_ReturnsEarly() {
    ChatPushNotificationService service = new ChatPushNotificationService(db);
    UUID recipientId = UUID.randomUUID();
    when(db.queryForList(anyString(), eq(String.class), eq(recipientId)))
        .thenReturn(Collections.emptyList());

    service.sendNewMessageNotification(recipientId, "Sender", "Hello", UUID.randomUUID());
    verify(db, never()).update(anyString(), any(Object[].class));
  }

  @Test
  void sendTestPushNotification_WithNoTokens_ReturnsFalse() {
    ChatPushNotificationService service = new ChatPushNotificationService(db);
    UUID userId = UUID.randomUUID();
    when(db.queryForList(anyString(), eq(String.class), eq(userId)))
        .thenReturn(Collections.emptyList());

    boolean result = service.sendTestPushNotification(userId);
    assertThat(result).isFalse();
  }
}
