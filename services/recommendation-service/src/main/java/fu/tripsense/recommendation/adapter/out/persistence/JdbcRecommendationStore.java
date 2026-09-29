package fu.tripsense.recommendation.adapter.out.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.algorithm.profile.InteractionWeightCalculator;
import fu.tripsense.recommendation.algorithm.profile.MultiTimescaleProfileComposer;
import fu.tripsense.recommendation.algorithm.profile.ProfileSegment;
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
  private final InteractionWeightCalculator interactionWeights;
  private final MultiTimescaleProfileComposer profileComposer;

  public JdbcRecommendationStore(
      JdbcTemplate jdbc,
      ObjectMapper objectMapper,
      RecommendationProperties properties,
      InteractionWeightCalculator interactionWeights,
      MultiTimescaleProfileComposer profileComposer) {
    this.jdbc = jdbc;
    this.objectMapper = objectMapper;
    this.properties = properties;
    this.interactionWeights = interactionWeights;
    this.profileComposer = profileComposer;
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
  public UserProfileSnapshot read(
      UUID userId, UUID tripId, String sessionId, boolean personalizationEnabled) {
    if (!personalizationEnabled) return UserProfileSnapshot.coldStart(false);
    Set<String> seen = new HashSet<>();
    Set<String> saved = new HashSet<>();
    Set<String> trip = new HashSet<>();
    Set<String> negative = new HashSet<>();
    Map<String, Double> longTermAffinities = new java.util.HashMap<>();
    Map<String, Double> tripAffinities = new java.util.HashMap<>();
    Map<String, Double> sessionAffinities = new java.util.HashMap<>();
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
    Instant now = Instant.now();
    jdbc.query(
        """
        SELECT event.event_type, event.occurred_at, event.trip_id, event.session_id,
               item.feature_snapshot
        FROM recommendation_feedback_event event
        JOIN recommendation_impression_item item
          ON item.recommendation_id = event.recommendation_id
         AND item.place_id = event.place_id
        WHERE event.user_id = ?
        ORDER BY event.occurred_at DESC
        LIMIT ?
        """,
        rs -> {
          FeedbackEventType eventType = FeedbackEventType.valueOf(rs.getString("event_type"));
          Instant occurredAt = rs.getTimestamp("occurred_at").toInstant();
          double weight = interactionWeight(eventType, occurredAt, now);
          for (String category : categories(rs.getString("feature_snapshot"))) {
            longTermAffinities.merge(category, weight, Double::sum);
            UUID eventTripId = rs.getObject("trip_id", UUID.class);
            if (tripId != null && tripId.equals(eventTripId)) {
              tripAffinities.merge(category, weight, Double::sum);
            }
            String eventSessionId = rs.getString("session_id");
            if (sessionId != null && sessionId.equals(eventSessionId)) {
              sessionAffinities.merge(category, weight, Double::sum);
            }
          }
        },
        userId,
        properties.getFeedback().getMaxHistoryEvents());
    Map<String, Double> categoryAffinities =
        profileComposer.compose(
            segment(longTermAffinities), segment(tripAffinities), segment(sessionAffinities));
    boolean available =
        !seen.isEmpty()
            || !saved.isEmpty()
            || !trip.isEmpty()
            || !negative.isEmpty()
            || !categoryAffinities.isEmpty();
    return new UserProfileSnapshot(
        available,
        true,
        Set.of(),
        Set.of(),
        categoryAffinities,
        seen,
        saved,
        trip,
        negative,
        available ? Instant.now() : null);
  }

  private ProfileSegment segment(Map<String, Double> values) {
    if (values.isEmpty()) return new ProfileSegment(false, Map.of());
    double max = values.values().stream().mapToDouble(Math::abs).max().orElse(1);
    Map<String, Double> normalized = new java.util.HashMap<>();
    values.forEach(
        (category, value) -> normalized.put(category, Math.max(-1, Math.min(1, value / max))));
    return new ProfileSegment(true, normalized);
  }

  private java.util.List<String> categories(String featureSnapshot) {
    try {
      var node = objectMapper.readTree(featureSnapshot).path("place").path("categories");
      if (!node.isArray()) return java.util.List.of();
      java.util.List<String> values = new java.util.ArrayList<>();
      node.forEach(
          value -> {
            String category = value.asText("").trim().toLowerCase(java.util.Locale.ROOT);
            if (!category.isBlank()) values.add(category);
          });
      return values;
    } catch (RuntimeException | JsonProcessingException exception) {
      return java.util.List.of();
    }
  }

  private double interactionWeight(FeedbackEventType eventType, Instant occurredAt, Instant now) {
    RecommendationProperties.Interaction interaction =
        switch (eventType) {
          case IMPRESSION -> RecommendationProperties.Interaction.VIEW;
          case CLICK, BOOKING_CLICK -> RecommendationProperties.Interaction.CLICK;
          case DETAIL_VIEW -> RecommendationProperties.Interaction.DETAIL_VIEW;
          case LIKE -> RecommendationProperties.Interaction.LIKE;
          case SAVE, UNSAVE -> RecommendationProperties.Interaction.SAVE;
          case ADD_TO_TRIP, REMOVE_FROM_TRIP -> RecommendationProperties.Interaction.ADD_TO_TRIP;
          case DISLIKE -> RecommendationProperties.Interaction.DISLIKE;
        };
    double value = interactionWeights.weight(interaction, occurredAt, now);
    return switch (eventType) {
      case UNSAVE, REMOVE_FROM_TRIP -> -value;
      default -> value;
    };
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
