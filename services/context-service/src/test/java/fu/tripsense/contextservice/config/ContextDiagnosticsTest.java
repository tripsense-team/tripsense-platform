package fu.tripsense.contextservice.config;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import fu.tripsense.contextservice.application.ContextDiagnostics;
import fu.tripsense.contextservice.application.PreferenceSignalReader.PreferenceSignal;
import fu.tripsense.contextservice.application.cache.*;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.*;
import org.slf4j.LoggerFactory;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class ContextDiagnosticsTest {
  private final Logger logger = (Logger) LoggerFactory.getLogger(ContextDiagnostics.class);
  private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
  private final ContextDiagnosticsFilter filter = new ContextDiagnosticsFilter(true);

  @BeforeEach
  void setup() {
    appender.start();
    logger.addAppender(appender);
  }

  @AfterEach
  void cleanup() {
    ContextDiagnostics.finish(500);
    logger.detachAppender(appender);
    appender.stop();
  }

  private MockHttpServletRequest request(String path, String id) {
    var request = new MockHttpServletRequest("GET", path);
    request.setServletPath(path);
    if (id != null) request.addHeader(ContextDiagnostics.HEADER, id);
    return request;
  }

  private String messages() {
    return String.join(
        "\n", appender.list.stream().map(ILoggingEvent::getFormattedMessage).toList());
  }

  @Test
  void keepsValidCorrelationAndCleansStateAfterSuccess() throws Exception {
    var response = new MockHttpServletResponse();
    filter.doFilter(
        request("/api/context/preferences", "context-test-123"),
        response,
        (req, res) -> {
          assertThat(ContextDiagnostics.requestId()).isEqualTo("context-test-123");
          assertThat(ContextDiagnostics.measure("context_metadata", () -> 42)).isEqualTo(42);
        });
    assertThat(response.getHeader(ContextDiagnostics.HEADER)).isEqualTo("context-test-123");
    assertThat(ContextDiagnostics.requestId()).isNull();
    assertThat(messages())
        .contains(
            "service=context-service", "phase=context_metadata", "outcome=success", "status=200");
  }

  @Test
  void invalidIdNeverAppearsInLogsAndExceptionsStillCleanScope() {
    var response = new MockHttpServletResponse();
    assertThatThrownBy(
            () ->
                filter.doFilter(
                    request("/api/context/preferences", "private\ninjected-header"),
                    response,
                    (req, res) -> {
                      throw new IOException("private-upstream-error");
                    }))
        .isInstanceOf(IOException.class);
    assertThat(response.getHeader(ContextDiagnostics.HEADER)).matches("[a-f0-9-]{36}");
    assertThat(ContextDiagnostics.requestId()).isNull();
    assertThat(messages()).contains("status=500").doesNotContain("private", "injected-header");
  }

  @Test
  void disabledAndOtherRoutesAreNotInstrumented() throws Exception {
    var response = new MockHttpServletResponse();
    filter.doFilter(
        request("/api/context/onboarding", "context-test-123"), response, (req, res) -> {});
    new ContextDiagnosticsFilter(false)
        .doFilter(request("/api/context/preferences", null), response, (req, res) -> {});
    assertThat(response.getHeader(ContextDiagnostics.HEADER)).isNull();
    assertThat(messages()).isEmpty();
  }

  @Test
  void authRejectionAndMissingIdRemainSafeAndDoNotLeakIntoNextRequest() throws Exception {
    var response = new MockHttpServletResponse();
    filter.doFilter(
        request("/api/context/preferences", null),
        response,
        (req, res) -> ((jakarta.servlet.http.HttpServletResponse) res).setStatus(401));
    assertThat(response.getHeader(ContextDiagnostics.HEADER)).matches("[a-f0-9-]{36}");
    assertThat(messages()).contains("status=401");
    assertThat(ContextDiagnostics.requestId()).isNull();
  }

  @Test
  void errorPhasesPreserveFailureAndOutsideScopeOperationsAreUnchanged() {
    assertThat(ContextDiagnostics.measure("context_metadata", () -> 7)).isEqualTo(7);
    assertThat(messages()).isEmpty();
    ContextDiagnostics.begin("context-test-123");
    var failure = new IllegalStateException("private-sql-body");
    assertThatThrownBy(
            () ->
                ContextDiagnostics.measure(
                    "context_metadata",
                    () -> {
                      throw failure;
                    }))
        .isSameAs(failure);
    ContextDiagnostics.finish(500);
    assertThat(messages()).contains("outcome=error").doesNotContain("private-sql-body");
  }

  @Test
  void threadPoolReuseAndCallerThreadAreIsolated() throws Exception {
    try (var pool = Executors.newSingleThreadExecutor()) {
      for (String id : List.of("context-first-123", "context-second-123")) {
        pool.submit(
                () -> {
                  assertThat(ContextDiagnostics.requestId()).isNull();
                  try {
                    filter.doFilter(
                        request("/api/context/preferences", id),
                        new MockHttpServletResponse(),
                        (req, res) -> assertThat(ContextDiagnostics.requestId()).isEqualTo(id));
                  } catch (Exception failure) {
                    throw new RuntimeException(failure);
                  }
                  assertThat(ContextDiagnostics.requestId()).isNull();
                })
            .get(2, TimeUnit.SECONDS);
      }
      assertThat(ContextDiagnostics.requestId()).isNull();
    }
  }

  @Test
  void facadeHitMissAndBypassTracingDoesNotChangeCallsOrLogPersonalData() {
    UUID user = UUID.randomUUID();
    var source = mock(PreferenceSnapshotSource.class);
    var cache = mock(PreferenceSnapshotCache.class);
    var revision = new PreferenceSnapshot.Revision(UUID.randomUUID(), 1, "COMPLETED", 1, "catalog");
    var snapshot =
        new PreferenceSnapshot(
            revision,
            "TRIP_PLANNING",
            List.of(
                new PreferenceSignal(
                    "FOOD_STYLE", "PRIVATE_VALUE", 1, "ONBOARDING", Instant.EPOCH)));
    when(source.revision(user)).thenReturn(revision);
    when(source.load(user, "TRIP_PLANNING")).thenReturn(snapshot);
    when(cache.enabled()).thenReturn(true);
    AtomicReference<PreferenceSnapshot> stored = new AtomicReference<>();
    when(cache.get(eq(user), eq(revision), eq("TRIP_PLANNING")))
        .thenAnswer(call -> Optional.ofNullable(stored.get()));
    doAnswer(
            call -> {
              stored.set(call.getArgument(1));
              return null;
            })
        .when(cache)
        .put(eq(user), any());
    var meters = new SimpleMeterRegistry();
    try {
      var service =
          new CachedPreferencesService(source, cache, new PreferenceCacheProperties(), meters);
      ContextDiagnostics.begin("context-test-123");
      assertThat(service.preferences(user, "TRIP_PLANNING")).isEqualTo(snapshot.signals());
      assertThat(service.preferences(user, "TRIP_PLANNING")).isEqualTo(snapshot.signals());
      verify(source, times(2)).revision(user);
      verify(source).load(user, "TRIP_PLANNING");
      verify(cache).put(user, snapshot);
      when(cache.enabled()).thenReturn(false);
      service.preferences(user, "TRIP_PLANNING");
      verify(source, times(2)).load(user, "TRIP_PLANNING");
      assertThat(messages())
          .contains(
              "context_preferences_outcome value=miss",
              "context_preferences_outcome value=hit",
              "context_preferences_outcome value=bypass",
              "phase=context_metadata",
              "phase=context_snapshot_load",
              "context_signal_count value=1")
          .doesNotContain(
              user.toString(), revision.profileId().toString(), "PRIVATE_VALUE", "FOOD_STYLE");
    } finally {
      meters.close();
    }
  }

  @Test
  void invalidPurposeAndMissingOwnerStillCannotTouchSources() {
    var source = mock(PreferenceSnapshotSource.class);
    var cache = mock(PreferenceSnapshotCache.class);
    var meters = new SimpleMeterRegistry();
    try {
      var service =
          new CachedPreferencesService(source, cache, new PreferenceCacheProperties(), meters);
      ContextDiagnostics.begin("context-test-123");
      assertThatThrownBy(() -> service.preferences(UUID.randomUUID(), "INVALID"))
          .isInstanceOf(IllegalArgumentException.class);
      assertThatThrownBy(() -> service.preferences(null, "TRIP_PLANNING"))
          .isInstanceOf(IllegalArgumentException.class);
      verifyNoInteractions(source, cache);
    } finally {
      meters.close();
    }
  }
}
