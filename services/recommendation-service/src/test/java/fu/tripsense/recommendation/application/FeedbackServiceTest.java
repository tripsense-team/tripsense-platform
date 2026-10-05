package fu.tripsense.recommendation.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import fu.tripsense.recommendation.application.port.FeedbackRecorder;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.FeedbackEventType;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class FeedbackServiceTest {
  private final FeedbackRecorder recorder = mock(FeedbackRecorder.class);
  private final FeedbackService service =
      new FeedbackService(recorder, new RecommendationProperties());

  @Test
  void recordsValidatedFeedbackThroughPort() {
    FeedbackCommand command = command(Instant.now());

    service.record(command);

    verify(recorder).recordFeedback(any(), any());
  }

  @Test
  void rejectsFeedbackOutsideConfiguredClockWindow() {
    FeedbackCommand command = command(Instant.now().minusSeconds(601));

    assertThatThrownBy(() -> service.record(command))
        .isInstanceOf(FeedbackValidationException.class);
    verify(recorder, never()).recordFeedback(any(), any());
  }

  private FeedbackCommand command(Instant occurredAt) {
    return new FeedbackCommand(
        UUID.randomUUID(),
        UUID.randomUUID(),
        UUID.randomUUID(),
        "place-1",
        FeedbackEventType.CLICK,
        1,
        occurredAt);
  }
}
