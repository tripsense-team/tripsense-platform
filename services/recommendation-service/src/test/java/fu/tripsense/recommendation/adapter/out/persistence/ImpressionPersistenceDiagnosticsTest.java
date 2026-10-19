package fu.tripsense.recommendation.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.application.RequestDiagnostics;
import fu.tripsense.recommendation.application.port.ImpressionRecorder;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.*;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.sql.BatchUpdateException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.jdbc.autoconfigure.DataSourceTransactionManagerAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.transaction.autoconfigure.TransactionAutoConfiguration;
import org.springframework.boot.transaction.autoconfigure.TransactionManagerCustomizationAutoConfiguration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

class ImpressionPersistenceDiagnosticsTest {
  private final DataSource dataSource = mock(DataSource.class);
  private final Connection connection = mock(Connection.class);
  private final PreparedStatement statement = mock(PreparedStatement.class);
  private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
  private final Logger logger = (Logger) LoggerFactory.getLogger(RequestDiagnostics.class);
  private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
  private final RecommendationContext request =
      new RecommendationContext(
          UUID.randomUUID(),
          UUID.randomUUID(),
          null,
          "private-session",
          "private-query",
          null,
          null,
          Set.of(),
          Set.of(),
          null,
          null,
          48);

  @BeforeEach
  void setup() throws SQLException {
    when(dataSource.getConnection()).thenReturn(connection);
    when(connection.getAutoCommit()).thenReturn(true);
    when(connection.prepareStatement(anyString())).thenReturn(statement);
    when(statement.getConnection()).thenReturn(connection);
    var metadata = mock(java.sql.DatabaseMetaData.class);
    when(connection.getMetaData()).thenReturn(metadata);
    when(metadata.getDatabaseProductName()).thenReturn("PostgreSQL");
    when(metadata.getDriverName()).thenReturn("PostgreSQL JDBC Driver");
    when(metadata.supportsBatchUpdates()).thenReturn(true);
    when(statement.executeUpdate()).thenReturn(1);
    AtomicInteger pending = new AtomicInteger();
    doAnswer(
            invocation -> {
              pending.incrementAndGet();
              return null;
            })
        .when(statement)
        .addBatch();
    when(statement.executeBatch())
        .thenAnswer(
            invocation -> {
              int[] counts = new int[pending.getAndSet(0)];
              Arrays.fill(counts, 1);
              return counts;
            });
    appender.start();
    logger.addAppender(appender);
    RequestDiagnostics.begin("recommendation-service", "test-impression-request", registry);
  }

  @AfterEach
  void cleanup() {
    RequestDiagnostics.finish(200);
    logger.detachAppender(appender);
    appender.stop();
    registry.close();
  }

  @Test
  void bootRegistersObserverAndMeasuresRealTransactionalProxyFor48Items() {
    runner()
        .run(
            context -> {
              assertThat(context).hasNotFailed();
              assertThat(
                      org.springframework.aop.support.AopUtils.isAopProxy(
                          context.getBean(ImpressionRecorder.class)))
                  .isTrue();
              record(context.getBean(ImpressionRecorder.class), 48);
              assertPhase("impression_transaction_begin", "success", 1);
              assertPhase("impression_header_prepare", "success", 1);
              assertPhase("impression_header_insert", "success", 1);
              assertPhase("impression_items_prepare", "success", 1);
              assertPhase("impression_items_batch_insert", "success", 1);
              assertPhase("impression_items_write", "success", 1);
              assertPhase("impression_transaction_commit", "success", 1);
              assertPhase("impression_record", "success", 1);
              assertThat(messages())
                  .contains("name=impression_items_expected value=48")
                  .contains("name=impression_batch_calls value=1")
                  .contains("name=impression_write_mode value=JDBC_BATCH")
                  .contains("name=impression_item_inserts_completed value=48")
                  .doesNotContain(
                      "private-query",
                      "private-place",
                      "private-session",
                      request.userId().toString(),
                      "INSERT INTO");
              verify(statement).executeUpdate();
              verify(statement, times(48)).addBatch();
              verify(statement).executeBatch();
              verify(connection).commit();
              verify(connection, never()).rollback();
              verify(connection).close();
            });
  }

  @Test
  void insertFailureStillRollsBackAndRecordsOnlyCompletedStatements() throws SQLException {
    when(statement.executeBatch())
        .thenThrow(
            new BatchUpdateException(
                "private-sql-failure", new int[] {1, Statement.EXECUTE_FAILED}));
    runner()
        .run(
            context -> {
              assertThatThrownBy(() -> record(context.getBean(ImpressionRecorder.class), 3))
                  .isInstanceOf(RuntimeException.class);
              assertPhase("impression_items_batch_insert", "error", 1);
              assertPhase("impression_items_write", "error", 1);
              assertPhase("impression_transaction_rollback", "success", 1);
              assertPhase("impression_record", "error", 1);
              assertThat(messages())
                  .contains("name=impression_item_inserts_completed value=0")
                  .doesNotContain("private-sql-failure");
              verify(connection).rollback();
              verify(connection, never()).commit();
            });
  }

  @Test
  void connectionFailureIsMeasuredBeforeStoreMethodCanRun() throws SQLException {
    when(dataSource.getConnection()).thenThrow(new SQLException("private-connection-failure"));
    runner()
        .run(
            context -> {
              assertThatThrownBy(() -> record(context.getBean(ImpressionRecorder.class), 1))
                  .isInstanceOf(RuntimeException.class);
              assertPhase("impression_transaction_begin", "error", 1);
              assertPhase("impression_record", "error", 1);
              assertThat(
                      registry
                          .find("tripsense.explore.phase")
                          .tag("phase", "impression_header_insert")
                          .timer())
                  .isNull();
              assertThat(messages()).doesNotContain("private-connection-failure");
            });
  }

  @Test
  void commitFailureIsNotReportedAsSuccessfulPersistence() throws SQLException {
    doThrow(new SQLException("private-commit-failure")).when(connection).commit();
    runner()
        .run(
            context -> {
              assertThatThrownBy(() -> record(context.getBean(ImpressionRecorder.class), 1))
                  .isInstanceOf(RuntimeException.class);
              assertPhase("impression_transaction_commit", "error", 1);
              assertPhase("impression_record", "error", 1);
              assertThat(messages()).doesNotContain("private-commit-failure");
            });
  }

  @Test
  void noMetricsOutsideMonitoredRequestButWritesAndCommitStillHappen() {
    RequestDiagnostics.finish(200);
    registry.clear();
    runner()
        .run(
            context -> {
              record(context.getBean(ImpressionRecorder.class), 2);
              assertThat(registry.getMeters()).isEmpty();
              verify(statement).executeUpdate();
              verify(statement).executeBatch();
              verify(connection).commit();
            });
  }

  @Test
  void unrelatedTransactionsAreNotLabeledAsImpressionWrites() {
    runner()
        .run(
            context -> {
              TransactionTemplate template =
                  new TransactionTemplate(context.getBean(PlatformTransactionManager.class));
              template.setName("unrelated.transaction");
              template.executeWithoutResult(status -> {});
              assertThat(registry.getMeters()).isEmpty();
            });
  }

  @Test
  void chunks201ItemsIntoThreeBatches() {
    runner()
        .run(
            context -> {
              record(context.getBean(ImpressionRecorder.class), 201);
              verify(statement, times(201)).addBatch();
              verify(statement, times(3)).executeBatch();
              verify(statement).executeUpdate();
              assertPhase("impression_items_batch_insert", "success", 3);
              assertThat(messages())
                  .contains("name=impression_item_inserts_completed value=201")
                  .contains("name=impression_batch_calls value=3");
              verify(connection).commit();
            });
  }

  @Test
  void emptyItemsSkipBatchButRetainHeaderAndTransaction() {
    runner()
        .run(
            context -> {
              record(context.getBean(ImpressionRecorder.class), 0);
              verify(statement).executeUpdate();
              verify(statement, never()).executeBatch();
              verify(statement, never()).addBatch();
              verify(connection).commit();
              assertThat(messages()).contains("name=impression_batch_calls value=0");
            });
  }

  @Test
  void acceptsDriverSuccessWithoutIndividualRowCounts() throws SQLException {
    when(statement.executeBatch()).thenReturn(new int[] {Statement.SUCCESS_NO_INFO});
    runner()
        .run(
            context -> {
              record(context.getBean(ImpressionRecorder.class), 1);
              verify(connection).commit();
              assertThat(messages()).contains("name=impression_item_inserts_completed value=1");
            });
  }

  @ParameterizedTest
  @ValueSource(ints = {0, Statement.EXECUTE_FAILED, 2})
  void unexpectedRowCountsRollBack(int count) throws SQLException {
    when(statement.executeBatch()).thenReturn(new int[] {count});
    runner()
        .run(
            context -> {
              assertThatThrownBy(() -> record(context.getBean(ImpressionRecorder.class), 1))
                  .isInstanceOf(IllegalStateException.class);
              verify(connection).rollback();
              verify(connection, never()).commit();
              assertPhase("impression_items_batch_insert", "error", 1);
            });
  }

  @Test
  void wrongResultCardinalityRollsBack() throws SQLException {
    when(statement.executeBatch()).thenReturn(new int[0]);
    runner()
        .run(
            context -> {
              assertThatThrownBy(() -> record(context.getBean(ImpressionRecorder.class), 1))
                  .isInstanceOf(IllegalStateException.class);
              verify(connection).rollback();
              verify(connection, never()).commit();
            });
  }

  @Test
  void failureInSecondChunkRollsBackWholeTransactionWithoutRetry() throws SQLException {
    int[] first = new int[100];
    Arrays.fill(first, 1);
    when(statement.executeBatch())
        .thenReturn(first)
        .thenThrow(new BatchUpdateException("private-batch-failure", new int[0]));
    runner()
        .run(
            context -> {
              assertThatThrownBy(() -> record(context.getBean(ImpressionRecorder.class), 101))
                  .isInstanceOf(RuntimeException.class);
              verify(statement, times(2)).executeBatch();
              verify(connection).rollback();
              verify(connection, never()).commit();
              assertThat(messages())
                  .contains("name=impression_item_inserts_completed value=100")
                  .contains("name=impression_batch_calls value=2")
                  .doesNotContain("private-batch-failure");
            });
  }

  @Test
  void driverWithoutBatchSupportUsesJdbcFallbackInSameTransaction() throws SQLException {
    when(connection.getMetaData().supportsBatchUpdates()).thenReturn(false);
    runner()
        .run(
            context -> {
              record(context.getBean(ImpressionRecorder.class), 2);
              verify(statement, times(3)).executeUpdate();
              verify(statement, never()).executeBatch();
              verify(connection).commit();
              assertThat(messages()).contains("name=impression_item_inserts_completed value=2");
            });
  }

  private ApplicationContextRunner runner() {
    return new ApplicationContextRunner()
        .withConfiguration(
            AutoConfigurations.of(
                TransactionManagerCustomizationAutoConfiguration.class,
                TransactionAutoConfiguration.class,
                DataSourceTransactionManagerAutoConfiguration.class))
        .withBean(DataSource.class, () -> dataSource)
        .withBean(ImpressionTransactionDiagnostics.class)
        .withBean(
            JdbcRecommendationStore.class,
            () ->
                new JdbcRecommendationStore(
                    new JdbcTemplate(dataSource),
                    new ObjectMapper(),
                    new RecommendationProperties(),
                    null,
                    null));
  }

  private void record(ImpressionRecorder recorder, int count) {
    List<RankedCandidate> items =
        IntStream.range(0, count)
            .mapToObj(
                index ->
                    new RankedCandidate(
                        CandidateFeatures.empty(
                            new FusedCandidate("private-place-" + index, null, 0, List.of())),
                        0.5,
                        null,
                        List.of()))
            .toList();
    RecommendationResult result =
        new RecommendationResult(
            UUID.randomUUID(),
            request.requestId(),
            items,
            new AlgorithmVersions("r", "f", "e", "feature", "rank", "d"),
            List.of());
    RequestDiagnostics.run("impression_record", () -> recorder.record(request, result));
  }

  private void assertPhase(String phase, String outcome, long count) {
    assertThat(
            registry
                .get("tripsense.explore.phase")
                .tags("phase", phase, "outcome", outcome)
                .timer()
                .count())
        .isEqualTo(count);
  }

  private String messages() {
    return appender.list.stream()
        .map(ILoggingEvent::getFormattedMessage)
        .collect(java.util.stream.Collectors.joining("\n"));
  }
}
