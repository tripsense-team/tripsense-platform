package fu.tripsense.recommendation.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class InternalApiKeyAuthorizer {
  private final byte[] expected;

  public InternalApiKeyAuthorizer(
      @Value("${tripsense.recommendation.security.internal-api-key:}") String apiKey) {
    this.expected = apiKey == null ? new byte[0] : apiKey.getBytes(StandardCharsets.UTF_8);
  }

  public void requireAuthorized(String supplied) {
    byte[] actual = supplied == null ? new byte[0] : supplied.getBytes(StandardCharsets.UTF_8);
    if (expected.length == 0 || !MessageDigest.isEqual(expected, actual)) {
      throw new InternalAuthenticationException();
    }
  }
}
