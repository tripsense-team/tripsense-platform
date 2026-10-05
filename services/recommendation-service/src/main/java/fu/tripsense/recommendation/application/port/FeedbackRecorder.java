package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.application.FeedbackCommand;
import java.time.Instant;

public interface FeedbackRecorder {
  void recordFeedback(FeedbackCommand command, Instant receivedAt);
}
