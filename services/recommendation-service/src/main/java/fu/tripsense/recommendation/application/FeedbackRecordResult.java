package fu.tripsense.recommendation.application;

import java.util.UUID;

public record FeedbackRecordResult(
    UUID eventId, FeedbackRecordStatus status, String errorCode) {

  public static FeedbackRecordResult accepted(UUID eventId) {
    return new FeedbackRecordResult(eventId, FeedbackRecordStatus.ACCEPTED, null);
  }

  public static FeedbackRecordResult duplicate(UUID eventId) {
    return new FeedbackRecordResult(eventId, FeedbackRecordStatus.DUPLICATE, null);
  }

  public static FeedbackRecordResult rejected(UUID eventId, String errorCode) {
    return new FeedbackRecordResult(eventId, FeedbackRecordStatus.REJECTED, errorCode);
  }
}
