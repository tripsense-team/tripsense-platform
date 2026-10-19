package fu.tripsense.recommendation.adapter.out.persistence;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.algorithm.feature.TemporalDecayCalculator;
import fu.tripsense.recommendation.algorithm.profile.InteractionWeightCalculator;
import fu.tripsense.recommendation.algorithm.profile.MultiTimescaleProfileComposer;
import fu.tripsense.recommendation.application.ObservedTiming;
import fu.tripsense.recommendation.application.RequestDiagnostics;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.UserProfileSnapshot;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;

class ObservedHistoryDiagnosticsTest {
  private final DataSource source = mock(DataSource.class);
  private final Connection connection = mock(Connection.class);
  private final PreparedStatement[] statements = new PreparedStatement[3];
  private final ResultSet[] rows = new ResultSet[3];
  private final UUID user = UUID.randomUUID();
  private final UUID trip = UUID.randomUUID();
  private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
  private final Logger logger = (Logger) LoggerFactory.getLogger(RequestDiagnostics.class);
  private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
  private JdbcRecommendationStore store;
  private RecommendationProperties properties;

  @BeforeEach
  void setup() throws Exception {
    when(source.getConnection()).thenReturn(connection);
    for (int i = 0; i < 3; i++) {
      statements[i] = mock(PreparedStatement.class);
      rows[i] = mock(ResultSet.class);
      when(statements[i].executeQuery()).thenReturn(rows[i]);
      when(rows[i].next()).thenReturn(true, false);
      when(rows[i].getString("place_id")).thenReturn("private-place");
    }
    when(connection.prepareStatement(anyString()))
        .thenReturn(statements[0], statements[1], statements[2]);
    when(rows[1].getString("event_type")).thenReturn("SAVE");
    when(rows[2].getString("event_type")).thenReturn("SAVE");
    when(rows[2].getTimestamp("occurred_at")).thenReturn(Timestamp.from(Instant.now()));
    when(rows[2].getString("session_id")).thenReturn("private-session");
    when(rows[2].getObject("trip_id", UUID.class)).thenReturn(trip);
    when(rows[2].getString("categories_snapshot")).thenReturn("[\"private-category\"]");
    properties = new RecommendationProperties();
    properties.getProfile().setObservedSignalPolicyV2Enabled(false);
    properties.getProfile().setTemporalDecayLambda(0);
    store =
        new JdbcRecommendationStore(
            new JdbcTemplate(source),
            new ObjectMapper(),
            properties,
            new InteractionWeightCalculator(properties, new TemporalDecayCalculator()),
            new MultiTimescaleProfileComposer(properties));
    logs.start();
    logger.addAppender(logs);
  }

  @AfterEach
  void cleanup() {
    RequestDiagnostics.finish(200);
    logger.detachAppender(logs);
    logs.stop();
    registry.close();
  }

  private void begin() {
    RequestDiagnostics.begin("recommendation-service", "observed-test-request", registry);
  }

  private UserProfileSnapshot read() {
    return store.read(user, trip, "private-session", true);
  }

  private String messages() {
    return String.join("\n", logs.list.stream().map(ILoggingEvent::getFormattedMessage).toList());
  }

  private void phase(String name, String outcome) {
    assertThat(
            registry
                .find("tripsense.explore.phase")
                .tags("phase", name, "outcome", outcome)
                .timer())
        .isNotNull()
        .satisfies(timer -> assertThat(timer.count()).isEqualTo(1));
  }

  @Test
  void intentPolicyUsesOneSharedBoundedEventQueryForStatesAndAffinity() throws Exception {
    properties.getProfile().setObservedSignalPolicyV2Enabled(true);
    when(rows[1].getObject("event_id", UUID.class)).thenReturn(new UUID(0, 1));
    when(rows[1].getObject("trip_id", UUID.class)).thenReturn(trip);
    when(rows[1].getString("session_id")).thenReturn("private-session");
    when(rows[1].getTimestamp("occurred_at")).thenReturn(Timestamp.from(Instant.now()));
    when(rows[1].getString("categories_snapshot")).thenReturn("[\"private-category\"]");
    begin();
    UserProfileSnapshot profile = ObservedTiming.measure(this::read);
    assertThat(profile.savedPlaceIds()).containsExactly("private-place");
    assertThat(profile.categoryAffinities().get("private-category")).isCloseTo(0.25, within(1e-12));
    ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
    verify(connection, times(2)).prepareStatement(sql.capture());
    assertThat(sql.getAllValues().get(1))
        .contains(
            "event.event_id",
            "event.place_id",
            "item.feature_snapshot->'place'->'categories' AS categories_snapshot",
            "WHERE event.user_id = ?",
            "ORDER BY event.occurred_at DESC, event.event_id DESC",
            "LIMIT ?");
    verify(statements[1]).setObject(1, user);
    verify(statements[1]).setObject(2, 5000);
    verify(source, times(2)).getConnection();
    verify(connection, times(2)).close();
    verify(statements[2], never()).executeQuery();
    phase("observed_affinity_query", "success");
    assertThat(messages())
        .contains("name=observed_signal_policy value=intent_v2")
        .doesNotContain(
            "private-", user.toString(), trip.toString(), "phase=observed_feedback_query");
  }

  @Test
  void projectedJsonPreservesLegacyCategoryCoercionAndMissingShapeFallback() throws Exception {
    ObjectMapper mapper = new ObjectMapper();
    for (String full :
        List.of(
            "{}",
            "null",
            "{\"place\":null}",
            "{\"place\":{\"categories\":null}}",
            "{\"place\":{\"categories\":{}}}",
            "{\"place\":{\"categories\":\"cafe\"}}",
            "{\"place\":{\"categories\":[\" CAFE \",\"CÀ PHÊ\",\"cafe\",null,3,true,{},[],\"\"]}}")) {
      var original = mapper.readTree(full).path("place").path("categories");
      List<String> expected = new ArrayList<>();
      if (original.isArray())
        original.forEach(
            value -> {
              String category = value.asText("").trim().toLowerCase(Locale.ROOT);
              if (!category.isBlank()) expected.add(category);
            });
      assertThat(store.categories(original.isMissingNode() ? null : original.toString()))
          .isEqualTo(expected);
    }
    assertThat(store.categories("not-json")).isEmpty();
  }

  @org.junit.jupiter.params.ParameterizedTest
  @org.junit.jupiter.params.provider.EnumSource(
      value = fu.tripsense.recommendation.domain.FeedbackEventType.class,
      names = {"IMPRESSION", "DISLIKE", "UNSAVE"})
  void rollbackKeepsLegacyExposureAndNegativeCategorySemantics(
      fu.tripsense.recommendation.domain.FeedbackEventType type) throws Exception {
    when(rows[1].getString("event_type")).thenReturn(type.name());
    when(rows[2].getString("event_type")).thenReturn(type.name());
    var profile = read();
    assertThat(profile.categoryAffinities())
        .containsEntry(
            "private-category",
            type == fu.tripsense.recommendation.domain.FeedbackEventType.IMPRESSION ? 1.0 : -1.0);
    verify(source, times(3)).getConnection();
  }

  @Test
  void measuresThreeQueriesAndKeepsParametersOrderingAndConnectionLifecycle() throws Exception {
    begin();
    UserProfileSnapshot profile = read();
    assertThat(profile.seenPlaceIds()).containsExactly("private-place");
    assertThat(profile.savedPlaceIds()).containsExactly("private-place");
    assertThat(profile.categoryAffinities()).containsEntry("private-category", 1.0);
    phase("observed_seen_query", "success");
    phase("observed_feedback_query", "success");
    phase("observed_affinity_query", "success");
    phase("observed_profile_compose", "success");
    assertThat(messages())
        .contains(
            "name=observed_seen_query_rows_processed value=1",
            "name=observed_feedback_query_rows_processed value=1",
            "name=observed_affinity_query_rows_processed value=1",
            "name=observed_snapshot_decode_count value=1",
            "name=observed_category_count value=1",
            "name=observed_connection_timing value=included_in_query")
        .doesNotContain(user.toString(), trip.toString(), "private-", "SELECT", "feature_snapshot");
    ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
    verify(connection, times(3)).prepareStatement(sql.capture());
    assertThat(sql.getAllValues().get(0)).contains("SELECT item.place_id", "LIMIT ?");
    assertThat(sql.getAllValues().get(1)).contains("recent_events", "ORDER BY occurred_at ASC");
    assertThat(sql.getAllValues().get(2))
        .contains("item.feature_snapshot->'place'->'categories' AS categories_snapshot", "LIMIT ?");
    for (int i = 0; i < 3; i++) {
      verify(statements[i]).setObject(1, user);
      verify(statements[i]).setObject(2, 5000);
      verify(statements[i]).close();
      verify(rows[i]).close();
    }
    verify(source, times(3)).getConnection();
    verify(connection, times(3)).close();
    verify(connection, never()).setAutoCommit(anyBoolean());
    verify(connection, never()).commit();
  }

  @Test
  void withoutDiagnosticsProducesSameProfileWithoutEventsOrExtraConnections() throws Exception {
    UserProfileSnapshot profile = read();
    assertThat(profile.available()).isTrue();
    assertThat(profile.seenPlaceIds()).containsExactly("private-place");
    assertThat(profile.savedPlaceIds()).containsExactly("private-place");
    assertThat(profile.categoryAffinities()).containsEntry("private-category", 1.0);
    assertThat(messages()).isEmpty();
    assertThat(registry.getMeters()).isEmpty();
    verify(source, times(3)).getConnection();
    verify(connection, times(3)).close();
  }

  @Test
  void emptyResultsReportZeroCountsAndColdProfile() throws Exception {
    for (ResultSet row : rows) when(row.next()).thenReturn(false);
    begin();
    assertThat(read()).isEqualTo(UserProfileSnapshot.coldStart(true));
    assertThat(messages())
        .contains(
            "name=observed_seen_query_rows_processed value=0",
            "name=observed_feedback_query_rows_processed value=0",
            "name=observed_affinity_query_rows_processed value=0",
            "name=observed_snapshot_decode_count value=0");
  }

  @Test
  void malformedSnapshotKeepsExistingEmptyCategoryFallback() throws Exception {
    when(rows[2].getString("categories_snapshot")).thenReturn("private-invalid-json");
    begin();
    assertThat(read().categoryAffinities()).isEmpty();
    phase("observed_affinity_query", "success");
    assertThat(messages())
        .contains("name=observed_snapshot_decode_count value=1")
        .doesNotContain("private-invalid-json");
  }

  @Test
  void queryFailurePreservesExceptionAndClosesResources() throws Exception {
    when(statements[1].executeQuery())
        .thenThrow(new SQLTransientConnectionException("private-sql-error"));
    begin();
    assertThatThrownBy(this::read).isInstanceOf(org.springframework.dao.DataAccessException.class);
    phase("observed_seen_query", "success");
    phase("observed_feedback_query", "error");
    assertThat(messages())
        .contains("name=observed_feedback_query_rows_processed value=0")
        .doesNotContain("private-sql-error", "phase=observed_affinity_query");
    verify(source, times(2)).getConnection();
    verify(connection, times(2)).close();
    verify(statements[1]).close();
  }

  @Test
  void acquisitionFailureIsReportedAsInclusiveQueryFailureWithoutRetry() throws Exception {
    when(source.getConnection())
        .thenThrow(new SQLTransientConnectionException("private-connect-error"));
    begin();
    assertThatThrownBy(this::read).isInstanceOf(org.springframework.dao.DataAccessException.class);
    phase("observed_seen_query", "error");
    assertThat(messages()).doesNotContain("private-connect-error");
    verify(source).getConnection();
    verify(connection, never()).prepareStatement(anyString());
  }

  @Test
  void failingRowIsNotCountedAsProcessedAndNextRequestHasNoResidualCounters() throws Exception {
    when(rows[0].getString("place_id")).thenThrow(new SQLException("private-row-error", "22000"));
    begin();
    assertThatThrownBy(this::read).isInstanceOf(org.springframework.dao.DataAccessException.class);
    phase("observed_seen_query", "error");
    assertThat(messages())
        .contains("name=observed_seen_query_rows_processed value=0")
        .doesNotContain("private-row-error");
    RequestDiagnostics.finish(500);
    logs.list.clear();
    when(connection.prepareStatement(anyString()))
        .thenReturn(statements[0], statements[1], statements[2]);
    for (ResultSet row : rows) when(row.next()).thenReturn(false);
    begin();
    assertThat(read().available()).isFalse();
    assertThat(messages())
        .contains(
            "name=observed_seen_query_rows_processed value=0",
            "name=observed_snapshot_decode_count value=0");
  }
}
