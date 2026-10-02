package fu.tripsense.tripservice.security;

import fu.tripsense.tripservice.exception.UnauthenticatedException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AiCommitSignatureVerifier {
  private static final long MAX_AGE_SECONDS = 300;
  private final byte[] secret;
  private final Clock clock;

  public AiCommitSignatureVerifier(@Value("${ai.commit-secret:}") String secret, Clock clock) {
    this.secret = secret.getBytes(StandardCharsets.UTF_8);
    this.clock = clock;
  }

  public void verify(
      String userId,
      String idempotencyKey,
      String timestamp,
      String bodyHash,
      String signature,
      String rawBody) {
    if (secret.length < 32
        || isBlank(idempotencyKey)
        || isBlank(timestamp)
        || isBlank(bodyHash)
        || isBlank(signature)) {
      throw new UnauthenticatedException();
    }
    try {
      long epochSeconds = Long.parseLong(timestamp);
      long age = Math.abs(Instant.now(clock).getEpochSecond() - epochSeconds);
      if (age > MAX_AGE_SECONDS) throw new UnauthenticatedException();

      String actualBodyHash = sha256(rawBody);
      if (!constantTimeEquals(actualBodyHash, bodyHash)) throw new UnauthenticatedException();

      String payload = timestamp + "\n" + userId + "\n" + idempotencyKey + "\n" + bodyHash;
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret, "HmacSHA256"));
      String expected =
          HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
      if (!constantTimeEquals(expected, signature)) throw new UnauthenticatedException();
    } catch (UnauthenticatedException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new UnauthenticatedException();
    }
  }

  private static String sha256(String value) throws Exception {
    return HexFormat.of()
        .formatHex(
            MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
  }

  private static boolean constantTimeEquals(String left, String right) {
    return MessageDigest.isEqual(
        left.toLowerCase().getBytes(StandardCharsets.US_ASCII),
        right.toLowerCase().getBytes(StandardCharsets.US_ASCII));
  }

  private static boolean isBlank(String value) {
    return value == null || value.isBlank();
  }
}
