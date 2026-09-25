package fu.tripsense.socialservice.chat;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.*;
import jakarta.annotation.PostConstruct;
import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatPushNotificationService {

  private final JdbcTemplate db;

  @Value("${firebase.credentials-path:}")
  private String credentialsPath;

  @Value("${firebase.credentials-json:}")
  private String credentialsJson;

  private boolean initialized = false;

  @PostConstruct
  public void init() {
    try {
      if (!FirebaseApp.getApps().isEmpty()) {
        initialized = true;
        log.info("[FCM] FirebaseApp already initialized");
        return;
      }

      InputStream serviceAccount = null;
      if (credentialsJson != null && !credentialsJson.isBlank()) {
        serviceAccount = new ByteArrayInputStream(credentialsJson.getBytes(StandardCharsets.UTF_8));
      } else if (credentialsPath != null && !credentialsPath.isBlank()) {
        java.io.File file = new java.io.File(credentialsPath);
        if (!file.exists()) {
          java.io.File candidate = new java.io.File("../../", credentialsPath);
          if (candidate.exists()) file = candidate;
        }
        if (!file.exists()) {
          java.io.File candidate = new java.io.File("../", credentialsPath);
          if (candidate.exists()) file = candidate;
        }
        if (file.exists()) {
          serviceAccount = new FileInputStream(file);
          log.info("[FCM] Loaded Firebase service account credentials from: {}", file.getAbsolutePath());
        } else {
          serviceAccount = getClass().getClassLoader().getResourceAsStream(credentialsPath);
        }
      }

      if (serviceAccount != null) {
        FirebaseOptions options = FirebaseOptions.builder()
            .setCredentials(GoogleCredentials.fromStream(serviceAccount))
            .setHttpTransport(new com.google.api.client.http.javanet.NetHttpTransport())
            .build();
        FirebaseApp.initializeApp(options);
        initialized = true;
        log.info("[FCM] FirebaseApp initialized successfully for Web Push Notifications with NetHttpTransport");
      } else {
        log.info("[FCM] No Firebase credentials configured (firebase.credentials-json / firebase.credentials-path). Running in local fallback mode.");
      }
    } catch (Exception e) {
      log.warn("[FCM] Failed to initialize FirebaseApp. Running in local fallback mode: {}", e.getMessage());
      initialized = false;
    }
  }

  public void sendNewMessageNotification(UUID recipientId, String senderName, String messageText, UUID conversationId) {
    if (recipientId == null) return;

    List<String> tokens = db.queryForList(
        "SELECT fcm_token FROM chat_fcm_tokens WHERE user_id = ?",
        String.class,
        recipientId
    );

    if (tokens.isEmpty()) {
      return;
    }

    String title = senderName != null && !senderName.isBlank() ? senderName : "TripSense";
    String body = messageText != null && !messageText.isBlank()
        ? (messageText.length() > 100 ? messageText.substring(0, 97) + "..." : messageText)
        : "Đã gửi một tin nhắn mới";
    String clickActionUrl = "/chat?t=" + conversationId;

    if (!initialized) {
      log.info("[FCM Mock] Push notification dispatched to recipient {} ({} tokens): {} - {}",
          recipientId, tokens.size(), title, body);
      return;
    }

    try {
      MulticastMessage message = MulticastMessage.builder()
          .addAllTokens(tokens)
          .setNotification(Notification.builder()
              .setTitle(title)
              .setBody(body)
              .build())
          .putData("type", "CHAT_MESSAGE")
          .putData("conversationId", conversationId.toString())
          .putData("clickActionUrl", clickActionUrl)
          .setWebpushConfig(WebpushConfig.builder()
              .setFcmOptions(WebpushFcmOptions.builder()
                  .setLink(clickActionUrl)
                  .build())
              .putHeader("Urgency", "high")
              .build())
          .build();

      BatchResponse response = FirebaseMessaging.getInstance().sendEachForMulticast(message);
      log.info("[FCM] Push sent: {} successes, {} failures for recipient {}",
          response.getSuccessCount(), response.getFailureCount(), recipientId);

      // Clean up invalid or expired tokens
      if (response.getFailureCount() > 0) {
        List<SendResponse> responses = response.getResponses();
        for (int i = 0; i < responses.size(); i++) {
          if (!responses.get(i).isSuccessful()) {
            FirebaseMessagingException exception = responses.get(i).getException();
            if (exception != null && (
                exception.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED ||
                exception.getMessagingErrorCode() == MessagingErrorCode.INVALID_ARGUMENT ||
                (exception.getMessage() != null && (exception.getMessage().contains("NotRegistered") || exception.getMessage().contains("404"))))) {
              String deadToken = tokens.get(i);
              db.update("DELETE FROM chat_fcm_tokens WHERE fcm_token = ?", deadToken);
              log.info("[FCM] Cleaned up dead token: {}", deadToken.substring(0, Math.min(10, deadToken.length())) + "...");
            }
          }
        }
      }
    } catch (Exception e) {
      log.warn("[FCM] Failed to send push notification to recipient {}: {}", recipientId, e.getMessage());
    }
  }

  public boolean sendTestPushNotification(UUID userId) {
    if (userId == null) return false;

    List<String> tokens = db.queryForList(
        "SELECT fcm_token FROM chat_fcm_tokens WHERE user_id = ?",
        String.class,
        userId
    );

    if (tokens.isEmpty()) {
      log.info("[FCM] No tokens found for user {}", userId);
      return false;
    }

    String title = "TripSense";
    String body = "🔔 Thông báo đẩy thử nghiệm hoạt động tốt!";
    String clickActionUrl = "/chat";

    if (!initialized) {
      log.info("[FCM Mock] Test push dispatched to user {} ({} tokens)", userId, tokens.size());
      return true;
    }

    try {
      MulticastMessage message = MulticastMessage.builder()
          .addAllTokens(tokens)
          .setNotification(Notification.builder()
              .setTitle(title)
              .setBody(body)
              .build())
          .putData("type", "CHAT_TEST")
          .putData("clickActionUrl", clickActionUrl)
          .setWebpushConfig(WebpushConfig.builder()
              .setFcmOptions(WebpushFcmOptions.builder()
                  .setLink(clickActionUrl)
                  .build())
              .putHeader("Urgency", "high")
              .build())
          .build();

      BatchResponse response = FirebaseMessaging.getInstance().sendEachForMulticast(message);
      log.info("[FCM] Test push sent: {} successes, {} failures for user {}",
          response.getSuccessCount(), response.getFailureCount(), userId);
      return response.getSuccessCount() > 0;
    } catch (Exception e) {
      log.warn("[FCM] Failed to send test push to user {}: {}", userId, e.getMessage());
      return false;
    }
  }
}
