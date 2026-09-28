package fu.tripsense.recommendation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.config.RecommendationProperties;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;

class ExploreRecommendationCacheTest {

  @Test
  void doesNotThrowWhenCacheSecretIsEmpty() {
    RecommendationProperties properties = new RecommendationProperties();
    properties.getExplore().setCacheKeySecret("");

    ExploreRecommendationCache cache =
        new ExploreRecommendationCache(null, new ObjectMapper(), properties);

    assertThatCode(
            () -> {
              Optional<ExploreRecommendationResult> result =
                  cache.getFresh(UUID.randomUUID(), "danang", "coffee", "fingerprint", 20);
              assertThat(result).isEmpty();
            })
        .doesNotThrowAnyException();

    assertThatCode(
            () -> {
              Optional<ExploreRecommendationResult> result =
                  cache.getLastKnownGood(UUID.randomUUID(), "danang", "coffee", "fingerprint", 20);
              assertThat(result).isEmpty();
            })
        .doesNotThrowAnyException();
  }
}
