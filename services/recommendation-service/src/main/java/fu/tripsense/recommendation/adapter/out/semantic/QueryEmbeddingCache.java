package fu.tripsense.recommendation.adapter.out.semantic;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.config.RecommendationProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class QueryEmbeddingCache {
  private static final String PREFIX = "recommendation:v2:query-embedding:";
  private final StringRedisTemplate redis;
  private final ObjectMapper objectMapper;
  private final Duration ttl;

  public QueryEmbeddingCache(
      StringRedisTemplate redis,
      ObjectMapper objectMapper,
      RecommendationProperties properties) {
    this.redis = redis;
    this.objectMapper = objectMapper;
    this.ttl = properties.getSemantic().getCacheTtl();
  }

  public Optional<List<Double>> get(String modelVersion, String content) {
    try {
      String value = redis.opsForValue().get(key(modelVersion, content));
      return value == null
          ? Optional.empty()
          : Optional.of(objectMapper.readValue(value, new TypeReference<List<Double>>() {}));
    } catch (Exception exception) {
      return Optional.empty();
    }
  }

  public void put(String modelVersion, String content, List<Double> embedding) {
    try {
      redis
          .opsForValue()
          .set(key(modelVersion, content), objectMapper.writeValueAsString(embedding), ttl);
    } catch (Exception ignored) {
      // Redis is an optional acceleration layer; semantic retrieval can continue without it.
    }
  }

  private String key(String modelVersion, String content) {
    return PREFIX + modelVersion + ":" + sha256(content);
  }

  private String sha256(String value) {
    try {
      byte[] bytes =
          MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return java.util.HexFormat.of().formatHex(bytes);
    } catch (Exception exception) {
      throw new IllegalStateException("Could not hash embedding content", exception);
    }
  }
}
