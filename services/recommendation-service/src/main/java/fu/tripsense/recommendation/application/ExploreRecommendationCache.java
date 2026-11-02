package fu.tripsense.recommendation.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.config.RecommendationProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.SetCondition;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.types.Expiration;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class ExploreRecommendationCache {
  private static final String PREFIX = "rec:explore:v3:";

  private final StringRedisTemplate redis;
  private final ObjectMapper objectMapper;
  private final String secret;
  private final Duration cacheTtl;
  private final Duration lastKnownGoodTtl;
  private final String algorithmFingerprint;

  public ExploreRecommendationCache(
      StringRedisTemplate redis, ObjectMapper objectMapper, RecommendationProperties properties) {
    this.redis = redis;
    this.objectMapper = objectMapper;
    this.secret = properties.getExplore().getCacheKeySecret();
    this.cacheTtl = properties.getExplore().getCacheTtl();
    this.lastKnownGoodTtl = properties.getExplore().getLastKnownGoodTtl();
    this.algorithmFingerprint =
        digest(
            properties.getVersions().toString()
                + "|observed="
                + properties.getProfile().toString()
                + "|budget-penalty=" + properties.getRanking().getBudgetMaximumPenalty());
  }

  public Optional<ExploreRecommendationResult> getFresh(
      UUID userId, String destinationId, String query, String profileFingerprint, int limit) {
    if (!enabled()) return Optional.empty();
    return read(key("fresh", userId, destinationId, query, profileFingerprint, limit));
  }

  public Optional<ExploreRecommendationResult> getLastKnownGood(
      UUID userId, String destinationId, String query, String profileFingerprint, int limit) {
    if (!enabled()) return Optional.empty();
    return read(key("lkg", userId, destinationId, query, profileFingerprint, limit));
  }

  public void put(
      UUID userId,
      String destinationId,
      String query,
      String profileFingerprint,
      int limit,
      ExploreRecommendationResult response) {
    if (!enabled() || response.recommendation().items().isEmpty()) return;
    String freshKey =
        RequestDiagnostics.measure(
            "cache_fresh_key",
            () -> key("fresh", userId, destinationId, query, profileFingerprint, limit));
    String lastKnownGoodKey =
        RequestDiagnostics.measure(
            "cache_lkg_key",
            () -> key("lkg", userId, destinationId, query, profileFingerprint, limit));
    try {
      String encoded = serialize("cache_serialize", response);
      var serializer = redis.getStringSerializer();
      byte[] payload =
          RequestDiagnostics.measure("cache_payload_encode", () -> serializer.serialize(encoded));
      byte[] freshBytes = serializer.serialize(freshKey);
      byte[] lastKnownGoodBytes = serializer.serialize(lastKnownGoodKey);
      RequestDiagnostics.run(
          "cache_pipeline_execute",
          () ->
              redis.executePipelined(
                  (RedisCallback<Object>)
                      connection -> {
                        enqueue(connection, "fresh", freshBytes, payload, cacheTtl);
                        enqueue(connection, "lkg", lastKnownGoodBytes, payload, lastKnownGoodTtl);
                        // Spring requires null here and waits for command replies when closing the
                        // pipeline.
                        return null;
                      }));
    } catch (RuntimeException | JsonProcessingException exception) {
      writeFailure(exception);
    }
  }

  public String profileFingerprint(fu.tripsense.recommendation.domain.UserProfileSnapshot profile) {
    String material =
        "daily-budget-v1|" + algorithmFingerprint
            + "|" + profile.dailyBudgetVnd() + "|" + profile.budgetTier()
            + "|"
            + profile.personalizationEnabled()
            + "|"
            + profile.available()
            + "|"
            + profile.preferredCategories().stream().sorted().toList()
            + "|"
            + profile.dislikedCategories().stream().sorted().toList()
            + "|"
            + profile.categoryAffinities().entrySet().stream()
                .sorted(java.util.Map.Entry.comparingByKey())
                .toList()
            + "|"
            + profile.seenPlaceIds().stream().sorted().toList()
            + "|"
            + profile.savedPlaceIds().stream().sorted().toList()
            + "|"
            + profile.addedToTripPlaceIds().stream().sorted().toList()
            + "|"
            + profile.negativePlaceIds().stream().sorted().toList();
    return digest(material);
  }

  private Optional<ExploreRecommendationResult> read(String key) {
    if (!enabled()) return Optional.empty();
    try {
      String value = redis.opsForValue().get(key);
      return value == null
          ? Optional.empty()
          : Optional.of(objectMapper.readValue(value, ExploreRecommendationResult.class))
              .filter(r -> BudgetEvidenceFreshness.usable(r.recommendation()));
    } catch (RuntimeException | java.io.IOException exception) {
      RequestDiagnostics.mark("cache_read_error", true);
      log.warn(
          "explore_recommendation_cache_read_failed errorType={}",
          exception.getClass().getSimpleName());
      return Optional.empty();
    }
  }

  private void enqueue(
      RedisConnection connection, String kind, byte[] key, byte[] payload, Duration ttl) {
    try {
      connection.stringCommands().set(key, payload, SetCondition.upsert(), Expiration.from(ttl));
    } catch (RuntimeException exception) {
      // Best effort for the other key; never retry an uncertain write after pipeline failure.
      RequestDiagnostics.mark("cache_" + kind + "_enqueue_error", true);
      writeFailure(exception);
    }
  }

  private void writeFailure(Exception exception) {
    RequestDiagnostics.mark("cache_write_error", true);
    log.warn(
        "explore_recommendation_cache_write_failed errorType={}",
        exception.getClass().getSimpleName());
  }

  private String serialize(String phase, ExploreRecommendationResult response)
      throws JsonProcessingException {
    var sample = RequestDiagnostics.start(phase);
    boolean failed = true;
    try {
      String encoded = objectMapper.writeValueAsString(response);
      failed = false;
      return encoded;
    } finally {
      sample.finish(failed);
    }
  }

  private String key(
      String kind,
      UUID userId,
      String destinationId,
      String query,
      String profileFingerprint,
      int limit) {
    return PREFIX
        + kind
        + ":"
        + hmac(
            userId
                + "|"
                + destinationId
                + "|"
                + normalize(query)
                + "|"
                + profileFingerprint
                + "|"
                + algorithmFingerprint
                + "|"
                + limit);
  }

  private boolean enabled() {
    return secret != null && !secret.isBlank();
  }

  private String hmac(String value) {
    if (!enabled()) {
      return digest(value);
    }
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception exception) {
      throw new IllegalStateException("Could not create Explore cache key", exception);
    }
  }

  private String digest(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception exception) {
      throw new IllegalStateException("Could not fingerprint recommendation profile", exception);
    }
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT);
  }
}
