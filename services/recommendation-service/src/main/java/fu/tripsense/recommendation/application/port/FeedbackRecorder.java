package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.application.FeedbackCommand;
import fu.tripsense.recommendation.application.FeedbackRecordResult;
import java.time.Instant;
import java.util.List;

public interface FeedbackRecorder {
  void recordFeedback(FeedbackCommand command, Instant receivedAt);

  List<FeedbackRecordResult> recordFeedbackBatch(
      List<FeedbackCommand> commands, Instant receivedAt);
}
