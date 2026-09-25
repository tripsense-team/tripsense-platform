package fu.tripsense.recommendation.security;

public class UnauthenticatedException extends RuntimeException {
  public UnauthenticatedException() {
    super("Authentication is required");
  }
}
