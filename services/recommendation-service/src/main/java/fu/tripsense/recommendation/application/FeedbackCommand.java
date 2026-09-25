package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.domain.FeedbackEventType;
import java.time.Instant;
import java.util.UUID;

public record FeedbackCommand(
    UUID recommendationId,
    UUID userId,
    UUID idempotencyKey,
    String placeId,
    FeedbackEventType eventType,
    int position,
    Instant occurredAt) {}
