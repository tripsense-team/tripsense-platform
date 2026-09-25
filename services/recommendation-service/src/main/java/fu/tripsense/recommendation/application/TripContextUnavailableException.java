package fu.tripsense.recommendation.application;

public class TripContextUnavailableException extends RuntimeException {
  public TripContextUnavailableException(Throwable cause) {
    super("Trip context could not be resolved", cause);
  }
}
