package fu.tripsense.recommendation.application;

public class FeedbackRateLimitExceededException extends RuntimeException {
  public FeedbackRateLimitExceededException() {
    super("Recommendation feedback rate limit exceeded");
  }
}
