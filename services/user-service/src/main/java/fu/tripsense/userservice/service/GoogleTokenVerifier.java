package fu.tripsense.userservice.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import jakarta.annotation.PostConstruct;
import java.util.Collections;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class GoogleTokenVerifier {

  @Value("${oauth.google.client-id:}")
  private String googleClientId;

  @Value("${oauth.google.acceptable-time-skew-seconds:86400}")
  private long acceptableTimeSkewSeconds = 86400L;

  private GoogleIdTokenVerifier verifier;

  @PostConstruct
  public void init() {
    if (googleClientId != null && !googleClientId.isBlank()) {
      GoogleIdTokenVerifier.Builder builder =
          new GoogleIdTokenVerifier.Builder(
              new NetHttpTransport(), GsonFactory.getDefaultInstance());
      builder.setAudience(Collections.singletonList(googleClientId.trim()));
      long skew = Math.max(300L, acceptableTimeSkewSeconds);
      builder.setAcceptableTimeSkewSeconds(skew);
      this.verifier = builder.build();
      log.info(
          "GoogleTokenVerifier initialized with audience client-id configured (acceptableTimeSkewSeconds={})",
          skew);
    } else {
      this.verifier = null;
      log.warn(
          "GoogleTokenVerifier: GOOGLE_CLIENT_ID is not configured. Google OAuth authentication will be rejected.");
    }
  }

  public GoogleIdToken.Payload verify(String idTokenString) {
    if (idTokenString == null || idTokenString.isBlank()) {
      throw new BadCredentialsException("Google ID token is required");
    }

    if (this.verifier == null) {
      log.error(
          "Google OAuth login attempted but GOOGLE_CLIENT_ID is not configured on the server");
      throw new BadCredentialsException("Google authentication is not configured on this server");
    }

    try {
      GoogleIdToken idToken = verifier.verify(idTokenString);
      if (idToken == null) {
        logDiagnosticFailure(idTokenString);
        throw new BadCredentialsException("Invalid or expired Google ID token");
      }
      return idToken.getPayload();
    } catch (BadCredentialsException bce) {
      throw bce;
    } catch (Exception e) {
      log.error("Exception during Google ID token verification: {}", e.getMessage());
      throw new BadCredentialsException("Failed to verify Google ID token: " + e.getMessage(), e);
    }
  }

  private void logDiagnosticFailure(String idTokenString) {
    try {
      GoogleIdToken unverified =
          GoogleIdToken.parse(GsonFactory.getDefaultInstance(), idTokenString);
      if (unverified != null && unverified.getPayload() != null) {
        GoogleIdToken.Payload p = unverified.getPayload();
        log.warn(
            "Google ID token verification failed. token_aud={}, expected_aud={}, token_iss={}, token_iat={}, token_exp={}, server_now_epoch={}",
            p.getAudience(),
            googleClientId,
            p.getIssuer(),
            p.getIssuedAtTimeSeconds(),
            p.getExpirationTimeSeconds(),
            System.currentTimeMillis() / 1000L);
      } else {
        log.warn("Google ID token verification failed: parsed payload is null");
      }
    } catch (Exception parseEx) {
      log.warn(
          "Google ID token verification failed and unverified parse threw: {}",
          parseEx.getMessage());
    }
  }
}
