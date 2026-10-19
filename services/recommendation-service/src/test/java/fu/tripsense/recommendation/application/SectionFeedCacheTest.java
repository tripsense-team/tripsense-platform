package fu.tripsense.recommendation.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.config.*;
import fu.tripsense.recommendation.domain.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.data.redis.connection.*;
import org.springframework.data.redis.core.*;
import org.springframework.data.redis.core.types.Expiration;
import org.springframework.data.redis.serializer.StringRedisSerializer;

class SectionFeedCacheTest {
  private final StringRedisTemplate redis = mock(StringRedisTemplate.class);
  private final ValueOperations<String, String> values = mock(ValueOperations.class);
  private final RedisConnection connection = mock(RedisConnection.class);
  private final RedisStringCommands strings = mock(RedisStringCommands.class);
  private final ObjectMapper json = spy(new ObjectMapper().findAndRegisterModules());
  private final RecommendationProperties properties = new RecommendationProperties();
  private final SectionFeedProperties settings = new SectionFeedProperties();
  private final Map<String, String> storage = new HashMap<>();
  private final UUID owner = UUID.randomUUID();
  private SectionFeedCache cache;

  @BeforeEach
  void setup() {
    properties.getExplore().setCacheKeySecret("test-private-secret");
    cache = new SectionFeedCache(redis, json, properties, settings);
    when(redis.opsForValue()).thenReturn(values);
    when(values.get(anyString())).thenAnswer(i -> storage.get(i.getArgument(0)));
    doAnswer(
            i -> {
              storage.put(i.getArgument(0), i.getArgument(1));
              return null;
            })
        .when(values)
        .set(anyString(), anyString(), any(Duration.class));
    when(redis.getStringSerializer()).thenReturn(new StringRedisSerializer());
    when(connection.stringCommands()).thenReturn(strings);
    when(strings.set(
            any(byte[].class), any(byte[].class), any(SetCondition.class), any(Expiration.class)))
        .thenReturn(true);
    when(redis.executePipelined(any(RedisCallback.class)))
        .thenAnswer(
            i -> {
              ((RedisCallback<?>) i.getArgument(0)).doInRedis(connection);
              return List.of();
            });
  }

  private SectionFeedCache.Seed seed(Instant expires) {
    return new SectionFeedCache.Seed(
        UUID.randomUUID(),
        cache.scope(owner, "owner"),
        cache.scope(owner, "danang"),
        "intent",
        expires,
        true,
        List.of(new SectionFeedCache.SeedCandidate("cafe", CandidateSource.SEMANTIC, 1, .8, null)),
        Map.of(DiscoveryCategory.CAFE, List.of("cafe")));
  }

  @Test
  void seedRoundTripsAndOwnerIdentitySurvivesAlgorithmChange() {
    var seed = seed(Instant.now().plusSeconds(300));
    assertThat(cache.seed(seed)).isTrue();
    assertThat(cache.seed(owner, seed.id())).contains(seed);
    properties.getVersions().setRanking("new-ranking");
    assertThat(cache.seed(owner, seed.id())).contains(seed);
    assertThat(cache.scope(owner, "danang")).isNotEqualTo(seed.destinationScope());
  }

  @Test
  void expiredCorruptAndOversizedSeedsAreIgnored() {
    var expired = seed(Instant.EPOCH);
    cache.seed(expired);
    assertThat(cache.seed(owner, expired.id())).isEmpty();
    storage.put("rec:explore:sections:seed:primary-v1:" + expired.id(), "{}");
    assertThat(cache.seed(owner, expired.id())).isEmpty();
    storage.put("rec:explore:sections:seed:primary-v1:" + expired.id(), "x".repeat(65537));
    assertThat(cache.seed(owner, expired.id())).isEmpty();
    settings.setSeedMaxIds(0);
    assertThat(cache.seed(seed(Instant.now().plusSeconds(100)))).isFalse();
  }

  @Test
  void legacyPolicySeedNamespaceIsNeverReused() throws Exception {
    var seed = seed(Instant.now().plusSeconds(300));
    storage.put("rec:explore:sections:seed:v1:" + seed.id(), json.writeValueAsString(seed));
    assertThat(cache.seed(owner, seed.id())).isEmpty();
  }

  @Test
  void snapshotJsonRetainsPrimaryAndSupportsLegacyPayloads() throws Exception {
    var p =
        json.readValue(
            "{\"id\":\"cafe\",\"name\":\"Cafe\",\"categories\":[\"food\",\"cafe\"],\"primaryType\":\"coffee_shop\"}",
            PlaceSnapshot.class);
    var roundTrip = json.readValue(json.writeValueAsString(p), PlaceSnapshot.class);
    assertThat(roundTrip.primaryType()).isEqualTo("coffee_shop");
    var legacy =
        json.readValue(
            "{\"id\":\"cafe\",\"name\":\"Cafe\",\"categories\":[\"food\",\"cafe\"]}",
            PlaceSnapshot.class);
    assertThat(legacy.primaryType()).isNull();
  }

  @Test
  void responseUsesOneSerializationAndTwoPipelineWritesAndRoundTrips() throws Exception {
    doAnswer(
            i -> {
              storage.put(
                  new String(i.getArgument(0, byte[].class), StandardCharsets.UTF_8),
                  new String(i.getArgument(1, byte[].class), StandardCharsets.UTF_8));
              return true;
            })
        .when(strings)
        .set(any(byte[].class), any(byte[].class), any(SetCondition.class), any(Expiration.class));
    var result =
        new RecommendationResult(
            UUID.randomUUID(),
            UUID.randomUUID(),
            List.of(),
            new AlgorithmVersions("r", "f", "e", "x", "s", "d"),
            List.of(),
            16,
            List.of(),
            0,
            Map.of());
    var response =
        new SectionFeedResult(
            null,
            Instant.now().plusSeconds(300),
            false,
            false,
            "danang",
            "GENERIC_DESTINATION",
            new ExploreRecommendationResult.Personalization(true, false, 0),
            false,
            result,
            List.of());
    cache.response("key", response);
    assertThat(cache.response("key", false)).contains(response);
    assertThat(cache.response("key", true)).contains(response);
    verify(redis, times(1)).executePipelined(any(RedisCallback.class));
    verify(json, times(1)).writeValueAsString(response);
    verify(strings, times(2))
        .set(any(byte[].class), any(byte[].class), any(SetCondition.class), any(Expiration.class));
  }
}
