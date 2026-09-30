package fu.tripsense.emailservice.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class InternalApiKeyValidator {
  private final byte[] expectedKey;

  public InternalApiKeyValidator(@Value("${MAIL_INTERNAL_API_KEY}") String expectedKey) {
    this.expectedKey = expectedKey.getBytes(StandardCharsets.UTF_8);
  }

  public void requireValid(String providedKey) {
    byte[] candidate =
        providedKey == null ? new byte[0] : providedKey.getBytes(StandardCharsets.UTF_8);
    if (!MessageDigest.isEqual(expectedKey, candidate)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
    }
  }
}
