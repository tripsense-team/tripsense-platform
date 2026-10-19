package fu.tripsense.recommendation.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.UserProfileSnapshot;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

class ContextPersonalizationCacheTest {
  private final RecommendationProperties properties = new RecommendationProperties();

  @Test
  void policyAndConfidenceSettingsHaveDifferentFingerprintsEvenForIdenticalProfiles() {
    var profile = UserProfileSnapshot.coldStart(true);
    var current = new ExploreRecommendationCache(null, new ObjectMapper(), properties);
    properties.getProfile().setObservedSignalPolicyV2Enabled(false);
    var legacy = new ExploreRecommendationCache(null, new ObjectMapper(), properties);
    assertThat(current.profileFingerprint(profile))
        .isNotEqualTo(legacy.profileFingerprint(profile));
    properties.getProfile().setObservedSignalPolicyV2Enabled(true);
    properties.getProfile().setObservedConfidencePrior(6);
    assertThat(current.profileFingerprint(profile))
        .isNotEqualTo(
            new ExploreRecommendationCache(null, new ObjectMapper(), properties)
                .profileFingerprint(profile));
  }

  @Test
  void passiveHistoryIsNotCountedAsIntentButSavedAndNegativeStateRemainSignals() {
    var passive =
        new UserProfileSnapshot(
            true,
            true,
            Set.of(),
            Set.of(),
            Map.of(),
            Set.of("a"),
            Set.of(),
            Set.of(),
            Set.of(),
            Instant.EPOCH);
    assertThat(passive.personalizationSignalCount(false)).isZero();
    assertThat(passive.personalizationSignalCount(true)).isEqualTo(1);
    var active =
        new UserProfileSnapshot(
            true,
            true,
            Set.of(),
            Set.of(),
            Map.of(),
            Set.of("a"),
            Set.of("b"),
            Set.of(),
            Set.of("c"),
            Instant.EPOCH);
    assertThat(active.personalizationSignalCount(false)).isEqualTo(2);
  }

  @Test
  void fingerprintIsStableAcrossOrderingAndFetchTimestampButChangesOnEditOrDeletion() {
    var cache = new ExploreRecommendationCache(null, new ObjectMapper(), properties);
    var a = profile(Set.of("cafe", "beach"), Map.of("cafe", 1.0, "beach", 0.7), Instant.EPOCH);
    Map<String, Double> reverse = new LinkedHashMap<>();
    reverse.put("beach", 0.7);
    reverse.put("cafe", 1.0);
    var b = profile(new LinkedHashSet<>(List.of("beach", "cafe")), reverse, Instant.now());
    assertThat(cache.profileFingerprint(a)).isEqualTo(cache.profileFingerprint(b));
    assertThat(cache.profileFingerprint(a))
        .isNotEqualTo(
            cache.profileFingerprint(profile(Set.of("cafe"), Map.of("cafe", 1.0), Instant.EPOCH)));
    assertThat(cache.profileFingerprint(a))
        .isNotEqualTo(cache.profileFingerprint(UserProfileSnapshot.coldStart(true)));
    var disliked =
        new UserProfileSnapshot(
            true,
            true,
            a.preferredCategories(),
            Set.of("hotel"),
            a.categoryAffinities(),
            Set.of(),
            Set.of(),
            Set.of(),
            Set.of(),
            Instant.EPOCH);
    assertThat(cache.profileFingerprint(disliked)).isNotEqualTo(cache.profileFingerprint(a));
  }

  @Test
  @SuppressWarnings("unchecked")
  void freshAndLkgCannotCrossUserProfileQueryDestinationLimitOrOldPolicyBoundary()
      throws Exception {
    properties.getExplore().setCacheKeySecret("test-only-secret");
    StringRedisTemplate redis = mock(StringRedisTemplate.class);
    ValueOperations<String, String> values = mock(ValueOperations.class);
    ObjectMapper mapper = mock(ObjectMapper.class);
    ExploreRecommendationResult cached = mock(ExploreRecommendationResult.class);
    when(redis.opsForValue()).thenReturn(values);
    Map<String, String> storage = new HashMap<>();
    List<String> requested = new ArrayList<>();
    when(values.get(anyString()))
        .thenAnswer(
            invocation -> {
              String key = invocation.getArgument(0);
              requested.add(key);
              return storage.get(key);
            });
    when(mapper.readValue("cached", ExploreRecommendationResult.class)).thenReturn(cached);
    var cache = new ExploreRecommendationCache(redis, mapper, properties);
    UUID user = UUID.randomUUID();
    String fingerprint =
        cache.profileFingerprint(profile(Set.of("cafe"), Map.of("cafe", 1.0), Instant.EPOCH));
    assertThat(cache.getFresh(user, "danang", "coffee", fingerprint, 48)).isEmpty();
    String fresh = requested.getFirst();
    assertThat(fresh).startsWith("rec:explore:v3:fresh:");
    storage.put(fresh.replace("v3:", "v2:"), "cached");
    assertThat(cache.getFresh(user, "danang", "coffee", fingerprint, 48)).isEmpty();
    storage.put(fresh, "cached");
    storage.put(fresh.replace(":fresh:", ":lkg:"), "cached");
    assertThat(cache.getFresh(user, "danang", "coffee", fingerprint, 48)).contains(cached);
    assertThat(cache.getLastKnownGood(user, "danang", "coffee", fingerprint, 48)).contains(cached);
    properties.getProfile().setObservedSignalPolicyV2Enabled(false);
    var rollback = new ExploreRecommendationCache(redis, mapper, properties);
    assertThat(rollback.getFresh(user, "danang", "coffee", fingerprint, 48)).isEmpty();
    assertThat(rollback.getLastKnownGood(user, "danang", "coffee", fingerprint, 48)).isEmpty();
    properties.getProfile().setObservedSignalPolicyV2Enabled(true);
    for (boolean lkg : List.of(false, true)) {
      assertThat(read(cache, lkg, UUID.randomUUID(), "danang", "coffee", fingerprint, 48))
          .isEmpty();
      assertThat(read(cache, lkg, user, "hue", "coffee", fingerprint, 48)).isEmpty();
      assertThat(read(cache, lkg, user, "danang", "museum", fingerprint, 48)).isEmpty();
      assertThat(read(cache, lkg, user, "danang", "coffee", fingerprint, 40)).isEmpty();
      assertThat(
              read(
                  cache,
                  lkg,
                  user,
                  "danang",
                  "coffee",
                  cache.profileFingerprint(UserProfileSnapshot.coldStart(true)),
                  48))
          .isEmpty();
    }
    assertThat(requested).allMatch(key -> key.startsWith("rec:explore:v3:"));
  }

  @Test
  void emptyContextHasNoSignalsButHistoryOnlyHasEffectiveSignals() {
    assertThat(UserProfileSnapshot.coldStart(true).personalizationSignalCount()).isZero();
    var historyOnly =
        new UserProfileSnapshot(
            true,
            true,
            Set.of(),
            Set.of(),
            Map.of(),
            Set.of("p1"),
            Set.of("p1", "p2"),
            Set.of(),
            Set.of("p3"),
            Instant.EPOCH);
    assertThat(historyOnly.personalizationSignalCount()).isEqualTo(3);
    assertThat(
            profile(Set.of("cafe"), Map.of("cafe", 1.0), Instant.EPOCH)
                .personalizationSignalCount())
        .isEqualTo(1);
  }

  private static Optional<ExploreRecommendationResult> read(
      ExploreRecommendationCache cache,
      boolean lkg,
      UUID user,
      String destination,
      String query,
      String fingerprint,
      int limit) {
    return lkg
        ? cache.getLastKnownGood(user, destination, query, fingerprint, limit)
        : cache.getFresh(user, destination, query, fingerprint, limit);
  }

  private static UserProfileSnapshot profile(
      Set<String> categories, Map<String, Double> affinities, Instant time) {
    return new UserProfileSnapshot(
        true, true, categories, Set.of(), affinities, Set.of(), Set.of(), Set.of(), Set.of(), time);
  }
}
