package fu.tripsense.userservice.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.util.ReflectionTestUtils;

class GoogleTokenVerifierTest {

  @Test
  @DisplayName("Should reject verification when GOOGLE_CLIENT_ID is not configured")
  void shouldRejectWhenClientIdNotConfigured() {
    GoogleTokenVerifier verifier = new GoogleTokenVerifier();
    ReflectionTestUtils.setField(verifier, "googleClientId", "");
    verifier.init();

    assertThatThrownBy(() -> verifier.verify("some-sample-id-token"))
        .isInstanceOf(BadCredentialsException.class)
        .hasMessageContaining("Google authentication is not configured on this server");
  }

  @Test
  @DisplayName("Should reject verification when idToken is null or blank")
  void shouldRejectWhenIdTokenIsBlank() {
    GoogleTokenVerifier verifier = new GoogleTokenVerifier();
    ReflectionTestUtils.setField(verifier, "googleClientId", "sample-client-id.apps.googleusercontent.com");
    verifier.init();

    assertThatThrownBy(() -> verifier.verify(""))
        .isInstanceOf(BadCredentialsException.class)
        .hasMessageContaining("Google ID token is required");

    assertThatThrownBy(() -> verifier.verify(null))
        .isInstanceOf(BadCredentialsException.class)
        .hasMessageContaining("Google ID token is required");
  }

  @Test
  @DisplayName("Should initialize verifier successfully when GOOGLE_CLIENT_ID is set")
  void shouldInitializeVerifierWhenClientIdIsConfigured() {
    GoogleTokenVerifier verifier = new GoogleTokenVerifier();
    ReflectionTestUtils.setField(verifier, "googleClientId", "valid-client-id.apps.googleusercontent.com");

    assertDoesNotThrow(verifier::init);
  }
}
