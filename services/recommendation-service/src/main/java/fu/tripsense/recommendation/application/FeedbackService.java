package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.application.port.FeedbackRecorder;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.FeedbackEventType;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class FeedbackService {
  private final FeedbackRecorder recorder;
  private final RecommendationProperties properties;
  private final FeedbackRateLimiter rateLimiter;
  private final FeedbackObservability observability;
  private static final Set<FeedbackEventType> BATCH_EVENT_TYPES =
      EnumSet.of(
          FeedbackEventType.IMPRESSION,
          FeedbackEventType.CLICK,
          FeedbackEventType.DETAIL_VIEW);

  public FeedbackService(
      FeedbackRecorder recorder,
      RecommendationProperties properties,
      FeedbackRateLimiter rateLimiter,
      FeedbackObservability observability) {
    this.recorder = recorder;
    this.properties = properties;
    this.rateLimiter = rateLimiter;
    this.observability = observability;
  }

  public void record(FeedbackCommand command) {
    Instant now = Instant.now();
    validate(command, now);
    rateLimiter.reserve(
        command.userId(), 1, properties.getFeedback().getEventsPerMinute());
    recorder.recordFeedback(command, now);
    observability.recordSingle();
  }

  public FeedbackBatchResult recordBatch(List<FeedbackCommand> commands) {
    if (commands == null
        || commands.isEmpty()
        || commands.size() > properties.getFeedback().getMaxBatchSize()) {
      throw new FeedbackValidationException("Feedback batch size is invalid");
    }
    FeedbackCommand first = commands.getFirst();
    if (first == null || first.userId() == null) {
      throw new FeedbackValidationException("Feedback batch identity is invalid");
    }
    UUID userId = first.userId();
    Set<UUID> eventIds = new HashSet<>();
    for (FeedbackCommand command : commands) {
      if (command == null
          || command.idempotencyKey() == null
          || !userId.equals(command.userId())
          || !eventIds.add(command.idempotencyKey())) {
        throw new FeedbackValidationException("Feedback batch identity is invalid");
      }
    }

    rateLimiter.reserve(
        userId, commands.size(), properties.getFeedback().getEventsPerMinute());
    Instant now = Instant.now();
    List<FeedbackCommand> valid = new ArrayList<>();
    Map<UUID, FeedbackRecordResult> resultsById = new HashMap<>();
    for (FeedbackCommand command : commands) {
      if (!BATCH_EVENT_TYPES.contains(command.eventType())) {
        resultsById.put(
            command.idempotencyKey(),
            FeedbackRecordResult.rejected(command.idempotencyKey(), "INVALID_EVENT"));
        continue;
      }
      try {
        validate(command, now);
        valid.add(command);
      } catch (FeedbackValidationException exception) {
        resultsById.put(
            command.idempotencyKey(),
            FeedbackRecordResult.rejected(command.idempotencyKey(), "STALE_OR_INVALID_EVENT"));
      }
    }
    if (!valid.isEmpty()) {
      recorder
          .recordFeedbackBatch(valid, now)
          .forEach(result -> resultsById.put(result.eventId(), result));
    }
    List<FeedbackRecordResult> ordered =
        commands.stream().map(command -> resultsById.get(command.idempotencyKey())).toList();
    FeedbackBatchResult result = FeedbackBatchResult.from(ordered);
    observability.recordBatch(result);
    return result;
  }

  private void validate(FeedbackCommand command, Instant now) {
    if (command == null
        || command.recommendationId() == null
        || command.userId() == null
        || command.idempotencyKey() == null
        || command.placeId() == null
        || command.eventType() == null
        || command.occurredAt() == null
        || command.position() < 1) {
      throw new FeedbackValidationException("Feedback is invalid");
    }
    if (command.occurredAt().isAfter(now.plus(properties.getFeedback().getMaxClockSkew()))
        || command.occurredAt().isBefore(now.minus(properties.getFeedback().getMaxClockSkew()))) {
      throw new FeedbackValidationException("Feedback timestamp is outside the accepted window");
    }
  }
}
