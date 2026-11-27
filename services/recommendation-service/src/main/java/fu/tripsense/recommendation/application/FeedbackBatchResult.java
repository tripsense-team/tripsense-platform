package fu.tripsense.recommendation.application;

import java.util.List;

public record FeedbackBatchResult(
    int submitted,
    int accepted,
    int duplicate,
    int rejected,
    List<FeedbackRecordResult> results) {

  public static FeedbackBatchResult from(List<FeedbackRecordResult> results) {
    int accepted = 0;
    int duplicate = 0;
    int rejected = 0;
    for (FeedbackRecordResult result : results) {
      switch (result.status()) {
        case ACCEPTED -> accepted++;
        case DUPLICATE -> duplicate++;
        case REJECTED -> rejected++;
      }
    }
    return new FeedbackBatchResult(results.size(), accepted, duplicate, rejected, List.copyOf(results));
  }
}
