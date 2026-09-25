package fu.tripsense.recommendation.application;

public class FeedbackConflictException extends RuntimeException {
  public FeedbackConflictException(String message) {
    super(message);
  }
}
