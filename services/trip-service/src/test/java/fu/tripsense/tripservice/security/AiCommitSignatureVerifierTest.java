package fu.tripsense.tripservice.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import fu.tripsense.tripservice.exception.UnauthenticatedException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

class AiCommitSignatureVerifierTest {
  private static final String SECRET = "0123456789abcdef0123456789abcdef";
  private static final Instant NOW = Instant.parse("2026-09-30T09:00:00Z");
  private final AiCommitSignatureVerifier verifier =
      new AiCommitSignatureVerifier(SECRET, Clock.fixed(NOW, ZoneOffset.UTC));

  @Test
  void acceptsValidSignedBody() throws Exception {
    String body = "{\"proposalId\":\"abc\"}";
    String hash = sha256(body);
    String timestamp = String.valueOf(NOW.getEpochSecond());
    String signature = signature(timestamp, "user-1", "key-1", hash);

    assertDoesNotThrow(() -> verifier.verify("user-1", "key-1", timestamp, hash, signature, body));
  }

  @Test
  void rejectsExpiredSignature() throws Exception {
    String body = "{}";
    String hash = sha256(body);
    String timestamp = String.valueOf(NOW.minusSeconds(301).getEpochSecond());

    assertThrows(
        UnauthenticatedException.class,
        () ->
            verifier.verify(
                "user-1",
                "key-1",
                timestamp,
                hash,
                signature(timestamp, "user-1", "key-1", hash),
                body));
  }

  @Test
  void rejectsTamperedBody() throws Exception {
    String hash = sha256("{}");
    String timestamp = String.valueOf(NOW.getEpochSecond());

    assertThrows(
        UnauthenticatedException.class,
        () ->
            verifier.verify(
                "user-1",
                "key-1",
                timestamp,
                hash,
                signature(timestamp, "user-1", "key-1", hash),
                "{\"changed\":true}"));
  }

  private static String sha256(String value) throws Exception {
    return HexFormat.of()
        .formatHex(
            MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
  }

  private static String signature(
      String timestamp, String userId, String idempotencyKey, String bodyHash) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    String payload = timestamp + "\n" + userId + "\n" + idempotencyKey + "\n" + bodyHash;
    return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
  }
}
