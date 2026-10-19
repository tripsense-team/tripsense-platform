package fu.tripsense.contextservice.adapter.out.cache;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import fu.tripsense.contextservice.application.PreferenceSignalReader.PreferenceSignal;
import fu.tripsense.contextservice.application.cache.PreferenceSnapshot;
import fu.tripsense.contextservice.config.PreferenceCacheProperties;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.types.Expiration;

class RedisPreferenceSnapshotCacheTest {
  private final RedisConnectionFactory factory = mock(RedisConnectionFactory.class);
  private final RedisConnection connection = mock(RedisConnection.class);
  private final RedisScriptingCommands scripts = mock(RedisScriptingCommands.class);
  private final RedisStringCommands strings = mock(RedisStringCommands.class);
  private final StringRedisTemplate template = new StringRedisTemplate(factory);
  private final PreferenceCacheProperties properties = new PreferenceCacheProperties();
  private final SimpleMeterRegistry meters = new SimpleMeterRegistry();
  private final AtomicLong clock = new AtomicLong();
  private final UUID user = UUID.randomUUID();
  private final PreferenceSnapshot snapshot = snapshot();
  private final Map<String, byte[]> data = new HashMap<>();

  @BeforeEach
  void setup() {
    properties.setEnabled(true);
    properties.setKeySecret("test-only-context-cache-secret-32-chars");
    when(factory.getConnection()).thenReturn(connection);
    when(connection.scriptingCommands()).thenReturn(scripts);
    when(connection.stringCommands()).thenReturn(strings);
    when(strings.set(
            any(byte[].class), any(byte[].class), any(SetCondition.class), any(Expiration.class)))
        .thenAnswer(
            call -> {
              data.put(text(call.getArgument(0)), call.getArgument(1));
              return true;
            });
    when(scripts.<byte[]>eval(
            any(byte[].class), eq(ReturnType.VALUE), eq(1), any(byte[].class), any(byte[].class)))
        .thenAnswer(
            call -> {
              String key = text(call.getArgument(3));
              byte[] value = data.get(key);
              if (value != null && value.length > RedisPreferenceSnapshotCache.MAX_BYTES) {
                data.remove(key);
                return null;
              }
              return value;
            });
  }

  @Test
  void swallowedTransportFailureIsExplicitInSafeDiagnostics() {
    var logger =
        (ch.qos.logback.classic.Logger)
            org.slf4j.LoggerFactory.getLogger(
                fu.tripsense.contextservice.application.ContextDiagnostics.class);
    var output =
        new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
    output.start();
    logger.addAppender(output);
    fu.tripsense.contextservice.application.ContextDiagnostics.begin("context-test-123");
    try {
      when(scripts.<byte[]>eval(
              any(byte[].class), eq(ReturnType.VALUE), eq(1), any(byte[].class), any(byte[].class)))
          .thenThrow(new IllegalStateException("private-redis-credentials"));
      assertThat(cache().get(user, snapshot.revision(), snapshot.purpose())).isEmpty();
      String messages =
          String.join(
              "\n", output.list.stream().map(event -> event.getFormattedMessage()).toList());
      assertThat(messages)
          .contains("context_redis_outcome value=error")
          .contains("context_redis_operation value=eval_bounded")
          .contains("context_redis_failure_stage value=command")
          .contains("context_redis_failure_category value=other")
          .contains(
              "context_redis_acquire_ms", "context_redis_command_ms", "context_redis_operation_ms")
          .doesNotContain("private-redis-credentials", user.toString());
    } finally {
      fu.tripsense.contextservice.application.ContextDiagnostics.finish(200);
      logger.detachAppender(output);
      output.stop();
    }
  }

  @Test
  void categorizesNestedFailuresWithoutExposingUpstreamMessages() {
    assertThat(
            RedisPreferenceSnapshotCache.failureCategory(
                new IllegalStateException(
                    new io.lettuce.core.RedisCommandTimeoutException("private"))))
        .isEqualTo("command_timeout");
    assertThat(
            RedisPreferenceSnapshotCache.failureCategory(
                new IllegalStateException(new javax.net.ssl.SSLHandshakeException("private"))))
        .isEqualTo("tls");
    assertThat(
            RedisPreferenceSnapshotCache.failureCategory(
                new java.net.UnknownHostException("private")))
        .isEqualTo("dns");
    assertThat(
            RedisPreferenceSnapshotCache.failureCategory(
                new io.lettuce.core.RedisCommandExecutionException("WRONGPASS private")))
        .isEqualTo("authentication");
    assertThat(
            RedisPreferenceSnapshotCache.failureCategory(
                new io.lettuce.core.RedisCommandExecutionException("NOPERM private")))
        .isEqualTo("permission");
    assertThat(
            RedisPreferenceSnapshotCache.failureCategory(new java.net.ConnectException("private")))
        .isEqualTo("connect_error");
  }

  @Test
  void connectionAcquisitionFailureDoesNotRunCommandsAndHasSafeMetric() {
    when(factory.getConnection())
        .thenThrow(
            new org.springframework.data.redis.RedisConnectionFailureException(
                "private", new javax.net.ssl.SSLHandshakeException("private")));
    assertThat(cache().get(user, snapshot.revision(), snapshot.purpose())).isEmpty();
    verifyNoInteractions(scripts, strings);
    assertThat(
            meters
                .get("tripsense.context.cache.failure")
                .tags("operation", "eval_bounded", "stage", "acquire", "category", "tls")
                .counter()
                .count())
        .isEqualTo(1);
  }

  @Test
  void roundTripIsTypedBoundedAndDoesNotRefreshTtlOnHits() {
    var cache = cache();
    cache.put(user, snapshot);
    assertThat(cache.get(user, snapshot.revision(), snapshot.purpose())).contains(snapshot);
    assertThat(cache.get(user, snapshot.revision(), snapshot.purpose())).contains(snapshot);
    verify(strings, times(1))
        .set(any(byte[].class), any(byte[].class), any(SetCondition.class), any(Expiration.class));
    assertThat(data).hasSize(1);
    assertThat(data.keySet().iterator().next())
        .matches("ctx:prefs:v1:[a-f0-9]{64}")
        .doesNotContain(user.toString());
  }

  @Test
  void isolatesOwnersRevisionsCatalogSchemaPurposeAndProfileRecreation() {
    var cache = cache();
    cache.put(user, snapshot);
    assertThat(cache.get(UUID.randomUUID(), snapshot.revision(), snapshot.purpose())).isEmpty();
    assertThat(cache.get(user, snapshot.revision(), "EXPLORE_RECOMMENDATION")).isEmpty();
    var r = snapshot.revision();
    for (var other :
        List.of(
            new PreferenceSnapshot.Revision(r.profileId(), 2, r.status(), 1, r.catalogHash()),
            new PreferenceSnapshot.Revision(UUID.randomUUID(), 1, r.status(), 1, r.catalogHash()),
            new PreferenceSnapshot.Revision(r.profileId(), 1, r.status(), 2, r.catalogHash()),
            new PreferenceSnapshot.Revision(r.profileId(), 1, r.status(), 1, "new-catalog")))
      assertThat(cache.get(user, other, snapshot.purpose())).isEmpty();
  }

  @Test
  void malformedMismatchedOrUnknownSchemaValuesAreMissesNeverPersonalDataFallbacks() {
    var cache = cache();
    cache.put(user, snapshot);
    String key = cache.key(user, snapshot.revision(), snapshot.purpose());
    String valid = text(data.get(key));
    for (String invalid :
        List.of(
            "not-json",
            "{}",
            valid + " {}",
            valid.replace("\"schemaVersion\":1", "\"schemaVersion\":999"),
            valid.replace("TRIP_PLANNING", "EXPLORE_RECOMMENDATION"),
            valid.replace(
                "\"dimensionCode\":\"FOOD_STYLE\"", "\"dimensionCode\":\"LOYALTY_PROGRAM\""))) {
      data.put(key, invalid.getBytes(StandardCharsets.UTF_8));
      assertThat(cache.get(user, snapshot.revision(), snapshot.purpose())).isEmpty();
    }
  }

  @Test
  void oversizeSensitiveUnknownSourceAndDraftSnapshotsAreNeverWritten() {
    var cache = cache();
    var r = snapshot.revision();
    var signal = snapshot.signals().getFirst();
    for (var invalid :
        List.of(
            new PreferenceSnapshot(
                PreferenceSnapshot.Revision.absent(), snapshot.purpose(), List.of()),
            new PreferenceSnapshot(r, snapshot.purpose(), Collections.nCopies(201, signal)),
            new PreferenceSnapshot(
                r,
                snapshot.purpose(),
                List.of(
                    new PreferenceSignal(
                        "LOYALTY_PROGRAM", "PRIVATE", 1, "ONBOARDING", Instant.EPOCH))),
            new PreferenceSnapshot(
                r,
                snapshot.purpose(),
                List.of(new PreferenceSignal("FOOD_STYLE", "CAFE", 1, "HISTORY", Instant.EPOCH))),
            new PreferenceSnapshot(
                r,
                snapshot.purpose(),
                List.of(
                    new PreferenceSignal(
                        "FOOD_STYLE", "CAFE", Double.NaN, "ONBOARDING", Instant.EPOCH)))))
      cache.put(user, invalid);
    assertThat(data).isEmpty();
    cache.put(user, snapshot);
    String key = cache.key(user, r, snapshot.purpose());
    data.put(key, new byte[65_537]);
    assertThat(cache.get(user, r, snapshot.purpose())).isEmpty();
  }

  @Test
  void ttlHasFixedEightToTwelveMinuteJitter() {
    for (int i = 0; i < 200; i++)
      assertThat(cache().ttl()).isBetween(Duration.ofMinutes(8), Duration.ofMinutes(12));
  }

  @Test
  void repeatedRedisFailuresOpenCircuitThenOneProbeRecovers() {
    when(factory.getConnection())
        .thenThrow(new IllegalStateException("private-connection-details"));
    var cache = cache();
    for (int i = 0; i < 30; i++)
      assertThat(cache.get(user, snapshot.revision(), snapshot.purpose())).isEmpty();
    verify(factory, times(3)).getConnection();
    clock.addAndGet(Duration.ofSeconds(6).toNanos());
    doReturn(connection).when(factory).getConnection();
    cache.get(user, snapshot.revision(), snapshot.purpose());
    verify(factory, times(4)).getConnection();
    cache.put(user, snapshot);
    assertThat(cache.get(user, snapshot.revision(), snapshot.purpose())).contains(snapshot);
  }

  @Test
  void missingSecretOrDisabledFlagNeverConnects() {
    properties.setKeySecret("");
    var cache = cache();
    assertThat(cache.enabled()).isFalse();
    cache.put(user, snapshot);
    cache.get(user, snapshot.revision(), snapshot.purpose());
    verifyNoInteractions(factory);
  }

  @Test
  void readFailureSkipsImmediateWriteUntilSuccessfulRead() {
    when(factory.getConnection()).thenThrow(new IllegalStateException("private"));
    var cache = cache();
    assertThat(cache.get(user, snapshot.revision(), snapshot.purpose())).isEmpty();
    cache.put(user, snapshot);
    verify(factory, times(1)).getConnection();
    doReturn(connection).when(factory).getConnection();
    cache.get(user, snapshot.revision(), snapshot.purpose());
    cache.put(user, snapshot);
    assertThat(cache.get(user, snapshot.revision(), snapshot.purpose())).contains(snapshot);
  }

  private RedisPreferenceSnapshotCache cache() {
    return new RedisPreferenceSnapshotCache(template, properties, meters, clock::get);
  }

  private static String text(byte[] bytes) {
    return new String(bytes, StandardCharsets.UTF_8);
  }

  private static PreferenceSnapshot snapshot() {
    return new PreferenceSnapshot(
        new PreferenceSnapshot.Revision(UUID.randomUUID(), 1, "COMPLETED", 1, "catalog"),
        "TRIP_PLANNING",
        List.of(new PreferenceSignal("FOOD_STYLE", "CAFE", 1, "ONBOARDING", Instant.EPOCH)));
  }
}
