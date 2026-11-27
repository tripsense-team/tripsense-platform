package fu.tripsense.recommendation.api.dto;

import fu.tripsense.recommendation.application.FeedbackRecordResult;
import fu.tripsense.recommendation.application.FeedbackRecordStatus;
import java.util.UUID;

public record FeedbackBatchItemResponse(
    UUID eventId, FeedbackRecordStatus status, String errorCode) {

  public static FeedbackBatchItemResponse from(FeedbackRecordResult result) {
    return new FeedbackBatchItemResponse(result.eventId(), result.status(), result.errorCode());
  }
}
