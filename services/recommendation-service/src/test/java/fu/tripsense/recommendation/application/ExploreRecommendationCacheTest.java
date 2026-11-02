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
  void budgetChangesAndClearingUseDifferentCacheScopes() {
    var cache = new ExploreRecommendationCache(null, new ObjectMapper(), new RecommendationProperties());
    var first = new fu.tripsense.recommendation.domain.UserProfileSnapshot(true, true,
        java.util.Set.of(), java.util.Set.of(), java.util.Map.of(), java.util.Set.of(),
        java.util.Set.of(), java.util.Set.of(), java.util.Set.of(), null, 700000L, "MID_RANGE");
    var second = new fu.tripsense.recommendation.domain.UserProfileSnapshot(true, true,
        java.util.Set.of(), java.util.Set.of(), java.util.Map.of(), java.util.Set.of(),
        java.util.Set.of(), java.util.Set.of(), java.util.Set.of(), null, 1000000L, "MID_RANGE");
    assertThat(cache.profileFingerprint(first)).isNotEqualTo(cache.profileFingerprint(second));
    assertThat(cache.profileFingerprint(first))
        .isNotEqualTo(cache.profileFingerprint(fu.tripsense.recommendation.domain.UserProfileSnapshot.coldStart(true)));
  }

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
