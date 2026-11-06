package fu.tripsense.socialservice.service;

import fu.tripsense.socialservice.exception.SocialException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class SavedPostCursorCodec {
  private final byte[] secret;

  public SavedPostCursorCodec(@Value("${community.saved-cursor-secret}") String secret) {
    if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
      throw new IllegalArgumentException("Saved-post cursor secret must contain at least 32 bytes");
    }
    this.secret = secret.getBytes(StandardCharsets.UTF_8);
  }

  public String encode(Instant createdAt, UUID postId) {
    String payload = "v1|" + createdAt.toEpochMilli() + "|" + postId;
    String signed = payload + "|" + sign(payload);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(signed.getBytes(StandardCharsets.UTF_8));
  }

  public Cursor decode(String cursor) {
    if (cursor == null || cursor.isBlank()) return new Cursor(null, null);
    if (cursor.length() > 512) throw invalid();
    try {
      String decoded = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
      String[] parts = decoded.split("\\|", -1);
      if (parts.length != 4 || !"v1".equals(parts[0])) throw invalid();
      String payload = String.join("|", parts[0], parts[1], parts[2]);
      if (!MessageDigest.isEqual(
          sign(payload).getBytes(StandardCharsets.UTF_8),
          parts[3].getBytes(StandardCharsets.UTF_8))) throw invalid();
      return new Cursor(Instant.ofEpochMilli(Long.parseLong(parts[1])), UUID.fromString(parts[2]));
    } catch (SocialException exception) {
      throw exception;
    } catch (Exception exception) {
      throw invalid();
    }
  }

  private String sign(String payload) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret, "HmacSHA256"));
      return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception exception) {
      throw new IllegalStateException("Saved cursor signing is unavailable", exception);
    }
  }

  private SocialException invalid() {
    return new SocialException(HttpStatus.BAD_REQUEST, "INVALID_CURSOR", "Saved-post cursor is invalid");
  }

  public record Cursor(Instant createdAt, UUID postId) {}
}
