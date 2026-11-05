package fu.tripsense.socialservice.security;

import static org.assertj.core.api.Assertions.*;

import fu.tripsense.socialservice.exception.SocialException;
import org.junit.jupiter.api.Test;

class InternalServiceAuthorizerTest {
  private static final String KEY = "test-key-that-is-at-least-thirty-two-bytes";

  @Test
  void acceptsExactConfiguredKey() {
    assertThatCode(() -> new InternalServiceAuthorizer(KEY).requireAuthorized(KEY))
        .doesNotThrowAnyException();
  }

  @Test
  void rejectsMissingOrWrongKey() {
    InternalServiceAuthorizer authorizer = new InternalServiceAuthorizer(KEY);
    assertThatThrownBy(() -> authorizer.requireAuthorized(null))
        .isInstanceOf(SocialException.class);
    assertThatThrownBy(() -> authorizer.requireAuthorized("wrong"))
        .isInstanceOf(SocialException.class);
  }
}
