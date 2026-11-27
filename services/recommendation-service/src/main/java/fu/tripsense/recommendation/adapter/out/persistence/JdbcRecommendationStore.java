package fu.tripsense.recommendation.adapter.out.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.algorithm.profile.InteractionWeightCalculator;
import fu.tripsense.recommendation.algorithm.profile.MultiTimescaleProfileComposer;
import fu.tripsense.recommendation.algorithm.profile.ObservedSignalReducer;
import fu.tripsense.recommendation.algorithm.profile.ProfileSegment;
import fu.tripsense.recommendation.application.FeedbackCommand;
import fu.tripsense.recommendation.application.FeedbackConflictException;
import fu.tripsense.recommendation.application.FeedbackRecordResult;
import fu.tripsense.recommendation.application.FeedbackRecordStatus;
import fu.tripsense.recommendation.application.FeedbackValidationException;
import fu.tripsense.recommendation.application.RequestDiagnostics;
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
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JdbcRecommendationStore
    implements ImpressionRecorder,
        ObservedHistoryReader,
        FeedbackRecorder,
        PersonalizationDataEraser {
  private static final int IMPRESSION_BATCH_SIZE = 100;
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
    RequestDiagnostics.mark("impression_items_expected", result.items().size());
    RequestDiagnostics.mark("impression_write_mode", "JDBC_BATCH");
    Object[] header =
        RequestDiagnostics.measure(
            "impression_header_prepare",
            () ->
                new Object[] {
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
                  sqlTimestamp(Instant.now())
                });
    RequestDiagnostics.measure(
        "impression_header_insert",
        () ->
            jdbc.update(
                """
        INSERT INTO recommendation_impression
          (recommendation_id, request_id, user_id, trip_id, session_id, query_hash,
           retrieval_version, fusion_version, embedding_version, feature_version,
           ranking_version, diversity_version, degradation_codes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)
        """,
                header));
    RequestDiagnostics.run(
        "impression_items_write",
        () -> {
          int inserted = 0;
          int batches = 0;
          try {
            for (int offset = 0; offset < result.items().size(); offset += IMPRESSION_BATCH_SIZE) {
              int start = offset;
              int end = Math.min(offset + IMPRESSION_BATCH_SIZE, result.items().size());
              List<Object[]> parameters =
                  RequestDiagnostics.measure(
                      "impression_items_prepare",
                      () -> {
                        List<Object[]> batch = new ArrayList<>(end - start);
                        for (int index = start; index < end; index++) {
                          RankedCandidate item = result.items().get(index);
                          batch.add(
                              new Object[] {
                                result.recommendationId(),
                                item.features().placeId(),
                                index + 1,
                                item.score(),
                                json(item.features().sourceEvidence()),
                                json(item.features()),
                                json(item.reasons())
                              });
                        }
                        return batch;
                      });
              batches++;
              RequestDiagnostics.run(
                  "impression_items_batch_insert",
                  () -> {
                    int[] counts =
                        jdbc.batchUpdate(
                            """
          INSERT INTO recommendation_impression_item
            (recommendation_id, place_id, position, final_score,
             source_evidence, feature_snapshot, reason_codes)
          VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb)
          """,
                            parameters);
                    // Drivers may report success without a per-row count after batch rewriting.
                    if (counts.length != parameters.size()) {
                      throw new IllegalStateException("Unexpected impression batch result size");
                    }
                    for (int count : counts) {
                      if (count != 1 && count != Statement.SUCCESS_NO_INFO) {
                        throw new IllegalStateException("Impression batch item was not inserted");
                      }
                    }
                  });
              inserted += parameters.size();
            }
          } finally {
            // Fully verified chunks only; partial failures are unknown and may be rolled back.
            RequestDiagnostics.mark("impression_item_inserts_completed", inserted);
            RequestDiagnostics.mark("impression_batch_calls", batches);
          }
        });
  }

  @Override
  @Transactional
  public void recordFeedback(FeedbackCommand command, Instant receivedAt) {
    FeedbackRecordResult result = recordFeedbackBatch(List.of(command), receivedAt).getFirst();
    if (result.status() == FeedbackRecordStatus.REJECTED) {
      if ("IDEMPOTENCY_CONFLICT".equals(result.errorCode())) {
        throw new FeedbackConflictException(
            "Idempotency key was already used for different feedback");
      }
      throw new FeedbackValidationException("Feedback does not match the shown recommendation");
    }
  }

  @Override
  @Transactional
  public List<FeedbackRecordResult> recordFeedbackBatch(
      List<FeedbackCommand> commands, Instant receivedAt) {
    if (commands.isEmpty()) return List.of();

    UUID userId = commands.getFirst().userId();
    Map<ItemKey, ImpressionRow> impressions = readImpressionRows(userId, commands);
    Map<UUID, FeedbackRecordResult> results = new HashMap<>();
    List<PendingFeedback> pending = new ArrayList<>();
    for (FeedbackCommand command : commands) {
      ImpressionRow row =
          impressions.get(new ItemKey(command.recommendationId(), command.placeId()));
      if (row == null || row.position() != command.position()) {
        results.put(
            command.idempotencyKey(),
            FeedbackRecordResult.rejected(command.idempotencyKey(), "INVALID_EVENT"));
        continue;
      }
      pending.add(
          new PendingFeedback(
              UUID.randomUUID(), command, row, semanticDedupKey(command)));
    }

    Set<UUID> insertedEventIds = insertFeedbackRows(pending, receivedAt);
    List<PendingFeedback> inserted = new ArrayList<>();
    List<PendingFeedback> conflicted = new ArrayList<>();
    for (PendingFeedback candidate : pending) {
      if (insertedEventIds.contains(candidate.databaseEventId())) {
        inserted.add(candidate);
        results.put(
            candidate.command().idempotencyKey(),
            FeedbackRecordResult.accepted(candidate.command().idempotencyKey()));
      } else {
        conflicted.add(candidate);
      }
    }

    if (!conflicted.isEmpty()) {
      classifyConflicts(userId, conflicted, results);
    }
    if (!inserted.isEmpty()) {
      insertOutboxRows(inserted, receivedAt);
    }
    return commands.stream().map(command -> results.get(command.idempotencyKey())).toList();
  }

  private Map<ItemKey, ImpressionRow> readImpressionRows(
      UUID userId, List<FeedbackCommand> commands) {
    Map<ItemKey, FeedbackCommand> unique = new LinkedHashMap<>();
    for (FeedbackCommand command : commands) {
      unique.putIfAbsent(new ItemKey(command.recommendationId(), command.placeId()), command);
    }
    String pairs = String.join(", ", java.util.Collections.nCopies(unique.size(), "(?, ?)"));
    List<Object> arguments = new ArrayList<>();
    arguments.add(userId);
    unique.keySet().forEach(
        key -> {
          arguments.add(key.recommendationId());
          arguments.add(key.placeId());
        });
    List<ImpressionItemRow> rows =
        jdbc.query(
            """
            SELECT i.recommendation_id, item.place_id, i.trip_id, i.session_id,
                   i.ranking_version, i.feature_version, item.position
            FROM recommendation_impression i
            JOIN recommendation_impression_item item
              ON item.recommendation_id = i.recommendation_id
            WHERE i.user_id = ?
              AND (i.recommendation_id, item.place_id) IN (%s)
            """
                .formatted(pairs),
            (rs, index) ->
                new ImpressionItemRow(
                    new ItemKey(
                        rs.getObject("recommendation_id", UUID.class),
                        rs.getString("place_id")),
                    new ImpressionRow(
                        rs.getObject("trip_id", UUID.class),
                        rs.getString("session_id"),
                        rs.getString("ranking_version"),
                        rs.getString("feature_version"),
                        rs.getInt("position"))),
            arguments.toArray());
    Map<ItemKey, ImpressionRow> byItem = new HashMap<>();
    rows.forEach(row -> byItem.put(row.key(), row.impression()));
    return byItem;
  }

  private Set<UUID> insertFeedbackRows(List<PendingFeedback> pending, Instant receivedAt) {
    if (pending.isEmpty()) return Set.of();
    String values =
        String.join(
            ", ",
            java.util.Collections.nCopies(
                pending.size(), "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"));
    List<Object> arguments = new ArrayList<>(pending.size() * 14);
    for (PendingFeedback item : pending) {
      FeedbackCommand command = item.command();
      ImpressionRow row = item.impression();
      java.util.Collections.addAll(
          arguments,
          item.databaseEventId(),
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
          row.featureVersion(),
          item.dedupKey());
    }
    return new HashSet<>(
        jdbc.query(
            """
            INSERT INTO recommendation_feedback_event
              (event_id, idempotency_key, recommendation_id, user_id, trip_id, session_id,
               place_id, event_type, position, occurred_at, received_at,
               ranking_version, feature_version, dedup_key)
            VALUES %s
            ON CONFLICT DO NOTHING
            RETURNING event_id
            """
                .formatted(values),
            (rs, index) -> rs.getObject("event_id", UUID.class),
            arguments.toArray()));
  }

  private void classifyConflicts(
      UUID userId,
      List<PendingFeedback> conflicted,
      Map<UUID, FeedbackRecordResult> results) {
    String idPlaceholders =
        String.join(", ", java.util.Collections.nCopies(conflicted.size(), "?"));
    List<String> dedupKeys =
        conflicted.stream()
            .map(PendingFeedback::dedupKey)
            .filter(java.util.Objects::nonNull)
            .toList();
    String dedupPredicate =
        dedupKeys.isEmpty()
            ? "FALSE"
            : "dedup_key IN ("
                + String.join(", ", java.util.Collections.nCopies(dedupKeys.size(), "?"))
                + ")";
    List<Object> arguments = new ArrayList<>();
    arguments.add(userId);
    conflicted.forEach(item -> arguments.add(item.command().idempotencyKey()));
    arguments.addAll(dedupKeys);
    List<ExistingFeedback> existing =
        jdbc.query(
            """
            SELECT idempotency_key, recommendation_id, place_id, event_type, position,
                   occurred_at, dedup_key
            FROM recommendation_feedback_event
            WHERE user_id = ?
              AND (idempotency_key IN (%s) OR %s)
            """
                .formatted(idPlaceholders, dedupPredicate),
            (rs, index) ->
                new ExistingFeedback(
                    rs.getObject("idempotency_key", UUID.class),
                    new FeedbackIdentity(
                        rs.getObject("recommendation_id", UUID.class),
                        rs.getString("place_id"),
                        FeedbackEventType.valueOf(rs.getString("event_type")),
                        rs.getInt("position"),
                        rs.getTimestamp("occurred_at").toInstant()),
                    rs.getString("dedup_key")),
            arguments.toArray());
    Map<UUID, ExistingFeedback> byIdempotency = new HashMap<>();
    Map<String, ExistingFeedback> byDedup = new HashMap<>();
    for (ExistingFeedback row : existing) {
      byIdempotency.put(row.idempotencyKey(), row);
      if (row.dedupKey() != null) byDedup.put(row.dedupKey(), row);
    }
    for (PendingFeedback item : conflicted) {
      FeedbackCommand command = item.command();
      ExistingFeedback sameId = byIdempotency.get(command.idempotencyKey());
      if (sameId != null) {
        results.put(
            command.idempotencyKey(),
            sameId.identity().matches(command)
                ? FeedbackRecordResult.duplicate(command.idempotencyKey())
                : FeedbackRecordResult.rejected(
                    command.idempotencyKey(), "IDEMPOTENCY_CONFLICT"));
      } else if (item.dedupKey() != null && byDedup.containsKey(item.dedupKey())) {
        results.put(
            command.idempotencyKey(),
            FeedbackRecordResult.duplicate(command.idempotencyKey()));
      } else {
        results.put(
            command.idempotencyKey(),
            FeedbackRecordResult.rejected(command.idempotencyKey(), "INVALID_EVENT"));
      }
    }
  }

  private void insertOutboxRows(List<PendingFeedback> inserted, Instant receivedAt) {
    String values =
        String.join(
            ", ",
            java.util.Collections.nCopies(
                inserted.size(),
                "(?, ?, 'RECOMMENDATION_FEEDBACK_RECORDED', 1, ?::jsonb, ?)"));
    List<Object> arguments = new ArrayList<>(inserted.size() * 4);
    for (PendingFeedback item : inserted) {
      FeedbackCommand command = item.command();
      ImpressionRow row = item.impression();
      java.util.Collections.addAll(
          arguments,
          UUID.randomUUID(),
          command.recommendationId(),
          json(
              Map.of(
                  "eventId", item.databaseEventId(),
                  "recommendationId", command.recommendationId(),
                  "userId", command.userId(),
                  "placeId", command.placeId(),
                  "eventType", command.eventType(),
                  "position", command.position(),
                  "rankingVersion", row.rankingVersion(),
                  "featureVersion", row.featureVersion())),
          sqlTimestamp(receivedAt));
    }
    jdbc.update(
        """
        INSERT INTO recommendation_outbox
          (event_id, aggregate_id, event_type, schema_version, payload, occurred_at)
        VALUES %s
        """
            .formatted(values),
        arguments.toArray());
  }

  private String semanticDedupKey(FeedbackCommand command) {
    return switch (command.eventType()) {
      case IMPRESSION, CLICK, DETAIL_VIEW ->
          hash(command.recommendationId() + ":" + command.placeId() + ":" + command.eventType());
      default -> null;
    };
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
    RequestDiagnostics.mark(
        "observed_history_limit", properties.getFeedback().getMaxHistoryEvents());
    // JdbcTemplate's acquisition is inside query(); do not change connection/transaction
    // semantics solely to time it. Inclusive query phases are not server SQL execution time.
    RequestDiagnostics.mark("observed_connection_timing", "included_in_query");
    observedQuery(
        "observed_seen_query",
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
    RequestDiagnostics.mark(
        "observed_signal_policy",
        properties.getProfile().isObservedSignalPolicyV2Enabled() ? "intent_v2" : "legacy_v1");
    if (properties.getProfile().isObservedSignalPolicyV2Enabled())
      return readIntentProfile(userId, tripId, sessionId, seen);
    observedQuery(
        "observed_feedback_query",
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
    boolean diagnostic = RequestDiagnostics.requestId() != null;
    long[] decode = new long[2]; // total nanoseconds and attempted JSON decodes; never per-row logs
    try {
      observedQuery(
          "observed_affinity_query",
          """
        SELECT event.event_type, event.occurred_at, event.trip_id, event.session_id,
               item.feature_snapshot->'place'->'categories' AS categories_snapshot
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
            String snapshot = rs.getString("categories_snapshot");
            long started = diagnostic ? System.nanoTime() : 0;
            List<String> categoryValues;
            try {
              categoryValues = categories(snapshot);
            } finally {
              if (diagnostic) {
                decode[0] += System.nanoTime() - started;
                decode[1]++;
              }
            }
            for (String category : categoryValues) {
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
    } finally {
      if (diagnostic) {
        RequestDiagnostics.mark("observed_snapshot_decode_ms", decode[0] / 1_000_000);
        RequestDiagnostics.mark("observed_snapshot_decode_count", decode[1]);
      }
    }
    Map<String, Double> categoryAffinities =
        RequestDiagnostics.measure(
            "observed_profile_compose",
            () ->
                profileComposer.compose(
                    segment(longTermAffinities),
                    segment(tripAffinities),
                    segment(sessionAffinities)));
    RequestDiagnostics.mark("observed_seen_count", seen.size());
    RequestDiagnostics.mark("observed_saved_count", saved.size());
    RequestDiagnostics.mark("observed_added_to_trip_count", trip.size());
    RequestDiagnostics.mark("observed_negative_count", negative.size());
    RequestDiagnostics.mark("observed_category_count", categoryAffinities.size());
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

  private UserProfileSnapshot readIntentProfile(
      UUID userId, UUID tripId, String sessionId, Set<String> seen) {
    List<ObservedSignalReducer.Event> events = new ArrayList<>();
    boolean diagnostic = RequestDiagnostics.requestId() != null;
    long[] decode = new long[2];
    try {
      observedQuery(
          "observed_affinity_query",
          """
          SELECT event.event_id, event.place_id, event.event_type, event.occurred_at,
                 event.trip_id, event.session_id,
                 item.feature_snapshot->'place'->'categories' AS categories_snapshot
          FROM recommendation_feedback_event event
          JOIN recommendation_impression_item item
            ON item.recommendation_id = event.recommendation_id
           AND item.place_id = event.place_id
          WHERE event.user_id = ?
          ORDER BY event.occurred_at DESC, event.event_id DESC
          LIMIT ?
          """,
          rs -> {
            String projected = rs.getString("categories_snapshot");
            long started = diagnostic ? System.nanoTime() : 0;
            List<String> values;
            try {
              values = categories(projected);
            } finally {
              if (diagnostic) {
                decode[0] += System.nanoTime() - started;
                decode[1]++;
              }
            }
            events.add(
                new ObservedSignalReducer.Event(
                    rs.getObject("event_id", UUID.class),
                    rs.getString("place_id"),
                    FeedbackEventType.valueOf(rs.getString("event_type")),
                    rs.getTimestamp("occurred_at").toInstant(),
                    rs.getObject("trip_id", UUID.class),
                    rs.getString("session_id"),
                    values));
          },
          userId,
          properties.getFeedback().getMaxHistoryEvents());
    } finally {
      if (diagnostic) {
        RequestDiagnostics.mark("observed_snapshot_decode_ms", decode[0] / 1_000_000);
        RequestDiagnostics.mark("observed_snapshot_decode_count", decode[1]);
      }
    }
    // State and affinities share this one bounded event snapshot; seen impressions are a
    // separate query as before. No cross-query transaction consistency is implied.
    UserProfileSnapshot profile =
        RequestDiagnostics.measure(
            "observed_profile_compose",
            () ->
                new ObservedSignalReducer(properties, interactionWeights, profileComposer)
                    .reduce(events, seen, tripId, sessionId, Instant.now()));
    RequestDiagnostics.mark("observed_seen_count", profile.seenPlaceIds().size());
    RequestDiagnostics.mark("observed_saved_count", profile.savedPlaceIds().size());
    RequestDiagnostics.mark("observed_added_to_trip_count", profile.addedToTripPlaceIds().size());
    RequestDiagnostics.mark("observed_negative_count", profile.negativePlaceIds().size());
    RequestDiagnostics.mark("observed_category_count", profile.categoryAffinities().size());
    return profile;
  }

  private void observedQuery(
      String phase, String sql, RowCallbackHandler callback, Object... args) {
    if (RequestDiagnostics.requestId() == null) {
      jdbc.query(sql, callback, args);
      return;
    }
    long[] processed = {0};
    long[] callbackNanos = {0};
    try {
      RequestDiagnostics.run(
          phase,
          () ->
              jdbc.query(
                  sql,
                  rs -> {
                    long started = System.nanoTime();
                    try {
                      callback.processRow(rs);
                      processed[0]++;
                    } finally {
                      callbackNanos[0] += System.nanoTime() - started;
                    }
                  },
                  args));
    } finally {
      // On error this is the number of fully processed rows, not the full result size.
      RequestDiagnostics.mark(phase + "_rows_processed", processed[0]);
      RequestDiagnostics.mark(phase + "_mapping_ms", callbackNanos[0] / 1_000_000);
    }
  }

  private ProfileSegment segment(Map<String, Double> values) {
    if (values.isEmpty()) return new ProfileSegment(false, Map.of());
    double max = values.values().stream().mapToDouble(Math::abs).max().orElse(1);
    Map<String, Double> normalized = new java.util.HashMap<>();
    values.forEach(
        (category, value) -> normalized.put(category, Math.max(-1, Math.min(1, value / max))));
    return new ProfileSegment(true, normalized);
  }

  java.util.List<String> categories(String categoriesSnapshot) {
    try {
      var node = objectMapper.readTree(categoriesSnapshot);
      if (node == null) return java.util.List.of();
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
      UUID tripId,
      String sessionId,
      String rankingVersion,
      String featureVersion,
      int position) {}

  private record ItemKey(UUID recommendationId, String placeId) {}

  private record ImpressionItemRow(ItemKey key, ImpressionRow impression) {}

  private record PendingFeedback(
      UUID databaseEventId,
      FeedbackCommand command,
      ImpressionRow impression,
      String dedupKey) {}

  private record ExistingFeedback(
      UUID idempotencyKey, FeedbackIdentity identity, String dedupKey) {}

  private record FeedbackIdentity(
      UUID recommendationId,
      String placeId,
      FeedbackEventType eventType,
      int position,
      Instant occurredAt) {
    private boolean matches(FeedbackCommand command) {
      return recommendationId.equals(command.recommendationId())
          && placeId.equals(command.placeId())
          && eventType == command.eventType()
          && position == command.position()
          && occurredAt.equals(command.occurredAt());
    }
  }
}
