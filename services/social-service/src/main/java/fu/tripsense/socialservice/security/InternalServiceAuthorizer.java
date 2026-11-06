package fu.tripsense.socialservice.security;

import fu.tripsense.socialservice.exception.SocialException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class InternalServiceAuthorizer {
  private final byte[] expectedKey;

  public InternalServiceAuthorizer(
      @Value("${community.import-internal-key:}") String configuredKey) {
    this.expectedKey = configuredKey == null ? new byte[0] : configuredKey.getBytes(StandardCharsets.UTF_8);
  }

  public void requireAuthorized(String presentedKey) {
    byte[] presented =
        presentedKey == null ? new byte[0] : presentedKey.getBytes(StandardCharsets.UTF_8);
    if (expectedKey.length < 32 || !MessageDigest.isEqual(expectedKey, presented)) {
      throw new SocialException(
          HttpStatus.UNAUTHORIZED,
          "INTERNAL_SERVICE_UNAUTHENTICATED",
          "Internal service authentication failed");
    }
  }
}
