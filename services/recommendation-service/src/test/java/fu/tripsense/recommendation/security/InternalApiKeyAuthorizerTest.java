package fu.tripsense.recommendation.security;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class InternalApiKeyAuthorizerTest {
  @Test
  void acceptsOnlyConfiguredKey() {
    InternalApiKeyAuthorizer authorizer = new InternalApiKeyAuthorizer("service-secret");

    assertThatCode(() -> authorizer.requireAuthorized("service-secret")).doesNotThrowAnyException();
    assertThatThrownBy(() -> authorizer.requireAuthorized("wrong"))
        .isInstanceOf(InternalAuthenticationException.class);
  }

  @Test
  void failsClosedWhenNoKeyIsConfigured() {
    InternalApiKeyAuthorizer authorizer = new InternalApiKeyAuthorizer("");

    assertThatThrownBy(() -> authorizer.requireAuthorized(""))
        .isInstanceOf(InternalAuthenticationException.class);
  }
}
