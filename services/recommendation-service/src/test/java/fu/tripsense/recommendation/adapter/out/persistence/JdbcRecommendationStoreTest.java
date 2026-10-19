package fu.tripsense.recommendation.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.application.FeedbackCommand;
import fu.tripsense.recommendation.application.FeedbackValidationException;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.*;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class JdbcRecommendationStoreTest {
  private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
  private final ObjectMapper mapper = new ObjectMapper();
  private final JdbcRecommendationStore store =
      new JdbcRecommendationStore(jdbc, mapper, new RecommendationProperties(), null, null);

  @Test
  void convertsInstantToJdbcTimestampForPostgresTimestamptzColumns() {
    Instant instant = Instant.parse("2026-09-25T04:11:12.260Z");

    Timestamp timestamp = JdbcRecommendationStore.sqlTimestamp(instant);

    assertThat(timestamp.toInstant()).isEqualTo(instant);
  }

  @Test
  @SuppressWarnings({"unchecked", "rawtypes"})
  void batchingPreservesEveryItemParameterAndGlobalPositionAcrossChunkBoundary() throws Exception {
    when(jdbc.batchUpdate(anyString(), org.mockito.ArgumentMatchers.<List<Object[]>>any()))
        .thenAnswer(
            invocation -> {
              List<Object[]> rows = invocation.getArgument(1);
              int[] counts = new int[rows.size()];
              Arrays.fill(counts, 1);
              return counts;
            });
    RecommendationContext context =
        new RecommendationContext(
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            "session",
            "private query",
            null,
            null,
            Set.of(),
            Set.of(),
            null,
            null,
            101);
    List<RankedCandidate> items =
        IntStream.range(0, 101)
            .mapToObj(
                index ->
                    new RankedCandidate(
                        CandidateFeatures.empty(
                            new FusedCandidate("place-" + index, null, 0.01, List.of())),
                        index / 101.0,
                        null,
                        List.of()))
            .toList();
    RecommendationResult result =
        new RecommendationResult(
            UUID.randomUUID(),
            context.requestId(),
            items,
            new AlgorithmVersions("r", "f", "e", "feature", "rank", "d"),
            List.of());

    store.record(context, result);

    ArgumentCaptor<List<Object[]>> batches = ArgumentCaptor.forClass((Class) List.class);
    ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
    verify(jdbc, times(2)).batchUpdate(sql.capture(), batches.capture());
    assertThat(batches.getAllValues()).extracting(List::size).containsExactly(100, 1);
    assertThat(sql.getAllValues())
        .allSatisfy(
            value ->
                assertThat(value)
                    .contains(
                        "INSERT INTO recommendation_impression_item",
                        "?::jsonb, ?::jsonb, ?::jsonb")
                    .doesNotContain("place-", "private query"));
    List<Object[]> rows = batches.getAllValues().stream().flatMap(List::stream).toList();
    for (int index = 0; index < items.size(); index++) {
      RankedCandidate item = items.get(index);
      assertThat(rows.get(index))
          .containsExactly(
              result.recommendationId(),
              item.features().placeId(),
              index + 1,
              item.score(),
              mapper.writeValueAsString(item.features().sourceEvidence()),
              mapper.writeValueAsString(item.features()),
              mapper.writeValueAsString(item.reasons()));
    }
    ArgumentCaptor<Object[]> header = ArgumentCaptor.forClass(Object[].class);
    verify(jdbc).update(contains("INSERT INTO recommendation_impression"), header.capture());
    assertThat(header.getValue()).hasSize(14);
    assertThat(header.getValue()[0]).isEqualTo(result.recommendationId());
    assertThat(header.getValue()[1]).isEqualTo(context.requestId());
    assertThat(header.getValue()[2]).isEqualTo(context.userId());
    assertThat(header.getValue()[3]).isEqualTo(context.tripId());
    assertThat(header.getValue()[4]).isEqualTo(context.sessionId());
    assertThat(header.getValue()[5].toString()).matches("[a-f0-9]{64}");
  }

  @Test
  void feedbackStillRejectsWrongOwnerAndWrongRankBeforeAnyWrite() throws Exception {
    UUID owner = UUID.randomUUID();
    ResultSet row = mock(ResultSet.class);
    when(row.getObject("user_id", UUID.class)).thenReturn(owner);
    when(row.getInt("position")).thenReturn(1);
    when(jdbc.query(
            anyString(),
            org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
            org.mockito.ArgumentMatchers.<Object[]>any()))
        .thenAnswer(
            invocation -> {
              RowMapper<?> rowMapper = invocation.getArgument(1);
              return List.of(rowMapper.mapRow(row, 0));
            });
    for (FeedbackCommand command :
        List.of(
            new FeedbackCommand(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "place",
                FeedbackEventType.CLICK,
                1,
                Instant.now()),
            new FeedbackCommand(
                UUID.randomUUID(),
                owner,
                UUID.randomUUID(),
                "place",
                FeedbackEventType.CLICK,
                2,
                Instant.now()))) {
      assertThatThrownBy(() -> store.recordFeedback(command, Instant.now()))
          .isInstanceOf(FeedbackValidationException.class);
    }
    verify(jdbc, never()).update(anyString(), org.mockito.ArgumentMatchers.<Object[]>any());
  }
}
