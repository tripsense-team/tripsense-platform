package fu.tripsense.recommendation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.AlgorithmVersions;
import fu.tripsense.recommendation.domain.RankedCandidate;
import fu.tripsense.recommendation.domain.RecommendationResult;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisPipelineException;
import org.springframework.data.redis.connection.RedisStringCommands;
import org.springframework.data.redis.connection.SetCondition;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.types.Expiration;

/** Real RedisTemplate pipeline lifecycle, mocked transport: never writes to a live Redis server. */
class ExploreCacheWriteDiagnosticsTest {
  private static final String JSON = "private-json-Đà Nẵng";
  private final RedisConnectionFactory factory = mock(RedisConnectionFactory.class);
  private final RedisConnection connection = mock(RedisConnection.class);
  private final RedisStringCommands commands = mock(RedisStringCommands.class);
  private final StringRedisTemplate redis = new StringRedisTemplate(factory);
  private final ObjectMapper mapper = mock(ObjectMapper.class);
  private final RecommendationProperties properties = new RecommendationProperties();
  private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
  private final UUID userId = UUID.randomUUID();
  private final ExploreRecommendationResult response = response(false);
  private final Logger logger = (Logger) LoggerFactory.getLogger(RequestDiagnostics.class);
  private final ListAppender<ILoggingEvent> appender = new ListAppender<>();

  @BeforeEach
  void setup() throws Exception {
    properties.getExplore().setCacheKeySecret("private-secret");
    properties.getExplore().setCacheTtl(Duration.ofMinutes(7));
    properties.getExplore().setLastKnownGoodTtl(Duration.ofHours(12));
    when(factory.getConnection()).thenReturn(connection);
    when(connection.stringCommands()).thenReturn(commands);
    when(connection.closePipeline()).thenReturn(List.of(true, true));
    when(mapper.writeValueAsString(response)).thenReturn(JSON);
    appender.start();
    logger.addAppender(appender);
    RequestDiagnostics.begin("recommendation-service", "cache-test-request", registry);
  }

  @AfterEach
  void cleanup() {
    RequestDiagnostics.finish(200);
    logger.detachAppender(appender);
    appender.stop();
    registry.close();
  }

  @Test
  void serializesOnceAndQueuesBothSetsBeforeCloseWithSameUtf8PayloadAndDistinctTtls()
      throws Exception {
    ExploreRecommendationCache cache = cache();
    put(cache, response);
    verify(mapper).writeValueAsString(response);
    var order = inOrder(mapper, connection, commands);
    order.verify(mapper).writeValueAsString(response);
    order.verify(connection).openPipeline();
    ArgumentCaptor<byte[]> keys = ArgumentCaptor.forClass(byte[].class);
    ArgumentCaptor<byte[]> payloads = ArgumentCaptor.forClass(byte[].class);
    order
        .verify(commands)
        .set(
            keys.capture(),
            payloads.capture(),
            same(SetCondition.upsert()),
            eq(Expiration.from(Duration.ofMinutes(7))));
    order
        .verify(commands)
        .set(
            keys.capture(),
            payloads.capture(),
            same(SetCondition.upsert()),
            eq(Expiration.from(Duration.ofHours(12))));
    order.verify(connection).closePipeline();
    order.verify(connection).close();
    assertThat(payloads.getAllValues().get(0))
        .isSameAs(payloads.getAllValues().get(1))
        .isEqualTo(JSON.getBytes(StandardCharsets.UTF_8));
    String freshKey = new String(keys.getAllValues().get(0), StandardCharsets.UTF_8);
    String lkgKey = new String(keys.getAllValues().get(1), StandardCharsets.UTF_8);
    assertThat(freshKey).matches("rec:explore:v3:fresh:[a-f0-9]{64}");
    assertThat(lkgKey).matches("rec:explore:v3:lkg:[a-f0-9]{64}");
    assertThat(freshKey.substring("rec:explore:v3:fresh:".length()))
        .isEqualTo(lkgKey.substring("rec:explore:v3:lkg:".length()));
    for (String phase :
        List.of(
            "cache_fresh_key",
            "cache_lkg_key",
            "cache_serialize",
            "cache_payload_encode",
            "cache_pipeline_execute")) {
      phase(phase, "success", 1);
    }
    cache.getFresh(userId, "danang", "private-query", "private-profile", 48);
    cache.getLastKnownGood(userId, "danang", "private-query", "private-profile", 48);
    verify(connection).get(keys.getAllValues().get(0));
    verify(connection).get(keys.getAllValues().get(1));
    assertPrivateDataNotLogged();
  }

  @Test
  void fullResultAndOriginalRecommendationIdRoundTripThroughExistingReadPaths() throws Exception {
    java.util.Map<String, byte[]> stored = new java.util.HashMap<>();
    when(commands.set(
            any(byte[].class),
            any(byte[].class),
            same(SetCondition.upsert()),
            any(Expiration.class)))
        .thenAnswer(
            invocation -> {
              stored.put(
                  new String(invocation.getArgument(0, byte[].class), StandardCharsets.UTF_8),
                  invocation.getArgument(1, byte[].class));
              return null;
            });
    when(connection.get(any(byte[].class)))
        .thenAnswer(
            invocation ->
                stored.get(
                    new String(invocation.getArgument(0, byte[].class), StandardCharsets.UTF_8)));
    ObjectMapper realMapper = spy(new ObjectMapper());
    ExploreRecommendationCache cache =
        new ExploreRecommendationCache(redis, realMapper, properties);
    put(cache, response);
    assertThat(cache.getFresh(userId, "danang", "private-query", "private-profile", 48))
        .contains(response);
    assertThat(cache.getLastKnownGood(userId, "danang", "private-query", "private-profile", 48))
        .contains(response);
    verify(realMapper).writeValueAsString(response);
    assertThat(stored).hasSize(2);
    assertPrivateDataNotLogged();
  }

  @Test
  void pipelineRetainsMillisecondTtlPrecision() {
    properties.getExplore().setCacheTtl(Duration.ofMillis(1500));
    put(cache(), response);
    verify(commands)
        .set(
            any(byte[].class),
            any(byte[].class),
            same(SetCondition.upsert()),
            eq(Expiration.from(Duration.ofMillis(1500))));
  }

  @Test
  void checkedSerializationFailureSkipsBothWritesWithoutRetry() throws Exception {
    when(mapper.writeValueAsString(response))
        .thenThrow(new JsonProcessingException("private-error") {});
    assertThatCode(() -> put(cache(), response)).doesNotThrowAnyException();
    verify(mapper).writeValueAsString(response);
    verifyNoInteractions(factory, connection, commands);
    phase("cache_serialize", "error", 1);
    noPhase("cache_pipeline_execute");
    assertThat(messages()).contains("name=cache_write_error value=true");
    assertPrivateDataNotLogged();
  }

  @Test
  void runtimeSerializationFailureAlsoRemainsFailOpen() throws Exception {
    when(mapper.writeValueAsString(response)).thenThrow(new IllegalStateException("private-error"));
    assertThatCode(() -> put(cache(), response)).doesNotThrowAnyException();
    verifyNoInteractions(factory, connection, commands);
    phase("cache_serialize", "error", 1);
    assertPrivateDataNotLogged();
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void immediateEnqueueFailureStillAttemptsOtherKeyAndReleasesPipeline(boolean freshFails) {
    Expiration failureTtl =
        Expiration.from(freshFails ? Duration.ofMinutes(7) : Duration.ofHours(12));
    doThrow(new IllegalStateException("private-error"))
        .when(commands)
        .set(any(byte[].class), any(byte[].class), same(SetCondition.upsert()), eq(failureTtl));
    when(connection.closePipeline()).thenReturn(List.of(true));
    assertThatCode(() -> put(cache(), response)).doesNotThrowAnyException();
    verify(commands, times(2))
        .set(
            any(byte[].class),
            any(byte[].class),
            same(SetCondition.upsert()),
            any(Expiration.class));
    verify(connection).closePipeline();
    verify(connection).close();
    assertThat(messages())
        .contains("name=cache_write_error value=true")
        .contains("name=cache_" + (freshFails ? "fresh" : "lkg") + "_enqueue_error value=true");
    assertPrivateDataNotLogged();
  }

  @Test
  void deferredPipelineFailureIsSwallowedWithoutRetryingUncertainWrites() {
    when(connection.closePipeline())
        .thenThrow(new RedisPipelineException("private-error", List.of(true, false)));
    assertThatCode(() -> put(cache(), response)).doesNotThrowAnyException();
    verify(commands, times(2))
        .set(
            any(byte[].class),
            any(byte[].class),
            same(SetCondition.upsert()),
            any(Expiration.class));
    // Spring itself makes a best-effort second close when the first close throws.
    verify(connection, atLeastOnce()).closePipeline();
    verify(connection).close();
    verify(factory).getConnection();
    phase("cache_pipeline_execute", "error", 1);
    assertThat(messages()).contains("name=cache_write_error value=true");
    assertPrivateDataNotLogged();
  }

  @Test
  void connectionFailureDoesNotFailRecommendationOrRetry() {
    when(factory.getConnection()).thenThrow(new IllegalStateException("private-error"));
    assertThatCode(() -> put(cache(), response)).doesNotThrowAnyException();
    verify(factory).getConnection();
    verifyNoInteractions(connection, commands);
    phase("cache_pipeline_execute", "error", 1);
    assertPrivateDataNotLogged();
  }

  @Test
  void openPipelineFailureReleasesConnectionAndDoesNotWrite() {
    doThrow(new IllegalStateException("private-error")).when(connection).openPipeline();
    assertThatCode(() -> put(cache(), response)).doesNotThrowAnyException();
    verify(connection).close();
    verifyNoInteractions(commands);
    phase("cache_pipeline_execute", "error", 1);
    assertPrivateDataNotLogged();
  }

  @Test
  void emptyResultAndDisabledCacheDoNotSerializeOrConnect() {
    put(cache(), response(true));
    properties.getExplore().setCacheKeySecret("");
    put(cache(), response);
    verifyNoInteractions(mapper, factory, connection, commands);
    assertThat(registry.getMeters()).isEmpty();
  }

  @Test
  void diagnosticsOffPreservesOneSerializationAndPipelineWithoutEvents() throws Exception {
    RequestDiagnostics.finish(200);
    registry.clear();
    appender.list.clear();
    put(cache(), response);
    verify(mapper).writeValueAsString(response);
    verify(connection).openPipeline();
    verify(connection).closePipeline();
    verify(commands, times(2))
        .set(
            any(byte[].class),
            any(byte[].class),
            same(SetCondition.upsert()),
            any(Expiration.class));
    assertThat(registry.getMeters()).isEmpty();
    assertThat(messages()).isEmpty();
  }

  private ExploreRecommendationCache cache() {
    return new ExploreRecommendationCache(redis, mapper, properties);
  }

  private void put(ExploreRecommendationCache cache, ExploreRecommendationResult value) {
    cache.put(userId, "danang", "private-query", "private-profile", 48, value);
  }

  private static ExploreRecommendationResult response(boolean empty) {
    RecommendationResult result =
        new RecommendationResult(
            UUID.randomUUID(),
            UUID.randomUUID(),
            empty ? List.of() : List.of(new RankedCandidate(null, 0.5, null, List.of())),
            new AlgorithmVersions("r", "f", "e", "feature", "rank", "d"),
            List.of());
    return new ExploreRecommendationResult(
        "danang",
        "private-query",
        true,
        ExploreRecommendationResult.ResultMode.GENERIC_DESTINATION,
        ExploreRecommendationResult.FallbackLevel.EXACT,
        false,
        new ExploreRecommendationResult.Personalization(false, false, 0),
        result);
  }

  private void phase(String name, String outcome, long count) {
    assertThat(
            registry
                .get("tripsense.explore.phase")
                .tags("phase", name, "outcome", outcome)
                .timer()
                .count())
        .isEqualTo(count);
  }

  private void noPhase(String name) {
    assertThat(registry.find("tripsense.explore.phase").tag("phase", name).timer()).isNull();
  }

  private String messages() {
    return appender.list.stream()
        .map(ILoggingEvent::getFormattedMessage)
        .collect(java.util.stream.Collectors.joining("\n"));
  }

  private void assertPrivateDataNotLogged() {
    assertThat(messages())
        .doesNotContain(
            JSON,
            "private-query",
            "private-profile",
            "private-secret",
            "private-error",
            "rec:explore:v3:",
            userId.toString());
  }
}
