package fu.tripsense.recommendation.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.config.SectionFeedProperties;
import fu.tripsense.recommendation.domain.*;
import java.time.*;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class SectionFeedCache {
  private final StringRedisTemplate redis;
  private final ObjectMapper json;
  private final RecommendationProperties properties;
  private final SectionFeedProperties settings;

  public SectionFeedCache(
      StringRedisTemplate redis,
      ObjectMapper json,
      RecommendationProperties properties,
      SectionFeedProperties settings) {
    this.redis = redis;
    this.json = json;
    this.properties = properties;
    this.settings = settings;
  }

  public String scope(UUID owner, String material) {
    try {
      String secret = properties.getExplore().getCacheKeySecret();
      var mac = Mac.getInstance("HmacSHA256");
      mac.init(
          new SecretKeySpec(
              (secret == null || secret.isBlank() ? "disabled-cache-scope" : secret)
                  .getBytes(java.nio.charset.StandardCharsets.UTF_8),
              "HmacSHA256"));
      return HexFormat.of()
          .formatHex(
              mac.doFinal(
                  ("owner".equals(material)
                          ? "sections-owner-v1|" + owner
                          : ("sections-primary-v1|"
                              + properties.getVersions()
                              + "|"
                              + properties.getProfile()
                              + "|"
                              + properties.getSemantic().isEnabled()
                              + "|"
                              + properties.getSemantic().getEmbeddingModel()
                              + "|"
                              + properties.getSemantic().getCollection()
                              + "|"
                              + settings.getPreviewCandidatesPerCategory()
                              + "|"
                              + owner
                              + "|"
                              + material))
                      .getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    } catch (java.security.GeneralSecurityException e) {
      throw new IllegalStateException("Cache scope unavailable", e);
    }
  }

  private boolean enabled() {
    return properties.getExplore().getCacheKeySecret() != null
        && !properties.getExplore().getCacheKeySecret().isBlank();
  }

  public Optional<SectionFeedResult> response(String key, boolean stale) {
    return read(
            "rec:explore:sections:" + (stale ? "lkg:" : "fresh:") + key, SectionFeedResult.class)
        .filter(
            r ->
                r.expiresAt() != null
                    && r.recommendation() != null
                    && r.sections() != null
                    && (stale || r.expiresAt().isAfter(Instant.now())));
  }

  public void response(String key, SectionFeedResult response) {
    if (!enabled()) return;
    try {
      String encoded = json.writeValueAsString(response);
      if (encoded.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 262144) return;
      Duration remaining = Duration.between(Instant.now(), response.expiresAt());
      if (remaining.isNegative() || remaining.isZero()) return;
      redis.executePipelined(
          (org.springframework.data.redis.core.RedisCallback<Object>)
              connection -> {
                var serializer = redis.getStringSerializer();
                var bytes = serializer.serialize(encoded);
                connection
                    .stringCommands()
                    .set(
                        serializer.serialize("rec:explore:sections:fresh:" + key),
                        bytes,
                        org.springframework.data.redis.connection.SetCondition.upsert(),
                        org.springframework.data.redis.core.types.Expiration.from(remaining));
                connection
                    .stringCommands()
                    .set(
                        serializer.serialize("rec:explore:sections:lkg:" + key),
                        bytes,
                        org.springframework.data.redis.connection.SetCondition.upsert(),
                        org.springframework.data.redis.core.types.Expiration.from(
                            properties.getExplore().getLastKnownGoodTtl()));
                return null;
              });
    } catch (Exception ignored) {
      RequestDiagnostics.mark("section_cache_write_error", true);
    }
  }

  public Optional<Seed> seed(UUID owner, UUID id) {
    if (id == null) return Optional.empty();
    return read("rec:explore:sections:seed:primary-v1:" + id, Seed.class)
        .filter(
            s ->
                s.id() != null
                    && s.id().equals(id)
                    && s.ownerScope() != null
                    && s.destinationScope() != null
                    && s.intentScope() != null
                    && s.expiresAt() != null
                    && s.previewOrder() != null
                    && s.candidates() != null
                    && s.candidates().size() <= settings.getSeedMaxIds()
                    && s.candidates().stream()
                        .allMatch(
                            c ->
                                c != null
                                    && c.id() != null
                                    && c.id().length() <= 200
                                    && c.source() != null
                                    && c.rank() > 0)
                    && s.previewOrder().values().stream()
                        .allMatch(
                            ids ->
                                ids != null
                                    && ids.size() <= 4
                                    && ids.stream().allMatch(Objects::nonNull)
                                    && ids.stream().distinct().count() == ids.size()))
        .map(
            seed -> {
              if (!seed.ownerScope().equals(scope(owner, "owner")))
                throw new SeedNotFoundException();
              return seed;
            })
        .filter(seed -> seed.expiresAt().isAfter(Instant.now()));
  }

  public boolean seed(Seed seed) {
    if (!enabled()) return false;
    try {
      byte[] encoded = json.writeValueAsBytes(seed);
      if (seed.candidates().size() > settings.getSeedMaxIds()
          || encoded.length > settings.getSeedMaxBytes()) return false;
      redis
          .opsForValue()
          .set(
              "rec:explore:sections:seed:primary-v1:" + seed.id(),
              new String(encoded, java.nio.charset.StandardCharsets.UTF_8),
              settings.getSeedTtl());
      return true;
    } catch (Exception ignored) {
      RequestDiagnostics.mark("seed_write_error", true);
      return false;
    }
  }

  private <T> Optional<T> read(String key, Class<T> type) {
    if (!enabled()) return Optional.empty();
    try {
      var encoded = redis.opsForValue().get(key);
      if (encoded != null
          && encoded.getBytes(java.nio.charset.StandardCharsets.UTF_8).length
              > (type == Seed.class ? settings.getSeedMaxBytes() : 262144)) return Optional.empty();
      return encoded == null ? Optional.empty() : Optional.of(json.readValue(encoded, type));
    } catch (Exception ignored) {
      RequestDiagnostics.mark("section_cache_read_error", true);
      return Optional.empty();
    }
  }

  public record Seed(
      UUID id,
      String ownerScope,
      String destinationScope,
      String intentScope,
      Instant expiresAt,
      boolean semanticSucceeded,
      List<SeedCandidate> candidates,
      Map<DiscoveryCategory, List<String>> previewOrder) {}

  public record SeedCandidate(
      String id, CandidateSource source, int rank, Double score, RetrievalEvidence evidence) {}

  public static class SeedNotFoundException extends RuntimeException {}
}
