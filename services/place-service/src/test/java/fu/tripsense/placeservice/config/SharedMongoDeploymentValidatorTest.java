package fu.tripsense.placeservice.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationArguments;
import org.springframework.mock.env.MockEnvironment;

class SharedMongoDeploymentValidatorTest {
  @Test
  void rejectsLocalMongoInProduction() {
    MockEnvironment environment = new MockEnvironment().withProperty("MONGODB_URI", "mongodb://localhost:27017/places");
    environment.setActiveProfiles("production");
    assertThatThrownBy(() -> new SharedMongoDeploymentValidator(environment).run(mock(ApplicationArguments.class)))
        .isInstanceOf(IllegalStateException.class).hasMessageContaining("shared infrastructure");
  }

  @Test
  void acceptsConfiguredReplicaSetInProduction() {
    MockEnvironment environment = new MockEnvironment().withProperty("MONGODB_URI",
        "mongodb://user:secret@mongo-a.internal:27017,mongo-b.internal:27017/places");
    environment.setActiveProfiles("production");
    assertThatCode(() -> new SharedMongoDeploymentValidator(environment).run(mock(ApplicationArguments.class)))
        .doesNotThrowAnyException();
  }

  @Test
  void allowsLocalMongoOutsideSharedProfiles() {
    MockEnvironment environment = new MockEnvironment().withProperty("MONGODB_URI", "mongodb://localhost:27017/places");
    environment.setActiveProfiles("test");
    assertThatCode(() -> new SharedMongoDeploymentValidator(environment).run(mock(ApplicationArguments.class)))
        .doesNotThrowAnyException();
  }
}
