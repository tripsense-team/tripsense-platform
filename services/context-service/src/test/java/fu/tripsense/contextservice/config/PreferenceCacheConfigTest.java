package fu.tripsense.contextservice.config;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import fu.tripsense.contextservice.adapter.out.cache.RedisPreferenceSnapshotCache;
import fu.tripsense.contextservice.application.cache.*;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

class PreferenceCacheConfigTest {
  @Test
  void activationAndOrdinaryCommandsHaveIndependentBudgets() {
    var props = new PreferenceCacheProperties();
    var source = PreferenceCacheConfig.commandTimeouts(props).getSource();
    var command = mock(io.lettuce.core.protocol.RedisCommand.class);
    when(command.getType()).thenReturn(io.lettuce.core.protocol.CommandType.HELLO);
    assertThat(source.getTimeout(command)).isEqualTo(800);
    when(command.getType()).thenReturn(io.lettuce.core.protocol.CommandType.EVAL);
    assertThat(source.getTimeout(command)).isEqualTo(100);
    when(command.getType()).thenReturn(io.lettuce.core.protocol.CommandType.SET);
    assertThat(source.getTimeout(command)).isEqualTo(100);
    var factory = new PreferenceCacheConfig().contextCacheConnectionFactory(props);
    assertThat(factory.getClientConfiguration().getCommandTimeout())
        .isEqualTo(java.time.Duration.ofMillis(800));
  }

  @Test
  void defaultDisabledCacheWiresWithoutOpeningRedisAndLoadsOnlyOnRequest() {
    var source = mock(PreferenceSnapshotSource.class);
    UUID user = UUID.randomUUID();
    when(source.load(user, "TRIP_PLANNING"))
        .thenReturn(
            new PreferenceSnapshot(
                PreferenceSnapshot.Revision.absent(), "TRIP_PLANNING", List.of()));
    try (var context = new AnnotationConfigApplicationContext()) {
      context.register(
          PreferenceCacheConfig.class,
          RedisPreferenceSnapshotCache.class,
          CachedPreferencesService.class);
      context.registerBean(PreferenceSnapshotSource.class, () -> source);
      context.registerBean(MeterRegistry.class, SimpleMeterRegistry::new);
      context.refresh();
      verifyNoInteractions(source);
      assertThat(context.getBean(PreferenceSnapshotCache.class).enabled()).isFalse();
      assertThat(context.getBean(CachedPreferencesService.class).preferences(user, "TRIP_PLANNING"))
          .isEmpty();
      verify(source).load(user, "TRIP_PLANNING");
      verify(source, never()).revision(user);
    }
  }

  @Test
  void redisUrlSupportsAclCredentialsAndSeparateDatabaseWithoutConnecting() {
    var props = new PreferenceCacheProperties();
    props.setRedisUrl("rediss://cache-user:test%3Ap%2Bss@localhost:6381/2");
    var factory = new PreferenceCacheConfig().contextCacheConnectionFactory(props);
    assertThat(factory.getStandaloneConfiguration().getUsername()).isEqualTo("cache-user");
    assertThat(factory.getStandaloneConfiguration().getPassword().get())
        .isEqualTo("test:p+ss".toCharArray());
    assertThat(factory.getStandaloneConfiguration().getDatabase()).isEqualTo(2);
    assertThat(factory.getClientConfiguration().isUseSsl()).isTrue();
  }

  @Test
  void invalidLimitsAndDurationsFailFast() {
    var props = new PreferenceCacheProperties();
    props.validate();
    props.setMaxRequests(0);
    assertThatThrownBy(props::validate).isInstanceOf(IllegalArgumentException.class);
    props.setMaxRequests(64);
    props.setTtl(java.time.Duration.ofDays(1));
    assertThatThrownBy(props::validate).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void invalidRedisEndpointNeverEchoesCredentialsInExceptionOrProperties() {
    var props = new PreferenceCacheProperties();
    props.setRedisUrl("https://test-user:private-password@localhost");
    props.setKeySecret("private-hmac-secret");
    assertThatThrownBy(() -> new PreferenceCacheConfig().contextCacheConnectionFactory(props))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("Invalid Context cache Redis endpoint")
        .hasNoCause();
    assertThat(props.toString()).doesNotContain("private-password", "private-hmac-secret");
  }
}
