package fu.tripsense.recommendation.api.dto;

import fu.tripsense.recommendation.application.FeedbackBatchResult;
import java.util.List;

public record FeedbackBatchResponse(
    int submitted,
    int accepted,
    int duplicate,
    int rejected,
    List<FeedbackBatchItemResponse> results) {

  public static FeedbackBatchResponse from(FeedbackBatchResult result) {
    return new FeedbackBatchResponse(
        result.submitted(),
        result.accepted(),
        result.duplicate(),
        result.rejected(),
        result.results().stream().map(FeedbackBatchItemResponse::from).toList());
  }
}
