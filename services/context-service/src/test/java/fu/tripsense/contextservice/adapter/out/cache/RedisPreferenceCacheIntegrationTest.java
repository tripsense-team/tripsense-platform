package fu.tripsense.contextservice.adapter.out.cache;

import static org.assertj.core.api.Assertions.*;

import fu.tripsense.contextservice.application.PreferenceSignalReader.PreferenceSignal;
import fu.tripsense.contextservice.application.cache.PreferenceSnapshot;
import fu.tripsense.contextservice.config.PreferenceCacheConfig;
import fu.tripsense.contextservice.config.PreferenceCacheProperties;
import fu.tripsense.contextservice.support.LocalCacheTestServer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.redis.core.StringRedisTemplate;

@EnabledIfSystemProperty(named = "context.cache.integration", matches = "true")
class RedisPreferenceCacheIntegrationTest {
  @Test
  void realRedisRoundTripExpiryOversizeOomEvictionAndRestartAreSafe() throws Exception {
    try (var server = LocalCacheTestServer.redis()) {
      var props = new PreferenceCacheProperties();
      props.setRedisUrl("redis://127.0.0.1:" + server.port);
      var factory = new PreferenceCacheConfig().contextCacheConnectionFactory(props);
      factory.afterPropertiesSet();
      factory.start();
      try {
        var redis = new StringRedisTemplate(factory);
        props.setEnabled(true);
        props.setKeySecret("integration-test-only-context-key-32-chars");
        props.setTtl(Duration.ofSeconds(1));
        props.setFailureThreshold(1);
        props.setFailureBackoff(Duration.ofMillis(100));
        var cache = new RedisPreferenceSnapshotCache(redis, props, new SimpleMeterRegistry());
        UUID user = UUID.randomUUID();
        var snapshot =
            new PreferenceSnapshot(
                new PreferenceSnapshot.Revision(UUID.randomUUID(), 1, "COMPLETED", 1, "catalog"),
                "TRIP_PLANNING",
                List.of(
                    new PreferenceSignal("FOOD_STYLE", "CAFE", 1, "ONBOARDING", Instant.EPOCH)));
        cache.put(user, snapshot);
        assertThat(cache.get(user, snapshot.revision(), snapshot.purpose())).contains(snapshot);
        String key = cache.key(user, snapshot.revision(), snapshot.purpose());
        assertThat(redis.getExpire(key, TimeUnit.MILLISECONDS)).isBetween(1L, 1200L);
        long deadline = System.nanoTime() + Duration.ofSeconds(3).toNanos();
        while (Boolean.TRUE.equals(redis.hasKey(key)) && System.nanoTime() < deadline)
          Thread.sleep(10);
        assertThat(cache.get(user, snapshot.revision(), snapshot.purpose())).isEmpty();
        redis.opsForValue().set(key, "x".repeat(65_537));
        assertThat(cache.get(user, snapshot.revision(), snapshot.purpose())).isEmpty();
        assertThat(redis.hasKey(key)).isFalse();
        redis.opsForHash().put(key, "wrong-type", "test-only");
        assertThat(cache.get(user, snapshot.revision(), snapshot.purpose())).isEmpty();
        assertThat(redis.hasKey(key)).isFalse();
        try (var connection = factory.getConnection()) {
          var settings = connection.serverCommands().getConfig("maxmemory-policy");
          assertThat(settings.getProperty("maxmemory-policy")).isEqualTo("allkeys-lfu");
        }
        // Exceed the disposable instance's 8 MiB budget with ordinary cache-sized values.
        for (int i = 0; i < 1200; i++)
          redis.opsForValue().set("test-fill:" + i, "x".repeat(16_384), Duration.ofSeconds(5));
        try (var connection = factory.getConnection()) {
          var stats = connection.serverCommands().info("stats");
          assertThat(Long.parseLong(stats.getProperty("evicted_keys"))).isGreaterThan(0);
        }
        // Cache write rejection must be best effort, even under an explicit OOM/noeviction policy.
        try (var connection = factory.getConnection()) {
          connection.serverCommands().setConfig("maxmemory-policy", "noeviction");
          connection.serverCommands().setConfig("maxmemory", "1");
        }
        assertThatCode(() -> cache.put(user, snapshot)).doesNotThrowAnyException();
        server.stop();
        Thread.sleep(120);
        assertThat(cache.get(user, snapshot.revision(), snapshot.purpose())).isEmpty();
        server.restart();
        Thread.sleep(120);
        cache.put(user, snapshot);
        assertThat(cache.get(user, snapshot.revision(), snapshot.purpose())).contains(snapshot);
        assertThat(redis.hasKey("test-fill:0")).isFalse(); // No AOF/RDB persistence.
      } finally {
        factory.destroy();
      }
    }
  }
}
