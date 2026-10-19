package fu.tripsense.contextservice.adapter.out.cache;

import fu.tripsense.contextservice.application.ContextDiagnostics;
import fu.tripsense.contextservice.application.cache.PreferenceSnapshot;
import fu.tripsense.contextservice.application.cache.PreferenceSnapshotCache;
import fu.tripsense.contextservice.config.PreferenceCacheProperties;
import io.micrometer.core.instrument.MeterRegistry;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.LongSupplier;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.ReturnType;
import org.springframework.data.redis.connection.SetCondition;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.types.Expiration;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

@Repository
public class RedisPreferenceSnapshotCache implements PreferenceSnapshotCache {
  private static final Logger log = LoggerFactory.getLogger(RedisPreferenceSnapshotCache.class);
  static final int MAX_BYTES = 65_536;
  static final int MAX_SIGNALS = 200;
  // Enforce the payload limit BEFORE GET crosses the network/allocates a large client buffer.
  private static final byte[] GET_BOUNDED =
      ("local t=redis.call('TYPE',KEYS[1]).ok; "
              + "if t~='string' and t~='none' then redis.call('DEL',KEYS[1]); return nil end; "
              + "local n=redis.call('STRLEN',KEYS[1]); "
              + "if n>tonumber(ARGV[1]) then redis.call('DEL',KEYS[1]); return nil end; "
              + "return redis.call('GET',KEYS[1])")
          .getBytes(StandardCharsets.UTF_8);
  private static final JsonMapper JSON =
      JsonMapper.builder().enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).build();
  private final StringRedisTemplate redis;
  private final PreferenceCacheProperties properties;
  private final MeterRegistry meters;
  private final LongSupplier clock;
  private final boolean enabled;
  private int failures;
  private long retryAt;
  private long writeRetryAt;
  private boolean probe;

  @org.springframework.beans.factory.annotation.Autowired
  public RedisPreferenceSnapshotCache(
      StringRedisTemplate redis, PreferenceCacheProperties properties, MeterRegistry meters) {
    this(redis, properties, meters, System::nanoTime);
  }

  RedisPreferenceSnapshotCache(
      StringRedisTemplate redis,
      PreferenceCacheProperties properties,
      MeterRegistry meters,
      LongSupplier clock) {
    this.redis = redis;
    this.properties = properties;
    this.meters = meters;
    this.clock = clock;
    this.enabled =
        properties.isEnabled()
            && properties.getKeySecret() != null
            && !properties.getKeySecret().isBlank()
            && properties.getKeySecret().length() >= 32;
    if (properties.isEnabled() && !enabled)
      log.warn("context_preferences_cache_disabled reason=missing_or_short_secret");
  }

  @Override
  public boolean enabled() {
    return enabled;
  }

  @Override
  public Optional<PreferenceSnapshot> get(
      UUID userId, PreferenceSnapshot.Revision revision, String purpose) {
    if (!enabled || !revision.completed() || !allow()) {
      count("bypass");
      return Optional.empty();
    }
    String key = key(userId, revision, purpose);
    byte[] bytes;
    try {
      bytes =
          execute(
              "eval_bounded",
              (RedisCallback<byte[]>)
                  connection ->
                      connection
                          .scriptingCommands()
                          .eval(
                              GET_BOUNDED,
                              ReturnType.VALUE,
                              1,
                              key.getBytes(StandardCharsets.UTF_8),
                              Integer.toString(MAX_BYTES).getBytes(StandardCharsets.UTF_8)));
      success();
    } catch (RuntimeException failure) {
      failed();
      return Optional.empty();
    }
    if (bytes == null) return Optional.empty();
    try {
      if (bytes.length > MAX_BYTES) throw new IllegalArgumentException("Oversized cache entry");
      var root = JSON.readTree(bytes);
      if (!root.isObject()
          || !root.path("schemaVersion").isInt()
          || root.path("schemaVersion").intValue() != 1
          || !root.path("snapshot").isObject())
        throw new IllegalArgumentException("Invalid cache schema");
      var rows = root.path("snapshot").path("signals");
      if (!rows.isArray() || rows.size() > MAX_SIGNALS)
        throw new IllegalArgumentException("Invalid cached signals");
      for (var row : rows) {
        if (!row.isObject()
            || !row.path("dimensionCode").isTextual()
            || !row.path("valueCode").isTextual()
            || !row.path("source").isTextual()
            || !row.path("confidence").isNumber())
          throw new IllegalArgumentException("Invalid cached signal types");
      }
      var snapshot = JSON.treeToValue(root.get("snapshot"), PreferenceSnapshot.class);
      if (!snapshot.revision().equals(revision)
          || !snapshot.purpose().equals(purpose)
          || !cacheable(snapshot))
        throw new IllegalArgumentException("Mismatched cache projection");
      return Optional.of(snapshot);
    } catch (RuntimeException invalid) {
      count("corrupt");
      try {
        execute(
            "delete_corrupt",
            connection -> connection.keyCommands().del(key.getBytes(StandardCharsets.UTF_8)));
      } catch (RuntimeException failure) {
        failed();
      }
      return Optional.empty();
    }
  }

  @Override
  public void put(UUID userId, PreferenceSnapshot snapshot) {
    if (!enabled || !cacheable(snapshot)) return;
    if (writeBlocked()) {
      count("bypass");
      ContextDiagnostics.state("context_redis_write_skipped_after_error", true);
      return;
    }
    byte[] payload;
    try {
      payload = JSON.writeValueAsBytes(new Envelope(1, snapshot));
    } catch (RuntimeException invalid) {
      count("uncacheable");
      return;
    }
    if (payload.length > MAX_BYTES) {
      count("uncacheable");
      return;
    }
    if (!allow()) {
      count("bypass");
      return;
    }
    try {
      byte[] key =
          key(userId, snapshot.revision(), snapshot.purpose()).getBytes(StandardCharsets.UTF_8);
      execute(
          "set",
          (RedisCallback<Boolean>)
              connection ->
                  connection
                      .stringCommands()
                      .set(key, payload, SetCondition.upsert(), Expiration.from(ttl())));
      success();
      count("write");
    } catch (RuntimeException failure) {
      failed();
    }
  }

  static boolean cacheable(PreferenceSnapshot snapshot) {
    if (snapshot == null
        || snapshot.revision() == null
        || !snapshot.revision().completed()
        || snapshot.signals().size() > MAX_SIGNALS) return false;
    for (var signal : snapshot.signals()) {
      if (signal == null
          || signal.updatedAt() == null
          || !Double.isFinite(signal.confidence())
          || signal.confidence() < 0
          || signal.confidence() > 1
          || !validCode(signal.dimensionCode(), 80)
          || !validCode(signal.valueCode(), 128)
          || !("ONBOARDING".equals(signal.source())
              || "ONBOARDING_DERIVED_V1".equals(signal.source()))) return false;
      // Defense in depth; all cache projections come from the current server-side catalog filter.
      if (Set.of("LOYALTY_PROGRAM", "DIETARY_RESTRICTION", "ACCESSIBILITY_NEEDS")
          .contains(signal.dimensionCode())) return false;
    }
    return true;
  }

  // Instrument the existing callback: no extra connection, PING, command or changed timeout.
  private <T> T execute(String operation, RedisCallback<T> callback) {
    long started = System.nanoTime();
    String[] stage = {"acquire"};
    ContextDiagnostics.state("context_redis_operation", operation);
    ContextDiagnostics.state(
        "context_redis_command_timeout_ms", properties.getCommandTimeout().toMillis());
    ContextDiagnostics.state(
        "context_redis_connect_timeout_ms", properties.getConnectTimeout().toMillis());
    try {
      T result =
          redis.execute(
              (RedisCallback<T>)
                  connection -> {
                    ContextDiagnostics.state(
                        "context_redis_acquire_ms", (System.nanoTime() - started) / 1_000_000);
                    stage[0] = "command";
                    long commandStarted = System.nanoTime();
                    try {
                      T value = callback.doInRedis(connection);
                      stage[0] = "release";
                      return value;
                    } finally {
                      ContextDiagnostics.state(
                          "context_redis_command_ms",
                          (System.nanoTime() - commandStarted) / 1_000_000);
                    }
                  });
      return result;
    } catch (RuntimeException failure) {
      String category = failureCategory(failure);
      if (stage[0].equals("acquire"))
        ContextDiagnostics.state(
            "context_redis_acquire_ms", (System.nanoTime() - started) / 1_000_000);
      ContextDiagnostics.state("context_redis_failure_stage", stage[0]);
      ContextDiagnostics.state("context_redis_failure_category", category);
      meters
          .counter(
              "tripsense.context.cache.failure",
              "operation",
              operation,
              "stage",
              stage[0],
              "category",
              category)
          .increment();
      throw failure;
    } finally {
      ContextDiagnostics.state(
          "context_redis_operation_ms", (System.nanoTime() - started) / 1_000_000);
    }
  }

  static String failureCategory(Throwable failure) {
    Set<Throwable> visited = Collections.newSetFromMap(new IdentityHashMap<>());
    String result = "other";
    for (Throwable cause = failure;
        cause != null && visited.size() < 16 && visited.add(cause);
        cause = cause.getCause()) {
      String type = cause.getClass().getSimpleName();
      if (cause instanceof javax.net.ssl.SSLException
          || type.equals("CertificateException")
          || type.equals("CertificateExpiredException")) return "tls";
      if (cause instanceof java.net.UnknownHostException) return "dns";
      if (type.equals("ConnectTimeoutException")) return "connect_timeout";
      if (cause instanceof java.net.ConnectException) return "connect_error";
      if (type.equals("RedisCommandTimeoutException")) result = "command_timeout";
      else if (type.equals("RedisCommandExecutionException")) {
        // Inspect only fixed Redis error prefixes internally; never log upstream text.
        String message = cause.getMessage();
        if (message != null && (message.startsWith("NOAUTH") || message.startsWith("WRONGPASS")))
          return "authentication";
        if (message != null && message.startsWith("NOPERM")) return "permission";
        if (result.equals("other")) result = "command_rejected";
      } else if (result.equals("other")
          && (type.equals("RedisConnectionException") || cause instanceof java.net.SocketException))
        result = "connection";
    }
    return result;
  }

  private static boolean validCode(String code, int max) {
    return code != null && !code.isBlank() && code.length() <= max && code.matches("[A-Z0-9_\\-]+");
  }

  String key(UUID userId, PreferenceSnapshot.Revision revision, String purpose) {
    PreferenceSnapshot.requirePurpose(purpose);
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(
          new SecretKeySpec(
              properties.getKeySecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      String material =
          userId
              + "|"
              + revision.profileId()
              + "|"
              + revision.version()
              + "|"
              + revision.status()
              + "|"
              + revision.schemaVersion()
              + "|"
              + revision.catalogHash()
              + "|"
              + purpose;
      return "ctx:prefs:v1:"
          + HexFormat.of().formatHex(mac.doFinal(material.getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.GeneralSecurityException impossible) {
      throw new IllegalStateException("Could not generate cache key", impossible);
    }
  }

  Duration ttl() {
    return Duration.ofMillis(
        Math.max(
            1,
            Math.round(
                properties.getTtl().toMillis()
                    * ThreadLocalRandom.current().nextDouble(0.8, 1.2))));
  }

  private synchronized boolean allow() {
    if (failures < properties.getFailureThreshold()) {
      ContextDiagnostics.state("context_redis_circuit", "closed");
      return true;
    }
    if (clock.getAsLong() < retryAt || probe) {
      ContextDiagnostics.state("context_redis_circuit", "open");
      return false;
    }
    ContextDiagnostics.state("context_redis_circuit", "half_open");
    probe = true;
    return true;
  }

  private synchronized void success() {
    failures = 0;
    probe = false;
    retryAt = 0;
    writeRetryAt = 0;
  }

  private synchronized boolean writeBlocked() {
    return failures > 0 && clock.getAsLong() < writeRetryAt;
  }

  private synchronized void failed() {
    writeRetryAt = clock.getAsLong() + properties.getFailureBackoff().toNanos();
    failures = Math.min(properties.getFailureThreshold(), failures + 1);
    probe = false;
    if (failures >= properties.getFailureThreshold()) {
      retryAt = clock.getAsLong() + properties.getFailureBackoff().toNanos();
      // autoReconnect is disabled: discard the broken shared connection so a later probe can
      // reconnect.
      if (redis.getConnectionFactory()
          instanceof
          org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory factory) {
        try {
          factory.resetConnection();
        } catch (RuntimeException ignored) {
          /* Cache remains open-circuit. */
        }
      }
    }
    count(
        "error"); // Fixed-cardinality counters only; no upstream messages, key or user ID logging.
  }

  private void count(String outcome) {
    meters.counter("tripsense.context.cache", "outcome", outcome).increment();
    ContextDiagnostics.state("context_redis_outcome", outcome);
  }

  private record Envelope(int schemaVersion, PreferenceSnapshot snapshot) {}
}
