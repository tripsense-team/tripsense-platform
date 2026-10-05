package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.application.port.FeedbackRecorder;
import fu.tripsense.recommendation.config.RecommendationProperties;
import java.time.Instant;
import org.springframework.stereotype.Service;

@Service
public class FeedbackService {
  private final FeedbackRecorder recorder;
  private final RecommendationProperties properties;

  public FeedbackService(FeedbackRecorder recorder, RecommendationProperties properties) {
    this.recorder = recorder;
    this.properties = properties;
  }

  public void record(FeedbackCommand command) {
    if (command.position() < 1) {
      throw new FeedbackValidationException("Feedback position must be positive");
    }
    Instant now = Instant.now();
    if (command.occurredAt().isAfter(now.plus(properties.getFeedback().getMaxClockSkew()))
        || command.occurredAt().isBefore(now.minus(properties.getFeedback().getMaxClockSkew()))) {
      throw new FeedbackValidationException("Feedback timestamp is outside the accepted window");
    }
    recorder.recordFeedback(command, now);
  }
}
