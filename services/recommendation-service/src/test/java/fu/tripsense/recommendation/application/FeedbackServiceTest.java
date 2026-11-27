package fu.tripsense.recommendation.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fu.tripsense.recommendation.application.port.FeedbackRecorder;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.FeedbackEventType;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class FeedbackServiceTest {
  private final FeedbackRecorder recorder = mock(FeedbackRecorder.class);
  private final FeedbackRateLimiter rateLimiter = mock(FeedbackRateLimiter.class);
  private final FeedbackObservability observability = mock(FeedbackObservability.class);
  private final FeedbackService service =
      new FeedbackService(
          recorder, new RecommendationProperties(), rateLimiter, observability);

  @Test
  void recordsValidatedFeedbackThroughPort() {
    FeedbackCommand command = command(Instant.now());

    service.record(command);

    verify(recorder).recordFeedback(any(), any());
    verify(rateLimiter).reserve(command.userId(), 1, 120);
  }

  @Test
  void rejectsFeedbackOutsideConfiguredClockWindow() {
    FeedbackCommand command = command(Instant.now().minusSeconds(601));

    assertThatThrownBy(() -> service.record(command))
        .isInstanceOf(FeedbackValidationException.class);
    verify(recorder, never()).recordFeedback(any(), any());
  }

  @Test
  void batchesOnlyWeakEventsAndPreservesInputOrder() {
    FeedbackCommand click = command(Instant.now());
    FeedbackCommand save =
        new FeedbackCommand(
            click.recommendationId(),
            click.userId(),
            UUID.randomUUID(),
            click.placeId(),
            FeedbackEventType.SAVE,
            click.position(),
            Instant.now());
    when(recorder.recordFeedbackBatch(any(), any()))
        .thenReturn(List.of(FeedbackRecordResult.accepted(click.idempotencyKey())));

    FeedbackBatchResult result = service.recordBatch(List.of(click, save));

    org.assertj.core.api.Assertions.assertThat(result.accepted()).isEqualTo(1);
    org.assertj.core.api.Assertions.assertThat(result.rejected()).isEqualTo(1);
    org.assertj.core.api.Assertions.assertThat(result.results())
        .extracting(FeedbackRecordResult::eventId)
        .containsExactly(click.idempotencyKey(), save.idempotencyKey());
    verify(rateLimiter).reserve(click.userId(), 2, 120);
  }

  @Test
  void rejectsDuplicateEventIdsBeforePersistence() {
    FeedbackCommand command = command(Instant.now());

    assertThatThrownBy(() -> service.recordBatch(List.of(command, command)))
        .isInstanceOf(FeedbackValidationException.class);

    verify(recorder, never()).recordFeedbackBatch(any(), any());
    verify(rateLimiter, never()).reserve(any(), any(Integer.class), any(Integer.class));
  }

  @Test
  void rejectsNullBatchItemsBeforeRateLimiting() {
    assertThatThrownBy(() -> service.recordBatch(java.util.Arrays.asList((FeedbackCommand) null)))
        .isInstanceOf(FeedbackValidationException.class);

    verify(recorder, never()).recordFeedbackBatch(any(), any());
    verify(rateLimiter, never()).reserve(any(), any(Integer.class), any(Integer.class));
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
