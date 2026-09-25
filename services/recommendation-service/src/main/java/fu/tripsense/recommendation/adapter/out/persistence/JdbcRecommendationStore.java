package fu.tripsense.recommendation.adapter.out.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.application.FeedbackCommand;
import fu.tripsense.recommendation.application.FeedbackConflictException;
import fu.tripsense.recommendation.application.FeedbackValidationException;
import fu.tripsense.recommendation.application.port.FeedbackRecorder;
import fu.tripsense.recommendation.application.port.ImpressionRecorder;
import fu.tripsense.recommendation.application.port.ObservedHistoryReader;
import fu.tripsense.recommendation.application.port.PersonalizationDataEraser;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.FeedbackEventType;
import fu.tripsense.recommendation.domain.RankedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import fu.tripsense.recommendation.domain.RecommendationResult;
import fu.tripsense.recommendation.domain.UserProfileSnapshot;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JdbcRecommendationStore
    implements ImpressionRecorder,
        ObservedHistoryReader,
        FeedbackRecorder,
        PersonalizationDataEraser {
  private final JdbcTemplate jdbc;
  private final ObjectMapper objectMapper;
  private final RecommendationProperties properties;

  public JdbcRecommendationStore(
      JdbcTemplate jdbc, ObjectMapper objectMapper, RecommendationProperties properties) {
    this.jdbc = jdbc;
    this.objectMapper = objectMapper;
    this.properties = properties;
  }

  @Override
  @Transactional
  public void record(RecommendationContext context, RecommendationResult result) {
    jdbc.update(
        """
        INSERT INTO recommendation_impression
          (recommendation_id, request_id, user_id, trip_id, session_id, query_hash,
           retrieval_version, fusion_version, embedding_version, feature_version,
           ranking_version, diversity_version, degradation_codes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)
        """,
        result.recommendationId(),
        result.requestId(),
        context.userId(),
        context.tripId(),
        context.sessionId(),
        hash(context.query()),
        result.versions().retrieval(),
        result.versions().fusion(),
        result.versions().embedding(),
        result.versions().feature(),
        result.versions().ranking(),
        result.versions().diversity(),
        json(result.degradations()),
        sqlTimestamp(Instant.now()));
    for (int index = 0; index < result.items().size(); index++) {
      RankedCandidate item = result.items().get(index);
      jdbc.update(
          """
          INSERT INTO recommendation_impression_item
            (recommendation_id, place_id, position, final_score,
             source_evidence, feature_snapshot, reason_codes)
          VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb)
          """,
          result.recommendationId(),
          item.features().placeId(),
          index + 1,
          item.score(),
          json(item.features().sourceEvidence()),
          json(item.features()),
          json(item.reasons()));
    }
  }

  @Override
  @Transactional
  public void recordFeedback(FeedbackCommand command, Instant receivedAt) {
    ImpressionRow row =
        jdbc
            .query(
                """
                SELECT i.user_id, i.trip_id, i.session_id, i.ranking_version, i.feature_version,
                       item.position
                FROM recommendation_impression i
                JOIN recommendation_impression_item item
                  ON item.recommendation_id = i.recommendation_id
                WHERE i.recommendation_id = ? AND item.place_id = ?
                """,
                (rs, index) ->
                    new ImpressionRow(
                        rs.getObject("user_id", UUID.class),
                        rs.getObject("trip_id", UUID.class),
                        rs.getString("session_id"),
                        rs.getString("ranking_version"),
                        rs.getString("feature_version"),
                        rs.getInt("position")),
                command.recommendationId(),
                command.placeId())
            .stream()
            .findFirst()
            .orElseThrow(() -> new FeedbackValidationException("Recommendation item not found"));
    if (!row.userId().equals(command.userId()) || row.position() != command.position()) {
      throw new FeedbackValidationException("Feedback does not match the shown recommendation");
    }
    UUID eventId = UUID.randomUUID();
    int inserted =
        jdbc.update(
            """
          INSERT INTO recommendation_feedback_event
            (event_id, idempotency_key, recommendation_id, user_id, trip_id, session_id,
             place_id, event_type, position, occurred_at, received_at,
             ranking_version, feature_version)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (user_id, idempotency_key) DO NOTHING
          """,
            eventId,
            command.idempotencyKey(),
            command.recommendationId(),
            command.userId(),
            row.tripId(),
            row.sessionId(),
            command.placeId(),
            command.eventType().name(),
            command.position(),
            sqlTimestamp(command.occurredAt()),
            sqlTimestamp(receivedAt),
            row.rankingVersion(),
            row.featureVersion());
    if (inserted == 0) {
      FeedbackIdentity existing =
          jdbc
              .query(
                  """
                  SELECT recommendation_id, place_id, event_type, position
                  FROM recommendation_feedback_event
                  WHERE user_id = ? AND idempotency_key = ?
                  """,
                  (rs, index) ->
                      new FeedbackIdentity(
                          rs.getObject("recommendation_id", UUID.class),
                          rs.getString("place_id"),
                          FeedbackEventType.valueOf(rs.getString("event_type")),
                          rs.getInt("position")),
                  command.userId(),
                  command.idempotencyKey())
              .stream()
              .findFirst()
              .orElseThrow(() -> new IllegalStateException("Feedback idempotency lookup failed"));
      if (!existing.matches(command)) {
        throw new FeedbackConflictException(
            "Idempotency key was already used for different feedback");
      }
      return;
    }
    jdbc.update(
        """
        INSERT INTO recommendation_outbox
          (event_id, aggregate_id, event_type, schema_version, payload, occurred_at)
        VALUES (?, ?, 'RECOMMENDATION_FEEDBACK_RECORDED', 1, ?::jsonb, ?)
        """,
        UUID.randomUUID(),
        command.recommendationId(),
        json(
            Map.of(
                "eventId", eventId,
                "recommendationId", command.recommendationId(),
                "userId", command.userId(),
                "placeId", command.placeId(),
                "eventType", command.eventType(),
                "position", command.position(),
                "rankingVersion", row.rankingVersion(),
                "featureVersion", row.featureVersion())),
        sqlTimestamp(receivedAt));
  }

  @Override
  public UserProfileSnapshot read(UUID userId, boolean personalizationEnabled) {
    if (!personalizationEnabled) return UserProfileSnapshot.coldStart(false);
    Set<String> seen = new HashSet<>();
    Set<String> saved = new HashSet<>();
    Set<String> trip = new HashSet<>();
    Set<String> negative = new HashSet<>();
    jdbc.query(
        """
        SELECT item.place_id
        FROM recommendation_impression_item item
        JOIN recommendation_impression impression
          ON impression.recommendation_id = item.recommendation_id
        WHERE impression.user_id = ?
        ORDER BY impression.created_at DESC, item.position ASC
        LIMIT ?
        """,
        rs -> {
          seen.add(rs.getString("place_id"));
        },
        userId,
        properties.getFeedback().getMaxHistoryEvents());
    jdbc.query(
        """
        SELECT place_id, event_type
        FROM (
          SELECT place_id, event_type, occurred_at
          FROM recommendation_feedback_event
          WHERE user_id = ?
          ORDER BY occurred_at DESC
          LIMIT ?
        ) recent_events
        ORDER BY occurred_at ASC
        """,
        rs -> {
          String placeId = rs.getString("place_id");
          FeedbackEventType type = FeedbackEventType.valueOf(rs.getString("event_type"));
          switch (type) {
            case IMPRESSION, CLICK, DETAIL_VIEW -> seen.add(placeId);
            case SAVE -> saved.add(placeId);
            case UNSAVE -> saved.remove(placeId);
            case ADD_TO_TRIP -> trip.add(placeId);
            case REMOVE_FROM_TRIP -> trip.remove(placeId);
            case DISLIKE -> negative.add(placeId);
            case LIKE -> negative.remove(placeId);
            case BOOKING_CLICK -> seen.add(placeId);
          }
        },
        userId,
        properties.getFeedback().getMaxHistoryEvents());
    boolean available =
        !seen.isEmpty() || !saved.isEmpty() || !trip.isEmpty() || !negative.isEmpty();
    return new UserProfileSnapshot(
        available,
        true,
        Set.of(),
        Set.of(),
        Map.of(),
        seen,
        saved,
        trip,
        negative,
        available ? Instant.now() : null);
  }

  @Override
  @Transactional
  public void erase(UUID userId) {
    jdbc.update(
        """
        DELETE FROM recommendation_outbox
        WHERE aggregate_id IN (
          SELECT recommendation_id FROM recommendation_impression WHERE user_id = ?
        )
        """,
        userId);
    jdbc.update("DELETE FROM recommendation_feedback_event WHERE user_id = ?", userId);
    jdbc.update("DELETE FROM recommendation_impression WHERE user_id = ?", userId);
  }

  private String json(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Could not serialize recommendation evidence", exception);
    }
  }

  private String hash(String value) {
    if (value == null || value.isBlank()) return null;
    try {
      byte[] encoded =
          MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return java.util.HexFormat.of().formatHex(encoded);
    } catch (Exception exception) {
      throw new IllegalStateException("Could not hash recommendation query", exception);
    }
  }

  static Timestamp sqlTimestamp(Instant value) {
    return Timestamp.from(value);
  }

  private record ImpressionRow(
      UUID userId,
      UUID tripId,
      String sessionId,
      String rankingVersion,
      String featureVersion,
      int position) {}

  private record FeedbackIdentity(
      UUID recommendationId, String placeId, FeedbackEventType eventType, int position) {
    private boolean matches(FeedbackCommand command) {
      return recommendationId.equals(command.recommendationId())
          && placeId.equals(command.placeId())
          && eventType == command.eventType()
          && position == command.position();
    }
  }
}
