package fu.tripsense.recommendation.application;

public class CandidateRetrievalUnavailableException extends RuntimeException {
  public CandidateRetrievalUnavailableException(Throwable cause) {
    super("No required candidate source is currently available", cause);
  }
}
