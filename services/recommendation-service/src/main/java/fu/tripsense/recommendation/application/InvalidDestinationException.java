package fu.tripsense.recommendation.application;

public class InvalidDestinationException extends IllegalArgumentException {
  public InvalidDestinationException() {
    super("Unsupported Explore destination");
  }
}
